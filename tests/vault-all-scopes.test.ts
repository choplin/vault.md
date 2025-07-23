import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { createVault, setEntry, getEntry, closeVault } from '../src/core/vault.js'
import type { VaultContext } from '../src/core/types.js'
import * as git from '../src/core/git.js'

describe('getEntry with allScopes option', () => {
  let testDir: string
  let vaultDir: string
  let globalContext: VaultContext
  let repoContext: VaultContext
  let branchContext: VaultContext

  beforeEach(() => {
    // Create test directory
    testDir = join(tmpdir(), `vault-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })

    // Create isolated vault directory for this test
    vaultDir = join(tmpdir(), `vault-db-${Date.now()}`)
    mkdirSync(vaultDir, { recursive: true })
    process.env.VAULT_DIR = vaultDir

    // Mock git functions
    vi.spyOn(git, 'getGitInfo').mockReturnValue({
      isGitRepo: true,
      repoRoot: testDir,
      currentBranch: 'main',
      isWorktree: false,
      remoteUrl: 'https://github.com/test/repo.git'
    })
  })

  afterEach(() => {
    if (globalContext) closeVault(globalContext)
    if (repoContext) closeVault(repoContext)
    if (branchContext) closeVault(branchContext)
    rmSync(testDir, { recursive: true, force: true })
    rmSync(vaultDir, { recursive: true, force: true })
    delete process.env.VAULT_DIR
    vi.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should use allScopes to find entry in current scope', () => {
      branchContext = createVault({ scope: 'branch' })

      // Create test file
      const testFile = join(testDir, 'test.txt')
      writeFileSync(testFile, 'branch content')

      // Set entry in branch scope
      setEntry(branchContext, 'test-key', testFile)

      // Get with allScopes should find it
      const result = getEntry(branchContext, 'test-key', { allScopes: true })
      expect(result).toBeDefined()

      // Verify content
      const content = readFileSync(result!, 'utf-8')
      expect(content).toBe('branch content')
    })

    it('should use allScopes to fall back to repository scope', () => {
      repoContext = createVault({ scope: 'repository' })
      branchContext = createVault({ scope: 'branch' })

      // Create test file
      const repoFile = join(testDir, 'repo.txt')
      writeFileSync(repoFile, 'repository content')

      // Set entry only in repository scope
      setEntry(repoContext, 'test-key', repoFile)

      // Get from branch with allScopes should find repository entry
      const result = getEntry(branchContext, 'test-key', { allScopes: true })
      expect(result).toBeDefined()

      // Verify it's the repository version
      const content = readFileSync(result!, 'utf-8')
      expect(content).toBe('repository content')
    })

    it('should use allScopes to fall back to global scope', () => {
      globalContext = createVault({ scope: 'global' })
      branchContext = createVault({ scope: 'branch' })

      // Create test file
      const globalFile = join(testDir, 'global.txt')
      writeFileSync(globalFile, 'global content')

      // Set entry only in global scope
      setEntry(globalContext, 'test-key', globalFile)

      // Get from branch with allScopes should find global entry
      const result = getEntry(branchContext, 'test-key', { allScopes: true })
      expect(result).toBeDefined()

      // Verify it's the global version
      const content = readFileSync(result!, 'utf-8')
      expect(content).toBe('global content')
    })

    it('should return undefined when not found in any scope with allScopes', () => {
      branchContext = createVault({ scope: 'branch' })

      // Get non-existent key with allScopes
      const result = getEntry(branchContext, 'non-existent', { allScopes: true })
      expect(result).toBeUndefined()
    })
  })

  describe('comparison with non-allScopes', () => {
    it('should NOT fall back without allScopes option', () => {
      globalContext = createVault({ scope: 'global' })
      branchContext = createVault({ scope: 'branch' })

      // Create test file
      const globalFile = join(testDir, 'global.txt')
      writeFileSync(globalFile, 'global content')

      // Set entry only in global scope
      setEntry(globalContext, 'test-key', globalFile)

      // Get from branch WITHOUT allScopes should NOT find it
      const result = getEntry(branchContext, 'test-key')
      expect(result).toBeUndefined()

      // But WITH allScopes should find it
      const resultWithAllScopes = getEntry(branchContext, 'test-key', { allScopes: true })
      expect(resultWithAllScopes).toBeDefined()
    })

    it('should use explicit scope when allScopes is false', () => {
      globalContext = createVault({ scope: 'global' })
      repoContext = createVault({ scope: 'repository' })
      branchContext = createVault({ scope: 'branch' })

      // Create test files
      const globalFile = join(testDir, 'global.txt')
      const repoFile = join(testDir, 'repo.txt')
      writeFileSync(globalFile, 'global content')
      writeFileSync(repoFile, 'repo content')

      // Set different values in different scopes
      setEntry(globalContext, 'test-key', globalFile)
      setEntry(repoContext, 'test-key', repoFile)

      // Get with explicit scope (without allScopes) should get from specified scope
      const result = getEntry(branchContext, 'test-key', { scope: 'global' })
      expect(result).toBeDefined()

      // Should get global version
      const content = readFileSync(result!, 'utf-8')
      expect(content).toBe('global content')

      // When using allScopes from branch context, it searches from branch -> repo -> global
      const resultWithAllScopes = getEntry(branchContext, 'test-key', { allScopes: true })
      expect(resultWithAllScopes).toBeDefined()

      // Should get repo version (since branch doesn't have it, falls back to repo)
      const contentWithAllScopes = readFileSync(resultWithAllScopes!, 'utf-8')
      expect(contentWithAllScopes).toBe('repo content')
    })
  })

  describe('priority order', () => {
    it('should follow branch -> repository -> global order', () => {
      globalContext = createVault({ scope: 'global' })
      repoContext = createVault({ scope: 'repository' })
      branchContext = createVault({ scope: 'branch' })

      // Create test files with different content
      const globalFile = join(testDir, 'global.txt')
      const repoFile = join(testDir, 'repo.txt')
      const branchFile = join(testDir, 'branch.txt')
      writeFileSync(globalFile, 'global priority 3')
      writeFileSync(repoFile, 'repo priority 2')
      writeFileSync(branchFile, 'branch priority 1')

      // Set same key in all scopes
      setEntry(globalContext, 'priority-test', globalFile)
      setEntry(repoContext, 'priority-test', repoFile)
      setEntry(branchContext, 'priority-test', branchFile)

      // From branch context, should get branch version
      const branchResult = getEntry(branchContext, 'priority-test', { allScopes: true })
      expect(readFileSync(branchResult!, 'utf-8')).toBe('branch priority 1')

      // From repo context, should get repo version
      const repoResult = getEntry(repoContext, 'priority-test', { allScopes: true })
      expect(readFileSync(repoResult!, 'utf-8')).toBe('repo priority 2')

      // From global context, should get global version
      const globalResult = getEntry(globalContext, 'priority-test', { allScopes: true })
      expect(readFileSync(globalResult!, 'utf-8')).toBe('global priority 3')
    })
  })

  describe('version handling with allScopes', () => {
    it('should respect version parameter with allScopes', () => {
      globalContext = createVault({ scope: 'global' })
      branchContext = createVault({ scope: 'branch' })

      // Create test files
      const file1 = join(testDir, 'v1.txt')
      const file2 = join(testDir, 'v2.txt')
      writeFileSync(file1, 'version 1 content')
      writeFileSync(file2, 'version 2 content')

      // Set two versions in global
      setEntry(globalContext, 'versioned-key', file1)
      setEntry(globalContext, 'versioned-key', file2)

      // Get specific version with allScopes from different context
      const result = getEntry(branchContext, 'versioned-key', { allScopes: true, version: 1 })
      expect(result).toBeDefined()

      // Verify it's version 1
      const content = readFileSync(result!, 'utf-8')
      expect(content).toBe('version 1 content')
    })

    it('should find latest version by default with allScopes', () => {
      globalContext = createVault({ scope: 'global' })
      branchContext = createVault({ scope: 'branch' })

      // Create test files
      const file1 = join(testDir, 'v1.txt')
      const file2 = join(testDir, 'v2.txt')
      writeFileSync(file1, 'old content')
      writeFileSync(file2, 'new content')

      // Set two versions in global
      setEntry(globalContext, 'versioned-key', file1)
      setEntry(globalContext, 'versioned-key', file2)

      // Get without version should return latest
      const result = getEntry(branchContext, 'versioned-key', { allScopes: true })
      expect(result).toBeDefined()

      // Verify it's the latest version
      const content = readFileSync(result!, 'utf-8')
      expect(content).toBe('new content')
    })
  })

  describe('edge cases', () => {
    it('should handle allScopes from global scope', () => {
      globalContext = createVault({ scope: 'global' })

      // Create test file
      const globalFile = join(testDir, 'global.txt')
      writeFileSync(globalFile, 'global only content')

      // Set entry in global
      setEntry(globalContext, 'test-key', globalFile)

      // Get with allScopes from global should still work
      const result = getEntry(globalContext, 'test-key', { allScopes: true })
      expect(result).toBeDefined()

      const content = readFileSync(result!, 'utf-8')
      expect(content).toBe('global only content')
    })

    it('should handle allScopes with custom repository path', () => {
      const customRepoPath = join(testDir, 'custom-repo')
      mkdirSync(customRepoPath, { recursive: true })

      // Mock git info for custom repo
      vi.spyOn(git, 'getGitInfo').mockReturnValue({
        isGitRepo: true,
        repoRoot: customRepoPath,
        currentBranch: 'develop',
        isWorktree: false,
        remoteUrl: 'https://github.com/test/custom.git'
      })

      const customContext = createVault({ scope: 'repository', repo: customRepoPath })

      // Create test file
      const customFile = join(testDir, 'custom.txt')
      writeFileSync(customFile, 'custom repo content')

      // Set entry in custom repo
      setEntry(customContext, 'custom-key', customFile)

      // Get with allScopes should work
      const result = getEntry(customContext, 'custom-key', { allScopes: true })
      expect(result).toBeDefined()

      const content = readFileSync(result!, 'utf-8')
      expect(content).toBe('custom repo content')

      closeVault(customContext)
    })

    it('should throw error on file integrity failure even with allScopes', () => {
      branchContext = createVault({ scope: 'branch' })

      // Create test file
      const testFile = join(testDir, 'test.txt')
      writeFileSync(testFile, 'original content')

      // Set entry and get vault path
      const vaultPath = setEntry(branchContext, 'test-key', testFile)

      // Corrupt the vault file
      writeFileSync(vaultPath, 'corrupted content')

      // Should throw error even with allScopes
      expect(() => getEntry(branchContext, 'test-key', { allScopes: true })).toThrow('File integrity check failed')
    })
  })
})
