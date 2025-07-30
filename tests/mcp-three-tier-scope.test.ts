import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveVaultContext, clearVault, setEntry, catEntry, listEntries, deleteEntry, getInfo } from '../src/core/vault.js'
import type { VaultContext } from '../src/core/vault.js'
import * as git from '../src/core/git.js'

// Mock git module
vi.mock('../src/core/git.js', () => ({
  getGitInfo: vi.fn(),
}))

describe('MCP Server Three-Tier Scope Operations', () => {
  let testDir: string
  let ctx: VaultContext
  const mockGetGitInfo = vi.mocked(git.getGitInfo)

  beforeAll(() => {
    // Set up isolated test directory
    testDir = mkdtempSync(join(tmpdir(), 'vault-mcp-three-tier-test-'))
    process.env.VAULT_DIR = testDir

    // Set up default mock before any tests run
    mockGetGitInfo.mockReturnValue({
      isGitRepo: true,
      repoRoot: testDir,
      currentBranch: 'main',
      remoteUrl: 'https://github.com/example/repo.git',
    })
  })

  beforeEach(() => {
    // Create a new context for each test
    ctx = resolveVaultContext()

    // Reset mock to default state
    mockGetGitInfo.mockReturnValue({
      isGitRepo: true,
      repoRoot: testDir,
      currentBranch: 'main',
      remoteUrl: 'https://github.com/example/repo.git',
    })
  })

  afterEach(() => {
    clearVault(ctx)
    vi.clearAllMocks()
  })

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true })
    delete process.env.VAULT_DIR
  })

  describe('vault.setEntry with three-tier scopes (used by MCP vault_set)', () => {
    it('should store content in global scope', async () => {
      const tmpFile = join(testDir, 'global.txt')
      writeFileSync(tmpFile, 'global content')

      const path = await setEntry(ctx, 'global-key', tmpFile, {
        scope: 'global',
        description: 'global test',
      })

      expect(path).toContain('global-key_v1.txt')

      // Verify it's in global scope by creating a new context with global scope
      const globalCtx = resolveVaultContext({ scope: 'global' })
      const content = await catEntry(globalCtx, 'global-key')
      expect(content).toBe('global content')
    })

    it('should store content in repository scope by default', async () => {
      const tmpFile = join(testDir, 'repo.txt')
      writeFileSync(tmpFile, 'repo content')

      const path = await setEntry(ctx, 'repo-key', tmpFile, {
        description: 'repo test',
      })

      expect(path).toContain('repo-key_v1.txt')

      // Verify it's in repository scope
      const repoCtx = resolveVaultContext({ scope: 'repository' })
      const content = await catEntry(repoCtx, 'repo-key')
      expect(content).toBe('repo content')
    })

    it('should store content in branch scope', async () => {
      const tmpFile = join(testDir, 'branch.txt')
      writeFileSync(tmpFile, 'branch content')

      const path = await setEntry(ctx, 'branch-key', tmpFile, {
        scope: 'branch',
        description: 'branch test',
      })

      expect(path).toContain('branch-key_v1.txt')

      // Verify it's in branch scope
      const branchCtx = resolveVaultContext({ scope: 'branch' })
      const content = await catEntry(branchCtx, 'branch-key')
      expect(content).toBe('branch content')
    })

    it('should store content in specific branch', async () => {
      const tmpFile = join(testDir, 'feature.txt')
      writeFileSync(tmpFile, 'feature content')

      const path = await setEntry(ctx, 'feature-key', tmpFile, {
        scope: 'branch',
        branch: 'feature-x',
        description: 'feature branch test',
      })

      expect(path).toContain('feature-key_v1.txt')

      // Verify it's in the specific branch
      const featureCtx = resolveVaultContext({ scope: 'branch', branch: 'feature-x' })
      const content = await catEntry(featureCtx, 'feature-key')
      expect(content).toBe('feature content')
    })

    it('should error when using branch scope outside git repo', async () => {
      mockGetGitInfo.mockReturnValue({
        isGitRepo: false,
        repoRoot: null,
        currentBranch: null,
        remoteUrl: null,
      })

      const tmpFile = join(testDir, 'nogit.txt')
      writeFileSync(tmpFile, 'no git content')

      // Create a new context after changing the git mock
      const nonGitCtx = resolveVaultContext()

      await expect(
        setEntry(nonGitCtx, 'nogit-key', tmpFile, {
          scope: 'branch',
        })
      ).rejects.toThrow('Not in a git repository. Branch scope requires git repository')
    })
  })

  describe('vault.catEntry with three-tier scopes (used by MCP vault_get)', () => {
    beforeEach(async () => {
      // Set up test data in all scopes
      const globalFile = join(testDir, 'global.txt')
      const repoFile = join(testDir, 'repo.txt')
      const branchFile = join(testDir, 'branch.txt')

      writeFileSync(globalFile, 'global value')
      writeFileSync(repoFile, 'repo value')
      writeFileSync(branchFile, 'branch value')

      // Create entries in different scopes
      const globalCtx = resolveVaultContext({ scope: 'global' })
      await setEntry(globalCtx, 'shared-key', globalFile)

      const repoCtx = resolveVaultContext({ scope: 'repository' })
      await setEntry(repoCtx, 'shared-key', repoFile)

      const branchCtx = resolveVaultContext({ scope: 'branch' })
      await setEntry(branchCtx, 'shared-key', branchFile)
    })

    it('should retrieve from specific scope', async () => {
      const globalCtx = resolveVaultContext({ scope: 'global' })
      const repoCtx = resolveVaultContext({ scope: 'repository' })
      const branchCtx = resolveVaultContext({ scope: 'branch' })

      const globalContent = await catEntry(globalCtx, 'shared-key')
      expect(globalContent).toBe('global value')

      const repoContent = await catEntry(repoCtx, 'shared-key')
      expect(repoContent).toBe('repo value')

      const branchContent = await catEntry(branchCtx, 'shared-key')
      expect(branchContent).toBe('branch value')
    })

    it('should use repository scope by default', async () => {
      const defaultCtx = resolveVaultContext()
      const content = await catEntry(defaultCtx, 'shared-key')
      expect(content).toBe('repo value')
    })

    it('should fall back through scopes with allScopes option', async () => {
      // Test with a key that only exists in global scope
      const globalFile = join(testDir, 'global-only.txt')
      writeFileSync(globalFile, 'global only value')

      const globalCtx = resolveVaultContext({ scope: 'global' })
      await setEntry(globalCtx, 'global-only-key', globalFile)

      // Try to get from branch scope with allScopes
      const branchCtx = resolveVaultContext({ scope: 'branch' })
      const content = await catEntry(branchCtx, 'global-only-key', { allScopes: true })
      expect(content).toBe('global only value')
    })

    it('should retrieve from specific branch', async () => {
      const featureFile = join(testDir, 'feature.txt')
      writeFileSync(featureFile, 'feature value')

      const featureCtx = resolveVaultContext({ scope: 'branch', branch: 'feature-y' })
      await setEntry(featureCtx, 'feature-key', featureFile)

      const content = await catEntry(featureCtx, 'feature-key')
      expect(content).toBe('feature value')
    })
  })

  describe('vault.listEntries with three-tier scopes (used by MCP vault_list)', () => {
    beforeEach(async () => {
      // Set up test data in different scopes
      const file1 = join(testDir, 'file1.txt')
      const file2 = join(testDir, 'file2.txt')
      const file3 = join(testDir, 'file3.txt')

      writeFileSync(file1, 'content1')
      writeFileSync(file2, 'content2')
      writeFileSync(file3, 'content3')

      const globalCtx = resolveVaultContext({ scope: 'global' })
      await setEntry(globalCtx, 'global-entry', file1)

      const repoCtx = resolveVaultContext({ scope: 'repository' })
      await setEntry(repoCtx, 'repo-entry', file2)

      const branchCtx = resolveVaultContext({ scope: 'branch' })
      await setEntry(branchCtx, 'branch-entry', file3)
    })

    it('should list entries from specific scope', async () => {
      const globalCtx = resolveVaultContext({ scope: 'global' })
      const globalEntries = await listEntries(globalCtx)
      expect(globalEntries).toHaveLength(1)
      expect(globalEntries[0].key).toBe('global-entry')

      const repoCtx = resolveVaultContext({ scope: 'repository' })
      const repoEntries = await listEntries(repoCtx)
      expect(repoEntries).toHaveLength(1)
      expect(repoEntries[0].key).toBe('repo-entry')

      const branchCtx = resolveVaultContext({ scope: 'branch' })
      const branchEntries = await listEntries(branchCtx)
      expect(branchEntries).toHaveLength(1)
      expect(branchEntries[0].key).toBe('branch-entry')
    })

    it('should list repository scope by default', async () => {
      const defaultCtx = resolveVaultContext()
      const entries = await listEntries(defaultCtx)
      expect(entries).toHaveLength(1)
      expect(entries[0].key).toBe('repo-entry')
    })

    it('should list entries from specific branch', async () => {
      const file = join(testDir, 'feature.txt')
      writeFileSync(file, 'feature content')

      const featureCtx = resolveVaultContext({ scope: 'branch', branch: 'feature-z' })
      await setEntry(featureCtx, 'feature-entry', file)

      const entries = await listEntries(featureCtx)
      expect(entries).toHaveLength(1)
      expect(entries[0].key).toBe('feature-entry')
    })
  })

  describe('vault.deleteEntry with three-tier scopes (used by MCP vault_delete)', () => {
    it('should delete from specific scope only', async () => {
      // Create entries in all scopes
      const file = join(testDir, 'delete.txt')
      writeFileSync(file, 'content')

      const globalCtx = resolveVaultContext({ scope: 'global' })
      await setEntry(globalCtx, 'delete-key', file)

      const repoCtx = resolveVaultContext({ scope: 'repository' })
      await setEntry(repoCtx, 'delete-key', file)

      const branchCtx = resolveVaultContext({ scope: 'branch' })
      await setEntry(branchCtx, 'delete-key', file)

      // Delete from repository scope
      const success = await deleteEntry(repoCtx, 'delete-key')
      expect(success).toBe(true)

      // Verify only repository scope was deleted
      expect(await catEntry(globalCtx, 'delete-key')).toBe('content')
      expect(await catEntry(repoCtx, 'delete-key')).toBeUndefined()
      expect(await catEntry(branchCtx, 'delete-key')).toBe('content')
    })

    it('should delete from specific branch', async () => {
      const file = join(testDir, 'branch-delete.txt')
      writeFileSync(file, 'branch content')

      const featureCtx = resolveVaultContext({ scope: 'branch', branch: 'feature-delete' })
      await setEntry(featureCtx, 'branch-delete-key', file)

      const success = await deleteEntry(featureCtx, 'branch-delete-key')
      expect(success).toBe(true)

      const content = await catEntry(featureCtx, 'branch-delete-key')
      expect(content).toBeUndefined()
    })
  })

  describe('vault.getInfo with three-tier scopes (used by MCP vault_info)', () => {
    it('should return info from specific scope', async () => {
      const file = join(testDir, 'info.txt')
      writeFileSync(file, 'info content')

      const globalCtx = resolveVaultContext({ scope: 'global' })
      await setEntry(globalCtx, 'info-key', file, { description: 'global info' })

      const repoCtx = resolveVaultContext({ scope: 'repository' })
      await setEntry(repoCtx, 'info-key', file, { description: 'repo info' })

      const globalInfo = await getInfo(globalCtx, 'info-key')
      expect(globalInfo?.description).toBe('global info')

      const repoInfo = await getInfo(repoCtx, 'info-key')
      expect(repoInfo?.description).toBe('repo info')
    })

    it('should return info from specific branch', async () => {
      const file = join(testDir, 'branch-info.txt')
      writeFileSync(file, 'branch info content')

      const featureCtx = resolveVaultContext({ scope: 'branch', branch: 'feature-info' })
      await setEntry(featureCtx, 'branch-info-key', file, { description: 'feature branch info' })

      const info = await getInfo(featureCtx, 'branch-info-key')
      expect(info?.description).toBe('feature branch info')
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle invalid scope type', async () => {
      const file = join(testDir, 'invalid.txt')
      writeFileSync(file, 'content')

      // TypeScript will catch this at compile time, but let's test runtime behavior
      expect(() => {
        const invalidCtx = resolveVaultContext({ scope: 'invalid' as any })
      }).toThrow()
    })

    it('should handle repository scope in non-git directory', async () => {
      mockGetGitInfo.mockReturnValue({
        isGitRepo: false,
        repoRoot: null,
        currentBranch: null,
        remoteUrl: null,
      })

      const nonGitCtx = resolveVaultContext({ scope: 'repository' })
      const file = join(testDir, 'nongit-repo.txt')
      writeFileSync(file, 'nongit repo content')

      // Repository scope should work even outside git repo
      const path = await setEntry(nonGitCtx, 'nongit-key', file, {
        description: 'non-git repo test',
      })

      expect(path).toContain('nongit-key_v1.txt')

      const content = await catEntry(nonGitCtx, 'nongit-key')
      expect(content).toBe('nongit repo content')
    })

    it('should use HEAD as branch name in detached HEAD state', async () => {
      mockGetGitInfo.mockReturnValue({
        isGitRepo: true,
        repoRoot: testDir,
        currentBranch: 'HEAD',
        remoteUrl: null,
      })

      const detachedCtx = resolveVaultContext({ scope: 'branch' })
      const file = join(testDir, 'detached.txt')
      writeFileSync(file, 'detached content')

      const path = await setEntry(detachedCtx, 'detached-key', file)
      expect(path).toContain('detached-key_v1.txt')

      const content = await catEntry(detachedCtx, 'detached-key')
      expect(content).toBe('detached content')
    })
  })
})
