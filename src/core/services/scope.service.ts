import type { DatabaseContext } from '../database/connection.js'
import { ScopeEntryQuery } from '../database/queries/scope-entry.query.js'
import { ScopedEntryQuery } from '../database/queries/scoped-entry.query.js'
import { EntryRepository } from '../database/repositories/entry.repository.js'
import { EntryStatusRepository } from '../database/repositories/entry-status.repository.js'
import { ScopeRepository } from '../database/repositories/scope.repository.js'
import { VersionRepository } from '../database/repositories/version.repository.js'
import type { ScopedEntry } from '../database/types.js'
import type { Scope } from '../scope.js'

export class ScopeService {
  private scopeRepo: ScopeRepository
  private entryRepo: EntryRepository
  private statusRepo: EntryStatusRepository
  private versionRepo: VersionRepository
  private scopedEntryQuery: ScopedEntryQuery
  private scopeEntryQuery: ScopeEntryQuery

  constructor(private ctx: DatabaseContext) {
    this.scopeRepo = new ScopeRepository(ctx)
    this.entryRepo = new EntryRepository(ctx)
    this.statusRepo = new EntryStatusRepository(ctx)
    this.versionRepo = new VersionRepository(ctx)
    this.scopedEntryQuery = new ScopedEntryQuery(ctx)
    this.scopeEntryQuery = new ScopeEntryQuery(ctx)
  }

  getOrCreate(scope: Scope): number {
    return this.scopeRepo.getOrCreate(scope)
  }

  getById(id: number): Scope | undefined {
    return this.scopeRepo.findById(id)
  }

  getAll(): Scope[] {
    return this.scopeRepo.findAll()
  }

  async getAllEntriesGrouped(): Promise<Map<Scope, ScopedEntry[]>> {
    const scopes = this.getAll()
    const scopeIds = scopes.map((scope) => this.getOrCreate(scope))

    // Get all entries in one query
    const entriesByScope = this.scopedEntryQuery.listByScopes(scopeIds)

    const result = new Map<Scope, ScopedEntry[]>()
    scopes.forEach((scope, index) => {
      const scopeId = scopeIds[index]
      result.set(scope, entriesByScope.get(scopeId) || [])
    })

    return result
  }

  async deleteScope(identifier: string, branch: string): Promise<number> {
    return this.ctx.db.transaction(() => {
      // Get scope
      const scopeRow = this.scopeRepo.findByIdentifierAndBranch(identifier, branch)
      if (!scopeRow) return 0

      // Get all entries with version counts in one query
      const entriesInfo = this.scopeEntryQuery.getEntriesWithVersionCount(scopeRow.id)

      let totalVersions = 0

      // Delete all related data for each entry
      for (const info of entriesInfo) {
        totalVersions += info.versionCount

        // Delete in order due to foreign keys
        this.versionRepo.deleteAllByEntry(info.entryId)
        this.statusRepo.delete(info.entryId)
        this.entryRepo.delete(info.entryId)
      }

      // Delete scope
      this.scopeRepo.delete(scopeRow.id)

      return totalVersions
    })()
  }

  async deleteAllBranches(identifier: string): Promise<number> {
    return this.ctx.db.transaction(() => {
      let totalVersions = 0

      // Get all scope info with counts in one query
      const scopesInfo = this.scopeEntryQuery.getScopesWithCounts(identifier)

      // Delete each scope
      for (const info of scopesInfo) {
        totalVersions += info.versionCount

        const entries = this.entryRepo.findAllByScope(info.scopeId)
        for (const entry of entries) {
          // Delete in order due to foreign keys
          this.versionRepo.deleteAllByEntry(entry.id)
          this.statusRepo.delete(entry.id)
          this.entryRepo.delete(entry.id)
        }
      }

      // Delete all scopes with this identifier
      this.scopeRepo.deleteByIdentifier(identifier)

      return totalVersions
    })()
  }
}
