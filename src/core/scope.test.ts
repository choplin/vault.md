import { describe, expect, it } from 'vitest'
import {
  type BranchScope,
  type DbScope,
  dbToScope,
  formatScope,
  formatScopeShort,
  type GlobalScope,
  isBranchScope,
  isGlobalScope,
  isRepositoryScope,
  type RepositoryScope,
  scopeToDb,
  validateScope,
} from './scope.js'
import type { ScopeType } from './types.js'

describe('scope types and interfaces', () => {
  describe('ScopeType enum', () => {
    it('should have three scope types', () => {
      const GLOBAL: ScopeType = 'global'
      const REPOSITORY: ScopeType = 'repository'
      const BRANCH: ScopeType = 'branch'
      expect(GLOBAL).toBe('global')
      expect(REPOSITORY).toBe('repository')
      expect(BRANCH).toBe('branch')
    })
  })

  describe('type guards', () => {
    it('should identify global scope correctly', () => {
      const globalScope: GlobalScope = { type: 'global' }
      expect(isGlobalScope(globalScope)).toBe(true)
      expect(isRepositoryScope(globalScope)).toBe(false)
      expect(isBranchScope(globalScope)).toBe(false)
    })

    it('should identify repository scope correctly', () => {
      const repoScope: RepositoryScope = {
        type: 'repository',
        identifier: '/home/user/projects/test-repo',
        workPath: '/home/user/projects/test-repo',
        remoteUrl: 'https://github.com/example/test-repo.git',
      }
      expect(isGlobalScope(repoScope)).toBe(false)
      expect(isRepositoryScope(repoScope)).toBe(true)
      expect(isBranchScope(repoScope)).toBe(false)
    })

    it('should identify branch scope correctly', () => {
      const branchScope: BranchScope = {
        type: 'branch',
        identifier: '/home/user/projects/test-repo',
        branch: 'main',
        workPath: '/home/user/projects/test-repo',
        remoteUrl: 'https://github.com/example/test-repo.git',
      }
      expect(isGlobalScope(branchScope)).toBe(false)
      expect(isRepositoryScope(branchScope)).toBe(false)
      expect(isBranchScope(branchScope)).toBe(true)
    })
  })
})

describe('scopeToDb conversion', () => {
  it('should convert global scope to database representation', () => {
    const globalScope: GlobalScope = { type: 'global' }
    const dbScope = scopeToDb(globalScope)

    expect(dbScope).toEqual({
      identifier: 'global',
      branch: 'global',
      work_path: null,
      remote_url: null,
    })
  })

  it('should convert repository scope to database representation', () => {
    const repoScope: RepositoryScope = {
      type: 'repository',
      identifier: '/home/user/projects/test-repo',
      workPath: '/home/user/projects/test-repo',
      remoteUrl: 'https://github.com/example/test-repo.git',
    }
    const dbScope = scopeToDb(repoScope)

    expect(dbScope).toEqual({
      identifier: '/home/user/projects/test-repo',
      branch: 'repository',
      work_path: '/home/user/projects/test-repo',
      remote_url: 'https://github.com/example/test-repo.git',
    })
  })

  it('should convert branch scope to database representation', () => {
    const branchScope: BranchScope = {
      type: 'branch',
      identifier: '/home/user/projects/test-repo',
      branch: 'feature-x',
      workPath: '/home/user/projects/test-repo',
      remoteUrl: 'https://github.com/example/test-repo.git',
    }
    const dbScope = scopeToDb(branchScope)

    expect(dbScope).toEqual({
      identifier: '/home/user/projects/test-repo',
      branch: 'feature-x',
      work_path: '/home/user/projects/test-repo',
      remote_url: 'https://github.com/example/test-repo.git',
    })
  })

  it('should handle repository scope without optional fields', () => {
    const repoScope: RepositoryScope = {
      type: 'repository',
      identifier: '/tmp/project',
    }
    const dbScope = scopeToDb(repoScope)

    expect(dbScope).toEqual({
      identifier: '/tmp/project',
      branch: 'repository',
      work_path: null,
      remote_url: null,
    })
  })

  it('should handle branch scope without optional fields', () => {
    const branchScope: BranchScope = {
      type: 'branch',
      identifier: '/tmp/project',
      branch: 'main',
    }
    const dbScope = scopeToDb(branchScope)

    expect(dbScope).toEqual({
      identifier: '/tmp/project',
      branch: 'main',
      work_path: null,
      remote_url: null,
    })
  })
})

