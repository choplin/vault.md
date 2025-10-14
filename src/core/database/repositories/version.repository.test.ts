import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Scope } from '../../scope.js'
import { closeDatabase, createDatabase, type DatabaseContext } from '../connection.js'
import { EntryRepository } from './entry.repository.js'
import { ScopeRepository } from './scope.repository.js'
import { VersionRepository } from './version.repository.js'

describe('VersionRepository', () => {
  let ctx: DatabaseContext
  let versionRepo: VersionRepository
  let entryRepo: EntryRepository
  let scopeRepo: ScopeRepository
  let entryId: number

  beforeEach(() => {
    ctx = createDatabase(':memory:')
    versionRepo = new VersionRepository(ctx)
    entryRepo = new EntryRepository(ctx)
    scopeRepo = new ScopeRepository(ctx)

    // Create test scope and entry
    const scope: Scope = { type: 'repository', primaryPath: '/test/repo' }
    const scopeId = scopeRepo.create(scope)
    entryId = entryRepo.create(scopeId, 'test-key')
  })

  afterEach(() => {
    closeDatabase(ctx)
  })

  describe('create', () => {
    it('should create a new version', () => {
      const versionId = versionRepo.create(entryId, 1, '/vault/files/test-v1', 'hash123', 'Initial version')
      expect(versionId).toBeGreaterThan(0)

      const version = versionRepo.findById(versionId)
      expect(version).toBeDefined()
      expect(version?.version).toBe(1)
      expect(version?.filePath).toBe('/vault/files/test-v1')
      expect(version?.hash).toBe('hash123')
      expect(version?.description).toBe('Initial version')
    })

    it('should create version without description', () => {
      const versionId = versionRepo.create(entryId, 1, '/vault/files/test-v1', 'hash123')
      const version = versionRepo.findById(versionId)
      expect(version?.description).toBeNull()
    })
  })

  describe('findByEntryAndVersion', () => {
    it('should find specific version', () => {
      versionRepo.create(entryId, 1, '/vault/files/test-v1', 'hash1')
      versionRepo.create(entryId, 2, '/vault/files/test-v2', 'hash2')

      const version = versionRepo.findByEntryAndVersion(entryId, 2)
      expect(version).toBeDefined()
      expect(version?.version).toBe(2)
      expect(version?.hash).toBe('hash2')
    })

    it('should return undefined for non-existent version', () => {
      const version = versionRepo.findByEntryAndVersion(entryId, 99)
      expect(version).toBeUndefined()
    })
  })

  describe('findAllByEntry', () => {
    it('should return all versions ordered by version DESC', () => {
      versionRepo.create(entryId, 1, '/vault/files/test-v1', 'hash1')
      versionRepo.create(entryId, 3, '/vault/files/test-v3', 'hash3')
      versionRepo.create(entryId, 2, '/vault/files/test-v2', 'hash2')

      const versions = versionRepo.findAllByEntry(entryId)
      expect(versions).toHaveLength(3)
      expect(versions[0].version).toBe(3)
      expect(versions[1].version).toBe(2)
      expect(versions[2].version).toBe(1)
    })

    it('should return empty array for entry with no versions', () => {
      const versions = versionRepo.findAllByEntry(entryId)
      expect(versions).toHaveLength(0)
    })
  })

  describe('getMaxVersion', () => {
    it('should return max version number', () => {
      versionRepo.create(entryId, 1, '/vault/files/test-v1', 'hash1')
      versionRepo.create(entryId, 5, '/vault/files/test-v5', 'hash5')
      versionRepo.create(entryId, 3, '/vault/files/test-v3', 'hash3')

      const maxVersion = versionRepo.getMaxVersion(entryId)
      expect(maxVersion).toBe(5)
    })

    it('should return 0 for entry with no versions', () => {
      const maxVersion = versionRepo.getMaxVersion(entryId)
      expect(maxVersion).toBe(0)
    })
  })

  describe('countByEntry', () => {
    it('should count versions for entry', () => {
      versionRepo.create(entryId, 1, '/vault/files/test-v1', 'hash1')
      versionRepo.create(entryId, 2, '/vault/files/test-v2', 'hash2')
      versionRepo.create(entryId, 3, '/vault/files/test-v3', 'hash3')

      const count = versionRepo.countByEntry(entryId)
      expect(count).toBe(3)
    })

    it('should return 0 for entry with no versions', () => {
      const count = versionRepo.countByEntry(entryId)
      expect(count).toBe(0)
    })
  })

  describe('delete operations', () => {
    let versionId1: number
    let versionId2: number

    beforeEach(() => {
      versionId1 = versionRepo.create(entryId, 1, '/vault/files/test-v1', 'hash1')
      versionId2 = versionRepo.create(entryId, 2, '/vault/files/test-v2', 'hash2')
    })

    it('should delete by id', () => {
      const deleted = versionRepo.delete(versionId1)
      expect(deleted).toBe(true)

      const version = versionRepo.findById(versionId1)
      expect(version).toBeUndefined()

      // Other version should remain
      const remaining = versionRepo.findById(versionId2)
      expect(remaining).toBeDefined()
    })

    it('should delete by entry and version', () => {
      const deleted = versionRepo.deleteByEntryAndVersion(entryId, 1)
      expect(deleted).toBe(true)

      const version = versionRepo.findByEntryAndVersion(entryId, 1)
      expect(version).toBeUndefined()
    })

    it('should delete all versions by entry', () => {
      const deletedCount = versionRepo.deleteAllByEntry(entryId)
      expect(deletedCount).toBe(2)

      const versions = versionRepo.findAllByEntry(entryId)
      expect(versions).toHaveLength(0)
    })

    it('should return false when deleting non-existent version', () => {
      const deleted = versionRepo.delete(9999)
      expect(deleted).toBe(false)
    })
  })
})
