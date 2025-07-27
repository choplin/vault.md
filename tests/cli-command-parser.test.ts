import { describe, expect, it } from 'vitest'
import { ScopeType } from '../src/core/types.js'

// Mock command option parsing logic
function validateScopeOption(scope: string): ScopeType {
  if (!['global', 'repository', 'branch'].includes(scope)) {
    throw new Error(`Invalid scope: ${scope}. Valid scopes are: global, repository, branch`)
  }
  return scope as ScopeType
}

function validateBranchOption(scope: ScopeType, branch?: string): void {
  if (branch && scope !== 'branch') {
    throw new Error('--branch option can only be used with --scope branch')
  }
}

function validateRepoOption(scope: ScopeType, repo?: string): string | undefined {
  if (scope === 'global' && repo) {
    // Repo is ignored for global scope
    return undefined
  }
  return repo
}

describe('CLI Command Parser', () => {
  describe('validateScopeOption', () => {
    it('should accept valid scope values', () => {
      expect(validateScopeOption('global')).toBe('global')
      expect(validateScopeOption('repository')).toBe('repository')
      expect(validateScopeOption('branch')).toBe('branch')
    })

    it('should reject invalid scope values', () => {
      expect(() => validateScopeOption('invalid')).toThrow('Invalid scope: invalid')
      expect(() => validateScopeOption('local')).toThrow('Valid scopes are: global, repository, branch')
      expect(() => validateScopeOption('')).toThrow('Invalid scope:')
    })
  })

  describe('validateBranchOption', () => {
    it('should allow branch option with branch scope', () => {
      expect(() => validateBranchOption('branch', 'main')).not.toThrow()
      expect(() => validateBranchOption('branch', 'feature/test')).not.toThrow()
    })

    it('should allow missing branch option', () => {
      expect(() => validateBranchOption('global')).not.toThrow()
      expect(() => validateBranchOption('repository')).not.toThrow()
      expect(() => validateBranchOption('branch')).not.toThrow()
    })

    it('should reject branch option with non-branch scopes', () => {
      expect(() => validateBranchOption('global', 'main')).toThrow('--branch option can only be used with --scope branch')
      expect(() => validateBranchOption('repository', 'main')).toThrow('--branch option can only be used with --scope branch')
    })
  })

  describe('validateRepoOption', () => {
    it('should return repo for repository scope', () => {
      expect(validateRepoOption('repository', '/custom/path')).toBe('/custom/path')
    })

    it('should return repo for branch scope', () => {
      expect(validateRepoOption('branch', '/custom/path')).toBe('/custom/path')
    })

    it('should return undefined for global scope with repo', () => {
      expect(validateRepoOption('global', '/custom/path')).toBeUndefined()
    })

    it('should handle missing repo option', () => {
      expect(validateRepoOption('global')).toBeUndefined()
      expect(validateRepoOption('repository')).toBeUndefined()
      expect(validateRepoOption('branch')).toBeUndefined()
    })
  })
})
