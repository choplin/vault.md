import { mkdirSync } from 'node:fs'
import Database from 'better-sqlite3'
import { DB_PATH, VAULT_DIR } from './config.js'
import type { VaultEntry } from './types.js'

export class VaultDatabase {
  private db: Database.Database

  constructor() {
    // Ensure vault directory exists
    mkdirSync(VAULT_DIR, { recursive: true })

    this.db = new Database(DB_PATH)
    this.init()
  }

  private init(): void {
    const schema = `
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        version INTEGER NOT NULL,
        key TEXT NOT NULL,
        file_path TEXT NOT NULL,
        hash TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_project_key_version
      ON entries(project, key, version DESC);
    `

    this.db.exec(schema)
  }

  getLatestEntry(project: string, key: string): VaultEntry | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM entries
      WHERE project = ? AND key = ?
      ORDER BY version DESC
      LIMIT 1
    `)

    const row = stmt.get(project, key) as Record<string, unknown>
    return row ? this.rowToEntry(row) : undefined
  }

  getEntry(project: string, key: string, version: number): VaultEntry | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM entries
      WHERE project = ? AND key = ? AND version = ?
    `)

    const row = stmt.get(project, key, version) as Record<string, unknown>
    return row ? this.rowToEntry(row) : undefined
  }

  getNextVersion(project: string, key: string): number {
    const stmt = this.db.prepare(`
      SELECT COALESCE(MAX(version), 0) + 1 as next_version
      FROM entries
      WHERE project = ? AND key = ?
    `)

    const result = stmt.get(project, key) as { next_version: number }
    return result.next_version
  }

  insertEntry(entry: Omit<VaultEntry, 'id' | 'createdAt'>): number {
    const stmt = this.db.prepare(`
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

  listEntries(project: string, allVersions = false): VaultEntry[] {
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

    const stmt = this.db.prepare(query)
    const rows = stmt.all(project) as Record<string, unknown>[]

    return rows.map((row) => this.rowToEntry(row))
  }

  deleteEntry(project: string, key: string, version?: number): boolean {
    const stmt = version
      ? this.db.prepare('DELETE FROM entries WHERE project = ? AND key = ? AND version = ?')
      : this.db.prepare('DELETE FROM entries WHERE project = ? AND key = ?')

    const result = version ? stmt.run(project, key, version) : stmt.run(project, key)

    return result.changes > 0
  }

  private rowToEntry(row: Record<string, unknown>): VaultEntry {
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

  close(): void {
    this.db.close()
  }
}
