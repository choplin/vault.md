import type { DatabaseContext } from '../connection.js'

export class EntryVersionQuery {
  constructor(private ctx: DatabaseContext) {}

  // Get next version number for an entry
  getNextVersion(scopeId: number, key: string): number {
    const result = this.ctx.db
      .prepare(`
        SELECT COALESCE(MAX(v.version), 0) + 1 as next_version
        FROM entries e
        LEFT JOIN versions v ON e.id = v.entry_id
        WHERE e.scope_id = ? AND e.key = ?
      `)
      .get(scopeId, key) as { next_version: number }

    return result.next_version
  }

  // Check if entry exists and get its ID
  getEntryId(scopeId: number, key: string): number | undefined {
    const result = this.ctx.db.prepare('SELECT id FROM entries WHERE scope_id = ? AND key = ?').get(scopeId, key) as
      | { id: number }
      | undefined

    return result?.id
  }

  // Get all versions for a key
  getAllVersions(scopeId: number, key: string): Array<{ version: number; filePath: string; createdAt: Date }> {
    const rows = this.ctx.db
      .prepare(`
        SELECT v.version, v.file_path, v.created_at
        FROM entries e
        JOIN versions v ON e.id = v.entry_id
        WHERE e.scope_id = ? AND e.key = ?
        ORDER BY v.version DESC
      `)
      .all(scopeId, key) as Array<{ version: number; file_path: string; created_at: string }>

    return rows.map((row) => ({
      version: row.version,
      filePath: row.file_path,
      createdAt: new Date(row.created_at),
    }))
  }
}
