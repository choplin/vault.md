import type { DatabaseContext } from '../database/connection.js'
import { EntryVersionQuery } from '../database/queries/entry-version.query.js'
import { ScopedEntryQuery } from '../database/queries/scoped-entry.query.js'
import { EntryRepository } from '../database/repositories/entry.repository.js'
import { EntryStatusRepository } from '../database/repositories/entry-status.repository.js'
import { VersionRepository } from '../database/repositories/version.repository.js'
import type { ScopedEntry } from '../database/types.js'

export class EntryService {
  private entryRepo: EntryRepository
  private statusRepo: EntryStatusRepository
  private versionRepo: VersionRepository
  private scopedEntryQuery: ScopedEntryQuery
  private entryVersionQuery: EntryVersionQuery

  constructor(private ctx: DatabaseContext) {
    this.entryRepo = new EntryRepository(ctx)
    this.statusRepo = new EntryStatusRepository(ctx)
    this.versionRepo = new VersionRepository(ctx)
    this.scopedEntryQuery = new ScopedEntryQuery(ctx)
    this.entryVersionQuery = new EntryVersionQuery(ctx)
  }

  async getLatest(scopeId: number, key: string): Promise<ScopedEntry | undefined> {
    return this.scopedEntryQuery.getLatest(scopeId, key)
  }

  async getByVersion(scopeId: number, key: string, version: number): Promise<ScopedEntry | undefined> {
    return this.scopedEntryQuery.getByVersion(scopeId, key, version)
  }

  async getNextVersion(scopeId: number, key: string): Promise<number> {
    return this.entryVersionQuery.getNextVersion(scopeId, key)
  }

  async create(
    entry: Omit<ScopedEntry, 'id' | 'createdAt' | 'isArchived'> & { isArchived?: boolean },
  ): Promise<number> {
    return this.ctx.db.transaction(() => {
      // Check if entry exists
      const existing = this.entryRepo.findByScopeAndKey(entry.scopeId, entry.key)

      let entryId: number

      if (existing) {
        entryId = existing.id

        // Check if entry_status exists, create if not
        const status = this.statusRepo.findByEntryId(entryId)
        if (!status) {
          this.statusRepo.create(entryId, entry.version, entry.isArchived)
        }
      } else {
        // Create new entry
        entryId = this.entryRepo.create(entry.scopeId, entry.key)

        // Create entry status
        this.statusRepo.create(entryId, entry.version, entry.isArchived)
      }

      // Insert version
      const versionId = this.versionRepo.create(entryId, entry.version, entry.filePath, entry.hash, entry.description)

      // Update current version
      this.statusRepo.updateCurrentVersion(entryId, entry.version)

      return versionId
    })()
  }

  async list(scopeId: number, includeArchived = false, allVersions = false): Promise<ScopedEntry[]> {
    return this.scopedEntryQuery.list(scopeId, includeArchived, allVersions)
  }

  async deleteVersion(scopeId: number, key: string, version: number): Promise<boolean> {
    return this.ctx.db.transaction(() => {
      const entry = this.entryRepo.findByScopeAndKey(scopeId, key)
      if (!entry) return false

      const result = this.versionRepo.deleteByEntryAndVersion(entry.id, version)

      // Update current version if necessary
      const maxVersion = this.versionRepo.getMaxVersion(entry.id)

      if (maxVersion > 0) {
        this.statusRepo.updateCurrentVersion(entry.id, maxVersion)
      }

      return result
    })()
  }

  async deleteAll(scopeId: number, key: string): Promise<boolean> {
    return this.ctx.db.transaction(() => {
      const entry = this.entryRepo.findByScopeAndKey(scopeId, key)
      if (!entry) return false

      // Delete all versions
      this.versionRepo.deleteAllByEntry(entry.id)

      // Delete status
      this.statusRepo.delete(entry.id)

      // Delete entry
      this.entryRepo.delete(entry.id)

      return true
    })()
  }

  async archive(scopeId: number, key: string): Promise<boolean> {
    const entry = this.entryRepo.findByScopeAndKey(scopeId, key)
    if (!entry) return false

    // Check if already archived
    const status = this.statusRepo.findByEntryId(entry.id)
    if (status?.isArchived) return false

    return this.statusRepo.setArchived(entry.id, true)
  }

  async restore(scopeId: number, key: string): Promise<boolean> {
    const entry = this.entryRepo.findByScopeAndKey(scopeId, key)
    if (!entry) return false

    // Check if already active (not archived)
    const status = this.statusRepo.findByEntryId(entry.id)
    if (!status?.isArchived) return false

    return this.statusRepo.setArchived(entry.id, false)
  }

  getEntryByKey(scopeId: number, key: string) {
    return this.entryRepo.findByScopeAndKey(scopeId, key)
  }
}
