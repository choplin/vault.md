import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { resolve } from 'node:path'
import { createVault, closeVault } from '../src/core/vault.js'
import * as gitUtils from '../src/core/git.js'

// Mock git utilities
vi.mock('../src/core/git.js')

describe('resolveScope function', () => {
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.chdir(originalCwd)
  })

  describe('global scope', () => {
    it('should create global scope when scope is explicitly set to global', () => {
      const ctx = createVault({ scope: 'global' })
      try {
        expect(ctx.scope.type).toBe('global')
        expect(ctx.scope).toEqual({ type: 'global' })
      } finally {
        closeVault(ctx)
      }
    })

    it('should create global scope regardless of git repository status', () => {
      // Mock git info to simulate being in a git repo
      vi.mocked(gitUtils.getGitInfo).mockReturnValue({
        isGitRepo: true,
        repoRoot: '/test/repo',
        currentBranch: 'main',
        remoteUrl: 'https://github.com/test/repo',
      })

      const ctx = createVault({ scope: 'global' })
      try {
        expect(ctx.scope.type).toBe('global')
        expect(ctx.scope).toEqual({ type: 'global' })
      } finally {
        closeVault(ctx)
      }
    })

    it('should create global scope even when repo option is provided', () => {
      const ctx = createVault({ scope: 'global', repo: '/custom/path' })
      try {
        expect(ctx.scope.type).toBe('global')
        expect(ctx.scope).toEqual({ type: 'global' })
      } finally {
        closeVault(ctx)
      }
    })

    it('should create global scope even when branch option is provided', () => {
      const ctx = createVault({ scope: 'global', branch: 'feature-x' })
      try {
        expect(ctx.scope.type).toBe('global')
        expect(ctx.scope).toEqual({ type: 'global' })
        // Branch option should be ignored for global scope
      } finally {
        closeVault(ctx)
      }
    })

    it('should store data in global scope when specified', () => {
      const ctx = createVault({ scope: 'global' })
      try {
        expect(ctx.scopeId).toBeGreaterThan(0)
        expect(ctx.scope.type).toBe('global')
      } finally {
        closeVault(ctx)
      }
    })
  })

  describe('repository scope', () => {
    it('should create repository scope by default', () => {
      vi.mocked(gitUtils.getGitInfo).mockReturnValue({
        isGitRepo: true,
        repoRoot: '/test/repo',
        currentBranch: 'main',
        remoteUrl: 'https://github.com/test/repo',
      })

      const ctx = createVault()
      try {
        expect(ctx.scope.type).toBe('repository')
        if (ctx.scope.type === 'repository') {
          expect(ctx.scope.identifier).toBe('/test/repo')
          expect(ctx.scope.workPath).toBe(process.cwd())
          expect(ctx.scope.remoteUrl).toBe('https://github.com/test/repo')
        }
      } finally {
        closeVault(ctx)
      }
    })

    it('should create repository scope when explicitly specified', () => {
      vi.mocked(gitUtils.getGitInfo).mockReturnValue({
        isGitRepo: true,
        repoRoot: '/test/repo',
        currentBranch: 'feature-x',
        remoteUrl: 'https://github.com/test/repo',
      })

      const ctx = createVault({ scope: 'repository' })
      try {
        expect(ctx.scope.type).toBe('repository')
        if (ctx.scope.type === 'repository') {
          expect(ctx.scope.identifier).toBe('/test/repo')
          expect(ctx.scope.workPath).toBe(process.cwd())
        }
      } finally {
        closeVault(ctx)
      }
    })

    it('should use current directory as identifier when not in git repo', () => {
      const mockCwd = '/non/git/directory'
      process.chdir('/')
      vi.spyOn(process, 'cwd').mockReturnValue(mockCwd)

      vi.mocked(gitUtils.getGitInfo).mockReturnValue({
        isGitRepo: false,
        repoRoot: undefined,
        currentBranch: undefined,
        remoteUrl: undefined,
      })

      const ctx = createVault({ scope: 'repository' })
      try {
        expect(ctx.scope.type).toBe('repository')
        if (ctx.scope.type === 'repository') {
          expect(ctx.scope.identifier).toBe(mockCwd)
          expect(ctx.scope.workPath).toBe(mockCwd)
          expect(ctx.scope.remoteUrl).toBeUndefined()
        }
      } finally {
        closeVault(ctx)
        vi.restoreAllMocks()
      }
    })

    it('should use custom repo path when provided', () => {
      vi.mocked(gitUtils.getGitInfo).mockReturnValue({
        isGitRepo: true,
        repoRoot: '/custom/repo',
        currentBranch: 'main',
        remoteUrl: 'https://github.com/custom/repo',
      })

      const ctx = createVault({ scope: 'repository', repo: '/custom/repo' })
      try {
        expect(ctx.scope.type).toBe('repository')
        if (ctx.scope.type === 'repository') {
          expect(ctx.scope.identifier).toBe('/custom/repo')
        }
      } finally {
        closeVault(ctx)
      }
    })

    it('should ignore branch option for repository scope', () => {
      vi.mocked(gitUtils.getGitInfo).mockReturnValue({
        isGitRepo: true,
        repoRoot: '/test/repo',
        currentBranch: 'main',
        remoteUrl: undefined,
      })

      const ctx = createVault({ scope: 'repository', branch: 'feature-x' })
      try {
        expect(ctx.scope.type).toBe('repository')
        if (ctx.scope.type === 'repository') {
          expect(ctx.scope.identifier).toBe('/test/repo')
          // Branch option should be ignored for repository scope
        }
      } finally {
        closeVault(ctx)
      }
    })
  })

  describe('branch scope', () => {
    it('should create branch scope when explicitly specified in git repo', () => {
      vi.mocked(gitUtils.getGitInfo).mockReturnValue({
        isGitRepo: true,
        repoRoot: '/test/repo',
        currentBranch: 'main',
        remoteUrl: 'https://github.com/test/repo',
      })

      const ctx = createVault({ scope: 'branch' })
      try {
        expect(ctx.scope.type).toBe('branch')
        if (ctx.scope.type === 'branch') {
          expect(ctx.scope.identifier).toBe('/test/repo')
          expect(ctx.scope.branch).toBe('main')
          expect(ctx.scope.workPath).toBe(process.cwd())
          expect(ctx.scope.remoteUrl).toBe('https://github.com/test/repo')
        }
      } finally {
        closeVault(ctx)
      }
    })

    it('should use custom branch when provided', () => {
      vi.mocked(gitUtils.getGitInfo).mockReturnValue({
        isGitRepo: true,
        repoRoot: '/test/repo',
        currentBranch: 'main',
        remoteUrl: undefined,
      })

      const ctx = createVault({ scope: 'branch', branch: 'feature-x' })
      try {
        expect(ctx.scope.type).toBe('branch')
        if (ctx.scope.type === 'branch') {
          expect(ctx.scope.identifier).toBe('/test/repo')
          expect(ctx.scope.branch).toBe('feature-x')
        }
      } finally {
        closeVault(ctx)
      }
    })

    it('should throw error when not in git repo and no branch specified', () => {
      vi.mocked(gitUtils.getGitInfo).mockReturnValue({
        isGitRepo: false,
        repoRoot: undefined,
        currentBranch: undefined,
        remoteUrl: undefined,
      })

      expect(() => createVault({ scope: 'branch' })).toThrow(
        'Not in a git repository. Branch scope requires git repository'
      )
    })

    it('should allow branch scope with custom branch even outside git repo', () => {
      const mockCwd = '/non/git/directory'
      process.chdir('/')
      vi.spyOn(process, 'cwd').mockReturnValue(mockCwd)

      vi.mocked(gitUtils.getGitInfo).mockReturnValue({
        isGitRepo: false,
        repoRoot: undefined,
        currentBranch: undefined,
        remoteUrl: undefined,
      })

      const ctx = createVault({ scope: 'branch', branch: 'custom' })
      try {
        expect(ctx.scope.type).toBe('branch')
        if (ctx.scope.type === 'branch') {
          expect(ctx.scope.identifier).toBe(mockCwd)
          expect(ctx.scope.branch).toBe('custom')
          expect(ctx.scope.remoteUrl).toBeUndefined()
        }
      } finally {
        closeVault(ctx)
        vi.restoreAllMocks()
      }
    })

    it('should use custom repo path for branch scope', () => {
      vi.mocked(gitUtils.getGitInfo).mockReturnValue({
        isGitRepo: true,
        repoRoot: '/custom/repo',
        currentBranch: 'develop',
        remoteUrl: 'https://github.com/custom/repo',
      })

      const ctx = createVault({ scope: 'branch', repo: '/custom/repo' })
      try {
        expect(ctx.scope.type).toBe('branch')
        if (ctx.scope.type === 'branch') {
          expect(ctx.scope.identifier).toBe('/custom/repo')
          expect(ctx.scope.branch).toBe('develop')
        }
      } finally {
        closeVault(ctx)
      }
    })
  })

  describe('invalid scope', () => {
    it('should throw error for invalid scope type', () => {
      expect(() => createVault({ scope: 'invalid' as any })).toThrow(
        'Invalid scope: invalid. Valid scopes are: global, repository, branch'
      )
    })
  })
})
