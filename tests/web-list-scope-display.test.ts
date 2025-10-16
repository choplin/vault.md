import { describe, it, expect } from 'vitest'
import { formatScopeForListDisplay, getScopeDisplayClass } from '../src/web/components/scopeDisplay.js'
import type { Scope } from '../src/core/scope'

describe('Web UI List Scope Display', () => {
  describe('formatScopeForListDisplay', () => {
    it('should display "global" for global scope', () => {
      const scope: Scope = { type: 'global' }
      expect(formatScopeForListDisplay(scope)).toBe('global')
    })

    it('should display repository name only for repository scope', () => {
      const scope: Scope = {
        type: 'repository',
        primaryPath: '/home/user/projects/test-repo',
      }
      expect(formatScopeForListDisplay(scope)).toBe('test-repo')
    })

    it('should display repository:branch for branch scope', () => {
      const scope: Scope = {
        type: 'branch',
        primaryPath: '/home/user/projects/test-repo',
        branchName: 'main',
      }
      expect(formatScopeForListDisplay(scope)).toBe('test-repo:main')
    })

    it('should handle paths with special characters', () => {
      const scope: Scope = {
        type: 'repository',
        primaryPath: '/path/with spaces/my-repo',
      }
      expect(formatScopeForListDisplay(scope)).toBe('my-repo')
    })

    it('should handle branch names with special characters', () => {
      const scope: Scope = {
        type: 'branch',
        primaryPath: '/home/user/projects/test-repo',
        branchName: 'feature/new-feature',
      }
      expect(formatScopeForListDisplay(scope)).toBe('test-repo:feature/new-feature')
    })

    it('should display repository@worktree for worktree scope', () => {
      const scope: Scope = {
        type: 'worktree',
        primaryPath: '/home/user/projects/test-repo',
        worktreeId: 'feature-login',
      }
      expect(formatScopeForListDisplay(scope)).toBe('test-repo@feature-login')
    })

    it('should handle root directory as repository', () => {
      const scope: Scope = {
        type: 'repository',
        primaryPath: '/',
      }
      expect(formatScopeForListDisplay(scope)).toBe('/')
    })
  })

  describe('getScopeDisplayClass', () => {
    it('should return appropriate CSS class for global scope', () => {
      const scope: Scope = { type: 'global' }
      expect(getScopeDisplayClass(scope)).toBe('badge-primary')
    })

    it('should return appropriate CSS class for repository scope', () => {
      const scope: Scope = {
        type: 'repository',
        primaryPath: '/path/to/repo',
      }
      expect(getScopeDisplayClass(scope)).toBe('badge-secondary')
    })

    it('should return appropriate CSS class for branch scope', () => {
      const scope: Scope = {
        type: 'branch',
        primaryPath: '/path/to/repo',
        branchName: 'main',
      }
      expect(getScopeDisplayClass(scope)).toBe('badge-accent')
    })

    it('should return appropriate CSS class for worktree scope', () => {
      const scope: Scope = {
        type: 'worktree',
        primaryPath: '/path/to/repo',
        worktreeId: 'feature-login',
      }
      expect(getScopeDisplayClass(scope)).toBe('badge-info')
    })
  })
})
