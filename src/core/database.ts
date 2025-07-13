import { mkdirSync } from 'node:fs'
import Database from 'better-sqlite3'
import { getDbPath, getVaultDir } from './config.js'
import type { VaultEntry } from './types.js'

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
      // Initial schema
      db.exec(`
        CREATE TABLE entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project TEXT NOT NULL,
          version INTEGER NOT NULL,
          key TEXT NOT NULL,
          file_path TEXT NOT NULL,
          hash TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_project_key_version
        ON entries(project, key, version DESC);
      `)
      break
    // Future migrations will be added here:
    // case 2:
    //   db.exec('ALTER TABLE entries ADD COLUMN tags TEXT')
    //   break
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
        'Please update ccvault to the latest version.',
    )
  }
}

export function createDatabase(): DatabaseContext {
  // Ensure vault directory exists
  mkdirSync(getVaultDir(), { recursive: true })

  const db = new Database(getDbPath())
  migrate(db)

  return { db }
}

function rowToEntry(row: Record<string, unknown>): VaultEntry {
  return {
    id: row.id as number,
    project: row.project as string,
    version: row.version as number,
    key: row.key as string,
    filePath: row.file_path as string,
    hash: row.hash as string,
    description: row.description as string | undefined,
    createdAt: new Date(row.created_at as string),
  }
}

export function getLatestEntry(ctx: DatabaseContext, project: string, key: string): VaultEntry | undefined {
  const stmt = ctx.db.prepare(`
    SELECT * FROM entries
    WHERE project = ? AND key = ?
    ORDER BY version DESC
    LIMIT 1
  `)

  const row = stmt.get(project, key) as Record<string, unknown>
  return row ? rowToEntry(row) : undefined
}

export function getEntry(ctx: DatabaseContext, project: string, key: string, version: number): VaultEntry | undefined {
  const stmt = ctx.db.prepare(`
    SELECT * FROM entries
    WHERE project = ? AND key = ? AND version = ?
  `)

  const row = stmt.get(project, key, version) as Record<string, unknown>
  return row ? rowToEntry(row) : undefined
}

export function getNextVersion(ctx: DatabaseContext, project: string, key: string): number {
  const stmt = ctx.db.prepare(`
    SELECT COALESCE(MAX(version), 0) + 1 as next_version
    FROM entries
    WHERE project = ? AND key = ?
  `)

  const result = stmt.get(project, key) as { next_version: number }
  return result.next_version
}

export function insertEntry(ctx: DatabaseContext, entry: Omit<VaultEntry, 'id' | 'createdAt'>): number {
  const stmt = ctx.db.prepare(`
    INSERT INTO entries (project, version, key, file_path, hash, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    entry.project,
    entry.version,
    entry.key,
    entry.filePath,
    entry.hash,
    entry.description || null,
  )

  return result.lastInsertRowid as number
}

export function listEntries(ctx: DatabaseContext, project: string, allVersions = false): VaultEntry[] {
  let query: string

  if (allVersions) {
    query = `
      SELECT * FROM entries
      WHERE project = ?
      ORDER BY key, version DESC
    `
  } else {
    query = `
      SELECT e1.* FROM entries e1
      INNER JOIN (
        SELECT project, key, MAX(version) as max_version
        FROM entries
        WHERE project = ?
        GROUP BY project, key
      ) e2 ON e1.project = e2.project
          AND e1.key = e2.key
          AND e1.version = e2.max_version
      ORDER BY e1.key
    `
  }

  const stmt = ctx.db.prepare(query)
  const rows = stmt.all(project) as Record<string, unknown>[]

  return rows.map((row) => rowToEntry(row))
}

export function deleteEntry(ctx: DatabaseContext, project: string, key: string, version?: number): boolean {
  const stmt = version
    ? ctx.db.prepare('DELETE FROM entries WHERE project = ? AND key = ? AND version = ?')
    : ctx.db.prepare('DELETE FROM entries WHERE project = ? AND key = ?')

  const result = version ? stmt.run(project, key, version) : stmt.run(project, key)

  return result.changes > 0
}

export function closeDatabase(ctx: DatabaseContext): void {
  ctx.db.close()
}

export function clearDatabase(ctx: DatabaseContext): void {
  ctx.db.exec('DELETE FROM entries')
}
