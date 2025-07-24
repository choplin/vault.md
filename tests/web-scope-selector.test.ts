import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { RepositoryGroup, ScopeGroup } from '../src/web/stores/vault'
import { parseCurrentScope, formatScopeForDisplay, groupEntriesByScope } from '../src/web/lib/grouping'
import { groupScopesIntoRepositories } from '../src/web/stores/vault'

describe('Web UI - Scope Selector Logic', () => {
  describe('Requirement 1: Three-tier scope system support', () => {
    it('should correctly identify global scope', () => {
      const globalGroup: RepositoryGroup = {
        identifier: 'global',
        displayName: 'Global',
        branches: [
          {
            branch: 'global',
            scope: 'global',
            entries: [],
          },
        ],
      }

      expect(globalGroup.identifier).toBe('global')
      expect(globalGroup.branches[0].scope).toBe('global')
    })

    it('should correctly identify repository scope', () => {
      const repoGroup: RepositoryGroup = {
        identifier: '/Users/aki/workspace/vault.md',
        displayName: 'vault.md',
        branches: [
          {
            branch: 'repository',
            scope: 'repository:/Users/aki/workspace/vault.md',
            entries: [],
          },
        ],
      }

      expect(repoGroup.identifier).toBe('/Users/aki/workspace/vault.md')
      expect(repoGroup.branches[0].scope).toContain('repository:')
    })

    it('should correctly identify branch scope', () => {
      const repoGroup: RepositoryGroup = {
        identifier: '/Users/aki/workspace/vault.md',
        displayName: 'vault.md',
        branches: [
          {
            branch: 'main',
            scope: 'vault.md:main',
            entries: [],
          },
        ],
      }

      expect(repoGroup.branches[0].branch).toBe('main')
      expect(repoGroup.branches[0].scope).toContain(':main')
    })
  })

  describe('Requirement 7: Scope display formatting', () => {
    it('should format global scope correctly', () => {
      const result = formatScopeForDisplay('global')
      expect(result).toEqual({
        type: 'global',
        displayName: 'Global',
        branch: undefined,
      })
    })

    it('should format repository scope correctly', () => {
      const result = formatScopeForDisplay('vault.md')
      expect(result).toEqual({
        type: 'repository',
        displayName: 'vault.md',
        branch: undefined,
      })
    })

    it('should format branch scope correctly', () => {
      const result = formatScopeForDisplay('vault.md:main')
      expect(result).toEqual({
        type: 'branch',
        displayName: 'vault.md',
        branch: 'main',
      })
    })

    it('should handle complex repository paths', () => {
      const result = formatScopeForDisplay('repository:/Users/aki/workspace/my-project')
      expect(result).toEqual({
        type: 'repository',
        displayName: 'my-project',
        branch: undefined,
      })
    })
  })

  describe('Scope grouping logic', () => {
    it('should group entries by repository and branch', () => {
      const entries = [
        {
          id: 1,
          scopeId: 1,
          scope: 'global',
          key: 'global-key',
          version: 1,
          filePath: '/path1',
          hash: 'hash1',
          createdAt: new Date(),
        },
        {
          id: 2,
          scopeId: 2,
          scope: 'vault.md:main',
          key: 'main-key',
          version: 1,
          filePath: '/path2',
          hash: 'hash2',
          createdAt: new Date(),
        },
        {
          id: 3,
          scopeId: 3,
          scope: 'vault.md:feature-x',
          key: 'feature-key',
          version: 1,
          filePath: '/path3',
          hash: 'hash3',
          createdAt: new Date(),
        },
        {
          id: 4,
          scopeId: 4,
          scope: 'repository:/Users/aki/workspace/vault.md',
          key: 'repo-key',
          version: 1,
          filePath: '/path4',
          hash: 'hash4',
          createdAt: new Date(),
        },
      ]

      const groups = groupEntriesByScope(entries)

      // Should have 2 groups: global and vault.md
      expect(groups).toHaveLength(2)

      // Check global group
      const globalGroup = groups.find(g => g.identifier === 'global')
      expect(globalGroup).toBeDefined()
      expect(globalGroup!.branches).toHaveLength(1)
      expect(globalGroup!.branches[0].entries).toHaveLength(1)

      // Check vault.md group
      const vaultGroup = groups.find(g => g.displayName === 'vault.md')
      expect(vaultGroup).toBeDefined()
      expect(vaultGroup!.branches).toHaveLength(3) // repository, main, feature-x

      // Check repository scope branch
      const repoBranch = vaultGroup!.branches.find(b => b.branch === 'repository')
      expect(repoBranch).toBeDefined()
      expect(repoBranch!.entries).toHaveLength(1)
      expect(repoBranch!.entries[0].key).toBe('repo-key')

      // Check main branch
      const mainBranch = vaultGroup!.branches.find(b => b.branch === 'main')
      expect(mainBranch).toBeDefined()
      expect(mainBranch!.entries).toHaveLength(1)

      // Check feature branch
      const featureBranch = vaultGroup!.branches.find(b => b.branch === 'feature-x')
      expect(featureBranch).toBeDefined()
      expect(featureBranch!.entries).toHaveLength(1)
    })

    it('should handle repository scope without branches', () => {
      const entries = [
        {
          id: 1,
          scopeId: 1,
          scope: 'repository:/tmp/test-repo',
          key: 'config',
          version: 1,
          filePath: '/path1',
          hash: 'hash1',
          createdAt: new Date(),
        },
      ]

      const groups = groupEntriesByScope(entries)

      expect(groups).toHaveLength(1)
      expect(groups[0].displayName).toBe('test-repo')
      expect(groups[0].branches).toHaveLength(1)
      expect(groups[0].branches[0].branch).toBe('repository')
      expect(groups[0].branches[0].entries).toHaveLength(1)
    })
  })

  describe('Current scope detection', () => {
    it('should correctly parse current scope string', () => {
      // Global scope
      expect(parseCurrentScope('global')).toEqual({
        type: 'global',
        identifier: 'global',
        branch: undefined,
      })

      // Repository scope
      expect(parseCurrentScope('repository:/Users/aki/workspace/vault.md')).toEqual({
        type: 'repository',
        identifier: '/Users/aki/workspace/vault.md',
        branch: undefined,
      })

      // Branch scope
      expect(parseCurrentScope('vault.md:main')).toEqual({
        type: 'branch',
        identifier: 'vault.md',
        branch: 'main',
      })
    })
  })

  describe('Entry count calculation', () => {
    it('should calculate correct total entries for repository', () => {
      const repoGroup: RepositoryGroup = {
        identifier: '/Users/aki/workspace/vault.md',
        displayName: 'vault.md',
        branches: [
          {
            branch: 'repository',
            scope: 'repository:/Users/aki/workspace/vault.md',
            entries: [
              {
                id: 1,
                scopeId: 1,
                scope: 'repository:/Users/aki/workspace/vault.md',
                key: 'shared-config',
                version: 1,
                filePath: '/path1',
                hash: 'hash1',
                createdAt: new Date(),
              },
            ],
          },
          {
            branch: 'main',
            scope: 'vault.md:main',
            entries: [
              {
                id: 2,
                scopeId: 2,
                scope: 'vault.md:main',
                key: 'main-key1',
                version: 1,
                filePath: '/path2',
                hash: 'hash2',
                createdAt: new Date(),
              },
              {
                id: 3,
                scopeId: 2,
                scope: 'vault.md:main',
                key: 'main-key2',
                version: 1,
                filePath: '/path3',
                hash: 'hash3',
                createdAt: new Date(),
              },
            ],
          },
          {
            branch: 'feature-x',
            scope: 'vault.md:feature-x',
            entries: [
              {
                id: 4,
                scopeId: 3,
                scope: 'vault.md:feature-x',
                key: 'feature-key',
                version: 1,
                filePath: '/path4',
                hash: 'hash4',
                createdAt: new Date(),
              },
            ],
          },
        ],
      }

      // Calculate total entries
      const totalEntries = repoGroup.branches.reduce((sum, branch) => sum + branch.entries.length, 0)
      expect(totalEntries).toBe(4) // 1 + 2 + 1

      // Individual branch counts
      expect(repoGroup.branches[0].entries.length).toBe(1) // repository
      expect(repoGroup.branches[1].entries.length).toBe(2) // main
      expect(repoGroup.branches[2].entries.length).toBe(1) // feature-x
    })
  })
})

