import { MongoClient, ServerApiVersion, Db } from 'mongodb';
import { config } from '../config';

let clientPromise: Promise<MongoClient> | null = null;
let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Simple, one-time MongoDB connection helper.
 * - Connects on first use, reuses the same client afterward.
 * - Uses the database specified in MONGODB_URI.
 */
export async function getMongoClient(): Promise<MongoClient> {
  if (client) {
    console.log("Client exists", client);
    return client;
  }

  if (!clientPromise) {
    const uri = config.mongoUri;
    console.log('[mongo] Connecting to', uri);

    // 1. Inject the Stable API Version options here
    const newClient = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });

    clientPromise = newClient.connect().then(async (c) => {
      client = c;
      const dbNameFromUri = new URL(uri).pathname.replace('/', '') || c.options.dbName || 'test';
      db = c.db(); // uses db name from URI or driver options

      // 2. Add the Ping command to confirm successful Atlas connection
      await db.command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
      console.log('[mongo] Using database:', dbNameFromUri);

      await ensureBasicIndexes();
      return c;
    }).catch((error) => {
      console.error('[mongo] Connection failed:', error);
      clientPromise = null;
      throw error;
    });
  }

  return clientPromise;
}

export async function getDatabase(): Promise<Db> {
  if (!db) {
    await getMongoClient();
  }
  if (!db) {
    throw new Error('[mongo] Database not initialized');
  }
  return db;
}

export async function closeConnection() {
  if (!client) return;
  await client.close();
  console.log('[mongo] Connection closed');
  clientPromise = null;
  client = null;
  db = null;
}

async function ensureBasicIndexes() {
  if (!db) return;

  const users = db.collection('users');
  const sessions = db.collection('sessions');
  const tasks = db.collection('tasks');
  const auditLogs = db.collection('audit_logs');

  // Google OAuth: unique on googleId, index on email
  await users.createIndex({ googleId: 1 }, { unique: true });
  await users.createIndex({ email: 1 });

  await sessions.createIndex({ userId: 1 });
  await sessions.createIndex({ expiresAt: 1 });

  await tasks.createIndex({ planId: 1 });
  await auditLogs.createIndex({ timestamp: -1 });
}