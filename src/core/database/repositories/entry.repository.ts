import type { DatabaseContext } from '../connection.js'
import type { DbEntryRow, Entry } from '../types.js'

export class EntryRepository {
  constructor(private ctx: DatabaseContext) {}

  findById(id: number): Entry | undefined {
    const row = this.ctx.db.prepare('SELECT * FROM entries WHERE id = ?').get(id) as DbEntryRow | undefined

    if (!row) return undefined

    return {
      id: row.id,
      scopeId: row.scope_id,
      key: row.key,
      createdAt: new Date(row.created_at),
    }
  }

  findByScopeAndKey(scopeId: number, key: string): Entry | undefined {
    const row = this.ctx.db.prepare('SELECT * FROM entries WHERE scope_id = ? AND key = ?').get(scopeId, key) as
      | DbEntryRow
      | undefined

    if (!row) return undefined

    return {
      id: row.id,
      scopeId: row.scope_id,
      key: row.key,
      createdAt: new Date(row.created_at),
    }
  }

  findAllByScope(scopeId: number): Entry[] {
    const rows = this.ctx.db.prepare('SELECT * FROM entries WHERE scope_id = ?').all(scopeId) as DbEntryRow[]

    return rows.map((row) => ({
      id: row.id,
      scopeId: row.scope_id,
      key: row.key,
      createdAt: new Date(row.created_at),
    }))
  }

  create(scopeId: number, key: string): number {
    const result = this.ctx.db.prepare('INSERT INTO entries (scope_id, key) VALUES (?, ?)').run(scopeId, key)

    return result.lastInsertRowid as number
  }

  delete(id: number): boolean {
    const result = this.ctx.db.prepare('DELETE FROM entries WHERE id = ?').run(id)
    return result.changes > 0
  }

  deleteByScope(scopeId: number): number {
    const result = this.ctx.db.prepare('DELETE FROM entries WHERE scope_id = ?').run(scopeId)
    return result.changes
  }
}
