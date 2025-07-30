import type { DatabaseContext } from '../connection.js'
import type { DbEntryStatusRow, EntryStatus } from '../types.js'

export class EntryStatusRepository {
  constructor(private ctx: DatabaseContext) {}

  findByEntryId(entryId: number): EntryStatus | undefined {
    const row = this.ctx.db.prepare('SELECT * FROM entry_status WHERE entry_id = ?').get(entryId) as
      | DbEntryStatusRow
      | undefined

    if (!row) return undefined

    return {
      entryId: row.entry_id,
      isArchived: Boolean(row.is_archived),
      currentVersion: row.current_version,
      updatedAt: new Date(row.updated_at),
    }
  }

  create(entryId: number, currentVersion: number, isArchived = false): void {
    this.ctx.db
      .prepare('INSERT INTO entry_status (entry_id, is_archived, current_version) VALUES (?, ?, ?)')
      .run(entryId, isArchived ? 1 : 0, currentVersion)
  }

  updateCurrentVersion(entryId: number, version: number): void {
    this.ctx.db
      .prepare('UPDATE entry_status SET current_version = ?, updated_at = CURRENT_TIMESTAMP WHERE entry_id = ?')
      .run(version, entryId)
  }

  setArchived(entryId: number, isArchived: boolean): boolean {
    const result = this.ctx.db
      .prepare(`
        UPDATE entry_status
        SET is_archived = ?, updated_at = CURRENT_TIMESTAMP
        WHERE entry_id = ?
      `)
      .run(isArchived ? 1 : 0, entryId)

    return result.changes > 0
  }

  delete(entryId: number): boolean {
    const result = this.ctx.db.prepare('DELETE FROM entry_status WHERE entry_id = ?').run(entryId)
    return result.changes > 0
  }
}
