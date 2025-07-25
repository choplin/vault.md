import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { resolveVaultContext, setEntry, getEntryWithFallback, closeVault, catEntry } from '../src/core/vault.js'
import type { VaultContext } from '../src/core/types.js'
import * as git from '../src/core/git.js'

describe('getEntryWithFallback', () => {
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

  describe('global scope fallback', () => {
    it('should return entry from global scope when searching from global scope', () => {
      globalContext = resolveVaultContext({ scope: 'global' })

      // Create test file
      const testFile = join(testDir, 'test.txt')
      writeFileSync(testFile, 'global content')

      // Set entry in global scope
      setEntry(globalContext, 'test-key', testFile)

      // Get entry should find it
      const result = getEntryWithFallback(globalContext, 'test-key')
      expect(result).toBeDefined()
      expect(result).toContain('test-key')
    })

    it('should return undefined when entry not found in global scope', () => {
      globalContext = resolveVaultContext({ scope: 'global' })

      const result = getEntryWithFallback(globalContext, 'non-existent')
      expect(result).toBeUndefined()
    })
  })

  describe('repository scope fallback', () => {
    it('should find entry in repository scope first', () => {
      globalContext = resolveVaultContext({ scope: 'global' })
      repoContext = resolveVaultContext({ scope: 'repository' })

      // Create test files
      const globalFile = join(testDir, 'global.txt')
      const repoFile = join(testDir, 'repo.txt')
      writeFileSync(globalFile, 'global content')
      writeFileSync(repoFile, 'repo content')

      // Set same key in both scopes
      setEntry(globalContext, 'test-key', globalFile)
      setEntry(repoContext, 'test-key', repoFile)

      // Should find repo version first
      const result = getEntryWithFallback(repoContext, 'test-key')
      expect(result).toBeDefined()
      // Verify it's the repo version by reading content
      const content = readFileSync(result, 'utf-8')
      expect(content).toBe('repo content')
    })

    it('should fall back to global scope when not found in repository', () => {
      globalContext = resolveVaultContext({ scope: 'global' })
      repoContext = resolveVaultContext({ scope: 'repository' })

      // Create test file
      const globalFile = join(testDir, 'global.txt')
      writeFileSync(globalFile, 'global content')

      // Set entry only in global scope
      setEntry(globalContext, 'test-key', globalFile)

      // Should fall back to global
      const result = getEntryWithFallback(repoContext, 'test-key')
      expect(result).toBeDefined()
      // Verify it's the global version by reading content
      const content = readFileSync(result, 'utf-8')
      expect(content).toBe('global content')
    })

    it('should return undefined when not found in either scope', () => {
      repoContext = resolveVaultContext({ scope: 'repository' })

      const result = getEntryWithFallback(repoContext, 'non-existent')
      expect(result).toBeUndefined()
    })
  })

  describe('branch scope fallback', () => {
    it('should find entry in branch scope first', () => {
      globalContext = resolveVaultContext({ scope: 'global' })
      repoContext = resolveVaultContext({ scope: 'repository' })
      branchContext = resolveVaultContext({ scope: 'branch' })

      // Create test files
      const globalFile = join(testDir, 'global.txt')
      const repoFile = join(testDir, 'repo.txt')
      const branchFile = join(testDir, 'branch.txt')
      writeFileSync(globalFile, 'global content')
      writeFileSync(repoFile, 'repo content')
      writeFileSync(branchFile, 'branch content')

      // Set same key in all scopes
      setEntry(globalContext, 'test-key', globalFile)
      setEntry(repoContext, 'test-key', repoFile)
      setEntry(branchContext, 'test-key', branchFile)

      // Should find branch version first
      const result = getEntryWithFallback(branchContext, 'test-key')
      expect(result).toBeDefined()
      // Verify it's the branch version by reading content
      const content = readFileSync(result, 'utf-8')
      expect(content).toBe('branch content')
    })

    it('should fall back to repository scope when not found in branch', () => {
      globalContext = resolveVaultContext({ scope: 'global' })
      repoContext = resolveVaultContext({ scope: 'repository' })
      branchContext = resolveVaultContext({ scope: 'branch' })

      // Create test files
      const globalFile = join(testDir, 'global.txt')
      const repoFile = join(testDir, 'repo.txt')
      writeFileSync(globalFile, 'global content')
      writeFileSync(repoFile, 'repo content')

      // Set entry in global and repo, but not branch
      setEntry(globalContext, 'test-key', globalFile)
      setEntry(repoContext, 'test-key', repoFile)

      // Should fall back to repo
      const result = getEntryWithFallback(branchContext, 'test-key')
      expect(result).toBeDefined()
      // Verify it's the repo version by reading content
      const content = readFileSync(result, 'utf-8')
      expect(content).toBe('repo content')
    })

    it('should fall back to global scope when not found in branch or repository', () => {
      globalContext = resolveVaultContext({ scope: 'global' })
      branchContext = resolveVaultContext({ scope: 'branch' })

      // Create test file
      const globalFile = join(testDir, 'global.txt')
      writeFileSync(globalFile, 'global content')

      // Set entry only in global
      setEntry(globalContext, 'test-key', globalFile)

      // Should fall back to global
      const result = getEntryWithFallback(branchContext, 'test-key')
      expect(result).toBeDefined()
      // Verify it's the global version by reading content
      const content = readFileSync(result, 'utf-8')
      expect(content).toBe('global content')
    })

    it('should return undefined when not found in any scope', () => {
      branchContext = resolveVaultContext({ scope: 'branch' })

      const result = getEntryWithFallback(branchContext, 'non-existent')
      expect(result).toBeUndefined()
    })
  })

  describe('version handling', () => {
    it('should respect version parameter in fallback search', () => {
      globalContext = resolveVaultContext({ scope: 'global' })
      branchContext = resolveVaultContext({ scope: 'branch' })

      // Create test files
      const file1 = join(testDir, 'v1.txt')
      const file2 = join(testDir, 'v2.txt')
      writeFileSync(file1, 'version 1')
      writeFileSync(file2, 'version 2')

      // Set two versions in global
      setEntry(globalContext, 'test-key', file1)
      setEntry(globalContext, 'test-key', file2)

      // Get specific version from branch context (should fall back to global)
      const result = getEntryWithFallback(branchContext, 'test-key', 1)
      expect(result).toBeDefined()
      // Verify it's version 1 by reading content
      const content = readFileSync(result, 'utf-8')
      expect(content).toBe('version 1')
    })

    it('should find specific version in current scope before falling back', () => {
      repoContext = resolveVaultContext({ scope: 'repository' })
      branchContext = resolveVaultContext({ scope: 'branch' })

      // Create test files
      const repoFile = join(testDir, 'repo-v1.txt')
      const branchFile1 = join(testDir, 'branch-v1.txt')
      const branchFile2 = join(testDir, 'branch-v2.txt')
      writeFileSync(repoFile, 'repo version')
      writeFileSync(branchFile1, 'branch version 1')
      writeFileSync(branchFile2, 'branch version 2')

      // Set versions
      setEntry(repoContext, 'test-key', repoFile)
      setEntry(branchContext, 'test-key', branchFile1)
      setEntry(branchContext, 'test-key', branchFile2)

      // Get version 1 from branch (should not fall back)
      const result = getEntryWithFallback(branchContext, 'test-key', 1)
      expect(result).toBeDefined()
      // Verify it's branch version 1 by reading content
      const content = readFileSync(result, 'utf-8')
      expect(content).toBe('branch version 1')
    })
  })

  describe('file integrity', () => {
    it('should throw error when file integrity check fails', () => {
      branchContext = resolveVaultContext({ scope: 'branch' })

      // Create test file
      const testFile = join(testDir, 'test.txt')
      writeFileSync(testFile, 'original content')

      // Set entry and get the actual vault path
      const vaultPath = setEntry(branchContext, 'test-key', testFile)

      // Modify the vault file directly to break integrity
      writeFileSync(vaultPath, 'modified content')

      // Should throw integrity error
      expect(() => getEntryWithFallback(branchContext, 'test-key')).toThrow('File integrity check failed')
    })

    it('should throw error when vault file is missing', () => {
      globalContext = resolveVaultContext({ scope: 'global' })
      branchContext = resolveVaultContext({ scope: 'branch' })

      // Create files
      const globalFile = join(testDir, 'global.txt')
      const branchFile = join(testDir, 'branch.txt')
      writeFileSync(globalFile, 'global content')
      writeFileSync(branchFile, 'branch content')

      // Set entries
      setEntry(globalContext, 'test-key', globalFile)
      const branchVaultPath = setEntry(branchContext, 'test-key', branchFile)

      // Remove vault file
      rmSync(branchVaultPath)

      // Should throw error, not fall back
      expect(() => getEntryWithFallback(branchContext, 'test-key')).toThrow('File integrity check failed')
    })
  })

  describe('cross-branch scenarios', () => {
    it('should not find entries from different branches', () => {
      // Create branch context for feature branch
      vi.spyOn(git, 'getGitInfo').mockReturnValue({
        isGitRepo: true,
        repoRoot: testDir,
        currentBranch: 'feature',
        isWorktree: false,
        remoteUrl: 'https://github.com/test/repo.git'
      })
      const featureContext = resolveVaultContext({ scope: 'branch' })

      // Create branch context for main branch
      vi.spyOn(git, 'getGitInfo').mockReturnValue({
        isGitRepo: true,
        repoRoot: testDir,
        currentBranch: 'main',
        isWorktree: false,
        remoteUrl: 'https://github.com/test/repo.git'
      })
      branchContext = resolveVaultContext({ scope: 'branch' })

      // Create test file
      const featureFile = join(testDir, 'feature.txt')
      writeFileSync(featureFile, 'feature content')

      // Set entry in feature branch
      setEntry(featureContext, 'test-key', featureFile)

      // Should not find it from main branch (should fall back to global, but no global entry exists)
      const result = getEntryWithFallback(branchContext, 'test-key')
      expect(result).toBeUndefined()

      closeVault(featureContext)
    })

    it('should find repository entries from any branch', () => {
      repoContext = resolveVaultContext({ scope: 'repository' })

      // Create test file
      const repoFile = join(testDir, 'repo.txt')
      writeFileSync(repoFile, 'repo content')

      // Set entry in repository scope
      setEntry(repoContext, 'test-key', repoFile)

      // Create branch contexts for different branches
      vi.spyOn(git, 'getGitInfo').mockReturnValue({
        isGitRepo: true,
        repoRoot: testDir,
        currentBranch: 'main',
        isWorktree: false,
        remoteUrl: 'https://github.com/test/repo.git'
      })
      const mainContext = resolveVaultContext({ scope: 'branch' })

      vi.spyOn(git, 'getGitInfo').mockReturnValue({
        isGitRepo: true,
        repoRoot: testDir,
        currentBranch: 'feature',
        isWorktree: false,
        remoteUrl: 'https://github.com/test/repo.git'
      })
      const featureContext = resolveVaultContext({ scope: 'branch' })

      // Both branches should find the repository entry
      const mainResult = getEntryWithFallback(mainContext, 'test-key')
      const featureResult = getEntryWithFallback(featureContext, 'test-key')

      expect(mainResult).toBeDefined()
      expect(featureResult).toBeDefined()
      expect(mainResult).toBe(featureResult)

      closeVault(mainContext)
      closeVault(featureContext)
    })
  })
})
