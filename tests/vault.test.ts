import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  catEntry,
  clearVault,
  closeVault,
  createVault,
  deleteEntry,
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
    ctx = createVault()
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
    it('should create vault with default project', () => {
      const defaultCtx = createVault()
      expect(defaultCtx.project).toBe(process.cwd())
      closeVault(defaultCtx)
    })

    it('should create vault with custom project', () => {
      const customCtx = createVault('/custom/project')
      expect(customCtx.project).toBe('/custom/project')
      closeVault(customCtx)
    })
  })

  describe('setEntry', () => {
    it('should save content from file', () => {
      const testFile = join(tempDir, 'test.txt')
      const content = 'Test content from file'
      writeFileSync(testFile, content)

      const path = setEntry(ctx, 'test-key', testFile)

      expect(path).toContain('test-key_1.txt')
      expect(path).toContain(ctx.project.replace(/[/._]/g, '-'))
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

      expect(path1).toContain('test-key_1.txt')
      expect(path2).toContain('test-key_2.txt')
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
      expect(path).toContain('test-key_1.txt')
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

    it('should list entries from different project', () => {
      const otherProject = '/other/project'
      const otherCtx = createVault(otherProject)

      const entries = listEntries(ctx, { project: otherProject })

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
      expect(info?.project).toBe(ctx.project)
    })

    it('should return undefined for non-existent key', () => {
      const info = getInfo(ctx, 'non-existent')
      expect(info).toBeUndefined()
    })
  })
})
