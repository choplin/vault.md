import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase, createDatabase, type DatabaseContext } from '../database/connection.js'
import type { Scope } from '../scope.js'
import { EntryService } from './entry.service.js'
import { ScopeService } from './scope.service.js'

describe('ScopeService', () => {
  let ctx: DatabaseContext
  let scopeService: ScopeService
  let entryService: EntryService

  beforeEach(() => {
    ctx = createDatabase(':memory:')
    scopeService = new ScopeService(ctx)
    entryService = new EntryService(ctx)
  })

  afterEach(() => {
    closeDatabase(ctx)
  })

  describe('getOrCreate', () => {
    it('should create new scope', () => {
      const scope: Scope = { type: 'repository', primaryPath: '/test/repo' }
      const id = scopeService.getOrCreate(scope)
      expect(id).toBeGreaterThan(0)

      const retrieved = scopeService.getById(id)
      expect(retrieved).toMatchObject(scope)
    })

    it('should return existing scope id', () => {
      const scope: Scope = { type: 'repository', primaryPath: '/test/repo' }
      const id1 = scopeService.getOrCreate(scope)
      const id2 = scopeService.getOrCreate(scope)
      expect(id2).toBe(id1)
    })
  })

  describe('getAll', () => {
    it('should return all scopes', () => {
      const scopes: Scope[] = [
        { type: 'global' },
        { type: 'repository', primaryPath: '/repo1' },
        { type: 'branch', primaryPath: '/repo1', branchName: 'main' },
      ]

      scopes.forEach((scope) => scopeService.getOrCreate(scope))

      const all = scopeService.getAll()
      expect(all).toHaveLength(3)
    })
  })

  describe('getAllEntriesGrouped', () => {
    it('should return entries grouped by scope', async () => {
      // Create scopes
      const scope1: Scope = { type: 'repository', primaryPath: '/repo1' }
      const scope2: Scope = { type: 'repository', primaryPath: '/repo2' }
      const scopeId1 = scopeService.getOrCreate(scope1)
      const scopeId2 = scopeService.getOrCreate(scope2)

      // Add entries to scopes
      await entryService.create({
        scopeId: scopeId1,
        key: 'key1',
        version: 1,
        filePath: '/files/key1',
        hash: 'hash1',
      })
      await entryService.create({
        scopeId: scopeId1,
        key: 'key2',
        version: 1,
        filePath: '/files/key2',
        hash: 'hash2',
      })
      await entryService.create({
        scopeId: scopeId2,
        key: 'key3',
        version: 1,
        filePath: '/files/key3',
        hash: 'hash3',
      })

      const grouped = await scopeService.getAllEntriesGrouped()
      expect(grouped.size).toBe(2)

      const scope1Entries = Array.from(grouped.entries()).find(
        ([scope]) => (scope.type === 'repository' || scope.type === 'branch') && scope.primaryPath === '/repo1',
      )?.[1]
      expect(scope1Entries).toHaveLength(2)
      expect(scope1Entries?.map((e) => e.key).sort()).toEqual(['key1', 'key2'])

      const scope2Entries = Array.from(grouped.entries()).find(
        ([scope]) => (scope.type === 'repository' || scope.type === 'branch') && scope.primaryPath === '/repo2',
      )?.[1]
      expect(scope2Entries).toHaveLength(1)
      expect(scope2Entries?.[0].key).toBe('key3')
    })

    it('should return empty arrays for scopes without entries', async () => {
      const scope: Scope = { type: 'repository', primaryPath: '/empty' }
      scopeService.getOrCreate(scope)

      const grouped = await scopeService.getAllEntriesGrouped()
      expect(grouped.size).toBe(1)

      const entries = Array.from(grouped.values())[0]
      expect(entries).toHaveLength(0)
    })
  })

  describe('deleteScope', () => {
    it('should delete scope and all its entries and versions', async () => {
      const scope: Scope = { type: 'repository', primaryPath: '/test/repo' }
      const scopeId = scopeService.getOrCreate(scope)

      // Add entries with multiple versions
      await entryService.create({
        scopeId,
        key: 'key1',
        version: 1,
        filePath: '/files/key1-v1',
        hash: 'hash1',
      })
      await entryService.create({
        scopeId,
        key: 'key1',
        version: 2,
        filePath: '/files/key1-v2',
        hash: 'hash2',
      })
      await entryService.create({
        scopeId,
        key: 'key2',
        version: 1,
        filePath: '/files/key2-v1',
        hash: 'hash3',
      })

      const deletedVersions = await scopeService.deleteScope('/test/repo', 'repository')
      expect(deletedVersions).toBe(3)

      // Verify scope is deleted
      const retrievedScope = scopeService.getById(scopeId)
      expect(retrievedScope).toBeUndefined()

      // Verify entries are deleted
      const entries = await entryService.list(scopeId)
      expect(entries).toHaveLength(0)
    })

    it('should return 0 for non-existent scope', async () => {
      const deletedVersions = await scopeService.deleteScope('/non/existent', 'repository')
      expect(deletedVersions).toBe(0)
    })

    it('should handle scope with no entries', async () => {
      const scope: Scope = { type: 'repository', primaryPath: '/empty/repo' }
      scopeService.getOrCreate(scope)

      const deletedVersions = await scopeService.deleteScope('/empty/repo', 'repository')
      expect(deletedVersions).toBe(0)
    })
  })

  describe('deleteAllBranches', () => {
    it('should delete all scopes with same primary path', async () => {
      // Create multiple scopes with same repository
      const scopes: Scope[] = [
        { type: 'repository', primaryPath: '/test/repo' },
        { type: 'branch', primaryPath: '/test/repo', branchName: 'main' },
        { type: 'branch', primaryPath: '/test/repo', branchName: 'dev' },
      ]

      const scopeIds = scopes.map((scope) => scopeService.getOrCreate(scope))

      // Add entries to each scope
      for (const [index, scopeId] of scopeIds.entries()) {
        await entryService.create({
          scopeId,
          key: `key-${index}`,
          version: 1,
          filePath: `/files/key-${index}`,
          hash: `hash-${index}`,
        })
      }

      const deletedVersions = await scopeService.deleteAllBranches('/test/repo')
      expect(deletedVersions).toBe(3)

      // Verify all scopes are deleted
      const remaining = scopeService.getAll()
      expect(
        remaining.filter((s) => (s.type === 'repository' || s.type === 'branch') && s.primaryPath === '/test/repo'),
      ).toHaveLength(0)
    })

    it('should not affect scopes with different primary paths', async () => {
      const scope1: Scope = { type: 'repository', primaryPath: '/repo1' }
      const scope2: Scope = { type: 'repository', primaryPath: '/repo2' }

      scopeService.getOrCreate(scope1)
      const scopeId2 = scopeService.getOrCreate(scope2)

      await scopeService.deleteAllBranches('/repo1')

      // repo2 should still exist
      const retrieved = scopeService.getById(scopeId2)
      expect(retrieved).toBeDefined()
    })

    it('should handle multiple versions per entry', async () => {
      const scope: Scope = { type: 'repository', primaryPath: '/test/repo' }
      const scopeId = scopeService.getOrCreate(scope)

      // Create entry with multiple versions
      await entryService.create({
        scopeId,
        key: 'key1',
        version: 1,
        filePath: '/files/key1-v1',
        hash: 'hash1',
      })
      await entryService.create({
        scopeId,
        key: 'key1',
        version: 2,
        filePath: '/files/key1-v2',
        hash: 'hash2',
      })
      await entryService.create({
        scopeId,
        key: 'key1',
        version: 3,
        filePath: '/files/key1-v3',
        hash: 'hash3',
      })

      const deletedVersions = await scopeService.deleteAllBranches('/test/repo')
      expect(deletedVersions).toBe(3)
    })
  })
})
