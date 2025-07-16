import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearDatabase,
  closeDatabase,
  createDatabase,
  deleteScopedEntry,
  getScopedEntry,
  getLatestScopedEntry,
  getNextScopedVersion,
  insertScopedEntry,
  listScopedEntries,
  getOrCreateScope,
  getScopeById,
  type DatabaseContext,
  type ScopedEntry,
} from '../src/core/database.js'
import type { GlobalScope, RepoScope } from '../src/core/scope.js'

describe('database functions', () => {
  let ctx: DatabaseContext
  let testDir: string

  beforeAll(() => {
    // Set up isolated test directory before tests
    testDir = mkdtempSync(join(tmpdir(), 'vault-db-test-'))
    process.env.VAULT_DIR = testDir
  })

  beforeEach(() => {
    ctx = createDatabase()
  })

  afterEach(() => {
    clearDatabase(ctx)
  })

  afterAll(() => {
    // Clean up test directory and reset environment
    closeDatabase(ctx)
    rmSync(testDir, { recursive: true, force: true })
    delete process.env.VAULT_DIR
  })

  describe('getNextScopedVersion', () => {
    it('should return 1 for new key', () => {
      // Create a test scope first
      const scope: GlobalScope = { type: 'global' }
      const scopeId = getOrCreateScope(ctx, scope)

      const version = getNextScopedVersion(ctx, scopeId, 'new-key')
      expect(version).toBe(1)
    })

    it('should increment version for existing key', () => {
      // Create a test scope
      const scope: RepoScope = {
        type: 'repo',
        identifier: '/test/repo',
        branch: 'main',
        remoteUrl: 'https://github.com/test/repo',
      }
      const scopeId = getOrCreateScope(ctx, scope)
      const uniqueKey = `test-key-${Math.random()}`

      const entry: Omit<ScopedEntry, 'id' | 'createdAt'> = {
        scopeId,
        version: 1,
        key: uniqueKey,
        filePath: '/tmp/file.txt',
        hash: 'hash123',
        description: 'Test entry',
      }

      insertScopedEntry(ctx, entry)

      const nextVersion = getNextScopedVersion(ctx, scopeId, uniqueKey)
      expect(nextVersion).toBe(2)
    })
  })

  describe('insertScopedEntry', () => {
    it('should insert entry and return id', () => {
      // Create a test scope
      const scope: GlobalScope = { type: 'global' }
      const scopeId = getOrCreateScope(ctx, scope)

      const entry: Omit<ScopedEntry, 'id' | 'createdAt'> = {
        scopeId,
        version: 1,
        key: 'test-key',
        filePath: '/tmp/file.txt',
        hash: 'hash123',
        description: 'Test entry',
      }

      const id = insertScopedEntry(ctx, entry)

      expect(id).toBeGreaterThan(0)
    })

    it('should insert entry without description', () => {
      // Create a test scope
      const scope: GlobalScope = { type: 'global' }
      const scopeId = getOrCreateScope(ctx, scope)

      const entry: Omit<ScopedEntry, 'id' | 'createdAt'> = {
        scopeId,
        version: 1,
        key: 'test-key',
        filePath: '/tmp/file.txt',
        hash: 'hash123',
      }

      const id = insertScopedEntry(ctx, entry)

      expect(id).toBeGreaterThan(0)
    })
  })

  describe('getLatestScopedEntry', () => {
    it('should return undefined for non-existent key', () => {
      // Create a test scope
      const scope: GlobalScope = { type: 'global' }
      const scopeId = getOrCreateScope(ctx, scope)

      const entry = getLatestScopedEntry(ctx, scopeId, 'non-existent')
      expect(entry).toBeUndefined()
    })

    it('should return latest version of entry', () => {
      // Create a test scope
      const scope: RepoScope = {
        type: 'repo',
        identifier: '/test/repo',
        branch: 'main',
        remoteUrl: 'https://github.com/test/repo',
      }
      const scopeId = getOrCreateScope(ctx, scope)

      // Insert multiple versions
      insertScopedEntry(ctx, {
        scopeId,
        version: 1,
        key: 'test-key',
        filePath: '/tmp/v1.txt',
        hash: 'hash1',
      })

      insertScopedEntry(ctx, {
        scopeId,
        version: 2,
        key: 'test-key',
        filePath: '/tmp/v2.txt',
        hash: 'hash2',
      })

      const entry = getLatestScopedEntry(ctx, scopeId, 'test-key')

      expect(entry).toBeDefined()
      expect(entry?.version).toBe(2)
      expect(entry?.filePath).toBe('/tmp/v2.txt')
    })
  })

  describe('getScopedEntry', () => {
    it('should return specific version', () => {
      // Create a test scope
      const scope: RepoScope = {
        type: 'repo',
        identifier: '/test/repo',
        branch: 'main',
        remoteUrl: 'https://github.com/test/repo',
      }
      const scopeId = getOrCreateScope(ctx, scope)

      insertScopedEntry(ctx, {
        scopeId,
        version: 1,
        key: 'test-key',
        filePath: '/tmp/v1.txt',
        hash: 'hash1',
      })

      insertScopedEntry(ctx, {
        scopeId,
        version: 2,
        key: 'test-key',
        filePath: '/tmp/v2.txt',
        hash: 'hash2',
      })

      const entry = getScopedEntry(ctx, scopeId, 'test-key', 1)

      expect(entry).toBeDefined()
      expect(entry?.version).toBe(1)
      expect(entry?.filePath).toBe('/tmp/v1.txt')
    })

    it('should return undefined for non-existent version', () => {
      // Create a test scope
      const scope: GlobalScope = { type: 'global' }
      const scopeId = getOrCreateScope(ctx, scope)

      const entry = getScopedEntry(ctx, scopeId, 'key', 999)
      expect(entry).toBeUndefined()
    })
  })

  describe('listScopedEntries', () => {
    let isolatedCtx: DatabaseContext
    let testScopeId: number
    let otherScopeId: number

    beforeEach(() => {
      // Create isolated context for listEntries tests
      isolatedCtx = createDatabase()

      // Create test scopes
      const testScope: RepoScope = {
        type: 'repo',
        identifier: '/test/list-repo',
        branch: 'main',
        remoteUrl: 'https://github.com/test/repo',
      }
      testScopeId = getOrCreateScope(isolatedCtx, testScope)

      const otherScope: RepoScope = {
        type: 'repo',
        identifier: '/other/list-repo',
        branch: 'main',
        remoteUrl: 'https://github.com/other/repo',
      }
      otherScopeId = getOrCreateScope(isolatedCtx, otherScope)

      // Add test data
      insertScopedEntry(isolatedCtx, {
        scopeId: testScopeId,
        version: 1,
        key: 'key1',
        filePath: '/tmp/key1_v1.txt',
        hash: 'hash1',
      })

      insertScopedEntry(isolatedCtx, {
        scopeId: testScopeId,
        version: 2,
        key: 'key1',
        filePath: '/tmp/key1_v2.txt',
        hash: 'hash2',
      })

      insertScopedEntry(isolatedCtx, {
        scopeId: testScopeId,
        version: 1,
        key: 'key2',
        filePath: '/tmp/key2_v1.txt',
        hash: 'hash3',
      })

      insertScopedEntry(isolatedCtx, {
        scopeId: otherScopeId,
        version: 1,
        key: 'key1',
        filePath: '/tmp/other_v1.txt',
        hash: 'hash4',
      })
    })

    afterEach(() => {
      clearDatabase(isolatedCtx)
    })

    it('should list latest entries only by default', () => {
      const entries = listScopedEntries(isolatedCtx, testScopeId)

      expect(entries).toHaveLength(2)
      expect(entries.map(e => e.key).sort()).toEqual(['key1', 'key2'])
      expect(entries.find(e => e.key === 'key1')?.version).toBe(2)
    })

    it('should list all versions when requested', () => {
      const entries = listScopedEntries(isolatedCtx, testScopeId, true)

      expect(entries).toHaveLength(3)
      expect(entries.filter(e => e.key === 'key1')).toHaveLength(2)
    })

    it('should filter by scope', () => {
      const entries = listScopedEntries(isolatedCtx, otherScopeId)

      expect(entries).toHaveLength(1)
      expect(entries[0].key).toBe('key1')
      expect(entries[0].scopeId).toBe(otherScopeId)
    })

    it('should return empty array for scope with no entries', () => {
      // Create an empty scope
      const emptyScope: GlobalScope = { type: 'global' }
      const emptyScopeId = getOrCreateScope(isolatedCtx, emptyScope)

      const entries = listScopedEntries(isolatedCtx, emptyScopeId)
      expect(entries).toEqual([])
    })
  })

  describe('deleteScopedEntry', () => {
    let deleteScopeId: number

    beforeEach(() => {
      // Create a test scope
      const scope: RepoScope = {
        type: 'repo',
        identifier: '/test/delete-repo',
        branch: 'main',
        remoteUrl: 'https://github.com/test/repo',
      }
      deleteScopeId = getOrCreateScope(ctx, scope)

      insertScopedEntry(ctx, {
        scopeId: deleteScopeId,
        version: 1,
        key: 'test-key',
        filePath: '/tmp/v1.txt',
        hash: 'hash1',
      })

      insertScopedEntry(ctx, {
        scopeId: deleteScopeId,
        version: 2,
        key: 'test-key',
        filePath: '/tmp/v2.txt',
        hash: 'hash2',
      })
    })

    it('should delete all versions when no version specified', () => {
      const result = deleteScopedEntry(ctx, deleteScopeId, 'test-key')

      expect(result).toBe(true)
      expect(getLatestScopedEntry(ctx, deleteScopeId, 'test-key')).toBeUndefined()
    })

    it('should delete specific version only', () => {
      const result = deleteScopedEntry(ctx, deleteScopeId, 'test-key', 1)

      expect(result).toBe(true)
      expect(getScopedEntry(ctx, deleteScopeId, 'test-key', 1)).toBeUndefined()
      expect(getScopedEntry(ctx, deleteScopeId, 'test-key', 2)).toBeDefined()
    })

    it('should return false for non-existent entry', () => {
      const result = deleteScopedEntry(ctx, deleteScopeId, 'non-existent')
      expect(result).toBe(false)
    })
  })

  describe('scope functions', () => {
    it('should create and retrieve global scope', () => {
      const scope: GlobalScope = { type: 'global' }
      const scopeId = getOrCreateScope(ctx, scope)

      expect(scopeId).toBeGreaterThan(0)

      const retrieved = getScopeById(ctx, scopeId)
      expect(retrieved).toBeDefined()
      expect(retrieved?.type).toBe('global')
    })

    it('should create and retrieve repo scope', () => {
      const scope: RepoScope = {
        type: 'repo',
        identifier: '/test/repo',
        branch: 'main',
        remoteUrl: 'https://github.com/test/repo',
      }
      const scopeId = getOrCreateScope(ctx, scope)

      expect(scopeId).toBeGreaterThan(0)

      const retrieved = getScopeById(ctx, scopeId)
      expect(retrieved).toBeDefined()
      expect(retrieved?.type).toBe('repo')
      if (retrieved?.type === 'repo') {
        expect(retrieved.identifier).toBe('/test/repo')
        expect(retrieved.branch).toBe('main')
      }
    })

    it('should return existing scope if already exists', () => {
      const scope: GlobalScope = { type: 'global' }
      const scopeId1 = getOrCreateScope(ctx, scope)
      const scopeId2 = getOrCreateScope(ctx, scope)

      expect(scopeId1).toBe(scopeId2)
    })
  })
})
