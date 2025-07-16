import { mkdirSync } from 'node:fs'
import Database from 'better-sqlite3'
import { getDbPath, getVaultDir } from './config.js'
import { type DbScope, dbToScope, type Scope, scopeToDb } from './scope.js'

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
      // Initial schema with scopes
      db.exec(`
        -- Scopes table: Defines the context for entries
        CREATE TABLE scopes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          identifier TEXT NOT NULL,
          branch TEXT NOT NULL,
          work_path TEXT,
          remote_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(identifier, branch)
        );

        -- Create indexes
        CREATE INDEX idx_scopes_lookup ON scopes(identifier, branch);

        -- Entries table with scope_id
        CREATE TABLE entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scope_id INTEGER NOT NULL REFERENCES scopes(id),
          version INTEGER NOT NULL,
          key TEXT NOT NULL,
          file_path TEXT NOT NULL,
          hash TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(scope_id, key, version)
        );

        -- Create index
        CREATE INDEX idx_entries_lookup ON entries(scope_id, key, version DESC);
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
        'Please update vault.md to the latest version.',
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

export function getOrCreateScope(ctx: DatabaseContext, scope: Scope): number {
  const dbScope = scopeToDb(scope)

  // Try to find existing scope
  const existing = ctx.db
    .prepare(`
    SELECT id FROM scopes
    WHERE identifier = ? AND branch = ?
  `)
    .get(dbScope.identifier, dbScope.branch) as { id: number } | undefined

  if (existing) {
    // Update work_path and updated_at
    ctx.db
      .prepare(`
      UPDATE scopes
      SET work_path = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
      .run(dbScope.work_path, existing.id)
    return existing.id
  }

  // Create new scope
  const result = ctx.db
    .prepare(`
    INSERT INTO scopes (identifier, branch, work_path, remote_url)
    VALUES (?, ?, ?, ?)
  `)
    .run(dbScope.identifier, dbScope.branch, dbScope.work_path, dbScope.remote_url)

  return result.lastInsertRowid as number
}

export function getScopeById(ctx: DatabaseContext, scopeId: number): Scope | undefined {
  const row = ctx.db.prepare('SELECT * FROM scopes WHERE id = ?').get(scopeId) as DbScope | undefined
  return row ? dbToScope(row) : undefined
}

// Entry type that uses scope_id
export interface ScopedEntry {
  id: number
  scopeId: number
  version: number
  key: string
  filePath: string
  hash: string
  description?: string
  createdAt: Date
}

function rowToScopedEntry(row: Record<string, unknown>): ScopedEntry {
  return {
    id: row.id as number,
    scopeId: row.scope_id as number,
    version: row.version as number,
    key: row.key as string,
    filePath: row.file_path as string,
    hash: row.hash as string,
    description: row.description as string | undefined,
    createdAt: new Date(row.created_at as string),
  }
}

export function getLatestScopedEntry(ctx: DatabaseContext, scopeId: number, key: string): ScopedEntry | undefined {
  const stmt = ctx.db.prepare(`
    SELECT * FROM entries
    WHERE scope_id = ? AND key = ?
    ORDER BY version DESC
    LIMIT 1
  `)

  const row = stmt.get(scopeId, key) as Record<string, unknown>
  return row ? rowToScopedEntry(row) : undefined
}

export function getScopedEntry(
  ctx: DatabaseContext,
  scopeId: number,
  key: string,
  version: number,
): ScopedEntry | undefined {
  const stmt = ctx.db.prepare(`
    SELECT * FROM entries
    WHERE scope_id = ? AND key = ? AND version = ?
  `)

  const row = stmt.get(scopeId, key, version) as Record<string, unknown>
  return row ? rowToScopedEntry(row) : undefined
}

export function getNextScopedVersion(ctx: DatabaseContext, scopeId: number, key: string): number {
  const stmt = ctx.db.prepare(`
    SELECT COALESCE(MAX(version), 0) + 1 as next_version
    FROM entries
    WHERE scope_id = ? AND key = ?
  `)

  const result = stmt.get(scopeId, key) as { next_version: number }
  return result.next_version
}

export function insertScopedEntry(ctx: DatabaseContext, entry: Omit<ScopedEntry, 'id' | 'createdAt'>): number {
  const stmt = ctx.db.prepare(`
    INSERT INTO entries (scope_id, version, key, file_path, hash, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    entry.scopeId,
    entry.version,
    entry.key,
    entry.filePath,
    entry.hash,
    entry.description || null,
  )

  return result.lastInsertRowid as number
}

export function listScopedEntries(ctx: DatabaseContext, scopeId: number, allVersions = false): ScopedEntry[] {
  let query: string

  if (allVersions) {
    query = `
      SELECT * FROM entries
      WHERE scope_id = ?
      ORDER BY key, version DESC
    `
  } else {
    query = `
      SELECT e1.* FROM entries e1
      INNER JOIN (
        SELECT scope_id, key, MAX(version) as max_version
        FROM entries
        WHERE scope_id = ?
        GROUP BY scope_id, key
      ) e2 ON e1.scope_id = e2.scope_id
          AND e1.key = e2.key
          AND e1.version = e2.max_version
      ORDER BY e1.key
    `
  }

  const stmt = ctx.db.prepare(query)
  const rows = stmt.all(scopeId) as Record<string, unknown>[]

  return rows.map((row) => rowToScopedEntry(row))
}

export function deleteScopedEntry(ctx: DatabaseContext, scopeId: number, key: string, version?: number): boolean {
  const stmt = version
    ? ctx.db.prepare('DELETE FROM entries WHERE scope_id = ? AND key = ? AND version = ?')
    : ctx.db.prepare('DELETE FROM entries WHERE scope_id = ? AND key = ?')

  const result = version ? stmt.run(scopeId, key, version) : stmt.run(scopeId, key)

  return result.changes > 0
}

export function getAllScopes(ctx: DatabaseContext): Scope[] {
  const rows = ctx.db.prepare('SELECT * FROM scopes ORDER BY identifier, branch').all() as DbScope[]
  return rows.map(dbToScope)
}

export function getAllScopedEntriesGroupedByScope(ctx: DatabaseContext): Map<Scope, ScopedEntry[]> {
  const scopes = getAllScopes(ctx)
  const result = new Map<Scope, ScopedEntry[]>()

  for (const scope of scopes) {
    const scopeId = getOrCreateScope(ctx, scope)
    const entries = listScopedEntries(ctx, scopeId, false)
    result.set(scope, entries)
  }

  return result
}

export function closeDatabase(ctx: DatabaseContext): void {
  ctx.db.close()
}

export function clearDatabase(ctx: DatabaseContext): void {
  ctx.db.exec('DELETE FROM entries; DELETE FROM scopes;')
}
