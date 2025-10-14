import type { DatabaseContext } from '../connection.js'

interface ScopeDeleteInfo {
  entryId: number
  versionCount: number
}

export class ScopeEntryQuery {
  constructor(private ctx: DatabaseContext) {}

  // Get all entries with version count for a scope - used for deletion
  getEntriesWithVersionCount(scopeId: number): ScopeDeleteInfo[] {
    const rows = this.ctx.db
      .prepare(`
        SELECT
          e.id as entry_id,
          COUNT(v.id) as version_count
        FROM entries e
        LEFT JOIN versions v ON e.id = v.entry_id
        WHERE e.scope_id = ?
        GROUP BY e.id
      `)
      .all(scopeId) as Array<{ entry_id: number; version_count: number }>

    return rows.map((row) => ({
      entryId: row.entry_id,
      versionCount: row.version_count,
    }))
  }

  // Get total version count for a scope
  getTotalVersionCount(scopeId: number): number {
    const result = this.ctx.db
      .prepare(`
        SELECT COUNT(v.id) as total
        FROM entries e
        JOIN versions v ON e.id = v.entry_id
        WHERE e.scope_id = ?
      `)
      .get(scopeId) as { total: number }

    return result.total
  }

  // Get all scopes with their entry and version counts
  getScopesWithCounts(primaryPath: string): Array<{ scopeId: number; entryCount: number; versionCount: number }> {
    const rows = this.ctx.db
      .prepare(`
        SELECT
          s.id as scope_id,
          COUNT(DISTINCT e.id) as entry_count,
          COUNT(v.id) as version_count
        FROM scopes s
        LEFT JOIN entries e ON s.id = e.scope_id
        LEFT JOIN versions v ON e.id = v.entry_id
        WHERE s.primary_path = ?
        GROUP BY s.id
      `)
      .all(primaryPath) as Array<{ scope_id: number; entry_count: number; version_count: number }>

    return rows.map((row) => ({
      scopeId: row.scope_id,
      entryCount: row.entry_count,
      versionCount: row.version_count,
    }))
  }
}
