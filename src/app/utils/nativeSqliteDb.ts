import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from "@capacitor-community/sqlite";

const DB_NAME = "bible_plan";
const DB_VERSION = 1;

let sqliteConn: SQLiteConnection | null = null;
let dbConn: SQLiteDBConnection | null = null;
let schemaReady: Promise<void> | null = null;

function getSQLiteConnection(): SQLiteConnection {
  if (!sqliteConn) sqliteConn = new SQLiteConnection(CapacitorSQLite);
  return sqliteConn;
}

export function isNativeSqlite(): boolean {
  return Capacitor.isNativePlatform();
}

async function ensureSchema(db: SQLiteDBConnection): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS progress_actions (
      key TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      day INTEGER NOT NULL,
      reading_index INTEGER,
      completed INTEGER NOT NULL,
      reading_count REAL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_progress_actions_user_created
      ON progress_actions(user_id, created_at);

    CREATE TABLE IF NOT EXISTS kv_cache (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

export async function getNativeDb(): Promise<SQLiteDBConnection | null> {
  if (!isNativeSqlite()) return null;

  if (dbConn) return dbConn;

  const sqlite = getSQLiteConnection();
  const db = await sqlite.createConnection(DB_NAME, false, "no-encryption", DB_VERSION, false);
  await db.open();

  dbConn = db;

  if (!schemaReady) {
    schemaReady = (async () => {
      await ensureSchema(db);
    })();
  }
  await schemaReady;

  return dbConn;
}
