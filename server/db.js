import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Falta MONGODB_URI");
  process.exit(1);
}

const client = new MongoClient(uri);
const dbName = process.env.MONGODB_DB || "notas";
let db;

export async function connect() {
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
