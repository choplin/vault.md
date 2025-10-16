import { describe, expect, it } from 'vitest'
import { ScopeType } from '../src/core/types.js'

// Mock scope priority logic
function getScopePriority(scope: ScopeType): number {
  switch (scope) {
    case 'worktree':
      return 4
    case 'branch':
      return 3
    case 'repository':
      return 2
    case 'global':
      return 1
    default:
      return 0
  }
}

function getScopeSearchOrder(currentScope: ScopeType = 'repository'): ScopeType[] {
  const scopes: ScopeType[] = ['worktree', 'branch', 'repository', 'global']

  // If current scope is branch, search in priority order
  if (currentScope === 'branch') {
    return scopes.filter((scope) => scope !== 'worktree')
  }

  if (currentScope === 'worktree') {
    return ['worktree', 'repository', 'global']
  }

  // If current scope is repository, skip worktree and branch
  if (currentScope === 'repository') {
    return ['repository', 'global']
  }

  // If current scope is global, only search global
  return ['global']
}

function findEntryInScopes(key: string, scopes: ScopeType[], entries: Map<string, ScopeType>): ScopeType | undefined {
  for (const scope of scopes) {
    const entryKey = `${scope}:${key}`
    if (entries.has(entryKey)) {
      return scope
    }
  }
  return undefined
}

describe('Scope Priority Logic', () => {
  describe('getScopePriority', () => {
    it('should return correct priority values', () => {
      expect(getScopePriority('worktree')).toBe(4)
      expect(getScopePriority('branch')).toBe(3)
      expect(getScopePriority('repository')).toBe(2)
      expect(getScopePriority('global')).toBe(1)
    })

    it('should prioritize worktree over branch', () => {
      expect(getScopePriority('worktree')).toBeGreaterThan(getScopePriority('branch'))
    })

    it('should prioritize branch over repository', () => {
      expect(getScopePriority('branch')).toBeGreaterThan(getScopePriority('repository'))
    })

    it('should prioritize repository over global', () => {
      expect(getScopePriority('repository')).toBeGreaterThan(getScopePriority('global'))
    })
  })

  describe('getScopeSearchOrder', () => {
    it('should return worktree fallback order when in worktree scope', () => {
      expect(getScopeSearchOrder('worktree')).toEqual(['worktree', 'repository', 'global'])
    })

    it('should return full priority order when in branch scope', () => {
      expect(getScopeSearchOrder('branch')).toEqual(['branch', 'repository', 'global'])
    })

    it('should skip branch when in repository scope', () => {
      expect(getScopeSearchOrder('repository')).toEqual(['repository', 'global'])
    })

    it('should only search global when in global scope', () => {
      expect(getScopeSearchOrder('global')).toEqual(['global'])
    })

    it('should default to repository scope behavior', () => {
      expect(getScopeSearchOrder()).toEqual(['repository', 'global'])
    })
  })

  describe('findEntryInScopes', () => {
    const entries = new Map<string, ScopeType>([
      ['global:config', 'global'],
      ['repository:config', 'repository'],
      ['branch:feature', 'branch'],
      ['repository:shared', 'repository'],
      ['worktree:feature', 'worktree'],
    ])

    it('should find entry in highest priority scope', () => {
      const scopes: ScopeType[] = ['worktree', 'branch', 'repository', 'global']
      expect(findEntryInScopes('config', scopes, entries)).toBe('repository')
    })

    it('should return undefined when key not found', () => {
      const scopes: ScopeType[] = ['branch', 'repository', 'global']
      expect(findEntryInScopes('notfound', scopes, entries)).toBeUndefined()
    })

    it('should respect scope order', () => {
      const globalOnly: ScopeType[] = ['global']
      expect(findEntryInScopes('config', globalOnly, entries)).toBe('global')
    })

    it('should find branch-specific entries', () => {
      const scopes: ScopeType[] = ['branch', 'repository', 'global']
      expect(findEntryInScopes('feature', scopes, entries)).toBe('branch')
    })

    it('should find worktree-specific entries first', () => {
      const scopes: ScopeType[] = ['worktree', 'branch', 'repository', 'global']
      expect(findEntryInScopes('feature', scopes, entries)).toBe('worktree')
    })
  })
})
