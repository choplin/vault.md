import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createVault, clearVault, closeVault } from '../src/core/vault.js'
import * as vault from '../src/core/vault.js'
import type { VaultContext } from '../src/core/vault.js'

describe('MCP Server Operations', () => {
  let testDir: string
  let ctx: VaultContext

  beforeAll(() => {
    // Set up isolated test directory
    testDir = mkdtempSync(join(tmpdir(), 'ccvault-mcp-test-'))
    process.env.VAULT_DIR = testDir
  })

  beforeEach(() => {
    ctx = createVault()
  })

  afterEach(() => {
    clearVault(ctx)
  })

  afterAll(() => {
    closeVault(ctx)
    rmSync(testDir, { recursive: true, force: true })
    delete process.env.VAULT_DIR
  })

  describe('vault_set operation', () => {
    it('should store content with key', () => {
      const tmpFile = join(testDir, 'test.txt')
      writeFileSync(tmpFile, 'test content')

      const path = vault.setEntry(ctx, 'test-key', tmpFile, {
        description: 'test description',
      })

      expect(path).toContain('test-key_1.txt')
    })
  })

  describe('vault_get operation', () => {
    it('should retrieve content by key', () => {
      const tmpFile = join(testDir, 'test.txt')
      writeFileSync(tmpFile, 'test content')
      vault.setEntry(ctx, 'test-key', tmpFile)

      const content = vault.catEntry(ctx, 'test-key')
      expect(content).toBe('test content')
    })

    it('should return undefined for non-existent key', () => {
      const content = vault.catEntry(ctx, 'non-existent')
      expect(content).toBeUndefined()
    })
  })

  describe('vault_list operation', () => {
    it('should list all entries', () => {
      const file1 = join(testDir, 'file1.txt')
      const file2 = join(testDir, 'file2.txt')
      writeFileSync(file1, 'content1')
      writeFileSync(file2, 'content2')

      vault.setEntry(ctx, 'key1', file1)
      vault.setEntry(ctx, 'key2', file2)

      const entries = vault.listEntries(ctx)
      expect(entries).toHaveLength(2)
      expect(entries.map(e => e.key).sort()).toEqual(['key1', 'key2'])
    })

    it('should list all versions when requested', () => {
      const file = join(testDir, 'file.txt')
      writeFileSync(file, 'v1')
      vault.setEntry(ctx, 'key', file)

      writeFileSync(file, 'v2')
      vault.setEntry(ctx, 'key', file)

      const latestOnly = vault.listEntries(ctx)
      expect(latestOnly).toHaveLength(1)
      expect(latestOnly[0].version).toBe(2)

      const allVersions = vault.listEntries(ctx, { allVersions: true })
      expect(allVersions).toHaveLength(2)
    })
  })

  describe('vault_delete operation', () => {
    it('should delete entry', () => {
      const file = join(testDir, 'file.txt')
      writeFileSync(file, 'content')
      vault.setEntry(ctx, 'test-key', file)

      const success = vault.deleteEntry(ctx, 'test-key')
      expect(success).toBe(true)

      const content = vault.catEntry(ctx, 'test-key')
      expect(content).toBeUndefined()
    })

    it('should delete specific version', () => {
      const file = join(testDir, 'file.txt')
      writeFileSync(file, 'v1')
      vault.setEntry(ctx, 'key', file)

      writeFileSync(file, 'v2')
      vault.setEntry(ctx, 'key', file)

      const success = vault.deleteEntry(ctx, 'key', { version: 1 })
      expect(success).toBe(true)

      const v1 = vault.catEntry(ctx, 'key', { version: 1 })
      expect(v1).toBeUndefined()

      const v2 = vault.catEntry(ctx, 'key', { version: 2 })
      expect(v2).toBe('v2')
    })
  })

  describe('vault_info operation', () => {
    it('should return entry metadata', () => {
      const file = join(testDir, 'file.txt')
      writeFileSync(file, 'content')
      vault.setEntry(ctx, 'test-key', file, { description: 'test info' })

      const info = vault.getInfo(ctx, 'test-key')

      expect(info).toBeDefined()
      expect(info?.key).toBe('test-key')
      expect(info?.version).toBe(1)
      expect(info?.description).toBe('test info')
    })

    it('should return undefined for non-existent key', () => {
      const info = vault.getInfo(ctx, 'non-existent')
      expect(info).toBeUndefined()
    })
  })
})
