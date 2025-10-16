import type { RepositoryGroup } from '../stores/vault'
import type { ScopePayload, VaultEntry } from './api'

export interface EntryGroup {
  name: string
  path: string
  children: EntryGroup[]
  entries: VaultEntry[]
}

export interface ScopeDisplayInfo {
  type: 'global' | 'repository' | 'branch' | 'worktree'
  displayName: string
  branchName?: string
  worktreeId?: string
}

export interface ParsedScope {
  type: 'global' | 'repository' | 'branch' | 'worktree'
  primaryPath: string
  branchName?: string
  worktreeId?: string
}

export function scopeToKey(scope: ScopePayload): string {
  switch (scope.type) {
    case 'global':
      return 'global'
    case 'repository':
      return scope.primaryPath
    case 'branch':
      return `${scope.primaryPath}:${scope.branchName}`
    case 'worktree':
      return `${scope.primaryPath}@${scope.worktreeId}`
  }
}

export function scopeEquals(a: ScopePayload | null | undefined, b: ScopePayload | null | undefined): boolean {
  if (!a || !b) return false
  return scopeToKey(a) === scopeToKey(b)
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

  entries.forEach((entry) => {
    const parts = entry.key.split('/')
    let currentGroup = root

    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        currentGroup.entries.push(entry)
      } else {
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

  sortGroupRecursively(root)

  return root
}

function sortGroupRecursively(group: EntryGroup): void {
  group.children.sort((a, b) => a.name.localeCompare(b.name))
  group.entries.sort((a, b) => a.key.localeCompare(b.key))
  group.children.forEach(sortGroupRecursively)
}

export function countEntriesInGroup(group: EntryGroup): number {
  let count = group.entries.length
  group.children.forEach((child) => {
    count += countEntriesInGroup(child)
  })
  return count
}

export function flattenGroup(group: EntryGroup): VaultEntry[] {
  const entries: VaultEntry[] = [...group.entries]
  group.children.forEach((child) => {
    entries.push(...flattenGroup(child))
  })
  return entries
}

export function parseCurrentScope(scope: ScopePayload): ParsedScope {
  switch (scope.type) {
    case 'global':
      return { type: 'global', primaryPath: 'global' }
    case 'repository':
      return { type: 'repository', primaryPath: scope.primaryPath }
    case 'branch':
      return { type: 'branch', primaryPath: scope.primaryPath, branchName: scope.branchName }
    case 'worktree':
      return { type: 'worktree', primaryPath: scope.primaryPath, worktreeId: scope.worktreeId }
  }
}

export function formatScopeForDisplay(scope: ScopePayload): ScopeDisplayInfo {
  if (scope.type === 'global') {
    return { type: 'global', displayName: 'Global' }
  }

  const displayName = scope.primaryPath.split('/').pop() || scope.primaryPath
  if (scope.type === 'repository') {
    return { type: 'repository', displayName }
  }

  if (scope.type === 'branch') {
    return { type: 'branch', displayName, branchName: scope.branchName }
  }

  return { type: 'worktree', displayName, worktreeId: scope.worktreeId }
}

export function groupEntriesByScope(entries: VaultEntry[]): RepositoryGroup[] {
  const groups = new Map<string, RepositoryGroup>()

  entries.forEach((entry) => {
    const parsed = parseCurrentScope(entry.scope)
    const groupPrimaryPath = parsed.type === 'global' ? 'global' : parsed.primaryPath
    const displayName = parsed.type === 'global' ? 'Global' : parsed.primaryPath.split('/').pop() || parsed.primaryPath

    if (!groups.has(groupPrimaryPath)) {
      groups.set(groupPrimaryPath, {
        primaryPath: groupPrimaryPath,
        displayName,
        branches: [],
      })
    }

    const group = groups.get(groupPrimaryPath)!

    let branchName: string
    if (parsed.type === 'global') {
      branchName = 'global'
    } else if (parsed.type === 'repository') {
      branchName = 'repository'
    } else if (parsed.type === 'worktree') {
      branchName = `@${parsed.worktreeId}`
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

  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    if (a.primaryPath === 'global') return -1
    if (b.primaryPath === 'global') return 1
    return a.displayName.localeCompare(b.displayName)
  })

  sortedGroups.forEach((group) => {
    group.branches.sort((a, b) => {
      if (a.branchName === 'repository') return -1
      if (b.branchName === 'repository') return 1
      return a.branchName.localeCompare(b.branchName)
    })
  })

  return sortedGroups
}
