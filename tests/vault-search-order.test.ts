import { describe, expect, it } from 'vitest'
import { getSearchOrder } from '../src/core/vault.js'
import type { Scope } from '../src/core/types.js'

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
      expect('identifier' in result[0]).toBe(false)
      expect('branch' in result[0]).toBe(false)
    })
  })

  describe('repository scope', () => {
    it('should return repository then global when current scope is repository', () => {
      const repoScope: Scope = {
        type: 'repository',
        identifier: '/path/to/repo',
        workPath: '/path/to/repo',
        remoteUrl: 'https://github.com/user/repo.git'
      }
      const result = getSearchOrder(repoScope)

      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('repository')
      expect(result[1].type).toBe('global')
    })

    it('should preserve repository properties in search order', () => {
      const repoScope: Scope = {
        type: 'repository',
        identifier: '/custom/repo',
        workPath: '/custom/repo',
        remoteUrl: 'https://example.com/repo.git'
      }
      const result = getSearchOrder(repoScope)

      expect(result[0]).toEqual(repoScope)
      expect(result[1]).toEqual({ type: 'global' })
    })

    it('should handle repository scope without remoteUrl', () => {
      const repoScope: Scope = {
        type: 'repository',
        identifier: '/local/repo',
        workPath: '/local/repo',
        remoteUrl: undefined
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
        identifier: '/path/to/repo',
        branch: 'main',
        workPath: '/path/to/repo',
        remoteUrl: 'https://github.com/user/repo.git'
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
        identifier: '/path/to/repo',
        branch: 'feature/test',
        workPath: '/path/to/repo',
        remoteUrl: 'https://github.com/user/repo.git'
      }
      const result = getSearchOrder(branchScope)

      // First should be the original branch scope
      expect(result[0]).toEqual(branchScope)

      // Second should be repository scope with same identifier but no branch
      expect(result[1]).toEqual({
        type: 'repository',
        identifier: '/path/to/repo',
        workPath: '/path/to/repo',
        remoteUrl: 'https://github.com/user/repo.git'
      })

      // Third should be global
      expect(result[2]).toEqual({ type: 'global' })
    })

    it('should handle branch scope without remoteUrl', () => {
      const branchScope: Scope = {
        type: 'branch',
        identifier: '/local/repo',
        branch: 'develop',
        workPath: '/local/repo',
        remoteUrl: undefined
      }
      const result = getSearchOrder(branchScope)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(branchScope)
      expect(result[1]).toEqual({
        type: 'repository',
        identifier: '/local/repo',
        workPath: '/local/repo',
        remoteUrl: undefined
      })
      expect(result[2]).toEqual({ type: 'global' })
    })

    it('should handle different branch names correctly', () => {
      const branchScope: Scope = {
        type: 'branch',
        identifier: '/repo',
        branch: 'fix/bug-123',
        workPath: '/repo',
        remoteUrl: 'https://example.com/repo.git'
      }
      const result = getSearchOrder(branchScope)

      expect(result[0].type).toBe('branch')
      expect((result[0] as any).branch).toBe('fix/bug-123')
      expect(result[1].type).toBe('repository')
      expect('branch' in result[1]).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle branch scope with complex paths', () => {
      const branchScope: Scope = {
        type: 'branch',
        identifier: '/Users/test/Documents/my-project',
        branch: 'feature/add-new-feature',
        workPath: '/Users/test/Documents/my-project',
        remoteUrl: 'git@github.com:user/my-project.git'
      }
      const result = getSearchOrder(branchScope)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(branchScope)
      expect(result[1].type).toBe('repository')
      expect((result[1] as any).identifier).toBe('/Users/test/Documents/my-project')
    })

    it('should maintain scope hierarchy consistency', () => {
      const branchScope: Scope = {
        type: 'branch',
        identifier: '/workspace/project',
        branch: 'main',
        workPath: '/workspace/project',
        remoteUrl: 'https://github.com/org/project.git'
      }
      const result = getSearchOrder(branchScope)

      // Verify hierarchy: branch -> repository -> global
      expect(result.map(s => s.type)).toEqual(['branch', 'repository', 'global'])

      // Verify identifier consistency
      expect((result[0] as any).identifier).toBe('/workspace/project')
      expect((result[1] as any).identifier).toBe('/workspace/project')
      expect('identifier' in result[2]).toBe(false)
    })
  })
})
