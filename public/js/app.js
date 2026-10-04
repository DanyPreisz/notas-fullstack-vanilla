import { api, setSession, clearSession, getToken } from "./api.js";

const authView = document.querySelector("#auth-view");
const appView = document.querySelector("#app-view");
const authForm = document.querySelector("#auth-form");
const authError = document.querySelector("#auth-error");
const authSubmit = document.querySelector("#auth-submit");
const notesEl = document.querySelector("#notes");
const categoriesEl = document.querySelector("#categories");
const noteForm = document.querySelector("#note-form");
const noteError = document.querySelector("#note-error");
const deleteBtn = document.querySelector("#delete-note");

let mode = "login";
let category = "Todas";
let query = "";
let selected = null;
let timer;

function showError(el, message) {
  el.hidden = !message;
  el.textContent = message || "";
}

function setMode(next) {
  mode = next;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
  authSubmit.textContent = mode === "login" ? "Entrar" : "Crear cuenta";
}

function blankEditor() {
  selected = null;
  noteForm.reset();
  deleteBtn.hidden = true;
  document.querySelector("#category").value = category !== "Todas" ? category : "";
}

function fillEditor(note) {
  selected = note;
  document.querySelector("#title").value = note.title;
  document.querySelector("#category").value = note.category;
  document.querySelector("#body").value = note.body;
  document.querySelector("#pinned").checked = note.pinned;
  deleteBtn.hidden = false;
}

async function loadCategories() {
  const data = await api("/api/categories");
  const items = [{ name: "Todas", count: data.categories.reduce((sum, item) => sum + item.count, 0) }, ...data.categories];
  categoriesEl.innerHTML = "";
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cat${item.name === category ? " active" : ""}`;
    button.textContent = `${item.name} (${item.count})`;
    button.addEventListener("click", async () => {
      category = item.name;
      await refresh();
    });
    categoriesEl.append(button);
  });
}

async function loadNotes() {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category !== "Todas") params.set("category", category);
  const data = await api(`/api/notes?${params}`);
  notesEl.innerHTML = "";
  if (!data.notes.length) {
    const empty = document.createElement("li");
    empty.className = "meta";
    empty.textContent = "No hay notas.";
    notesEl.append(empty);
    return;
  }
  data.notes.forEach((note) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = `note${selected && selected.id === note.id ? " active" : ""}`;
    const title = document.createElement("strong");
    title.textContent = note.pinned ? `* ${note.title}` : note.title;
    const meta = document.createElement("small");
    meta.textContent = note.category;
    button.append(title, document.createElement("br"), meta);
    button.addEventListener("click", () => {
      fillEditor(note);
      document.querySelectorAll(".note").forEach((el) => el.classList.remove("active"));
      button.classList.add("active");
    });
    li.append(button);
    notesEl.append(li);
  });
}

async function refresh() {
  await loadCategories();
  await loadNotes();
}

async function boot() {
  if (!getToken()) return;
  try {
    const { user } = await api("/api/auth/me");
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    document.querySelector("#user-name").textContent = user.username;
    await refresh();
  } catch {
    clearSession();
  }
}

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(authError, "");
  const fd = new FormData(authForm);
  try {
    const data = await api(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }),
    });
    setSession(data.token);
    authForm.reset();
    await boot();
  } catch (err) {
    showError(authError, err.message);
  }
});

document.querySelector("#logout").addEventListener("click", () => {
  clearSession();
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
});

document.querySelector("#new-note").addEventListener("click", blankEditor);

document.querySelector("#search").addEventListener("input", (event) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    query = event.target.value.trim();
    await loadNotes();
  }, 200);
});

noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(noteError, "");
  const payload = {
    title: document.querySelector("#title").value.trim(),
    body: document.querySelector("#body").value,
    category: document.querySelector("#category").value.trim(),
    pinned: document.querySelector("#pinned").checked,
  };
  try {
    const data = selected
      ? await api(`/api/notes/${selected.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await api("/api/notes", { method: "POST", body: JSON.stringify(payload) });
    selected = data.note;
    deleteBtn.hidden = false;
    await refresh();
  } catch (err) {
    showError(noteError, err.message);
  }
});

deleteBtn.addEventListener("click", async () => {
  if (!selected) return;
  await api(`/api/notes/${selected.id}`, { method: "DELETE" });
  blankEditor();
  await refresh();
});

boot();
