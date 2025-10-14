import { describe, expect, it } from 'vitest'
import {
  type BranchScope,
  formatScope,
  formatScopeShort,
  type GlobalScope,
  isBranchScope,
  isGlobalScope,
  isRepositoryScope,
  type RepositoryScope,
  type ScopeType,
  validateScope,
} from './scope.js'

describe('scope type guards', () => {
  it('should include all scope types', () => {
    const types: ScopeType[] = ['global', 'repository', 'branch']
    expect(types).toEqual(['global', 'repository', 'branch'])
  })

  it('should identify global scope', () => {
    const scope: GlobalScope = { type: 'global' }
    expect(isGlobalScope(scope)).toBe(true)
    expect(isRepositoryScope(scope)).toBe(false)
    expect(isBranchScope(scope)).toBe(false)
  })

  it('should identify repository scope', () => {
    const scope: RepositoryScope = { type: 'repository', primaryPath: '/repo' }
    expect(isRepositoryScope(scope)).toBe(true)
    expect(isBranchScope(scope)).toBe(false)
  })

  it('should identify branch scope', () => {
    const scope: BranchScope = {
      type: 'branch',
      primaryPath: '/repo',
      branchName: 'main',
    }
    expect(isBranchScope(scope)).toBe(true)
    expect(isRepositoryScope(scope)).toBe(false)
  })
})

describe('validateScope', () => {
  it('accepts valid repository scope', () => {
    const scope: RepositoryScope = { type: 'repository', primaryPath: '/repo' }
    expect(() => validateScope(scope)).not.toThrow()
  })

  it('throws on empty repository path', () => {
    const scope: RepositoryScope = { type: 'repository', primaryPath: '' }
    expect(() => validateScope(scope)).toThrow('Repository scope requires a valid repository path')
  })

  it('throws on repository path "global"', () => {
    const scope: RepositoryScope = { type: 'repository', primaryPath: 'global' }
    expect(() => validateScope(scope)).toThrow('Repository path cannot be "global" (reserved for global scope)')
  })

  it('accepts valid branch scope', () => {
    const scope: BranchScope = { type: 'branch', primaryPath: '/repo', branchName: 'main' }
    expect(() => validateScope(scope)).not.toThrow()
  })

  it('throws on empty branch primary path', () => {
    const scope: BranchScope = { type: 'branch', primaryPath: '', branchName: 'main' }
    expect(() => validateScope(scope)).toThrow('Branch scope requires a valid repository path')
  })

  it('throws on empty branch name', () => {
    const scope: BranchScope = { type: 'branch', primaryPath: '/repo', branchName: '' }
    expect(() => validateScope(scope)).toThrow('Branch scope requires a valid branch name')
  })

  it('throws on branch primary path "global"', () => {
    const scope: BranchScope = { type: 'branch', primaryPath: 'global', branchName: 'main' }
    expect(() => validateScope(scope)).toThrow('Branch scope cannot use "global" as repository path')
  })

  it('throws on branch name "repository"', () => {
    const scope: BranchScope = { type: 'branch', primaryPath: '/repo', branchName: 'repository' }
    expect(() => validateScope(scope)).toThrow('Branch name "repository" is reserved for repository scope')
  })
})

describe('formatScope', () => {
  it('formats global scope', () => {
    expect(formatScope({ type: 'global' })).toBe('global')
  })

  it('formats repository scope', () => {
    expect(formatScope({ type: 'repository', primaryPath: '/home/user/repo' })).toBe('/home/user/repo')
  })

  it('formats repository root path', () => {
    expect(formatScope({ type: 'repository', primaryPath: '/' })).toBe('/')
  })

  it('formats branch scope', () => {
    expect(formatScope({ type: 'branch', primaryPath: '/home/user/repo', branchName: 'feature/x' })).toBe(
      '/home/user/repo:feature/x',
    )
  })
})

describe('formatScopeShort', () => {
  it('formats global scope short', () => {
    expect(formatScopeShort({ type: 'global' })).toBe('global')
  })

  it('formats repository scope short', () => {
    expect(formatScopeShort({ type: 'repository', primaryPath: '/path/to/repo' })).toBe('repo')
  })

  it('formats branch scope short', () => {
    expect(formatScopeShort({ type: 'branch', primaryPath: '/path/to/repo', branchName: 'feature/x' })).toBe(
      'repo:feature/x',
    )
  })
})
