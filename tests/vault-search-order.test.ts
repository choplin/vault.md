import { describe, expect, it } from 'vitest'
import { getSearchOrder } from '../src/core/vault.js'
import type { Scope } from '../src/core/scope.js'

describe('getSearchOrder', () => {
  describe('global scope', () => {
    it('should return only global scope when current scope is global', () => {
      const globalScope: Scope = { type: 'global' }
      const result = getSearchOrder(globalScope)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ type: 'global' })
    })

    it('should maintain global scope properties in search order', () => {
      const globalScope: Scope = { type: 'global' }
      const result = getSearchOrder(globalScope)

      expect(result[0].type).toBe('global')
      expect('primaryPath' in result[0]).toBe(false)
      expect('branchName' in result[0]).toBe(false)
    })
  })

  describe('repository scope', () => {
    it('should return repository then global when current scope is repository', () => {
      const repoScope: Scope = {
        type: 'repository',
        primaryPath: '/path/to/repo',
      }
      const result = getSearchOrder(repoScope)

      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('repository')
      expect(result[1].type).toBe('global')
    })

    it('should preserve repository properties in search order', () => {
      const repoScope: Scope = {
        type: 'repository',
        primaryPath: '/custom/repo',
      }
      const result = getSearchOrder(repoScope)

      expect(result[0]).toEqual(repoScope)
      expect(result[1]).toEqual({ type: 'global' })
    })

    it('should handle repository scope without remote metadata', () => {
      const repoScope: Scope = {
        type: 'repository',
        primaryPath: '/local/repo',
      }
      const result = getSearchOrder(repoScope)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(repoScope)
      expect(result[1]).toEqual({ type: 'global' })
    })
  })

  describe('branch scope', () => {
    it('should return branch, repository, then global when current scope is branch', () => {
      const branchScope: Scope = {
        type: 'branch',
        primaryPath: '/path/to/repo',
        branchName: 'main',
      }
      const result = getSearchOrder(branchScope)

      expect(result).toHaveLength(3)
      expect(result[0].type).toBe('branch')
      expect(result[1].type).toBe('repository')
      expect(result[2].type).toBe('global')
    })

    it('should create correct repository scope from branch scope', () => {
      const branchScope: Scope = {
        type: 'branch',
        primaryPath: '/path/to/repo',
        branchName: 'feature/test',
      }
      const result = getSearchOrder(branchScope)

      // First should be the original branch scope
      expect(result[0]).toEqual(branchScope)

      // Second should be repository scope with same primary path but no branch
      expect(result[1]).toEqual({
        type: 'repository',
        primaryPath: '/path/to/repo',
      })

      // Third should be global
      expect(result[2]).toEqual({ type: 'global' })
    })

    it('should handle branch scope without remote metadata', () => {
      const branchScope: Scope = {
        type: 'branch',
        primaryPath: '/local/repo',
        branchName: 'develop',
      }
      const result = getSearchOrder(branchScope)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(branchScope)
      expect(result[1]).toEqual({
        type: 'repository',
        primaryPath: '/local/repo',
      })
      expect(result[2]).toEqual({ type: 'global' })
    })

    it('should handle different branch names correctly', () => {
      const branchScope: Scope = {
        type: 'branch',
        primaryPath: '/repo',
        branchName: 'fix/bug-123',
        worktreePath: '/repo',
      }
      const result = getSearchOrder(branchScope)

      expect(result[0].type).toBe('branch')
      expect((result[0] as any).branchName).toBe('fix/bug-123')
      expect(result[1].type).toBe('repository')
      expect('branchName' in result[1]).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle branch scope with complex paths', () => {
      const branchScope: Scope = {
        type: 'branch',
        primaryPath: '/Users/test/Documents/my-project',
        branchName: 'feature/add-new-feature',
        worktreePath: '/Users/test/Documents/my-project',
      }
      const result = getSearchOrder(branchScope)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(branchScope)
      expect(result[1].type).toBe('repository')
      expect((result[1] as any).primaryPath).toBe('/Users/test/Documents/my-project')
    })

    it('should maintain scope hierarchy consistency', () => {
      const branchScope: Scope = {
        type: 'branch',
        primaryPath: '/workspace/project',
        branchName: 'main',
        worktreePath: '/workspace/project',
      }
      const result = getSearchOrder(branchScope)

      // Verify hierarchy: branch -> repository -> global
      expect(result.map(s => s.type)).toEqual(['branch', 'repository', 'global'])

      // Verify primary path consistency
      expect((result[0] as any).primaryPath).toBe('/workspace/project')
      expect((result[1] as any).primaryPath).toBe('/workspace/project')
      expect('primaryPath' in result[2]).toBe(false)
    })
  })
})
