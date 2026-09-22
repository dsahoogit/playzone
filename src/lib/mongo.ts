import { promises as fs } from "node:fs";
import path from "node:path";
import { MongoClient, type Collection, type Document } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB ?? "cricarena";

declare global {
  var __cricarenaMongoClient: MongoClient | undefined;
}

async function getCollection(name: string): Promise<Collection<Document>> {
  if (!mongoUri) throw new Error("MONGODB_URI is not configured");
  const client = globalThis.__cricarenaMongoClient ?? new MongoClient(mongoUri);
  globalThis.__cricarenaMongoClient = client;
  await client.connect();
  return client.db(databaseName).collection(name);
}

export async function readStoredArray<T>(
  collectionName: string,
  fileName: string,
): Promise<T[]> {
  if (mongoUri) {
    const collection = await getCollection(collectionName);
    return (await collection.find({}, { projection: { _id: 0 } }).toArray()) as T[];
  }

  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", fileName), "utf8")) as T[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function writeStoredArray<T>(
  collectionName: string,
  fileName: string,
  items: T[],
): Promise<void> {
  if (mongoUri) {
    const collection = await getCollection(collectionName);
    await collection.deleteMany({});
    if (items.length > 0) await collection.insertMany(items as Document[]);
    return;
  }

  const file = path.join(process.cwd(), "data", fileName);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}