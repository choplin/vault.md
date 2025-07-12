import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearDatabase,
  closeDatabase,
  createDatabase,
  deleteEntry,
  getEntry,
  getLatestEntry,
  getNextVersion,
  insertEntry,
  listEntries,
  type DatabaseContext,
} from '../src/core/database.js'
import type { VaultEntry } from '../src/core/types.js'

describe('database functions', () => {
  let ctx: DatabaseContext
  let testDir: string

  beforeAll(() => {
    // Set up isolated test directory before tests
    testDir = mkdtempSync(join(tmpdir(), 'ccvault-db-test-'))
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

  describe('getNextVersion', () => {
    it('should return 1 for new key', () => {
      const version = getNextVersion(ctx, 'project', 'new-key')
      expect(version).toBe(1)
    })

    it('should increment version for existing key', () => {
      // Use unique project and key to avoid conflicts
      const uniqueProject = `test-project-${Date.now()}`
      const uniqueKey = `test-key-${Math.random()}`

      const entry: Omit<VaultEntry, 'id' | 'createdAt'> = {
        project: uniqueProject,
        version: 1,
        key: uniqueKey,
        filePath: '/tmp/file.txt',
        hash: 'hash123',
        description: 'Test entry',
      }

      insertEntry(ctx, entry)

      const nextVersion = getNextVersion(ctx, uniqueProject, uniqueKey)
      expect(nextVersion).toBe(2)
    })
  })

  describe('insertEntry', () => {
    it('should insert entry and return id', () => {
      const entry: Omit<VaultEntry, 'id' | 'createdAt'> = {
        project: 'test-project',
        version: 1,
        key: 'test-key',
        filePath: '/tmp/file.txt',
        hash: 'hash123',
        description: 'Test entry',
      }

      const id = insertEntry(ctx, entry)

      expect(id).toBeGreaterThan(0)
    })

    it('should insert entry without description', () => {
      const entry: Omit<VaultEntry, 'id' | 'createdAt'> = {
        project: 'test-project',
        version: 1,
        key: 'test-key',
        filePath: '/tmp/file.txt',
        hash: 'hash123',
      }

      const id = insertEntry(ctx, entry)

      expect(id).toBeGreaterThan(0)
    })
  })

  describe('getLatestEntry', () => {
    it('should return undefined for non-existent key', () => {
      const entry = getLatestEntry(ctx, 'project', 'non-existent')
      expect(entry).toBeUndefined()
    })

    it('should return latest version of entry', () => {
      // Insert multiple versions
      insertEntry(ctx, {
        project: 'test-project',
        version: 1,
        key: 'test-key',
        filePath: '/tmp/v1.txt',
        hash: 'hash1',
      })

      insertEntry(ctx, {
        project: 'test-project',
        version: 2,
        key: 'test-key',
        filePath: '/tmp/v2.txt',
        hash: 'hash2',
      })

      const entry = getLatestEntry(ctx, 'test-project', 'test-key')

      expect(entry).toBeDefined()
      expect(entry?.version).toBe(2)
      expect(entry?.filePath).toBe('/tmp/v2.txt')
    })
  })

  describe('getEntry', () => {
    it('should return specific version', () => {
      insertEntry(ctx, {
        project: 'test-project',
        version: 1,
        key: 'test-key',
        filePath: '/tmp/v1.txt',
        hash: 'hash1',
      })

      insertEntry(ctx, {
        project: 'test-project',
        version: 2,
        key: 'test-key',
        filePath: '/tmp/v2.txt',
        hash: 'hash2',
      })

      const entry = getEntry(ctx, 'test-project', 'test-key', 1)

      expect(entry).toBeDefined()
      expect(entry?.version).toBe(1)
      expect(entry?.filePath).toBe('/tmp/v1.txt')
    })

    it('should return undefined for non-existent version', () => {
      const entry = getEntry(ctx, 'project', 'key', 999)
      expect(entry).toBeUndefined()
    })
  })

  describe('listEntries', () => {
    let isolatedCtx: DatabaseContext

    beforeEach(() => {
      // Create isolated context for listEntries tests
      isolatedCtx = createDatabase()
      // Add test data
      insertEntry(isolatedCtx, {
        project: 'list-test-project',
        version: 1,
        key: 'key1',
        filePath: '/tmp/key1_v1.txt',
        hash: 'hash1',
      })

      insertEntry(isolatedCtx, {
        project: 'list-test-project',
        version: 2,
        key: 'key1',
        filePath: '/tmp/key1_v2.txt',
        hash: 'hash2',
      })

      insertEntry(isolatedCtx, {
        project: 'list-test-project',
        version: 1,
        key: 'key2',
        filePath: '/tmp/key2_v1.txt',
        hash: 'hash3',
      })

      insertEntry(isolatedCtx, {
        project: 'other-list-project',
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
      const entries = listEntries(isolatedCtx, 'list-test-project')

      expect(entries).toHaveLength(2)
      expect(entries.map(e => e.key).sort()).toEqual(['key1', 'key2'])
      expect(entries.find(e => e.key === 'key1')?.version).toBe(2)
    })

    it('should list all versions when requested', () => {
      const entries = listEntries(isolatedCtx, 'list-test-project', true)

      expect(entries).toHaveLength(3)
      expect(entries.filter(e => e.key === 'key1')).toHaveLength(2)
    })

    it('should filter by project', () => {
      const entries = listEntries(isolatedCtx, 'other-list-project')

      expect(entries).toHaveLength(1)
      expect(entries[0].key).toBe('key1')
      expect(entries[0].project).toBe('other-list-project')
    })

    it('should return empty array for project with no entries', () => {
      const entries = listEntries(isolatedCtx, 'empty-project')
      expect(entries).toEqual([])
    })
  })

  describe('deleteEntry', () => {
    beforeEach(() => {
      insertEntry(ctx, {
        project: 'test-project',
        version: 1,
        key: 'test-key',
        filePath: '/tmp/v1.txt',
        hash: 'hash1',
      })

      insertEntry(ctx, {
        project: 'test-project',
        version: 2,
        key: 'test-key',
        filePath: '/tmp/v2.txt',
        hash: 'hash2',
      })
    })

    it('should delete all versions when no version specified', () => {
      const result = deleteEntry(ctx, 'test-project', 'test-key')

      expect(result).toBe(true)
      expect(getLatestEntry(ctx, 'test-project', 'test-key')).toBeUndefined()
    })

    it('should delete specific version only', () => {
      const result = deleteEntry(ctx, 'test-project', 'test-key', 1)

      expect(result).toBe(true)
      expect(getEntry(ctx, 'test-project', 'test-key', 1)).toBeUndefined()
      expect(getEntry(ctx, 'test-project', 'test-key', 2)).toBeDefined()
    })

    it('should return false for non-existent entry', () => {
      const result = deleteEntry(ctx, 'test-project', 'non-existent')
      expect(result).toBe(false)
    })
  })
})
