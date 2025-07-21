import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  catEntry,
  clearVault,
  closeVault,
  createVault,
  deleteEntry,
  deleteVersion,
  deleteKey,
  deleteCurrentScope,
  deleteBranch,
  deleteAllBranches,
  getEntry,
  getInfo,
  listEntries,
  setEntry,
  type VaultContext,
} from '../src/core/vault.js'

describe('vault functions', () => {
  let tempDir: string
  let ctx: VaultContext
  let testDir: string

  beforeAll(() => {
    // Set up isolated test directory before tests
    testDir = mkdtempSync(join(tmpdir(), 'vault-vault-test-'))
    process.env.VAULT_DIR = testDir
  })

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = mkdtempSync(join(tmpdir(), 'vault-test-files-'))
    // Use global scope for tests
    ctx = createVault({ scope: 'global' })
  })

  afterEach(() => {
    clearVault(ctx)
    rmSync(tempDir, { recursive: true, force: true })
  })

  afterAll(() => {
    // Clean up test directory and reset environment
    rmSync(testDir, { recursive: true, force: true })
    delete process.env.VAULT_DIR
  })

  describe('createVault', () => {
    it('should create vault with global scope', () => {
      const defaultCtx = createVault({ scope: 'global' })
      expect(defaultCtx.scope.type).toBe('global')
      expect(defaultCtx.scopeId).toBeGreaterThan(0)
      closeVault(defaultCtx)
    })

    it.skip('should create vault with repo scope', () => {
      // Skip this test as it requires a git repository
      const customCtx = createVault({ repo: '/custom/repo', branch: 'main' })
      expect(customCtx.scope.type).toBe('repo')
      expect(customCtx.scopeId).toBeGreaterThan(0)
      closeVault(customCtx)
    })

    it('should create vault with directory scope when not in git repo', () => {
      const nonGitDir = realpathSync(mkdtempSync(join(tmpdir(), 'non-git-')))
      const originalCwd = process.cwd()

      try {
        process.chdir(nonGitDir)
        const ctx = createVault()

        expect(ctx.scope.type).toBe('repository')
        if (ctx.scope.type === 'repository') {
          expect(ctx.scope.identifier).toBe(nonGitDir)
          expect(ctx.scope.remoteUrl).toBeUndefined()
        }

        closeVault(ctx)
      } finally {
        process.chdir(originalCwd)
        rmSync(nonGitDir, { recursive: true, force: true })
      }
    })

    it('should use custom branch for non-git directory', () => {
      const nonGitDir = realpathSync(mkdtempSync(join(tmpdir(), 'non-git-')))
      const originalCwd = process.cwd()

      try {
        process.chdir(nonGitDir)
        const ctx = createVault({ scope: 'branch', branch: 'custom' })

        expect(ctx.scope.type).toBe('branch')
        if (ctx.scope.type === 'branch') {
          expect(ctx.scope.identifier).toBe(nonGitDir)
          expect(ctx.scope.branch).toBe('custom')
        }

        closeVault(ctx)
      } finally {
        process.chdir(originalCwd)
        rmSync(nonGitDir, { recursive: true, force: true })
      }
    })
  })

  describe('setEntry', () => {
    it('should save content from file', () => {
      const testFile = join(tempDir, 'test.txt')
      const content = 'Test content from file'
      writeFileSync(testFile, content)

      const path = setEntry(ctx, 'test-key', testFile)

      expect(path).toContain('test-key_v1.txt')
      expect(path).toContain('/global/')
    })

    it('should save with description', () => {
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'content')

      setEntry(ctx, 'test-key', testFile, { description: 'Test description' })

      const info = getInfo(ctx, 'test-key')
      expect(info?.description).toBe('Test description')
    })

    it('should increment version on subsequent saves', () => {
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'v1')

      const path1 = setEntry(ctx, 'test-key', testFile)
      writeFileSync(testFile, 'v2')
      const path2 = setEntry(ctx, 'test-key', testFile)

      expect(path1).toContain('test-key_v1.txt')
      expect(path2).toContain('test-key_v2.txt')
    })
  })

  describe('getEntry', () => {
    beforeEach(() => {
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'content')
      setEntry(ctx, 'test-key', testFile)
    })

    it('should get latest entry path', () => {
      const path = getEntry(ctx, 'test-key')

      expect(path).toBeDefined()
      expect(path).toContain('test-key_v1.txt')
    })

    it('should return undefined for non-existent key', () => {
      const path = getEntry(ctx, 'non-existent')
      expect(path).toBeUndefined()
    })

    it('should verify file integrity', () => {
      const testFile = join(tempDir, 'test2.txt')
      writeFileSync(testFile, 'content')
      setEntry(ctx, 'test-key2', testFile)

      // Corrupt the file
      const info = getInfo(ctx, 'test-key2')
      if (info?.filePath) {
        writeFileSync(info.filePath, 'corrupted content')
      }

      expect(() => getEntry(ctx, 'test-key2')).toThrow('File integrity check failed')
    })
  })

  describe('catEntry', () => {
    beforeEach(() => {
      const testFile = join(tempDir, 'test.txt')
      const content = 'Hello, World!'
      writeFileSync(testFile, content)
      setEntry(ctx, 'test-key', testFile)
    })

    it('should return file content', () => {
      const content = catEntry(ctx, 'test-key')
      expect(content).toBe('Hello, World!')
    })

    it('should return undefined for non-existent key', () => {
      const content = catEntry(ctx, 'non-existent')
      expect(content).toBeUndefined()
    })
  })

  describe('listEntries', () => {
    beforeEach(() => {
      const file1 = join(tempDir, 'file1.txt')
      const file2 = join(tempDir, 'file2.txt')
      writeFileSync(file1, 'content1')
      writeFileSync(file2, 'content2')

      setEntry(ctx, 'key1', file1)
      setEntry(ctx, 'key2', file2)
    })

    it('should list all entries', () => {
      const entries = listEntries(ctx)

      expect(entries).toHaveLength(2)
      expect(entries.map(e => e.key).sort()).toEqual(['key1', 'key2'])
    })

    it.skip('should list entries from different scope', () => {
      // Skip this test as it requires a git repository
      const otherCtx = createVault({ repo: '/other/repo', branch: 'main' })

      const entries = listEntries(ctx, { repo: '/other/repo', branch: 'main' })

      expect(entries).toEqual([])
      closeVault(otherCtx)
    })
  })

  describe('deleteEntry', () => {
    beforeEach(() => {
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'v1')
      setEntry(ctx, 'test-key', testFile)
      writeFileSync(testFile, 'v2')
      setEntry(ctx, 'test-key', testFile)
    })

    it('should delete all versions', () => {
      const result = deleteEntry(ctx, 'test-key')

      expect(result).toBe(true)
      expect(getEntry(ctx, 'test-key')).toBeUndefined()
    })

    it('should delete specific version', () => {
      const result = deleteEntry(ctx, 'test-key', { version: 1 })

      expect(result).toBe(true)
      expect(getEntry(ctx, 'test-key', { version: 1 })).toBeUndefined()
      expect(getEntry(ctx, 'test-key', { version: 2 })).toBeDefined()
    })

    it('should return false for non-existent key', () => {
      const result = deleteEntry(ctx, 'non-existent')
      expect(result).toBe(false)
    })
  })

  describe('new deletion functions', () => {
    beforeEach(() => {
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'v1')
      setEntry(ctx, 'delete-test', testFile)
      writeFileSync(testFile, 'v2')
      setEntry(ctx, 'delete-test', testFile)

      const testFile2 = join(tempDir, 'test2.txt')
      writeFileSync(testFile2, 'content')
      setEntry(ctx, 'delete-test2', testFile2)
    })

    it('should delete specific version with deleteVersion', () => {
      const result = deleteVersion(ctx, 'delete-test', 1)

      expect(result).toBe(1)
      expect(getEntry(ctx, 'delete-test', { version: 1 })).toBeUndefined()
      expect(getEntry(ctx, 'delete-test', { version: 2 })).toBeDefined()
    })

    it('should delete all versions with deleteKey', () => {
      const result = deleteKey(ctx, 'delete-test')

      expect(result).toBe(2)
      expect(getEntry(ctx, 'delete-test')).toBeUndefined()
    })

    it.skip('should delete current scope with deleteCurrentScope', () => {
      // Skip this test as it would delete the global scope
    })

    it.skip('should delete branch with deleteBranch', () => {
      // This requires a repo context setup
    })

    it.skip('should delete all branches with deleteAllBranches', () => {
      // This requires a repo context setup
    })
  })

  describe('getInfo', () => {
    beforeEach(() => {
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'content')
      setEntry(ctx, 'test-key', testFile, { description: 'Test info' })
    })

    it('should return entry metadata', () => {
      const info = getInfo(ctx, 'test-key')

      expect(info).toBeDefined()
      expect(info?.key).toBe('test-key')
      expect(info?.version).toBe(1)
      expect(info?.description).toBe('Test info')
      expect(info?.scope).toBe('global')
    })

    it('should return undefined for non-existent key', () => {
      const info = getInfo(ctx, 'non-existent')
      expect(info).toBeUndefined()
    })
  })
})
