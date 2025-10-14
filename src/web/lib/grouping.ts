import type { RepositoryGroup } from '../stores/vault'
import type { VaultEntry } from './api'

export interface EntryGroup {
  name: string
  path: string
  children: EntryGroup[]
  entries: VaultEntry[]
}

export interface ScopeDisplayInfo {
  type: 'global' | 'repository' | 'branch'
  displayName: string
  branchName?: string
}

export interface ParsedScope {
  type: 'global' | 'repository' | 'branch'
  primaryPath: string
  branchName?: string
}

/**
 * Group vault entries by their key paths using slash as delimiter
 */
export function groupEntriesByPath(entries: VaultEntry[]): EntryGroup {
  const root: EntryGroup = {
    name: '',
    path: '',
    children: [],
    entries: [],
  }

  // Process each entry
  entries.forEach((entry) => {
    const parts = entry.key.split('/')
    let currentGroup = root

    // Navigate/create the group hierarchy
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        // This is the final part - add entry to current group
        currentGroup.entries.push(entry)
      } else {
        // This is a group - find or create it
        let childGroup = currentGroup.children.find((g) => g.name === part)
        if (!childGroup) {
          childGroup = {
            name: part,
            path: parts.slice(0, index + 1).join('/'),
            children: [],
            entries: [],
          }
          currentGroup.children.push(childGroup)
        }
        currentGroup = childGroup
      }
    })
  })

  // Sort groups and entries
  sortGroupRecursively(root)

  return root
}

/**
 * Sort groups and entries recursively
 */
function sortGroupRecursively(group: EntryGroup): void {
  // Sort child groups by name
  group.children.sort((a, b) => a.name.localeCompare(b.name))

  // Sort entries by key
  group.entries.sort((a, b) => a.key.localeCompare(b.key))

  // Recursively sort children
  group.children.forEach(sortGroupRecursively)
}

/**
 * Count total entries in a group (including all descendants)
 */
export function countEntriesInGroup(group: EntryGroup): number {
  let count = group.entries.length
  group.children.forEach((child) => {
    count += countEntriesInGroup(child)
  })
  return count
}

/**
 * Flatten a group structure back to a list of entries
 */
export function flattenGroup(group: EntryGroup): VaultEntry[] {
  const entries: VaultEntry[] = [...group.entries]
  group.children.forEach((child) => {
    entries.push(...flattenGroup(child))
  })
  return entries
}

/**
 * Parse current scope string into components
 */
export function parseCurrentScope(scope: string): ParsedScope {
  if (scope === 'global') {
    return { type: 'global', primaryPath: 'global' }
  }

  const colonIndex = scope.indexOf(':')
  if (colonIndex > 0 && colonIndex < scope.length - 1) {
    return {
      type: 'branch',
      primaryPath: scope.substring(0, colonIndex),
      branchName: scope.substring(colonIndex + 1),
    }
  }

  // Repository scopes are represented solely by their primary path
  return { type: 'repository', primaryPath: scope }
}

/**
 * Format scope string for display
 */
export function formatScopeForDisplay(scope: string): ScopeDisplayInfo {
  if (scope === 'global') {
    return { type: 'global', displayName: 'Global' }
  }

  const colonIndex = scope.indexOf(':')
  if (colonIndex > 0 && colonIndex < scope.length - 1) {
    const repoPath = scope.substring(0, colonIndex)
    const displayName = repoPath.split('/').pop() || repoPath
    const branchName = scope.substring(colonIndex + 1)
    return { type: 'branch', displayName, branchName }
  }

  // Default to repository type for backward compatibility
  const displayName = scope.split('/').pop() || scope
  return { type: 'repository', displayName }
}

/**
 * Group entries by scope into repository groups
 */
export function groupEntriesByScope(entries: VaultEntry[]): RepositoryGroup[] {
  const groups = new Map<string, RepositoryGroup>()

  entries.forEach((entry) => {
    const parsed = parseCurrentScope(entry.scope)
    let groupPrimaryPath: string
    let displayName: string

    if (parsed.type === 'global') {
      groupPrimaryPath = 'global'
      displayName = 'Global'
    } else {
      groupPrimaryPath = parsed.primaryPath
      displayName = parsed.primaryPath.split('/').pop() || parsed.primaryPath
    }

    if (!groups.has(groupPrimaryPath)) {
      groups.set(groupPrimaryPath, {
        primaryPath: groupPrimaryPath,
        displayName,
        branches: [],
      })
    }

    const group = groups.get(groupPrimaryPath)!

    // Find or create branch
    let branchName: string
    if (parsed.type === 'global') {
      branchName = 'global'
    } else if (parsed.type === 'repository') {
      branchName = 'repository'
    } else {
      branchName = parsed.branchName!
    }

    let branch = group.branches.find((b) => b.branchName === branchName)
    if (!branch) {
      branch = {
        branchName,
        scope: entry.scope,
        entries: [],
      }
      group.branches.push(branch)
    }

    branch.entries.push(entry)
  })

  // Sort groups and branches
  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    // Global always comes first
    if (a.primaryPath === 'global') return -1
    if (b.primaryPath === 'global') return 1
    return a.displayName.localeCompare(b.displayName)
  })

  sortedGroups.forEach((group) => {
    group.branches.sort((a, b) => {
      // Repository scope comes first
      if (a.branchName === 'repository') return -1
      if (b.branchName === 'repository') return 1
      // Then sort by branch name
      return a.branchName.localeCompare(b.branchName)
    })
  })

  return sortedGroups
}
