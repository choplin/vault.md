import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  catEntry,
  clearVault,
  closeVault,
  resolveVaultContext,
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
    ctx = resolveVaultContext({ scope: 'global' })
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

  describe('resolveVaultContext', () => {
    it('should create vault with global scope', () => {
      const defaultCtx = resolveVaultContext({ scope: 'global' })
      expect(defaultCtx.scope.type).toBe('global')
      expect(defaultCtx.scopeId).toBeGreaterThan(0)
      closeVault(defaultCtx)
    })

    it.skip('should create vault with repo scope', () => {
      // Skip this test as it requires a git repository
      const customCtx = resolveVaultContext({ repo: '/custom/repo', branch: 'main' })
      expect(customCtx.scope.type).toBe('repo')
      expect(customCtx.scopeId).toBeGreaterThan(0)
      closeVault(customCtx)
    })

    it('should create vault with directory scope when not in git repo', () => {
      const nonGitDir = realpathSync(mkdtempSync(join(tmpdir(), 'non-git-')))
      const originalCwd = process.cwd()

      try {
        process.chdir(nonGitDir)
        const ctx = resolveVaultContext()

        expect(ctx.scope.type).toBe('repository')
        if (ctx.scope.type === 'repository') {
          expect(ctx.scope.primaryPath).toBe(nonGitDir)
        }

        closeVault(ctx)
      } finally {
        process.chdir(originalCwd)
        rmSync(nonGitDir, { recursive: true, force: true })
      }
    })

    it('should reject branch scope when not in git repo', () => {
      const nonGitDir = realpathSync(mkdtempSync(join(tmpdir(), 'non-git-')))
      const originalCwd = process.cwd()

      try {
        process.chdir(nonGitDir)
        expect(() => resolveVaultContext({ scope: 'branch', branch: 'custom' })).toThrow(
          'Not in a git repository. Branch scope requires git repository'
        )
      } finally {
        process.chdir(originalCwd)
        rmSync(nonGitDir, { recursive: true, force: true })
      }
    })
  })

  describe('setEntry', () => {
    it('should save content from file', async () => {
      const testFile = join(tempDir, 'test.txt')
      const content = 'Test content from file'
      writeFileSync(testFile, content)

      const path = await setEntry(ctx, 'test-key', testFile)

      expect(path).toContain('test-key_v1.txt')
      expect(path).toContain('/global/')
    })

    it('should save with description', async () => {
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'content')

      await setEntry(ctx, 'test-key', testFile, { description: 'Test description' })

      const info = await getInfo(ctx, 'test-key')
      expect(info?.description).toBe('Test description')
    })

    it('should increment version on subsequent saves', async () => {
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'v1')

      const path1 = await setEntry(ctx, 'test-key', testFile)
      writeFileSync(testFile, 'v2')
      const path2 = await setEntry(ctx, 'test-key', testFile)

      expect(path1).toContain('test-key_v1.txt')
      expect(path2).toContain('test-key_v2.txt')
    })
  })

  describe('getEntry', () => {
    beforeEach(async () => {
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'content')
      await setEntry(ctx, 'test-key', testFile)
    })

    it('should get latest entry path', async () => {
      const path = await getEntry(ctx, 'test-key')

      expect(path).toBeDefined()
      expect(path).toContain('test-key_v1.txt')
    })

    it('should return undefined for non-existent key', async () => {
      const path = await getEntry(ctx, 'non-existent')
      expect(path).toBeUndefined()
    })

    it('should verify file integrity', async () => {
      const testFile = join(tempDir, 'test2.txt')
      writeFileSync(testFile, 'content')
      await setEntry(ctx, 'test-key2', testFile)

      // Corrupt the file
      const info = await getInfo(ctx, 'test-key2')
      if (info?.filePath) {
        writeFileSync(info.filePath, 'corrupted content')
      }

      await expect(getEntry(ctx, 'test-key2')).rejects.toThrow('File integrity check failed')
    })
  })

  describe('catEntry', () => {
    beforeEach(async () => {
      const testFile = join(tempDir, 'test.txt')
      const content = 'Hello, World!'
      writeFileSync(testFile, content)
      await setEntry(ctx, 'test-key', testFile)
    })

    it('should return file content', async () => {
      const content = await catEntry(ctx, 'test-key')
      expect(content).toBe('Hello, World!')
    })

    it('should return undefined for non-existent key', async () => {
      const content = await catEntry(ctx, 'non-existent')
      expect(content).toBeUndefined()
    })
  })

  describe('listEntries', () => {
    beforeEach(async () => {
      const file1 = join(tempDir, 'file1.txt')
      const file2 = join(tempDir, 'file2.txt')
      writeFileSync(file1, 'content1')
      writeFileSync(file2, 'content2')

      await setEntry(ctx, 'key1', file1)
      await setEntry(ctx, 'key2', file2)
    })

    it('should list all entries', async () => {
      const entries = await listEntries(ctx)

      expect(entries).toHaveLength(2)
      expect(entries.map(e => e.key).sort()).toEqual(['key1', 'key2'])
    })

    it.skip('should list entries from different scope', async () => {
      // Skip this test as it requires a git repository
      const otherCtx = resolveVaultContext({ repo: '/other/repo', branch: 'main' })

      const entries = await listEntries(ctx, { repo: '/other/repo', branch: 'main' })

      expect(entries).toEqual([])
      closeVault(otherCtx)
    })
  })

  describe('deleteEntry', () => {
    beforeEach(async () => {
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'v1')
      await setEntry(ctx, 'test-key', testFile)
      writeFileSync(testFile, 'v2')
      await setEntry(ctx, 'test-key', testFile)
    })

    it('should delete all versions', async () => {
      const result = await deleteEntry(ctx, 'test-key')

      expect(result).toBe(true)
      expect(await getEntry(ctx, 'test-key')).toBeUndefined()
    })

    it('should delete specific version', async () => {
      const result = await deleteEntry(ctx, 'test-key', { version: 1 })

      expect(result).toBe(true)
      expect(await getEntry(ctx, 'test-key', { version: 1 })).toBeUndefined()
      expect(await getEntry(ctx, 'test-key', { version: 2 })).toBeDefined()
    })

    it('should return false for non-existent key', async () => {
      const result = await deleteEntry(ctx, 'non-existent')
      expect(result).toBe(false)
    })
  })

  describe('new deletion functions', () => {
    beforeEach(async () => {
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'v1')
      await setEntry(ctx, 'delete-test', testFile)
      writeFileSync(testFile, 'v2')
      await setEntry(ctx, 'delete-test', testFile)

      const testFile2 = join(tempDir, 'test2.txt')
      writeFileSync(testFile2, 'content')
      await setEntry(ctx, 'delete-test2', testFile2)
    })

    it('should delete specific version with deleteVersion', async () => {
      const result = await deleteVersion(ctx, 'delete-test', 1)

      expect(result).toBe(1)
      expect(await getEntry(ctx, 'delete-test', { version: 1 })).toBeUndefined()
      expect(await getEntry(ctx, 'delete-test', { version: 2 })).toBeDefined()
    })

    it('should delete all versions with deleteKey', async () => {
      const result = await deleteKey(ctx, 'delete-test')

      expect(result).toBe(2)
      expect(await getEntry(ctx, 'delete-test')).toBeUndefined()
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
    beforeEach(async () => {
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'content')
      await setEntry(ctx, 'test-key', testFile, { description: 'Test info' })
    })

    it('should return entry metadata', async () => {
      const info = await getInfo(ctx, 'test-key')

      expect(info).toBeDefined()
      expect(info?.key).toBe('test-key')
      expect(info?.version).toBe(1)
      expect(info?.description).toBe('Test info')
      expect(info?.scope).toBe('global')
    })

    it('should return undefined for non-existent key', async () => {
      const info = await getInfo(ctx, 'non-existent')
      expect(info).toBeUndefined()
    })
  })
})
