import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase, createDatabase, type DatabaseContext } from '../database/connection.js'
import { ScopeRepository } from '../database/repositories/scope.repository.js'
import type { ScopedEntry } from '../database/types.js'
import type { Scope } from '../scope.js'
import { EntryService } from './entry.service.js'

describe('EntryService', () => {
  let ctx: DatabaseContext
  let service: EntryService
  let scopeRepo: ScopeRepository
  let scopeId: number

  beforeEach(() => {
    ctx = createDatabase(':memory:')
    service = new EntryService(ctx)
    scopeRepo = new ScopeRepository(ctx)

    // Create a test scope
    const scope: Scope = { type: 'repository', primaryPath: '/test/repo' }
    scopeId = scopeRepo.create(scope)
  })

  afterEach(() => {
    closeDatabase(ctx)
  })

  describe('create', () => {
    it('should create new entry with first version', async () => {
      const entry: Omit<ScopedEntry, 'id' | 'createdAt' | 'isArchived'> = {
        scopeId,
        key: 'test-key',
        version: 1,
        filePath: '/vault/files/test-key-v1',
        hash: 'hash123',
        description: 'Test entry',
      }

      const id = await service.create(entry)
      expect(id).toBeGreaterThan(0)

      const retrieved = await service.getLatest(scopeId, 'test-key')
      expect(retrieved).toBeDefined()
      expect(retrieved?.key).toBe('test-key')
      expect(retrieved?.version).toBe(1)
      expect(retrieved?.description).toBe('Test entry')
      expect(retrieved?.isArchived).toBe(false)
    })

    it('should add new version to existing entry', async () => {
      // Create first version
      await service.create({
        scopeId,
        key: 'test-key',
        version: 1,
        filePath: '/vault/files/test-key-v1',
        hash: 'hash1',
      })

      // Add second version
      await service.create({
        scopeId,
        key: 'test-key',
        version: 2,
        filePath: '/vault/files/test-key-v2',
        hash: 'hash2',
      })

      const latest = await service.getLatest(scopeId, 'test-key')
      expect(latest?.version).toBe(2)
    })

    it('should create archived entry when specified', async () => {
      await service.create({
        scopeId,
        key: 'archived-key',
        version: 1,
        filePath: '/vault/files/archived-key-v1',
        hash: 'hash123',
        isArchived: true,
      })

      const retrieved = await service.getLatest(scopeId, 'archived-key')
      expect(retrieved?.isArchived).toBe(true)
    })
  })

  describe('getLatest', () => {
    it('should return latest version', async () => {
      await service.create({
        scopeId,
        key: 'test-key',
        version: 1,
        filePath: '/vault/files/test-key-v1',
        hash: 'hash1',
      })

      await service.create({
        scopeId,
        key: 'test-key',
        version: 2,
        filePath: '/vault/files/test-key-v2',
        hash: 'hash2',
      })

      const latest = await service.getLatest(scopeId, 'test-key')
      expect(latest?.version).toBe(2)
      expect(latest?.filePath).toBe('/vault/files/test-key-v2')
    })

    it('should return undefined for non-existent key', async () => {
      const result = await service.getLatest(scopeId, 'non-existent')
      expect(result).toBeUndefined()
    })
  })

  describe('getByVersion', () => {
    it('should return specific version', async () => {
      await service.create({
        scopeId,
        key: 'test-key',
        version: 1,
        filePath: '/vault/files/test-key-v1',
        hash: 'hash1',
      })

      await service.create({
        scopeId,
        key: 'test-key',
        version: 2,
        filePath: '/vault/files/test-key-v2',
        hash: 'hash2',
      })

      const v1 = await service.getByVersion(scopeId, 'test-key', 1)
      expect(v1?.version).toBe(1)
      expect(v1?.filePath).toBe('/vault/files/test-key-v1')
    })
  })

  describe('getNextVersion', () => {
    it('should return 1 for new key', async () => {
      const nextVersion = await service.getNextVersion(scopeId, 'new-key')
      expect(nextVersion).toBe(1)
    })

    it('should return next version for existing key', async () => {
      await service.create({
        scopeId,
        key: 'test-key',
        version: 1,
        filePath: '/vault/files/test-key-v1',
        hash: 'hash1',
      })

      await service.create({
        scopeId,
        key: 'test-key',
        version: 2,
        filePath: '/vault/files/test-key-v2',
        hash: 'hash2',
      })

      const nextVersion = await service.getNextVersion(scopeId, 'test-key')
      expect(nextVersion).toBe(3)
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      // Create test entries
      await service.create({
        scopeId,
        key: 'key1',
        version: 1,
        filePath: '/vault/files/key1-v1',
        hash: 'hash1',
      })

      await service.create({
        scopeId,
        key: 'key2',
        version: 1,
        filePath: '/vault/files/key2-v1',
        hash: 'hash2',
      })

      await service.create({
        scopeId,
        key: 'archived-key',
        version: 1,
        filePath: '/vault/files/archived-key-v1',
        hash: 'hash3',
        isArchived: true,
      })
    })

    it('should list active entries by default', async () => {
      const entries = await service.list(scopeId)
      expect(entries).toHaveLength(2)
      expect(entries.map((e) => e.key)).toContain('key1')
      expect(entries.map((e) => e.key)).toContain('key2')
    })

    it('should include archived when requested', async () => {
      const entries = await service.list(scopeId, true)
      expect(entries).toHaveLength(3)
      expect(entries.map((e) => e.key)).toContain('archived-key')
    })

    it('should list all versions when requested', async () => {
      await service.create({
        scopeId,
        key: 'key1',
        version: 2,
        filePath: '/vault/files/key1-v2',
        hash: 'hash1-v2',
      })

      const entries = await service.list(scopeId, false, true)
      expect(entries).toHaveLength(3) // key1 v1 & v2, key2 v1
      expect(entries.filter((e) => e.key === 'key1')).toHaveLength(2)
    })
  })

  describe('archive/restore', () => {
    beforeEach(async () => {
      await service.create({
        scopeId,
        key: 'test-key',
        version: 1,
        filePath: '/vault/files/test-key-v1',
        hash: 'hash1',
      })
    })

    it('should archive entry', async () => {
      const result = await service.archive(scopeId, 'test-key')
      expect(result).toBe(true)

      const entry = await service.getLatest(scopeId, 'test-key')
      expect(entry?.isArchived).toBe(true)
    })

    it('should restore archived entry', async () => {
      await service.archive(scopeId, 'test-key')

      const result = await service.restore(scopeId, 'test-key')
      expect(result).toBe(true)

      const entry = await service.getLatest(scopeId, 'test-key')
      expect(entry?.isArchived).toBe(false)
    })

    it('should return false for non-existent entry', async () => {
      const result = await service.archive(scopeId, 'non-existent')
      expect(result).toBe(false)
    })
  })

  describe('delete operations', () => {
    beforeEach(async () => {
      await service.create({
        scopeId,
        key: 'test-key',
        version: 1,
        filePath: '/vault/files/test-key-v1',
        hash: 'hash1',
      })

      await service.create({
        scopeId,
        key: 'test-key',
        version: 2,
        filePath: '/vault/files/test-key-v2',
        hash: 'hash2',
      })

      await service.create({
        scopeId,
        key: 'test-key',
        version: 3,
        filePath: '/vault/files/test-key-v3',
        hash: 'hash3',
      })
    })

    it('should delete specific version', async () => {
      const result = await service.deleteVersion(scopeId, 'test-key', 2)
      expect(result).toBe(true)

      const v2 = await service.getByVersion(scopeId, 'test-key', 2)
      expect(v2).toBeUndefined()

      // Other versions should remain
      const v1 = await service.getByVersion(scopeId, 'test-key', 1)
      const v3 = await service.getByVersion(scopeId, 'test-key', 3)
      expect(v1).toBeDefined()
      expect(v3).toBeDefined()

      // Current version should be updated to highest remaining
      const latest = await service.getLatest(scopeId, 'test-key')
      expect(latest?.version).toBe(3)
    })

    it('should delete all versions', async () => {
      const result = await service.deleteAll(scopeId, 'test-key')
      expect(result).toBe(true)

      const entry = await service.getLatest(scopeId, 'test-key')
      expect(entry).toBeUndefined()
    })

    it('should return false when deleting non-existent version', async () => {
      const result = await service.deleteVersion(scopeId, 'test-key', 99)
      expect(result).toBe(false)
    })
  })
})
