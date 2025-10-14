import { createMemo, createSignal } from 'solid-js'
import { api, type ScopeGroup, type ScopePayload, type VaultEntry } from '../lib/api'
import { parseCurrentScope, scopeEquals } from '../lib/grouping'

export type { ScopeGroup } from '../lib/api'

export interface RepositoryGroup {
  primaryPath: string
  displayName: string
  branches: Array<{
    branchName: string
    scope: ScopePayload
    entries: VaultEntry[]
  }>
}

export const [currentScope, setCurrentScope] = createSignal<ScopePayload | null>(null)
export const [scopes, setScopes] = createSignal<ScopeGroup[]>([])
export const [selectedScope, setSelectedScope] = createSignal<ScopePayload | null>(null)
export const [selectedEntry, setSelectedEntry] = createSignal<{
  scope: ScopePayload
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
    const entry = scope.entries.find((e) => scopeEquals(e.scope, selected.scope) && e.key === selected.key)
    if (entry) return entry
  }
  return null
})

// Core logic for grouping scopes - exported for testing
export function groupScopesIntoRepositories(scopesList: ScopeGroup[]): RepositoryGroup[] {
  const groups: RepositoryGroup[] = []

  // First, add global scope if it exists
  const globalScope = scopesList.find((s) => s.scope.type === 'global')
  if (globalScope) {
    groups.push({
      primaryPath: 'global',
      displayName: 'Global',
      branches: [
        {
          branchName: 'global',
          scope: globalScope.scope,
          entries: globalScope.entries,
        },
      ],
    })
  }

  // Group repository scopes
  const repoMap = new Map<string, RepositoryGroup>()

  for (const scopeGroup of scopesList) {
    if (scopeGroup.scope.type === 'global') continue

    const parsed = parseCurrentScope(scopeGroup.scope)

    const repoPrimaryPath = parsed.primaryPath
    const displayName = repoPrimaryPath.split('/').pop() || repoPrimaryPath
    const branchName = parsed.type === 'repository' ? 'repository' : parsed.branchName!

    if (!repoMap.has(repoPrimaryPath)) {
      repoMap.set(repoPrimaryPath, {
        primaryPath: repoPrimaryPath,
        displayName,
        branches: [],
      })
    }

    const group = repoMap.get(repoPrimaryPath)!
    group.branches.push({ branchName, scope: scopeGroup.scope, entries: scopeGroup.entries })
  }

  // Sort branches within each repository group
  repoMap.forEach((group) => {
    group.branches.sort((a, b) => {
      // Repository scope comes first
      if (a.branchName === 'repository') return -1
      if (b.branchName === 'repository') return 1
      // Then sort by branch name
      return a.branchName.localeCompare(b.branchName)
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
