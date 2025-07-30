import type { DatabaseContext } from '../connection.js'
import type { ScopedEntry } from '../types.js'

export class ScopedEntryQuery {
  constructor(private ctx: DatabaseContext) {}

  // Get latest version of an entry with all related data in one query
  getLatest(scopeId: number, key: string): ScopedEntry | undefined {
    const row = this.ctx.db
      .prepare(`
        SELECT
          e.id, e.scope_id, e.key, e.created_at as entry_created_at,
          es.is_archived, es.current_version,
          v.version, v.file_path, v.hash, v.description, v.created_at as version_created_at
        FROM entries e
        JOIN entry_status es ON e.id = es.entry_id
        JOIN versions v ON e.id = v.entry_id AND v.version = es.current_version
        WHERE e.scope_id = ? AND e.key = ?
      `)
      .get(scopeId, key) as Record<string, unknown> | undefined

    return row ? this.mapToScopedEntry(row) : undefined
  }

  // Get specific version of an entry
  getByVersion(scopeId: number, key: string, version: number): ScopedEntry | undefined {
    const row = this.ctx.db
      .prepare(`
        SELECT
          e.id, e.scope_id, e.key, e.created_at as entry_created_at,
          es.is_archived,
          v.version, v.file_path, v.hash, v.description, v.created_at as version_created_at
        FROM entries e
        JOIN entry_status es ON e.id = es.entry_id
        JOIN versions v ON e.id = v.entry_id
        WHERE e.scope_id = ? AND e.key = ? AND v.version = ?
      `)
      .get(scopeId, key, version) as Record<string, unknown> | undefined

    return row ? this.mapToScopedEntry(row) : undefined
  }

  // List entries with efficient JOIN
  list(scopeId: number, includeArchived = false, allVersions = false): ScopedEntry[] {
    let query: string

    if (allVersions) {
      query = `
        SELECT
          e.id, e.scope_id, e.key, e.created_at as entry_created_at,
          es.is_archived,
          v.version, v.file_path, v.hash, v.description, v.created_at as version_created_at
        FROM entries e
        JOIN entry_status es ON e.id = es.entry_id
        JOIN versions v ON e.id = v.entry_id
        WHERE e.scope_id = ?
        ${includeArchived ? '' : 'AND es.is_archived = 0'}
        ORDER BY e.key, v.version DESC
      `
    } else {
      query = `
        SELECT
          e.id, e.scope_id, e.key, e.created_at as entry_created_at,
          es.is_archived, es.current_version,
          v.version, v.file_path, v.hash, v.description, v.created_at as version_created_at
        FROM entries e
        JOIN entry_status es ON e.id = es.entry_id
        JOIN versions v ON e.id = v.entry_id AND v.version = es.current_version
        WHERE e.scope_id = ?
        ${includeArchived ? '' : 'AND es.is_archived = 0'}
        ORDER BY e.key
      `
    }

    const rows = this.ctx.db.prepare(query).all(scopeId) as Record<string, unknown>[]
    return rows.map((row) => this.mapToScopedEntry(row))
  }

  // Get all entries for multiple scopes in one query
  listByScopes(scopeIds: number[]): Map<number, ScopedEntry[]> {
    if (scopeIds.length === 0) return new Map()

    const placeholders = scopeIds.map(() => '?').join(',')
    const query = `
      SELECT
        e.id, e.scope_id, e.key, e.created_at as entry_created_at,
        es.is_archived, es.current_version,
        v.version, v.file_path, v.hash, v.description, v.created_at as version_created_at
      FROM entries e
      JOIN entry_status es ON e.id = es.entry_id
      JOIN versions v ON e.id = v.entry_id AND v.version = es.current_version
      WHERE e.scope_id IN (${placeholders})
      AND es.is_archived = 0
      ORDER BY e.scope_id, e.key
    `

    const rows = this.ctx.db.prepare(query).all(...scopeIds) as Record<string, unknown>[]

    const result = new Map<number, ScopedEntry[]>()
    for (const row of rows) {
      const entry = this.mapToScopedEntry(row)
      const scopeEntries = result.get(entry.scopeId) || []
      scopeEntries.push(entry)
      result.set(entry.scopeId, scopeEntries)
    }

    return result
  }

  private mapToScopedEntry(row: Record<string, unknown>): ScopedEntry {
    return {
      id: row.id as number,
      scopeId: row.scope_id as number,
      key: row.key as string,
      version: row.version as number,
      filePath: row.file_path as string,
      hash: row.hash as string,
      description: row.description as string | undefined,
      createdAt: new Date(row.entry_created_at as string),
      isArchived: Boolean(row.is_archived),
    }
  }
}
