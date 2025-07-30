import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Scope } from '../../scope.js'
import { closeDatabase, createDatabase, type DatabaseContext } from '../connection.js'
import { EntryRepository } from '../repositories/entry.repository.js'
import { EntryStatusRepository } from '../repositories/entry-status.repository.js'
import { ScopeRepository } from '../repositories/scope.repository.js'
import { VersionRepository } from '../repositories/version.repository.js'
import { ScopedEntryQuery } from './scoped-entry.query.js'

describe('ScopedEntryQuery', () => {
  let ctx: DatabaseContext
  let query: ScopedEntryQuery
  let scopeRepo: ScopeRepository
  let entryRepo: EntryRepository
  let statusRepo: EntryStatusRepository
  let versionRepo: VersionRepository
  let scopeId: number

  beforeEach(() => {
    ctx = createDatabase(':memory:')
    query = new ScopedEntryQuery(ctx)
    scopeRepo = new ScopeRepository(ctx)
    entryRepo = new EntryRepository(ctx)
    statusRepo = new EntryStatusRepository(ctx)
    versionRepo = new VersionRepository(ctx)

    // Create a test scope
    const scope: Scope = { type: 'repository', identifier: '/test/repo' }
    scopeId = scopeRepo.create(scope)
  })

  afterEach(() => {
    closeDatabase(ctx)
  })

  function createTestEntry(key: string, version: number, isArchived = false) {
    // Find existing entry or create new one
    const entry = entryRepo.findByScopeAndKey(scopeId, key)
    let entryId: number

    if (entry) {
      entryId = entry.id
      // Update the current version in status
      statusRepo.updateCurrentVersion(entryId, version)
    } else {
      entryId = entryRepo.create(scopeId, key)
      statusRepo.create(entryId, version, isArchived)
    }

    const versionId = versionRepo.create(
      entryId,
      version,
      `/vault/files/${key}-v${version}`,
      `hash-${key}-v${version}`,
      `Description for ${key} v${version}`,
    )

    // Update archive status if needed
    if (isArchived && entry) {
      statusRepo.setArchived(entryId, isArchived)
    }

    return { entryId, versionId }
  }

  describe('getLatest', () => {
    it('should get latest version of entry with JOIN', () => {
      createTestEntry('test-key', 1)
      const entry2 = createTestEntry('test-key', 2)

      // Update current version
      statusRepo.updateCurrentVersion(entry2.entryId, 2)

      const result = query.getLatest(scopeId, 'test-key')
      expect(result).toBeDefined()
      expect(result?.key).toBe('test-key')
      expect(result?.version).toBe(2)
      expect(result?.filePath).toBe('/vault/files/test-key-v2')
      expect(result?.hash).toBe('hash-test-key-v2')
      expect(result?.isArchived).toBe(false)
    })

    it('should return undefined for non-existent entry', () => {
      const result = query.getLatest(scopeId, 'non-existent')
      expect(result).toBeUndefined()
    })

    it('should include archived status', () => {
      const { entryId } = createTestEntry('archived-key', 1, true)
      statusRepo.updateCurrentVersion(entryId, 1)

      const result = query.getLatest(scopeId, 'archived-key')
      expect(result).toBeDefined()
      expect(result?.isArchived).toBe(true)
    })
  })

  describe('getByVersion', () => {
    it('should get specific version of entry', () => {
      createTestEntry('test-key', 1)
      createTestEntry('test-key', 2)
      createTestEntry('test-key', 3)

      const result = query.getByVersion(scopeId, 'test-key', 2)
      expect(result).toBeDefined()
      expect(result?.version).toBe(2)
      expect(result?.filePath).toBe('/vault/files/test-key-v2')
    })

    it('should return undefined for non-existent version', () => {
      createTestEntry('test-key', 1)

      const result = query.getByVersion(scopeId, 'test-key', 5)
      expect(result).toBeUndefined()
    })
  })

  describe('list', () => {
    beforeEach(() => {
      // Create multiple entries with versions
      const entry1 = createTestEntry('key1', 1)
      statusRepo.updateCurrentVersion(entry1.entryId, 1)

      const entry2 = createTestEntry('key2', 1)
      createTestEntry('key2', 2)
      statusRepo.updateCurrentVersion(entry2.entryId, 2)

      const entry3 = createTestEntry('key3', 1, true) // archived
      statusRepo.updateCurrentVersion(entry3.entryId, 1)
    })

    it('should list latest versions excluding archived by default', () => {
      const results = query.list(scopeId, false, false)
      expect(results).toHaveLength(2)
      expect(results.map((r) => r.key)).toContain('key1')
      expect(results.map((r) => r.key)).toContain('key2')
      expect(results.map((r) => r.key)).not.toContain('key3')
    })

    it('should include archived when requested', () => {
      const results = query.list(scopeId, true, false)
      expect(results).toHaveLength(3)
      expect(results.map((r) => r.key)).toContain('key3')
    })

    it('should list all versions when requested', () => {
      const results = query.list(scopeId, true, true)
      expect(results).toHaveLength(4) // key1(v1), key2(v1,v2), key3(v1)

      const key2Results = results.filter((r) => r.key === 'key2')
      expect(key2Results).toHaveLength(2)
      expect(key2Results.map((r) => r.version)).toContain(1)
      expect(key2Results.map((r) => r.version)).toContain(2)
    })

    it('should order results by key and version', () => {
      const results = query.list(scopeId, true, true)

      // Check ordering
      expect(results[0].key).toBe('key1')
      expect(results[1].key).toBe('key2')
      expect(results[1].version).toBe(2) // Higher version first
      expect(results[2].key).toBe('key2')
      expect(results[2].version).toBe(1)
    })
  })

  describe('listByScopes', () => {
    it('should list entries for multiple scopes in one query', () => {
      // Create another scope
      const scope2: Scope = { type: 'repository', identifier: '/other/repo' }
      const scopeId2 = scopeRepo.create(scope2)

      // Add entries to both scopes
      const entry1 = createTestEntry('key1', 1)
      statusRepo.updateCurrentVersion(entry1.entryId, 1)

      const entryId2 = entryRepo.create(scopeId2, 'key2')
      statusRepo.create(entryId2, 1)
      versionRepo.create(entryId2, 1, '/vault/files/key2-v1', 'hash-key2-v1')
      statusRepo.updateCurrentVersion(entryId2, 1)

      const results = query.listByScopes([scopeId, scopeId2])

      expect(results.size).toBe(2)
      expect(results.get(scopeId)).toHaveLength(1)
      expect(results.get(scopeId2)).toHaveLength(1)
      expect(results.get(scopeId)?.[0].key).toBe('key1')
      expect(results.get(scopeId2)?.[0].key).toBe('key2')
    })

    it('should return empty map for empty scopeIds array', () => {
      const results = query.listByScopes([])
      expect(results.size).toBe(0)
    })

    it('should exclude archived entries', () => {
      createTestEntry('active-key', 1)
      const archived = createTestEntry('archived-key', 1, true)
      statusRepo.updateCurrentVersion(archived.entryId, 1)

      const results = query.listByScopes([scopeId])
      expect(results.get(scopeId)).toHaveLength(1)
      expect(results.get(scopeId)?.[0].key).toBe('active-key')
    })
  })
})
