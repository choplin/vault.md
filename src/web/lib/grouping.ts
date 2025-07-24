import type { RepositoryGroup } from '../stores/vault'
import type { VaultEntry } from './api'

export interface EntryGroup {
  name: string
  path: string
  children: EntryGroup[]
  entries: VaultEntry[]
}

export interface ParsedScope {
  type: 'global' | 'repository' | 'branch'
  identifier: string
  branch?: string
}

export interface ScopeDisplayInfo {
  type: 'global' | 'repository' | 'branch'
  displayName: string
  branch?: string
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
    return { type: 'global', identifier: 'global' }
  }

  if (scope.startsWith('repository:')) {
    return {
      type: 'repository',
      identifier: scope.substring('repository:'.length),
    }
  }

  const colonIndex = scope.indexOf(':')
  if (colonIndex > 0) {
    return {
      type: 'branch',
      identifier: scope.substring(0, colonIndex),
      branch: scope.substring(colonIndex + 1),
    }
  }

  // Default to repository type for backward compatibility
  return { type: 'repository', identifier: scope }
}

/**
 * Format scope string for display
 */
export function formatScopeForDisplay(scope: string): ScopeDisplayInfo {
  if (scope === 'global') {
    return { type: 'global', displayName: 'Global' }
  }

  if (scope.startsWith('repository:')) {
    const path = scope.substring('repository:'.length)
    const displayName = path.split('/').pop() || path
    return { type: 'repository', displayName }
  }

  const colonIndex = scope.indexOf(':')
  if (colonIndex > 0) {
    const displayName = scope.substring(0, colonIndex)
    const branch = scope.substring(colonIndex + 1)
    return { type: 'branch', displayName, branch }
  }

  // Default to repository type for backward compatibility
  return { type: 'repository', displayName: scope }
}

/**
 * Group entries by scope into repository groups
 */
export function groupEntriesByScope(entries: VaultEntry[]): RepositoryGroup[] {
  const groups = new Map<string, RepositoryGroup>()

  entries.forEach((entry) => {
    const parsed = parseCurrentScope(entry.scope)
    let groupId: string
    let displayName: string

    if (parsed.type === 'global') {
      groupId = 'global'
      displayName = 'Global'
    } else if (parsed.type === 'repository') {
      groupId = parsed.identifier
      displayName = parsed.identifier.split('/').pop() || parsed.identifier
    } else {
      // For branch scope, group by repository
      groupId = parsed.identifier.includes('/') ? parsed.identifier : `/Users/aki/workspace/${parsed.identifier}` // Assume default path
      displayName = parsed.identifier
    }

    if (!groups.has(groupId)) {
      groups.set(groupId, {
        identifier: groupId,
        displayName,
        branches: [],
      })
    }

    const group = groups.get(groupId)!

    // Find or create branch
    let branchName: string
    if (parsed.type === 'global') {
      branchName = 'global'
    } else if (parsed.type === 'repository') {
      branchName = 'repository'
    } else {
      branchName = parsed.branch!
    }

    let branch = group.branches.find((b) => b.branch === branchName)
    if (!branch) {
      branch = {
        branch: branchName,
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
    if (a.identifier === 'global') return -1
    if (b.identifier === 'global') return 1
    return a.displayName.localeCompare(b.displayName)
  })

  sortedGroups.forEach((group) => {
    group.branches.sort((a, b) => {
      // Repository scope comes first
      if (a.branch === 'repository') return -1
      if (b.branch === 'repository') return 1
      // Then sort by branch name
      return a.branch.localeCompare(b.branch)
    })
  })

  return sortedGroups
}
