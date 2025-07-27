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
        identifier: '/home/user/projects/test-repo',
        displayName: 'test-repo',
        branches: [
          {
            branch: 'repository',
            scope: 'repository:/home/user/projects/test-repo',
            entries: [],
          },
        ],
      }

      expect(repoGroup.identifier).toBe('/home/user/projects/test-repo')
      expect(repoGroup.branches[0].scope).toContain('repository:')
    })

    it('should correctly identify branch scope', () => {
      const repoGroup: RepositoryGroup = {
        identifier: '/home/user/projects/test-repo',
        displayName: 'test-repo',
        branches: [
          {
            branch: 'main',
            scope: 'test-repo:main',
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
      const result = formatScopeForDisplay('test-repo')
      expect(result).toEqual({
        type: 'repository',
        displayName: 'test-repo',
        branch: undefined,
      })
    })

    it('should format branch scope correctly', () => {
      const result = formatScopeForDisplay('test-repo:main')
      expect(result).toEqual({
        type: 'branch',
        displayName: 'test-repo',
        branch: 'main',
      })
    })

    it('should handle complex repository paths', () => {
      const result = formatScopeForDisplay('repository:/home/user/projects/my-project')
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
          scope: '/home/user/projects/test-repo:main',
          key: 'main-key',
          version: 1,
          filePath: '/path2',
          hash: 'hash2',
          createdAt: new Date(),
        },
        {
          id: 3,
          scopeId: 3,
          scope: '/home/user/projects/test-repo:feature-x',
          key: 'feature-key',
          version: 1,
          filePath: '/path3',
          hash: 'hash3',
          createdAt: new Date(),
        },
        {
          id: 4,
          scopeId: 4,
          scope: 'repository:/home/user/projects/test-repo',
          key: 'repo-key',
          version: 1,
          filePath: '/path4',
          hash: 'hash4',
          createdAt: new Date(),
        },
      ]

      const groups = groupEntriesByScope(entries)

      // Should have 2 groups: global and test-repo
      expect(groups).toHaveLength(2)

      // Check global group
      const globalGroup = groups.find(g => g.identifier === 'global')
      expect(globalGroup).toBeDefined()
      expect(globalGroup!.branches).toHaveLength(1)
      expect(globalGroup!.branches[0].entries).toHaveLength(1)

      // Check test-repo group
      const vaultGroup = groups.find(g => g.identifier === '/home/user/projects/test-repo')
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
      expect(parseCurrentScope('repository:/home/user/projects/test-repo')).toEqual({
        type: 'repository',
        identifier: '/home/user/projects/test-repo',
        branch: undefined,
      })

      // Branch scope
      expect(parseCurrentScope('test-repo:main')).toEqual({
        type: 'branch',
        identifier: 'test-repo',
        branch: 'main',
      })
    })
  })

  describe('Entry count calculation', () => {
    it('should calculate correct total entries for repository', () => {
      const repoGroup: RepositoryGroup = {
        identifier: '/home/user/projects/test-repo',
        displayName: 'test-repo',
        branches: [
          {
            branch: 'repository',
            scope: 'repository:/home/user/projects/test-repo',
            entries: [
              {
                id: 1,
                scopeId: 1,
                scope: 'repository:/home/user/projects/test-repo',
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
            scope: 'test-repo:main',
            entries: [
              {
                id: 2,
                scopeId: 2,
                scope: 'test-repo:main',
                key: 'main-key1',
                version: 1,
                filePath: '/path2',
                hash: 'hash2',
                createdAt: new Date(),
              },
              {
                id: 3,
                scopeId: 2,
                scope: 'test-repo:main',
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
            scope: 'test-repo:feature-x',
            entries: [
              {
                id: 4,
                scopeId: 3,
                scope: 'test-repo:feature-x',
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
          scope: 'repository:/home/user/projects/test-repo',
          entries: [
            {
              key: 'repo-config',
              scope: 'repository:/home/user/projects/test-repo',
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
          scope: 'test-repo:main',
          entries: [
            {
              key: 'main-key',
              scope: 'test-repo:main',
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
          scope: 'test-repo:feature-x',
          entries: [
            {
              key: 'feature-key',
              scope: 'test-repo:feature-x',
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

      // Should have 2 groups: global and test-repo
      expect(groups).toHaveLength(2)

      // Check global group
      const globalGroup = groups.find(g => g.identifier === 'global')
      expect(globalGroup).toBeDefined()
      expect(globalGroup!.displayName).toBe('Global')
      expect(globalGroup!.branches).toHaveLength(1)
      expect(globalGroup!.branches[0].branch).toBe('global')
      expect(globalGroup!.branches[0].scope).toBe('global')
      expect(globalGroup!.branches[0].entries).toHaveLength(1)

      // Check test-repo group
      const vaultGroup = groups.find(g => g.displayName === 'test-repo')
      expect(vaultGroup).toBeDefined()
      expect(vaultGroup!.identifier).toContain('test-repo')
      expect(vaultGroup!.branches).toHaveLength(3) // repository, main, feature-x

      // Check repository scope branch
      const repoBranch = vaultGroup!.branches.find(b => b.branch === 'repository')
      expect(repoBranch).toBeDefined()
      expect(repoBranch!.scope).toBe('repository:/home/user/projects/test-repo')
      expect(repoBranch!.entries).toHaveLength(1)

      // Check main branch
      const mainBranch = vaultGroup!.branches.find(b => b.branch === 'main')
      expect(mainBranch).toBeDefined()
      expect(mainBranch!.scope).toBe('test-repo:main')
      expect(mainBranch!.entries).toHaveLength(1)

      // Check feature branch
      const featureBranch = vaultGroup!.branches.find(b => b.branch === 'feature-x')
      expect(featureBranch).toBeDefined()
      expect(featureBranch!.scope).toBe('test-repo:feature-x')
      expect(featureBranch!.entries).toHaveLength(1)
    })

    it('should correctly sort scopes with global first, then repository, then branches', () => {
      const apiResponse: ScopeGroup[] = [
        {
          scope: 'test-repo:z-branch',
          entries: [],
        },
        {
          scope: 'test-repo:a-branch',
          entries: [],
        },
        {
          scope: 'repository:/home/user/projects/test-repo',
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

      // test-repo should be second
      expect(groups[1].displayName).toBe('test-repo')

      // Within test-repo, repository should be first, then branches alphabetically
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
          scope: 'repository:/home/user/projects/test-repo',
          entries: [],
        },
        {
          scope: 'test-repo:main',
          entries: [],
        },
        {
          scope: 'test-repo:feature',
          entries: [],
        },
      ]

      const groups = groupScopesIntoRepositories(apiResponse)

      // Should have 2 groups: global and test-repo
      expect(groups).toHaveLength(2)

      const globalGroup = groups.find(g => g.identifier === 'global')
      expect(globalGroup).toBeDefined()

      const vaultGroup = groups.find(g => g.displayName === 'test-repo')
      expect(vaultGroup).toBeDefined()
      expect(vaultGroup!.branches).toHaveLength(3) // repository, main, feature
    })
  })
})
