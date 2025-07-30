import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resolveVaultContext, clearVault, setEntry, listEntries, archiveEntry, restoreEntry, getInfo } from '../src/core/vault.js'
import type { VaultContext } from '../src/core/vault.js'

describe('Archive CLI functionality', () => {
  let testDir: string
  let ctx: VaultContext
  let tempDir: string

  beforeAll(() => {
    // Set up isolated test directory
    testDir = mkdtempSync(join(tmpdir(), 'vault-archive-cli-test-'))
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
    rmSync(testDir, { recursive: true, force: true })
    delete process.env.VAULT_DIR
  })

  describe('archiveEntry', () => {
    it('should archive an entry', async () => {
      // Create an entry
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'test content')
      await setEntry(ctx, 'test-key', testFile, { description: 'test entry' })

      // Archive it
      const result = await archiveEntry(ctx, 'test-key')
      expect(result).toBe(true)

      // Verify it's archived
      const info = await getInfo(ctx, 'test-key')
      expect(info?.isArchived).toBe(true)

      // Verify it doesn't show in normal list
      const entries = await listEntries(ctx)
      expect(entries).toHaveLength(0)

      // Verify it shows when includeArchived is true
      const allEntries = await listEntries(ctx, { includeArchived: true })
      expect(allEntries).toHaveLength(1)
      expect(allEntries[0].key).toBe('test-key')
      expect(allEntries[0].isArchived).toBe(true)
    })

    it('should return false when archiving non-existent entry', async () => {
      const result = await archiveEntry(ctx, 'non-existent')
      expect(result).toBe(false)
    })

    it('should handle already archived entries', async () => {
      // Create and archive an entry
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'test content')
      await setEntry(ctx, 'test-key', testFile)
      await archiveEntry(ctx, 'test-key')

      // Try to archive again
      const result = await archiveEntry(ctx, 'test-key')
      expect(result).toBe(false)
    })
  })

  describe('restoreEntry', () => {
    it('should restore an archived entry', async () => {
      // Create and archive an entry
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'test content')
      await setEntry(ctx, 'test-key', testFile, { description: 'test entry' })
      await archiveEntry(ctx, 'test-key')

      // Restore it
      const result = await restoreEntry(ctx, 'test-key')
      expect(result).toBe(true)

      // Verify it's not archived anymore
      const info = await getInfo(ctx, 'test-key')
      expect(info?.isArchived).toBe(false)

      // Verify it shows in normal list
      const entries = await listEntries(ctx)
      expect(entries).toHaveLength(1)
      expect(entries[0].key).toBe('test-key')
      expect(entries[0].isArchived).toBe(false)
    })

    it('should return false when restoring non-existent entry', async () => {
      const result = await restoreEntry(ctx, 'non-existent')
      expect(result).toBe(false)
    })

    it('should handle already active entries', async () => {
      // Create an active entry
      const testFile = join(tempDir, 'test.txt')
      writeFileSync(testFile, 'test content')
      await setEntry(ctx, 'test-key', testFile)

      // Try to restore it
      const result = await restoreEntry(ctx, 'test-key')
      expect(result).toBe(false)
    })
  })

  describe('list with includeArchived', () => {
    beforeEach(async () => {
      // Create some entries
      const file1 = join(tempDir, 'file1.txt')
      const file2 = join(tempDir, 'file2.txt')
      const file3 = join(tempDir, 'file3.txt')
      writeFileSync(file1, 'content1')
      writeFileSync(file2, 'content2')
      writeFileSync(file3, 'content3')

      await setEntry(ctx, 'active1', file1)
      await setEntry(ctx, 'active2', file2)
      await setEntry(ctx, 'archived1', file3)

      // Archive one entry
      await archiveEntry(ctx, 'archived1')
    })

    it('should list only active entries by default', async () => {
      const entries = await listEntries(ctx)
      expect(entries).toHaveLength(2)
      expect(entries.map(e => e.key).sort()).toEqual(['active1', 'active2'])
    })

    it('should list all entries with includeArchived', async () => {
      const entries = await listEntries(ctx, { includeArchived: true })
      expect(entries).toHaveLength(3)
      expect(entries.map(e => e.key).sort()).toEqual(['active1', 'active2', 'archived1'])

      const archivedEntry = entries.find(e => e.key === 'archived1')
      expect(archivedEntry?.isArchived).toBe(true)
    })

    it('should handle multiple versions with archive status', async () => {
      // Add more versions to archived entry
      const file4 = join(tempDir, 'file4.txt')
      writeFileSync(file4, 'content4')
      await setEntry(ctx, 'archived1', file4)

      // The entire key should be archived regardless of versions
      const entries = await listEntries(ctx, { includeArchived: true, allVersions: true })
      const archivedEntries = entries.filter(e => e.key === 'archived1')
      expect(archivedEntries).toHaveLength(2)
      expect(archivedEntries.every(e => e.isArchived)).toBe(true)
    })
  })
})