describe('Web UI - Scope Selector Store Integration', () => {
  describe('groupScopesIntoRepositories function', () => {
    it('should handle new three-tier scope format from API', () => {
      const apiResponse: ScopeGroup[] = [
        {
          scope: 'global',
          entries: [
            {
              key: 'global-config',
              scope: 'global',
              id: 1,
              scopeId: 1,
              version: 1,
              filePath: '/path1',
              hash: 'hash1',
              createdAt: '2025-07-24T00:00:00Z',
            },
          ],
        },
        {
          scope: 'repository:/Users/aki/workspace/vault.md',
          entries: [
            {
              key: 'repo-config',
              scope: 'repository:/Users/aki/workspace/vault.md',
              id: 2,
              scopeId: 2,
              version: 1,
              filePath: '/path2',
              hash: 'hash2',
              createdAt: '2025-07-24T00:00:00Z',
            },
          ],
        },
        {
          scope: 'vault.md:main',
          entries: [
            {
              key: 'main-key',
              scope: 'vault.md:main',
              id: 3,
              scopeId: 3,
              version: 1,
              filePath: '/path3',
              hash: 'hash3',
              createdAt: '2025-07-24T00:00:00Z',
            },
          ],
        },
        {
          scope: 'vault.md:feature-x',
          entries: [
            {
              key: 'feature-key',
              scope: 'vault.md:feature-x',
              id: 4,
              scopeId: 4,
              version: 1,
              filePath: '/path4',
              hash: 'hash4',
              createdAt: '2025-07-24T00:00:00Z',
            },
          ],
        },
      ]

      const groups = groupScopesIntoRepositories(apiResponse)

      // Should have 2 groups: global and vault.md
      expect(groups).toHaveLength(2)

      // Check global group
      const globalGroup = groups.find(g => g.identifier === 'global')
      expect(globalGroup).toBeDefined()
      expect(globalGroup!.displayName).toBe('Global')
      expect(globalGroup!.branches).toHaveLength(1)
      expect(globalGroup!.branches[0].branch).toBe('global')
      expect(globalGroup!.branches[0].scope).toBe('global')
      expect(globalGroup!.branches[0].entries).toHaveLength(1)

      // Check vault.md group
      const vaultGroup = groups.find(g => g.displayName === 'vault.md')
      expect(vaultGroup).toBeDefined()
      expect(vaultGroup!.identifier).toContain('vault.md')
      expect(vaultGroup!.branches).toHaveLength(3) // repository, main, feature-x

      // Check repository scope branch
      const repoBranch = vaultGroup!.branches.find(b => b.branch === 'repository')
      expect(repoBranch).toBeDefined()
      expect(repoBranch!.scope).toBe('repository:/Users/aki/workspace/vault.md')
      expect(repoBranch!.entries).toHaveLength(1)

      // Check main branch
      const mainBranch = vaultGroup!.branches.find(b => b.branch === 'main')
      expect(mainBranch).toBeDefined()
      expect(mainBranch!.scope).toBe('vault.md:main')
      expect(mainBranch!.entries).toHaveLength(1)

      // Check feature branch
      const featureBranch = vaultGroup!.branches.find(b => b.branch === 'feature-x')
      expect(featureBranch).toBeDefined()
      expect(featureBranch!.scope).toBe('vault.md:feature-x')
      expect(featureBranch!.entries).toHaveLength(1)
    })

    it('should correctly sort scopes with global first, then repository, then branches', () => {
      const apiResponse: ScopeGroup[] = [
        {
          scope: 'vault.md:z-branch',
          entries: [],
        },
        {
          scope: 'vault.md:a-branch',
          entries: [],
        },
        {
          scope: 'repository:/Users/aki/workspace/vault.md',
          entries: [],
        },
        {
          scope: 'global',
          entries: [],
        },
      ]

      const groups = groupScopesIntoRepositories(apiResponse)

      // Global should be first
      expect(groups[0].identifier).toBe('global')

      // vault.md should be second
      expect(groups[1].displayName).toBe('vault.md')

      // Within vault.md, repository should be first, then branches alphabetically
      const vaultBranches = groups[1].branches
      expect(vaultBranches[0].branch).toBe('repository')
      expect(vaultBranches[1].branch).toBe('a-branch')
      expect(vaultBranches[2].branch).toBe('z-branch')
    })

    it('should handle only new three-tier scope formats', () => {
      const apiResponse: ScopeGroup[] = [
        {
          scope: 'global',
          entries: [],
        },
        {
          scope: 'repository:/Users/aki/workspace/vault.md',
          entries: [],
        },
        {
          scope: 'vault.md:main',
          entries: [],
        },
        {
          scope: 'vault.md:feature',
          entries: [],
        },
      ]

      const groups = groupScopesIntoRepositories(apiResponse)

      // Should have 2 groups: global and vault.md
      expect(groups).toHaveLength(2)

      const globalGroup = groups.find(g => g.identifier === 'global')
      expect(globalGroup).toBeDefined()

      const vaultGroup = groups.find(g => g.displayName === 'vault.md')
      expect(vaultGroup).toBeDefined()
      expect(vaultGroup!.branches).toHaveLength(3) // repository, main, feature
    })
  })
})
