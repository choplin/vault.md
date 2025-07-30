import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resolveVaultContext, clearVault, closeVault } from '../src/core/vault.js'
import * as vault from '../src/core/vault.js'
import type { VaultContext } from '../src/core/vault.js'

describe('MCP Server Operations', () => {
  let testDir: string
  let ctx: VaultContext

  beforeAll(() => {
    // Set up isolated test directory
    testDir = mkdtempSync(join(tmpdir(), 'vault-mcp-test-'))
    process.env.VAULT_DIR = testDir
  })

  beforeEach(() => {
    ctx = resolveVaultContext()
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
    it('should store content with key', async () => {
      const tmpFile = join(testDir, 'test.txt')
      writeFileSync(tmpFile, 'test content')

      const path = await vault.setEntry(ctx, 'test-key', tmpFile, {
        description: 'test description',
      })

      expect(path).toContain('test-key_v1.txt')
    })
  })

  describe('vault_get operation', () => {
    it('should retrieve content by key', async () => {
      const tmpFile = join(testDir, 'test.txt')
      writeFileSync(tmpFile, 'test content')
      await vault.setEntry(ctx, 'test-key', tmpFile)

      const content = await vault.catEntry(ctx, 'test-key')
      expect(content).toBe('test content')
    })

    it('should return undefined for non-existent key', async () => {
      const content = await vault.catEntry(ctx, 'non-existent')
      expect(content).toBeUndefined()
    })
  })

  describe('vault_list operation', () => {
    it('should list all entries', async () => {
      const file1 = join(testDir, 'file1.txt')
      const file2 = join(testDir, 'file2.txt')
      writeFileSync(file1, 'content1')
      writeFileSync(file2, 'content2')

      await vault.setEntry(ctx, 'key1', file1)
      await vault.setEntry(ctx, 'key2', file2)

      const entries = await vault.listEntries(ctx)
      expect(entries).toHaveLength(2)
      expect(entries.map(e => e.key).sort()).toEqual(['key1', 'key2'])
    })

    it('should list all versions when requested', async () => {
      const file = join(testDir, 'file.txt')
      writeFileSync(file, 'v1')
      await vault.setEntry(ctx, 'key', file)

      writeFileSync(file, 'v2')
      await vault.setEntry(ctx, 'key', file)

      const latestOnly = await vault.listEntries(ctx)
      expect(latestOnly).toHaveLength(1)
      expect(latestOnly[0].version).toBe(2)

      const allVersions = await vault.listEntries(ctx, { allVersions: true })
      expect(allVersions).toHaveLength(2)
    })
  })

  describe('vault_delete operation', () => {
    it('should delete entry', async () => {
      const file = join(testDir, 'file.txt')
      writeFileSync(file, 'content')
      await vault.setEntry(ctx, 'test-key', file)

      const success = await vault.deleteEntry(ctx, 'test-key')
      expect(success).toBe(true)

      const content = await vault.catEntry(ctx, 'test-key')
      expect(content).toBeUndefined()
    })

    it('should delete specific version', async () => {
      const file = join(testDir, 'file.txt')
      writeFileSync(file, 'v1')
      await vault.setEntry(ctx, 'key', file)

      writeFileSync(file, 'v2')
      await vault.setEntry(ctx, 'key', file)

      const success = await vault.deleteEntry(ctx, 'key', { version: 1 })
      expect(success).toBe(true)

      const v1 = await vault.catEntry(ctx, 'key', { version: 1 })
      expect(v1).toBeUndefined()

      const v2 = await vault.catEntry(ctx, 'key', { version: 2 })
      expect(v2).toBe('v2')
    })
  })

  describe('vault_info operation', () => {
    it('should return entry metadata', async () => {
      const file = join(testDir, 'file.txt')
      writeFileSync(file, 'content')
      await vault.setEntry(ctx, 'test-key', file, { description: 'test info' })

      const info = await vault.getInfo(ctx, 'test-key')

      expect(info).toBeDefined()
      expect(info?.key).toBe('test-key')
      expect(info?.version).toBe(1)
      expect(info?.description).toBe('test info')
    })

    it('should return undefined for non-existent key', async () => {
      const info = await vault.getInfo(ctx, 'non-existent')
      expect(info).toBeUndefined()
    })
  })
})
