import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as db from '../src/core/database.js'
import * as fs from '../src/core/filesystem.js'
import { type BranchScope, type GlobalScope, type RepositoryScope } from '../src/core/scope.js'
import { createVault, moveScope, type VaultContext } from '../src/core/vault.js'

vi.mock('../src/core/git.js', () => ({
  getGitInfo: vi.fn().mockReturnValue({
    isGitRepo: true,
    repoRoot: '/test/repo',
    currentBranch: 'main',
    remoteUrl: 'https://github.com/test/repo.git',
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
    ctx = createVault()
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

    it('should move data from branch scope to repository scope', () => {
      // Given: data exists in branch scope
      const branchScope: BranchScope = {
        type: 'branch',
        identifier: '/test/repo',
        branch: 'feature-x',
        workPath: '/test/repo',
        remoteUrl: 'https://github.com/test/repo.git',
      }
      const repoScope: RepositoryScope = {
        type: 'repository',
        identifier: '/test/repo',
        workPath: '/test/repo',
        remoteUrl: 'https://github.com/test/repo.git',
      }

      const fromScopeId = db.getOrCreateScope(ctx.database, branchScope)
      db.insertScopedEntry(ctx.database, {
        scopeId: fromScopeId,
        key: 'test-key',
        version: 1,
        filePath: '/mock/path/branch/test-key/1',
        hash: 'mockhash',
        description: 'test description',
      })

      // When: moveScope is called
      moveScope(ctx, 'test-key', branchScope, repoScope)

      // Then: data should be in repository scope with same version
      const toScopeId = db.getOrCreateScope(ctx.database, repoScope)
      const movedEntry = db.getLatestScopedEntry(ctx.database, toScopeId, 'test-key')
      expect(movedEntry).toBeDefined()
      expect(movedEntry?.version).toBe(1)
      expect(movedEntry?.description).toBe('test description')

      // And: data should be removed from branch scope
      const oldEntry = db.getLatestScopedEntry(ctx.database, fromScopeId, 'test-key')
      expect(oldEntry).toBeUndefined()
    })

    it('should move data from repository scope to global scope', () => {
      // Given: data exists in repository scope
      const repoScope: RepositoryScope = {
        type: 'repository',
        identifier: '/test/repo',
        workPath: '/test/repo',
        remoteUrl: 'https://github.com/test/repo.git',
      }
      const globalScope: GlobalScope = {
        type: 'global',
      }

      const fromScopeId = db.getOrCreateScope(ctx.database, repoScope)
      db.insertScopedEntry(ctx.database, {
        scopeId: fromScopeId,
        key: 'config-key',
        version: 2,
        filePath: '/mock/path/repo/config-key/2',
        hash: 'mockhash',
        description: 'global config',
      })

      // When: moveScope is called
      moveScope(ctx, 'config-key', repoScope, globalScope)

      // Then: data should be in global scope
      const toScopeId = db.getOrCreateScope(ctx.database, globalScope)
      const movedEntry = db.getLatestScopedEntry(ctx.database, toScopeId, 'config-key')
      expect(movedEntry).toBeDefined()
      expect(movedEntry?.version).toBe(2)
      expect(movedEntry?.description).toBe('global config')

      // And: data should be removed from repository scope
      const oldEntry = db.getLatestScopedEntry(ctx.database, fromScopeId, 'config-key')
      expect(oldEntry).toBeUndefined()
    })

    it('should preserve all versions when moving between scopes', () => {
      // Given: multiple versions exist in source scope
      const branchScope: BranchScope = {
        type: 'branch',
        identifier: '/test/repo',
        branch: 'main',
        workPath: '/test/repo',
        remoteUrl: 'https://github.com/test/repo.git',
      }
      const repoScope: RepositoryScope = {
        type: 'repository',
        identifier: '/test/repo',
        workPath: '/test/repo',
        remoteUrl: 'https://github.com/test/repo.git',
      }

      const fromScopeId = db.getOrCreateScope(ctx.database, branchScope)
      // Insert 3 versions
      for (let i = 1; i <= 3; i++) {
        db.insertScopedEntry(ctx.database, {
          scopeId: fromScopeId,
          key: 'versioned-key',
          version: i,
          filePath: `/mock/path/branch/versioned-key/${i}`,
          hash: `mockhash${i}`,
          description: `version ${i}`,
        })
      }

      // When: moveScope is called
      moveScope(ctx, 'versioned-key', branchScope, repoScope)

      // Then: all versions should be in target scope
      const toScopeId = db.getOrCreateScope(ctx.database, repoScope)
      const allVersions = db.listScopedEntries(ctx.database, toScopeId, true).filter((e) => e.key === 'versioned-key')
      expect(allVersions).toHaveLength(3)
      expect(allVersions.map((v) => v.version).sort((a, b) => b - a)).toEqual([3, 2, 1])
      expect(allVersions.map((v) => v.description).sort()).toEqual(['version 1', 'version 2', 'version 3'])
    })
  })

  describe('error cases', () => {
    it('should throw error when key already exists in target scope', () => {
      // Given: data exists in both source and target scopes
      const branchScope: BranchScope = {
        type: 'branch',
        identifier: '/test/repo',
        branch: 'feature-x',
        workPath: '/test/repo',
        remoteUrl: 'https://github.com/test/repo.git',
      }
      const repoScope: RepositoryScope = {
        type: 'repository',
        identifier: '/test/repo',
        workPath: '/test/repo',
        remoteUrl: 'https://github.com/test/repo.git',
      }

      const fromScopeId = db.getOrCreateScope(ctx.database, branchScope)
      const toScopeId = db.getOrCreateScope(ctx.database, repoScope)

      db.insertScopedEntry(ctx.database, {
        scopeId: fromScopeId,
        key: 'conflict-key',
        version: 1,
        filePath: '/mock/path/branch/conflict-key/1',
        hash: 'mockhash1',
        description: 'from branch',
      })

      db.insertScopedEntry(ctx.database, {
        scopeId: toScopeId,
        key: 'conflict-key',
        version: 1,
        filePath: '/mock/path/repo/conflict-key/1',
        hash: 'mockhash2',
        description: 'already in repo',
      })

      // When/Then: moveScope should throw error
      expect(() => {
        moveScope(ctx, 'conflict-key', branchScope, repoScope)
      }).toThrow('Key already exists in target scope')
    })

    it('should throw error when key not found in source scope', () => {
      // Given: key does not exist in source scope
      const branchScope: BranchScope = {
        type: 'branch',
        identifier: '/test/repo',
        branch: 'feature-x',
        workPath: '/test/repo',
        remoteUrl: 'https://github.com/test/repo.git',
      }
      const repoScope: RepositoryScope = {
        type: 'repository',
        identifier: '/test/repo',
        workPath: '/test/repo',
        remoteUrl: 'https://github.com/test/repo.git',
      }

      // When/Then: moveScope should throw error
      expect(() => {
        moveScope(ctx, 'non-existent-key', branchScope, repoScope)
      }).toThrow('Key not found in source scope')
    })

    it('should throw error when source and target scopes are the same', () => {
      // Given: source and target are the same repository scope
      const repoScope: RepositoryScope = {
        type: 'repository',
        identifier: '/test/repo',
        workPath: '/test/repo',
        remoteUrl: 'https://github.com/test/repo.git',
      }

      // When/Then: moveScope should throw error
      expect(() => {
        moveScope(ctx, 'any-key', repoScope, repoScope)
      }).toThrow('Source and target scopes must be different')
    })

    it('should throw error when trying to move from global to same global scope', () => {
      // Given: source and target are both global scopes
      const globalScope: GlobalScope = {
        type: 'global',
      }

      // When/Then: moveScope should throw error
      expect(() => {
        moveScope(ctx, 'any-key', globalScope, globalScope)
      }).toThrow('Source and target scopes must be different')
    })
  })
})
