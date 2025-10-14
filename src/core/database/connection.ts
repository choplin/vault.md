import { mkdirSync } from 'node:fs'
import Database from 'better-sqlite3'
import { getDbPath, getVaultDir } from '../config.js'

export interface DatabaseContext {
  db: Database.Database
}

const CURRENT_VERSION = 1

function getSchemaVersion(db: Database.Database): number {
  const result = db.prepare('PRAGMA user_version').get() as { user_version: number }
  return result.user_version
}

function setSchemaVersion(db: Database.Database, version: number): void {
  db.prepare(`PRAGMA user_version = ${version}`).run()
}

function runMigration(db: Database.Database, version: number): void {
  switch (version) {
    case 1:
      // Canonical schema with scope metadata (type, primary_path, worktree_id, branch_name)
      db.transaction(() => {
        // 1. Scopes table with scope_path
        db.exec(`
          CREATE TABLE scopes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            primary_path TEXT,
            worktree_id TEXT,
            worktree_path TEXT,
            branch_name TEXT,
            scope_path TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(type, primary_path, worktree_id, branch_name),
            -- scope_path is a sanitised filesystem key; keep it unique to surface storage collisions early
            UNIQUE(scope_path)
          );

          CREATE INDEX idx_scopes_lookup ON scopes(type, primary_path, branch_name);
          CREATE INDEX idx_scopes_primary_path ON scopes(primary_path);
        `)

        // 2. Entries table (immutable)
        db.exec(`
          CREATE TABLE entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope_id INTEGER NOT NULL REFERENCES scopes(id),
            key TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(scope_id, key)
          );

          CREATE INDEX idx_entries_lookup ON entries(scope_id, key);
        `)

        // 3. Entry status table (mutable)
        db.exec(`
          CREATE TABLE entry_status (
            entry_id INTEGER PRIMARY KEY REFERENCES entries(id),
            is_archived BOOLEAN DEFAULT FALSE,
            current_version INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `)

        // 4. Versions table (immutable)
        db.exec(`
          CREATE TABLE versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER NOT NULL REFERENCES entries(id),
            version INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            hash TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(entry_id, version)
          );

          CREATE INDEX idx_versions_lookup ON versions(entry_id, version DESC);
        `)
      })()
      break
    default:
      throw new Error(`Unknown migration version: ${version}`)
  }
}

function migrate(db: Database.Database): void {
  // Get current schema version
  const currentVersion = getSchemaVersion(db)

  if (currentVersion < CURRENT_VERSION) {
    // Run migrations in order
    for (let v = currentVersion + 1; v <= CURRENT_VERSION; v++) {
      runMigration(db, v)
    }

    // Update schema version
    setSchemaVersion(db, CURRENT_VERSION)
  } else if (currentVersion > CURRENT_VERSION) {
    throw new Error(
      `Database schema version ${currentVersion} is newer than CLI version ${CURRENT_VERSION}. ` +
        'Please update vault.md to the latest version.',
    )
  }
}

export function createDatabase(dbPath?: string): DatabaseContext {
  // Only create vault directory for file-based databases
  if (!dbPath || dbPath !== ':memory:') {
    mkdirSync(getVaultDir(), { recursive: true })
  }

  const db = new Database(dbPath || getDbPath())
  migrate(db)

  return { db }
}

export function closeDatabase(ctx: DatabaseContext): void {
  ctx.db.close()
}

export function clearDatabase(ctx: DatabaseContext): void {
  ctx.db.transaction(() => {
    // Delete in order due to foreign keys
    ctx.db.exec('DELETE FROM versions')
    ctx.db.exec('DELETE FROM entry_status')
    ctx.db.exec('DELETE FROM entries')
    ctx.db.exec('DELETE FROM scopes')
  })()
}
