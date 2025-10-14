import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Scope } from '../../scope.js'
import { closeDatabase, createDatabase, type DatabaseContext } from '../connection.js'
import { EntryRepository } from './entry.repository.js'
import { ScopeRepository } from './scope.repository.js'

describe('EntryRepository', () => {
  let ctx: DatabaseContext
  let entryRepo: EntryRepository
  let scopeRepo: ScopeRepository
  let scopeId: number

  beforeEach(() => {
    ctx = createDatabase(':memory:')
    entryRepo = new EntryRepository(ctx)
    scopeRepo = new ScopeRepository(ctx)

    // Create a test scope
    const scope: Scope = { type: 'repository', primaryPath: '/test/repo' }
    scopeId = scopeRepo.create(scope)
  })

  afterEach(() => {
    closeDatabase(ctx)
  })

  describe('create', () => {
    it('should create a new entry', () => {
      const id = entryRepo.create(scopeId, 'test-key')
      expect(id).toBeGreaterThan(0)

      const found = entryRepo.findById(id)
      expect(found).toBeDefined()
      expect(found?.key).toBe('test-key')
      expect(found?.scopeId).toBe(scopeId)
    })

    it('should enforce unique constraint on scope_id and key', () => {
      entryRepo.create(scopeId, 'test-key')

      // Should throw on duplicate
      expect(() => entryRepo.create(scopeId, 'test-key')).toThrow()
    })
  })

  describe('findById', () => {
    it('should find existing entry', () => {
      const id = entryRepo.create(scopeId, 'test-key')

      const found = entryRepo.findById(id)
      expect(found).toBeDefined()
      expect(found?.id).toBe(id)
      expect(found?.key).toBe('test-key')
      expect(found?.createdAt).toBeInstanceOf(Date)
    })

    it('should return undefined for non-existent entry', () => {
      const found = entryRepo.findById(999)
      expect(found).toBeUndefined()
    })
  })

  describe('findByScopeAndKey', () => {
    it('should find entry by scope and key', () => {
      entryRepo.create(scopeId, 'test-key')

      const found = entryRepo.findByScopeAndKey(scopeId, 'test-key')
      expect(found).toBeDefined()
      expect(found?.key).toBe('test-key')
      expect(found?.scopeId).toBe(scopeId)
    })

    it('should return undefined for non-existent key', () => {
      const found = entryRepo.findByScopeAndKey(scopeId, 'non-existent')
      expect(found).toBeUndefined()
    })

    it('should not find entry from different scope', () => {
      entryRepo.create(scopeId, 'test-key')

      // Create another scope
      const scope2: Scope = { type: 'repository', primaryPath: '/other/repo' }
      const scopeId2 = scopeRepo.create(scope2)

      const found = entryRepo.findByScopeAndKey(scopeId2, 'test-key')
      expect(found).toBeUndefined()
    })
  })

  describe('findAllByScope', () => {
    it('should find all entries for a scope', () => {
      entryRepo.create(scopeId, 'key1')
      entryRepo.create(scopeId, 'key2')
      entryRepo.create(scopeId, 'key3')

      const entries = entryRepo.findAllByScope(scopeId)
      expect(entries).toHaveLength(3)
      expect(entries.map((e) => e.key)).toContain('key1')
      expect(entries.map((e) => e.key)).toContain('key2')
      expect(entries.map((e) => e.key)).toContain('key3')
    })

    it('should return empty array for scope with no entries', () => {
      const entries = entryRepo.findAllByScope(scopeId)
      expect(entries).toHaveLength(0)
    })

    it('should only return entries for specified scope', () => {
      entryRepo.create(scopeId, 'key1')

      // Create another scope with entries
      const scope2: Scope = { type: 'repository', primaryPath: '/other/repo' }
      const scopeId2 = scopeRepo.create(scope2)
      entryRepo.create(scopeId2, 'key2')

      const entries = entryRepo.findAllByScope(scopeId)
      expect(entries).toHaveLength(1)
      expect(entries[0].key).toBe('key1')
    })
  })

  describe('delete', () => {
    it('should delete entry by id', () => {
      const id = entryRepo.create(scopeId, 'test-key')

      const deleted = entryRepo.delete(id)
      expect(deleted).toBe(true)

      const found = entryRepo.findById(id)
      expect(found).toBeUndefined()
    })

    it('should return false when deleting non-existent entry', () => {
      const deleted = entryRepo.delete(999)
      expect(deleted).toBe(false)
    })
  })

  describe('deleteByScope', () => {
    it('should delete all entries for a scope', () => {
      entryRepo.create(scopeId, 'key1')
      entryRepo.create(scopeId, 'key2')
      entryRepo.create(scopeId, 'key3')

      const deletedCount = entryRepo.deleteByScope(scopeId)
      expect(deletedCount).toBe(3)

      const remaining = entryRepo.findAllByScope(scopeId)
      expect(remaining).toHaveLength(0)
    })

    it('should return 0 when no entries to delete', () => {
      const deletedCount = entryRepo.deleteByScope(scopeId)
      expect(deletedCount).toBe(0)
    })

    it('should only delete entries for specified scope', () => {
      entryRepo.create(scopeId, 'key1')

      // Create another scope with entries
      const scope2: Scope = { type: 'repository', primaryPath: '/other/repo' }
      const scopeId2 = scopeRepo.create(scope2)
      entryRepo.create(scopeId2, 'key2')

      const deletedCount = entryRepo.deleteByScope(scopeId)
      expect(deletedCount).toBe(1)

      // Verify other scope's entries remain
      const remaining = entryRepo.findAllByScope(scopeId2)
      expect(remaining).toHaveLength(1)
    })
  })
})
