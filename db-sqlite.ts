/**
 * db-sqlite.ts â€” Drop-in replacement for lowdb in dipper-ai
 *
 * Presents the EXACT same interface as lowdb:
 *   db.data.users, db.data.agents, etc.
 *   db.write() / db.read()
 *
 * But backs storage with SQLite (better-sqlite3) using WAL mode.
 * Each "table" is stored as a JSON blob in a single kv table.
 * This is intentionally simple â€” it keeps the existing route code
 * 100% unchanged while fixing the concurrent-write corruption risk.
 *
 * Upgrade path: later migrate to proper SQLite tables per entity.
 */

import Database from 'better-sqlite3';
import path from 'path';

export type DBSchema = {
  users: any[];
  agents: any[];
  conversations: any[];
  messages: any[];
  integrations: any[];
  scheduled_messages: any[];
  activity_logs: any[];
  user_memories: any[];
  automations: any[];
  automation_runs: any[];
  knowledge_sources: any[];
  agent_teams: any[];
  team_tasks: any[];
  team_task_logs: any[];
  leads: any[];
  agent_long_term_memory: any[];
  agent_metrics: any[];
  sms_optouts: any[];
  broadcasts: any[];
  approvals: any[];
  api_keys: any[];
  escalation_alerts: any[];
  [key: string]: any[];
};

const TABLES = [
  'users', 'agents', 'conversations', 'messages', 'integrations',
  'scheduled_messages', 'activity_logs', 'user_memories', 'automations',
  'automation_runs', 'knowledge_sources', 'agent_teams', 'team_tasks',
  'team_task_logs', 'leads', 'agent_long_term_memory', 'agent_metrics',
  'sms_optouts', 'broadcasts', 'approvals', 'api_keys', 'escalation_alerts',
] as const;

export function createSQLiteDB(dbPath: string) {
  const sqlite = new Database(dbPath);

  // WAL mode: multiple readers, one writer, no corruption on concurrent access
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('cache_size = 10000');
  sqlite.pragma('foreign_keys = ON');

  // Single kv table â€” each key = one "collection", value = JSON array
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '[]'
    );
  `);

  const getStmt = sqlite.prepare('SELECT value FROM kv WHERE key = ?');
  const setStmt = sqlite.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)');

  // Initialize missing tables
  const initTx = sqlite.transaction(() => {
    for (const table of TABLES) {
      const existing = getStmt.get(table);
      if (!existing) {
        setStmt.run(table, '[]');
      }
    }
  });
  initTx();

  // In-memory cache of all collections
  const cache: DBSchema = {} as DBSchema;

  // Load all collections into cache
  function loadAll() {
    for (const table of TABLES) {
      const row = getStmt.get(table) as { value: string } | undefined;
      cache[table] = row ? JSON.parse(row.value) : [];
    }
  }

  loadAll();

  // Flush cache to SQLite â€” wrapped in a transaction for atomicity
  const flushTx = sqlite.transaction(() => {
    for (const table of TABLES) {
      if (cache[table] !== undefined) {
        setStmt.run(table, JSON.stringify(cache[table]));
      }
    }
    // Also flush any dynamic keys added at runtime
    for (const key of Object.keys(cache)) {
      if (!TABLES.includes(key as any)) {
        const row = getStmt.get(key);
        if (!row) sqlite.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)').run(key, JSON.stringify(cache[key]));
        else setStmt.run(key, JSON.stringify(cache[key]));
      }
    }
  });

  // The db object â€” same shape as lowdb's Low instance
  const db = {
    data: cache,

    // Sync write â€” called by save() in server.ts
    write() {
      try {
        flushTx();
      } catch (err) {
        console.error('[SQLiteDB] write error:', err);
      }
    },

    // Sync read â€” reload from disk
    read() {
      loadAll();
    },
  };

  // Auto-flush every 5 seconds as a safety net
  setInterval(() => {
    try { flushTx(); } catch { /* ignore */ }
  }, 5000);

  console.log(`[SQLiteDB] Using SQLite at ${dbPath} (WAL mode)`);
  return db;
}

/**
 * Migrate existing dipperai.json â†’ SQLite
 * Call once during startup if the JSON file exists and SQLite is empty.
 */
export async function migrateFromJSON(jsonPath: string, db: ReturnType<typeof createSQLiteDB>) {
  const fs = await import('fs');
  if (!fs.existsSync(jsonPath)) return;

  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const json = JSON.parse(raw);
    let migrated = 0;

    for (const key of Object.keys(json)) {
      if (Array.isArray(json[key]) && json[key].length > 0) {
        // Only migrate if SQLite collection is currently empty
        if (!db.data[key] || db.data[key].length === 0) {
          db.data[key] = json[key];
          migrated++;
        }
      }
    }

    if (migrated > 0) {
      db.write();
      console.log(`[SQLiteDB] Migrated ${migrated} collections from ${jsonPath}`);
      // Rename the old JSON file so it's not loaded again
      fs.renameSync(jsonPath, jsonPath + '.migrated');
    }
  } catch (err) {
    console.warn('[SQLiteDB] Migration from JSON failed (non-fatal):', err);
  }
}
