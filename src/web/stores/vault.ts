import { createMemo, createSignal } from 'solid-js'
import { api, type ScopeGroup, type VaultEntry } from '../lib/api'

export type { ScopeGroup } from '../lib/api'

export interface RepositoryGroup {
  identifier: string
  displayName: string
  branches: Array<{
    branch: string
    scope: string
    entries: VaultEntry[]
  }>
}

export const [currentScope, setCurrentScope] = createSignal<string>('')
export const [scopes, setScopes] = createSignal<ScopeGroup[]>([])
export const [selectedScope, setSelectedScope] = createSignal<{
  identifier: string
  branch: string
} | null>(null)
export const [selectedEntry, setSelectedEntry] = createSignal<{
  scope: string
  key: string
  version?: number
} | null>(null)
export const [entryContent, setEntryContent] = createSignal<string>('')
export const [loading, setLoading] = createSignal(true)
export const [contentLoading, setContentLoading] = createSignal(false)
export const [error, setError] = createSignal<string | null>(null)

export const selectedEntryInfo = createMemo(() => {
  const selected = selectedEntry()
  const scopesList = scopes()

  if (!selected) return null

  for (const scope of scopesList) {
    const entry = scope.entries.find((e) => e.scope === selected.scope && e.key === selected.key)
    if (entry) return entry
  }
  return null
})

// Core logic for grouping scopes - exported for testing
export function groupScopesIntoRepositories(scopesList: ScopeGroup[]): RepositoryGroup[] {
  const groups: RepositoryGroup[] = []

  // First, add global scope if it exists
  const globalScope = scopesList.find((s) => s.scope === 'global')
  if (globalScope) {
    groups.push({
      identifier: 'global',
      displayName: 'Global',
      branches: [
        {
          branch: 'global',
          scope: globalScope.scope,
          entries: globalScope.entries,
        },
      ],
    })
  }

  // Group repository scopes
  const repoMap = new Map<string, RepositoryGroup>()

  for (const scope of scopesList) {
    if (scope.scope === 'global') continue

    // Handle new three-tier scope formats
    let repoIdentifier: string | null = null
    let displayName: string | null = null
    let branchData: { branch: string; scope: string; entries: VaultEntry[] } | null = null

    if (scope.scope.startsWith('repository:')) {
      // Repository scope: repository:/path/to/repo
      const repoPath = scope.scope.substring('repository:'.length)
      repoIdentifier = repoPath
      displayName = repoPath.split('/').pop() || repoPath
      branchData = {
        branch: 'repository',
        scope: scope.scope,
        entries: scope.entries,
      }
    } else if (scope.scope.includes(':')) {
      // Branch scope: repo:branch (new format)
      const colonIndex = scope.scope.indexOf(':')
      const repoName = scope.scope.substring(0, colonIndex)
      const branch = scope.scope.substring(colonIndex + 1)

      // Check if we have a matching repository scope in the list
      const repoScope = scopesList.find(
        (s) =>
          s.scope.startsWith('repository:') &&
          (s.scope.endsWith(`/${repoName}`) || s.scope === `repository:${repoName}`),
      )

      if (repoScope) {
        // Use the full path from the repository scope
        repoIdentifier = repoScope.scope.substring('repository:'.length)
      } else {
        // Use the repo name as identifier
        repoIdentifier = repoName
      }

      displayName = repoName
      branchData = {
        branch,
        scope: scope.scope,
        entries: scope.entries,
      }
    }

    // Add to map if we have valid data
    if (repoIdentifier && displayName && branchData) {
      if (!repoMap.has(repoIdentifier)) {
        repoMap.set(repoIdentifier, {
          identifier: repoIdentifier,
          displayName,
          branches: [],
        })
      }

      const group = repoMap.get(repoIdentifier)!
      group.branches.push(branchData)
    }
  }

  // Sort branches within each repository group
  repoMap.forEach((group) => {
    group.branches.sort((a, b) => {
      // Repository scope comes first
      if (a.branch === 'repository') return -1
      if (b.branch === 'repository') return 1
      // Then sort by branch name
      return a.branch.localeCompare(b.branch)
    })
  })

  // Add repository groups, sorted alphabetically
  const repoGroups = Array.from(repoMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName))

  groups.push(...repoGroups)

  return groups
}

// Group scopes by repository
export const groupedScopes = createMemo(() => {
  return groupScopesIntoRepositories(scopes())
})

// Refresh entries from the server
export async function refreshEntries() {
  try {
    setLoading(true)
    setError(null)

    const data = await api.getAllEntries()
    setCurrentScope(data.currentScope)
    setScopes(data.scopes)

    // Force refresh of selected scope by resetting and re-setting it
    const current = selectedScope()
    if (current) {
      setSelectedScope(null)
      setTimeout(() => setSelectedScope(current), 0)
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to fetch entries')
    console.error('Failed to fetch entries:', err)
  } finally {
    setLoading(false)
  }
}
