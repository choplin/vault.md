import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase, closeDatabase } from '../src/core/database/connection.js'
import { EntryService } from '../src/core/services/entry.service.js'
import { ScopeService } from '../src/core/services/scope.service.js'
import * as fs from '../src/core/filesystem.js'
import { type BranchScope, type GlobalScope, type RepositoryScope } from '../src/core/scope.js'
import { resolveVaultContext, moveScope, type VaultContext } from '../src/core/vault.js'

vi.mock('../src/core/git.js', () => ({
  getGitInfo: vi.fn().mockReturnValue({
    isGitRepo: true,
    primaryWorktreePath: '/test/repo',
    currentWorktreePath: '/test/repo',
    currentBranch: 'main',
  }),
}))

describe('moveScope', () => {
  let ctx: VaultContext
  let originalEnv: string | undefined
  let tempDir: string

  beforeEach(() => {
    originalEnv = process.env.VAULT_DIR
    // Create a unique temporary directory for each test
    tempDir = `/tmp/vault-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    process.env.VAULT_DIR = tempDir
    ctx = resolveVaultContext()
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.VAULT_DIR = originalEnv
    } else {
      delete process.env.VAULT_DIR
    }
    // Clean up temp directory
    if (tempDir) {
      try {
        const fs = require('fs')
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  describe('successful moves', () => {
    beforeEach(() => {
      // Setup mock file system
      vi.spyOn(fs, 'saveFile').mockImplementation((scopePath, key, version, content) => ({
        path: `/mock/path/${scopePath}/${key}/${version}`,
        hash: 'mockhash',
      }))
      vi.spyOn(fs, 'readFile').mockImplementation(() => 'test content')
      vi.spyOn(fs, 'verifyFile').mockImplementation(() => true)
    })

    it('should move data from branch scope to repository scope', async () => {
      // Given: data exists in branch scope
      const branchScope: BranchScope = {
        type: 'branch',
        primaryPath: '/test/repo',
        branchName: 'feature-x',
      }
      const repoScope: RepositoryScope = {
        type: 'repository',
        primaryPath: '/test/repo',
      }

      const fromScopeId = ctx.scopeService.getOrCreate(branchScope)
      await ctx.entryService.create({
        scopeId: fromScopeId,
        key: 'test-key',
        version: 1,
        filePath: '/mock/path/branch/test-key/1',
        hash: 'mockhash',
        description: 'test description',
      })

      // When: moveScope is called
      await moveScope(ctx, 'test-key', branchScope, repoScope)

      // Then: data should be in repository scope with same version
      const toScopeId = ctx.scopeService.getOrCreate(repoScope)
      const movedEntry = await ctx.entryService.getLatest(toScopeId, 'test-key')
      expect(movedEntry).toBeDefined()
      expect(movedEntry?.version).toBe(1)
      expect(movedEntry?.description).toBe('test description')

      // And: data should be removed from branch scope
      const oldEntry = await ctx.entryService.getLatest(fromScopeId, 'test-key')
      expect(oldEntry).toBeUndefined()
    })

    it('should move data from repository scope to global scope', async () => {
      // Given: data exists in repository scope
      const repoScope: RepositoryScope = {
        type: 'repository',
        primaryPath: '/test/repo',
      }
      const globalScope: GlobalScope = {
        type: 'global',
      }

      const fromScopeId = ctx.scopeService.getOrCreate(repoScope)
      await ctx.entryService.create({
        scopeId: fromScopeId,
        key: 'config-key',
        version: 2,
        filePath: '/mock/path/repo/config-key/2',
        hash: 'mockhash',
        description: 'global config',
      })

      // When: moveScope is called
      await moveScope(ctx, 'config-key', repoScope, globalScope)

      // Then: data should be in global scope
      const toScopeId = ctx.scopeService.getOrCreate(globalScope)
      const movedEntry = await ctx.entryService.getLatest(toScopeId, 'config-key')
      expect(movedEntry).toBeDefined()
      expect(movedEntry?.version).toBe(2)
      expect(movedEntry?.description).toBe('global config')

      // And: data should be removed from repository scope
      const oldEntry = await ctx.entryService.getLatest(fromScopeId, 'config-key')
      expect(oldEntry).toBeUndefined()
    })

    it('should preserve all versions when moving between scopes', async () => {
      // Given: multiple versions exist in source scope
      const branchScope: BranchScope = {
        type: 'branch',
        primaryPath: '/test/repo',
        branchName: 'main',
      }
      const repoScope: RepositoryScope = {
        type: 'repository',
        primaryPath: '/test/repo',
      }

      const fromScopeId = ctx.scopeService.getOrCreate(branchScope)
      // Insert 3 versions
      for (let i = 1; i <= 3; i++) {
        await ctx.entryService.create({
          scopeId: fromScopeId,
          key: 'versioned-key',
          version: i,
          filePath: `/mock/path/branch/versioned-key/${i}`,
          hash: `mockhash${i}`,
          description: `version ${i}`,
        })
      }

      // When: moveScope is called
      await moveScope(ctx, 'versioned-key', branchScope, repoScope)

      // Then: all versions should be in target scope
      const toScopeId = ctx.scopeService.getOrCreate(repoScope)
      const allVersions = (await ctx.entryService.list(toScopeId, true, true)).filter((e) => e.key === 'versioned-key')
      expect(allVersions).toHaveLength(3)
      expect(allVersions.map((v) => v.version).sort((a, b) => b - a)).toEqual([3, 2, 1])
      expect(allVersions.map((v) => v.description).sort()).toEqual(['version 1', 'version 2', 'version 3'])
    })
  })

  describe('error cases', () => {
    it('should throw error when key already exists in target scope', async () => {
      // Given: data exists in both source and target scopes
      const branchScope: BranchScope = {
        type: 'branch',
        primaryPath: '/test/repo',
        branchName: 'feature-x',
      }
      const repoScope: RepositoryScope = {
        type: 'repository',
        primaryPath: '/test/repo',
      }

      const fromScopeId = ctx.scopeService.getOrCreate(branchScope)
      const toScopeId = ctx.scopeService.getOrCreate(repoScope)

      await ctx.entryService.create({
        scopeId: fromScopeId,
        key: 'conflict-key',
        version: 1,
        filePath: '/mock/path/branch/conflict-key/1',
        hash: 'mockhash1',
        description: 'from branch',
      })

      await ctx.entryService.create({
        scopeId: toScopeId,
        key: 'conflict-key',
        version: 1,
        filePath: '/mock/path/repo/conflict-key/1',
        hash: 'mockhash2',
        description: 'already in repo',
      })

      // When/Then: moveScope should throw error
      await expect(moveScope(ctx, 'conflict-key', branchScope, repoScope)).rejects.toThrow('Key already exists in target scope')
    })

    it('should throw error when key not found in source scope', async () => {
      // Given: key does not exist in source scope
      const branchScope: BranchScope = {
        type: 'branch',
        primaryPath: '/test/repo',
        branchName: 'feature-x',
      }
      const repoScope: RepositoryScope = {
        type: 'repository',
        primaryPath: '/test/repo',
      }

      // When/Then: moveScope should throw error
      await expect(moveScope(ctx, 'non-existent-key', branchScope, repoScope)).rejects.toThrow('Key not found in source scope')
    })

    it('should throw error when source and target scopes are the same', async () => {
      // Given: source and target are the same repository scope
      const repoScope: RepositoryScope = {
        type: 'repository',
        primaryPath: '/test/repo',
      }

      // When/Then: moveScope should throw error
      await expect(moveScope(ctx, 'any-key', repoScope, repoScope)).rejects.toThrow('Source and target scopes must be different')
    })

    it('should throw error when trying to move from global to same global scope', async () => {
      // Given: source and target are both global scopes
      const globalScope: GlobalScope = {
        type: 'global',
      }

      // When/Then: moveScope should throw error
      await expect(moveScope(ctx, 'any-key', globalScope, globalScope)).rejects.toThrow('Source and target scopes must be different')
    })
  })
})
