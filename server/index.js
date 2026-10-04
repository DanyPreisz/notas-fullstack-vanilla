import { URL } from "node:url";
import { connect, users, notes, toId, mapNote } from "./db.js";
import { createApp, readJson, sendEmpty, sendJson, serveStatic } from "./http.js";
import { getUserFromRequest, hashPassword, signToken, verifyPassword } from "./middleware/auth.js";

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function usernameQuery(username) {
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, "i");
}

function requireUser(req, res) {
  const user = getUserFromRequest(req);
  if (!user) {
    sendJson(res, 401, { error: "No autenticado" });
    return null;
  }
  return user;
}

function cleanCategory(value) {
  const category = String(value || "").trim().slice(0, 32);
  return category || "General";
}

const server = createApp(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const { pathname, searchParams } = url;
  const method = req.method || "GET";

  if (!pathname.startsWith("/api/")) {
    serveStatic(req, res);
    return;
  }

  if (method === "POST" && pathname === "/api/auth/register") {
    const body = await readJson(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (!USERNAME_RE.test(username)) return sendJson(res, 400, { error: "Usuario: 3-20 caracteres, letras, numeros y _" });
    if (password.length < 6) return sendJson(res, 400, { error: "La contrasena debe tener al menos 6 caracteres" });
    if (await users().findOne({ username: usernameQuery(username) })) return sendJson(res, 409, { error: "Ese usuario ya existe" });
    const result = await users().insertOne({ username, passwordHash: hashPassword(password), createdAt: new Date() });
    const user = { id: String(result.insertedId), username };
    return sendJson(res, 201, { user, token: signToken(user) });
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const row = await users().findOne({ username: usernameQuery(username) });
    if (!row || !verifyPassword(password, row.passwordHash)) return sendJson(res, 401, { error: "Usuario o contrasena incorrectos" });
    const user = { id: String(row._id), username: row.username };
    return sendJson(res, 200, { user, token: signToken(user) });
  }

  if (method === "GET" && pathname === "/api/auth/me") {
    const user = requireUser(req, res);
    if (!user) return;
    const id = toId(user.id);
    const row = id ? await users().findOne({ _id: id }) : null;
    if (!row) return sendJson(res, 401, { error: "Usuario no encontrado" });
    return sendJson(res, 200, { user: { id: String(row._id), username: row.username } });
  }

  if (pathname === "/api/notes" || pathname.startsWith("/api/notes/") || pathname === "/api/categories") {
    const user = requireUser(req, res);
    if (!user) return;
    const userId = user.id;

    if (method === "GET" && pathname === "/api/categories") {
      const rows = await notes().aggregate([
        { $match: { userId } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).toArray();
      return sendJson(res, 200, { categories: rows.map((row) => ({ name: row._id, count: row.count })) });
    }

    if (method === "GET" && pathname === "/api/notes") {
      const q = String(searchParams.get("q") || "").trim();
      const category = String(searchParams.get("category") || "").trim();
      const query = { userId };
      if (category && category !== "Todas") query.category = category;
      if (q) {
        const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
        query.$or = [{ title: rx }, { body: rx }, { category: rx }];
      }
      const rows = await notes().find(query).sort({ pinned: -1, updatedAt: -1 }).limit(200).toArray();
      return sendJson(res, 200, { notes: rows.map(mapNote) });
    }

    if (method === "POST" && pathname === "/api/notes") {
      const body = await readJson(req);
      const title = String(body.title || "").trim();
      const text = String(body.body || "").trim();
      if (!title) return sendJson(res, 400, { error: "El titulo es obligatorio" });
      if (title.length > 120) return sendJson(res, 400, { error: "Titulo maximo 120 caracteres" });
      if (text.length > 20000) return sendJson(res, 400, { error: "Nota demasiado larga" });
      const now = new Date();
      const result = await notes().insertOne({
        userId,
        title,
        body: text,
        category: cleanCategory(body.category),
        pinned: Boolean(body.pinned),
        createdAt: now,
        updatedAt: now,
      });
      return sendJson(res, 201, { note: mapNote(await notes().findOne({ _id: result.insertedId })) });
    }

    const match = pathname.match(/^\/api\/notes\/([a-fA-F0-9]{24})$/);
    if (match) {
      const id = toId(match[1]);
      if (method === "PATCH") {
        const existing = await notes().findOne({ _id: id, userId });
        if (!existing) return sendJson(res, 404, { error: "Nota no encontrada" });
        const body = await readJson(req);
        const title = body.title !== undefined ? String(body.title).trim() : existing.title;
        const text = body.body !== undefined ? String(body.body) : existing.body;
        if (!title) return sendJson(res, 400, { error: "El titulo no puede estar vacio" });
        await notes().updateOne({ _id: id, userId }, {
          $set: {
            title,
            body: text.slice(0, 20000),
            category: body.category !== undefined ? cleanCategory(body.category) : existing.category,
            pinned: body.pinned !== undefined ? Boolean(body.pinned) : Boolean(existing.pinned),
            updatedAt: new Date(),
          },
        });
        return sendJson(res, 200, { note: mapNote(await notes().findOne({ _id: id })) });
      }
      if (method === "DELETE") {
        const result = await notes().deleteOne({ _id: id, userId });
        if (!result.deletedCount) return sendJson(res, 404, { error: "Nota no encontrada" });
        return sendEmpty(res, 204);
      }
    }
  }

  sendJson(res, 404, { error: "Ruta no encontrada" });
});

await connect();
server.listen(Number(PORT), HOST, () => {
  console.log(`Notas en http://${HOST}:${PORT}`);
});
