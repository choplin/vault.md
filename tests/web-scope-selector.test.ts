import { describe, expect, it } from 'vitest'
import { formatScopeForDisplay, groupEntriesByScope, parseCurrentScope, scopeEquals } from '../src/web/lib/grouping'
import { groupScopesIntoRepositories } from '../src/web/stores/vault'
import type { ScopeGroup } from '../src/web/stores/vault'

describe('Web UI – Scope helpers', () => {
  it('parses Scope payloads correctly', () => {
    expect(parseCurrentScope({ type: 'global' })).toEqual({ type: 'global', primaryPath: 'global' })
    expect(parseCurrentScope({ type: 'repository', primaryPath: '/repo/path' })).toEqual({
      type: 'repository',
      primaryPath: '/repo/path',
    })
    expect(parseCurrentScope({ type: 'branch', primaryPath: '/repo/path', branchName: 'feature' })).toEqual({
      type: 'branch',
      primaryPath: '/repo/path',
      branchName: 'feature',
    })
  })

  it('formats scope display labels', () => {
    expect(formatScopeForDisplay({ type: 'global' })).toEqual({ type: 'global', displayName: 'Global' })
    expect(formatScopeForDisplay({ type: 'repository', primaryPath: '/work/test-repo' })).toEqual({
      type: 'repository',
      displayName: 'test-repo',
    })
    expect(
      formatScopeForDisplay({ type: 'branch', primaryPath: '/work/test-repo', branchName: 'main' }),
    ).toEqual({
      type: 'branch',
      displayName: 'test-repo',
      branchName: 'main',
    })
  })

  it('groups scopes into repository clusters', () => {
    const scopeGroups: ScopeGroup[] = [
      {
        scope: { type: 'global' },
        entries: [],
      },
      {
        scope: { type: 'repository', primaryPath: '/work/test-repo' },
        entries: [],
      },
      {
        scope: { type: 'branch', primaryPath: '/work/test-repo', branchName: 'dev' },
        entries: [],
      },
    ]

    const grouped = groupScopesIntoRepositories(scopeGroups)

    expect(grouped[0].primaryPath).toBe('global')
    expect(grouped[1].primaryPath).toBe('/work/test-repo')
    expect(grouped[1].branches.map((b) => b.branchName)).toEqual(['repository', 'dev'])
    expect(scopeEquals(grouped[1].branches[0].scope, { type: 'repository', primaryPath: '/work/test-repo' })).toBe(true)
  })

  it('groups entries by scope', () => {
    const grouped = groupEntriesByScope([
      {
        id: 1,
        scopeId: 10,
        key: 'note',
        scope: { type: 'branch', primaryPath: '/work/test-repo', branchName: 'dev' },
        version: 1,
      },
      {
        id: 2,
        scopeId: 11,
        key: 'docs',
        scope: { type: 'repository', primaryPath: '/work/test-repo' },
        version: 1,
      },
    ])

    expect(grouped).toHaveLength(1)
    const repoGroup = grouped[0]
    expect(repoGroup.primaryPath).toBe('/work/test-repo')
    expect(repoGroup.branches.map((b) => b.branchName)).toEqual(['repository', 'dev'])
  })
})
