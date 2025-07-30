import type { DatabaseContext } from '../connection.js'
import type { DbVersionRow, Version } from '../types.js'

export class VersionRepository {
  constructor(private ctx: DatabaseContext) {}

  findById(id: number): Version | undefined {
    const row = this.ctx.db.prepare('SELECT * FROM versions WHERE id = ?').get(id) as DbVersionRow | undefined

    if (!row) return undefined

    return this.rowToVersion(row)
  }

  findByEntryAndVersion(entryId: number, version: number): Version | undefined {
    const row = this.ctx.db
      .prepare('SELECT * FROM versions WHERE entry_id = ? AND version = ?')
      .get(entryId, version) as DbVersionRow | undefined

    if (!row) return undefined

    return this.rowToVersion(row)
  }

  findAllByEntry(entryId: number): Version[] {
    const rows = this.ctx.db
      .prepare('SELECT * FROM versions WHERE entry_id = ? ORDER BY version DESC')
      .all(entryId) as DbVersionRow[]

    return rows.map((row) => this.rowToVersion(row))
  }

  getMaxVersion(entryId: number): number {
    const result = this.ctx.db
      .prepare('SELECT COALESCE(MAX(version), 0) as max_version FROM versions WHERE entry_id = ?')
      .get(entryId) as { max_version: number }

    return result.max_version
  }

  create(entryId: number, version: number, filePath: string, hash: string, description?: string): number {
    const result = this.ctx.db
      .prepare(`
        INSERT INTO versions (entry_id, version, file_path, hash, description)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(entryId, version, filePath, hash, description || null)

    return result.lastInsertRowid as number
  }

  delete(id: number): boolean {
    const result = this.ctx.db.prepare('DELETE FROM versions WHERE id = ?').run(id)
    return result.changes > 0
  }

  deleteByEntryAndVersion(entryId: number, version: number): boolean {
    const result = this.ctx.db.prepare('DELETE FROM versions WHERE entry_id = ? AND version = ?').run(entryId, version)
    return result.changes > 0
  }

  deleteAllByEntry(entryId: number): number {
    const result = this.ctx.db.prepare('DELETE FROM versions WHERE entry_id = ?').run(entryId)
    return result.changes
  }

  countByEntry(entryId: number): number {
    const result = this.ctx.db.prepare('SELECT COUNT(*) as count FROM versions WHERE entry_id = ?').get(entryId) as {
      count: number
    }

    return result.count
  }

  private rowToVersion(row: DbVersionRow): Version {
    return {
      id: row.id,
      entryId: row.entry_id,
      version: row.version,
      filePath: row.file_path,
      hash: row.hash,
      description: row.description,
      createdAt: new Date(row.created_at),
    }
  }
}
