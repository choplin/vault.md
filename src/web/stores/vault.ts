import { createMemo, createSignal } from 'solid-js'
import type { ScopeGroup, VaultEntry } from '../lib/api'

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

// Group scopes by repository
export const groupedScopes = createMemo(() => {
  const scopesList = scopes()
  const groups: RepositoryGroup[] = []

  // First, add global scope if it exists
  const globalScope = scopesList.find((s) => s.scope === 'Global')
  if (globalScope) {
    groups.push({
      identifier: 'global',
      displayName: 'Global',
      branches: [
        {
          branch: 'global',
          scope: 'Global',
          entries: globalScope.entries,
        },
      ],
    })
  }

  // Group repository scopes
  const repoMap = new Map<string, RepositoryGroup>()

  for (const scope of scopesList) {
    if (scope.scope === 'Global') continue

    // Parse scope format: "identifier (branch)" or just use scope as-is
    const match = scope.scope.match(/^(.+?)\s*\((.+?)\)$/)
    if (match) {
      const [, identifier, branch] = match

      if (!repoMap.has(identifier)) {
        // Extract display name from identifier
        const displayName = identifier.includes('/')
          ? identifier.split('/').pop() || identifier
          : identifier.split('\\').pop() || identifier

        repoMap.set(identifier, {
          identifier,
          displayName: displayName,
          branches: [],
        })
      }

      const group = repoMap.get(identifier)!
      group.branches.push({
        branch,
        scope: scope.scope,
        entries: scope.entries,
      })
    }
  }

  // Add repository groups, sorted alphabetically
  const repoGroups = Array.from(repoMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName))

  groups.push(...repoGroups)

  return groups
})
