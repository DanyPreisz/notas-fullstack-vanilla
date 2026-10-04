import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI || "";
const dbName = process.env.MONGODB_DB || "notas";
let db;

export function isReady() {
  return Boolean(db);
}

export async function connect() {
  if (!uri) throw new Error("Falta MONGODB_URI");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  db = client.db(dbName);
  await db.collection("users").createIndex({ username: 1 }, { unique: true });
  await db.collection("notes").createIndex({ userId: 1, updatedAt: -1 });
  await db.collection("notes").createIndex({ userId: 1, category: 1 });
  console.log(`MongoDB conectado (${dbName})`);
  return db;
}

export const users = () => db.collection("users");
export const notes = () => db.collection("notes");

export function toId(value) {
  if (!ObjectId.isValid(value)) return null;
  return new ObjectId(String(value));
}

export function mapNote(doc) {
  return {
    id: String(doc._id),
    title: doc.title,
    body: doc.body,
    category: doc.category,
    pinned: Boolean(doc.pinned),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