describe('dbToScope conversion', () => {
  it('should convert database representation to global scope', () => {
    const dbScope: DbScope = {
      identifier: 'global',
      branch: 'global',
      work_path: null,
      remote_url: null,
    }
    const scope = dbToScope(dbScope)

    expect(scope).toEqual({ type: 'global' })
    expect(isGlobalScope(scope)).toBe(true)
  })

  it('should convert database representation to repository scope', () => {
    const dbScope: DbScope = {
      identifier: '/home/user/projects/test-repo',
      branch: 'repository',
      work_path: '/home/user/projects/test-repo',
      remote_url: 'https://github.com/example/test-repo.git',
    }
    const scope = dbToScope(dbScope)

    expect(scope).toEqual({
      type: 'repository',
      identifier: '/home/user/projects/test-repo',
      workPath: '/home/user/projects/test-repo',
      remoteUrl: 'https://github.com/example/test-repo.git',
    })
    expect(isRepositoryScope(scope)).toBe(true)
  })

  it('should convert database representation to branch scope', () => {
    const dbScope: DbScope = {
      identifier: '/home/user/projects/test-repo',
      branch: 'feature-x',
      work_path: '/home/user/projects/test-repo',
      remote_url: 'https://github.com/example/test-repo.git',
    }
    const scope = dbToScope(dbScope)

    expect(scope).toEqual({
      type: 'branch',
      identifier: '/home/user/projects/test-repo',
      branch: 'feature-x',
      workPath: '/home/user/projects/test-repo',
      remoteUrl: 'https://github.com/example/test-repo.git',
    })
    expect(isBranchScope(scope)).toBe(true)
  })

  it('should handle repository scope without optional fields', () => {
    const dbScope: DbScope = {
      identifier: '/tmp/project',
      branch: 'repository',
      work_path: null,
      remote_url: null,
    }
    const scope = dbToScope(dbScope)

    expect(scope).toEqual({
      type: 'repository',
      identifier: '/tmp/project',
      workPath: undefined,
      remoteUrl: undefined,
    })
  })

  it('should handle branch scope without optional fields', () => {
    const dbScope: DbScope = {
      identifier: '/tmp/project',
      branch: 'main',
      work_path: null,
      remote_url: null,
    }
    const scope = dbToScope(dbScope)

    expect(scope).toEqual({
      type: 'branch',
      identifier: '/tmp/project',
      branch: 'main',
      workPath: undefined,
      remoteUrl: undefined,
    })
  })
})

