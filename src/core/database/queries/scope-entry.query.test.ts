import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Scope } from '../../scope.js'
import { closeDatabase, createDatabase, type DatabaseContext } from '../connection.js'
import { EntryRepository } from '../repositories/entry.repository.js'
import { ScopeRepository } from '../repositories/scope.repository.js'
import { VersionRepository } from '../repositories/version.repository.js'
import { ScopeEntryQuery } from './scope-entry.query.js'

describe('ScopeEntryQuery', () => {
  let ctx: DatabaseContext
  let query: ScopeEntryQuery
  let scopeRepo: ScopeRepository
  let entryRepo: EntryRepository
  let versionRepo: VersionRepository

  beforeEach(() => {
    ctx = createDatabase(':memory:')
    query = new ScopeEntryQuery(ctx)
    scopeRepo = new ScopeRepository(ctx)
    entryRepo = new EntryRepository(ctx)
    versionRepo = new VersionRepository(ctx)
  })

  afterEach(() => {
    closeDatabase(ctx)
  })

  describe('getEntriesWithVersionCount', () => {
    it('should return entries with version counts', () => {
      const scope: Scope = { type: 'repository', identifier: '/test/repo' }
      const scopeId = scopeRepo.create(scope)

      // Create entries with different version counts
      const entry1 = entryRepo.create(scopeId, 'key1')
      versionRepo.create(entry1, 1, '/files/key1-v1', 'hash1')
      versionRepo.create(entry1, 2, '/files/key1-v2', 'hash2')
      versionRepo.create(entry1, 3, '/files/key1-v3', 'hash3')

      const entry2 = entryRepo.create(scopeId, 'key2')
      versionRepo.create(entry2, 1, '/files/key2-v1', 'hash1')

      const entry3 = entryRepo.create(scopeId, 'key3')
      // No versions for entry3

      const results = query.getEntriesWithVersionCount(scopeId)
      expect(results).toHaveLength(3)

      const entry1Info = results.find((r) => r.entryId === entry1)
      expect(entry1Info?.versionCount).toBe(3)

      const entry2Info = results.find((r) => r.entryId === entry2)
      expect(entry2Info?.versionCount).toBe(1)

      const entry3Info = results.find((r) => r.entryId === entry3)
      expect(entry3Info?.versionCount).toBe(0)
    })

    it('should return empty array for scope with no entries', () => {
      const scope: Scope = { type: 'repository', identifier: '/empty/repo' }
      const scopeId = scopeRepo.create(scope)

      const results = query.getEntriesWithVersionCount(scopeId)
      expect(results).toHaveLength(0)
    })
  })

  describe('getTotalVersionCount', () => {
    it('should return total version count for scope', () => {
      const scope: Scope = { type: 'repository', identifier: '/test/repo' }
      const scopeId = scopeRepo.create(scope)

      const entry1 = entryRepo.create(scopeId, 'key1')
      versionRepo.create(entry1, 1, '/files/key1-v1', 'hash1')
      versionRepo.create(entry1, 2, '/files/key1-v2', 'hash2')

      const entry2 = entryRepo.create(scopeId, 'key2')
      versionRepo.create(entry2, 1, '/files/key2-v1', 'hash1')
      versionRepo.create(entry2, 2, '/files/key2-v2', 'hash2')
      versionRepo.create(entry2, 3, '/files/key2-v3', 'hash3')

      const total = query.getTotalVersionCount(scopeId)
      expect(total).toBe(5)
    })

    it('should return 0 for scope with no versions', () => {
      const scope: Scope = { type: 'repository', identifier: '/test/repo' }
      const scopeId = scopeRepo.create(scope)
      entryRepo.create(scopeId, 'key1') // Entry with no versions

      const total = query.getTotalVersionCount(scopeId)
      expect(total).toBe(0)
    })
  })

  describe('getScopesWithCounts', () => {
    it('should return all scopes with entry and version counts', () => {
      // Create multiple scopes with same identifier
      const scope1: Scope = { type: 'repository', identifier: '/test/repo' }
      const scopeId1 = scopeRepo.create(scope1)

      const scope2: Scope = { type: 'branch', identifier: '/test/repo', branch: 'main' }
      const scopeId2 = scopeRepo.create(scope2)

      const scope3: Scope = { type: 'branch', identifier: '/test/repo', branch: 'dev' }
      const scopeId3 = scopeRepo.create(scope3)

      // Add entries and versions to scope1
      const entry1 = entryRepo.create(scopeId1, 'key1')
      versionRepo.create(entry1, 1, '/files/key1-v1', 'hash1')
      versionRepo.create(entry1, 2, '/files/key1-v2', 'hash2')
      const entry2 = entryRepo.create(scopeId1, 'key2')
      versionRepo.create(entry2, 1, '/files/key2-v1', 'hash1')

      // Add entries and versions to scope2
      const entry3 = entryRepo.create(scopeId2, 'key3')
      versionRepo.create(entry3, 1, '/files/key3-v1', 'hash1')

      // scope3 has no entries

      const results = query.getScopesWithCounts('/test/repo')
      expect(results).toHaveLength(3)

      const scope1Info = results.find((r) => r.scopeId === scopeId1)
      expect(scope1Info?.entryCount).toBe(2)
      expect(scope1Info?.versionCount).toBe(3)

      const scope2Info = results.find((r) => r.scopeId === scopeId2)
      expect(scope2Info?.entryCount).toBe(1)
      expect(scope2Info?.versionCount).toBe(1)

      const scope3Info = results.find((r) => r.scopeId === scopeId3)
      expect(scope3Info?.entryCount).toBe(0)
      expect(scope3Info?.versionCount).toBe(0)
    })

    it('should return empty array for non-existent identifier', () => {
      const results = query.getScopesWithCounts('/non/existent')
      expect(results).toHaveLength(0)
    })
  })
})
