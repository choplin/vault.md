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
        identifier: '/Users/aki/workspace/vault.md',
      }
      expect(formatScopeForListDisplay(scope)).toBe('vault.md')
    })

    it('should display repository:branch for branch scope', () => {
      const scope: Scope = {
        type: 'branch',
        identifier: '/Users/aki/workspace/vault.md',
        branch: 'main',
      }
      expect(formatScopeForListDisplay(scope)).toBe('vault.md:main')
    })

    it('should handle paths with special characters', () => {
      const scope: Scope = {
        type: 'repository',
        identifier: '/path/with spaces/my-repo',
      }
      expect(formatScopeForListDisplay(scope)).toBe('my-repo')
    })

    it('should handle branch names with special characters', () => {
      const scope: Scope = {
        type: 'branch',
        identifier: '/Users/aki/workspace/vault.md',
        branch: 'feature/new-feature',
      }
      expect(formatScopeForListDisplay(scope)).toBe('vault.md:feature/new-feature')
    })

    it('should handle root directory as repository', () => {
      const scope: Scope = {
        type: 'repository',
        identifier: '/',
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
        identifier: '/path/to/repo',
      }
      expect(getScopeDisplayClass(scope)).toBe('badge-secondary')
    })

    it('should return appropriate CSS class for branch scope', () => {
      const scope: Scope = {
        type: 'branch',
        identifier: '/path/to/repo',
        branch: 'main',
      }
      expect(getScopeDisplayClass(scope)).toBe('badge-accent')
    })
  })
})