describe('validateScope', () => {
  describe('global scope validation', () => {
    it('should accept valid global scope', () => {
      const globalScope: GlobalScope = { type: 'global' }
      expect(() => validateScope(globalScope)).not.toThrow()
    })
  })

  describe('repository scope validation', () => {
    it('should accept valid repository scope', () => {
      const repoScope: RepositoryScope = {
        type: 'repository',
        identifier: '/home/user/projects/test-repo',
      }
      expect(() => validateScope(repoScope)).not.toThrow()
    })

    it('should reject repository scope with empty identifier', () => {
      const repoScope: RepositoryScope = {
        type: 'repository',
        identifier: '',
      }
      expect(() => validateScope(repoScope)).toThrow('Repository scope requires a valid identifier (repository path)')
    })

    it('should reject repository scope with whitespace-only identifier', () => {
      const repoScope: RepositoryScope = {
        type: 'repository',
        identifier: '   ',
      }
      expect(() => validateScope(repoScope)).toThrow('Repository scope requires a valid identifier (repository path)')
    })

    it('should reject repository scope with "global" identifier', () => {
      const repoScope: RepositoryScope = {
        type: 'repository',
        identifier: 'global',
      }
      expect(() => validateScope(repoScope)).toThrow(
        'Repository identifier cannot be "global" (reserved for global scope)',
      )
    })
  })

  describe('branch scope validation', () => {
    it('should accept valid branch scope', () => {
      const branchScope: BranchScope = {
        type: 'branch',
        identifier: '/home/user/projects/test-repo',
        branch: 'main',
      }
      expect(() => validateScope(branchScope)).not.toThrow()
    })

    it('should reject branch scope with empty identifier', () => {
      const branchScope: BranchScope = {
        type: 'branch',
        identifier: '',
        branch: 'main',
      }
      expect(() => validateScope(branchScope)).toThrow('Branch scope requires a valid identifier (repository path)')
    })

    it('should reject branch scope with empty branch', () => {
      const branchScope: BranchScope = {
        type: 'branch',
        identifier: '/tmp/project',
        branch: '',
      }
      expect(() => validateScope(branchScope)).toThrow('Branch scope requires a valid branch name')
    })

    it('should reject branch scope with whitespace-only branch', () => {
      const branchScope: BranchScope = {
        type: 'branch',
        identifier: '/tmp/project',
        branch: '   ',
      }
      expect(() => validateScope(branchScope)).toThrow('Branch scope requires a valid branch name')
    })

    it('should reject branch scope with "global" identifier', () => {
      const branchScope: BranchScope = {
        type: 'branch',
        identifier: 'global',
        branch: 'main',
      }
      expect(() => validateScope(branchScope)).toThrow(
        'Branch identifier cannot be "global" (reserved for global scope)',
      )
    })

    it('should reject branch scope with "repository" branch name', () => {
      const branchScope: BranchScope = {
        type: 'branch',
        identifier: '/tmp/project',
        branch: 'repository',
      }
      expect(() => validateScope(branchScope)).toThrow('Branch name "repository" is reserved for repository scope')
    })

    it('should reject branch scope with "global" branch name', () => {
      const branchScope: BranchScope = {
        type: 'branch',
        identifier: '/tmp/project',
        branch: 'global',
      }
      expect(() => validateScope(branchScope)).toThrow('Branch name "global" is reserved for global scope')
    })
  })
})

describe('formatScope', () => {
  it('should format global scope as "global"', () => {
    const globalScope: GlobalScope = { type: 'global' }
    expect(formatScope(globalScope)).toBe('global')
  })

  it('should format repository scope as repository name only', () => {
    const repoScope: RepositoryScope = {
      type: 'repository',
      identifier: '/home/user/projects/test-repo',
    }
    expect(formatScope(repoScope)).toBe('test-repo')
  })

  it('should format branch scope as "repository:branch"', () => {
    const branchScope: BranchScope = {
      type: 'branch',
      identifier: '/home/user/projects/test-repo',
      branch: 'main',
    }
    expect(formatScope(branchScope)).toBe('test-repo:main')
  })

  it('should extract repository name from complex paths', () => {
    const repoScope: RepositoryScope = {
      type: 'repository',
      identifier: '/home/user/projects/my-app',
    }
    expect(formatScope(repoScope)).toBe('my-app')
  })

  it('should handle paths with trailing slashes', () => {
    const repoScope: RepositoryScope = {
      type: 'repository',
      identifier: '/home/user/projects/test-repo/',
    }
    expect(formatScope(repoScope)).toBe('test-repo')
  })

  it('should handle root directory', () => {
    const repoScope: RepositoryScope = {
      type: 'repository',
      identifier: '/',
    }
    expect(formatScope(repoScope)).toBe('/')
  })
})

describe('formatScopeShort', () => {
  it('should format global scope as "global"', () => {
    const globalScope: GlobalScope = { type: 'global' }
    expect(formatScopeShort(globalScope)).toBe('global')
  })

  it('should format repository scope as "repository"', () => {
    const repoScope: RepositoryScope = {
      type: 'repository',
      identifier: '/home/user/projects/test-repo',
    }
    expect(formatScopeShort(repoScope)).toBe('repository')
  })

  it('should format branch scope as branch name', () => {
    const branchScope: BranchScope = {
      type: 'branch',
      identifier: '/home/user/projects/test-repo',
      branch: 'feature-x',
    }
    expect(formatScopeShort(branchScope)).toBe('feature-x')
  })
})
