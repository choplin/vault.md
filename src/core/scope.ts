import { basename } from 'node:path'

export type Scope = GlobalScope | RepositoryScope | BranchScope | WorktreeScope
export type ScopeType = Scope['type']

export interface GlobalScope {
  type: 'global'
}

export interface RepositoryScope {
  type: 'repository'
  primaryPath: string
}

export interface BranchScope {
  type: 'branch'
  primaryPath: string
  branchName: string
}

export interface WorktreeScope {
  type: 'worktree'
  primaryPath: string
  worktreeId: string
  worktreePath?: string
}

const FILE_SANITIZE_PATTERN = /[@/\\:?*"<>|]/g

export function isGlobalScope(scope: Scope): scope is GlobalScope {
  return scope.type === 'global'
}

export function isRepositoryScope(scope: Scope): scope is RepositoryScope {
  return scope.type === 'repository'
}

export function isBranchScope(scope: Scope): scope is BranchScope {
  return scope.type === 'branch'
}

export function isWorktreeScope(scope: Scope): scope is WorktreeScope {
  return scope.type === 'worktree'
}

export function validateScope(scope: Scope): void {
  switch (scope.type) {
    case 'global':
      return
    case 'repository':
      ensureNonEmpty('Repository scope requires a valid repository path', scope.primaryPath)
      if (scope.primaryPath === 'global') {
        throw new Error('Repository path cannot be "global" (reserved for global scope)')
      }
      return
    case 'branch':
      ensureNonEmpty('Branch scope requires a valid repository path', scope.primaryPath)
      ensureNonEmpty('Branch scope requires a valid branch name', scope.branchName)
      if (scope.primaryPath === 'global') {
        throw new Error('Branch scope cannot use "global" as repository path')
      }
      if (scope.branchName === 'repository') {
        throw new Error('Branch name "repository" is reserved for repository scope')
      }
      if (scope.branchName === 'global') {
        throw new Error('Branch name "global" is reserved for global scope')
      }
      return
    case 'worktree':
      ensureNonEmpty('Worktree scope requires a valid repository path', scope.primaryPath)
      ensureNonEmpty('Worktree scope requires a worktree id', scope.worktreeId)
      if (scope.primaryPath === 'global') {
        throw new Error('Worktree scope cannot use "global" as repository path')
      }
      if (scope.worktreeId === 'global') {
        throw new Error('Worktree id \"global\" is reserved for global scope')
      }
      if (scope.worktreeId === 'repository') {
        throw new Error('Worktree id \"repository\" is reserved for repository scope')
      }
      return
  }
}

export function getScopeStorageKey(scope: Scope): string {
  return sanitizeForFile(formatScope(scope))
}

export function formatScope(scope: Scope): string {
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

export function formatScopeShort(scope: Scope): string {
  switch (scope.type) {
    case 'global':
      return 'global'
    case 'repository':
      return getDisplayName(scope.primaryPath)
    case 'branch':
      return `${getDisplayName(scope.primaryPath)}:${scope.branchName}`
    case 'worktree':
      return `${getDisplayName(scope.primaryPath)}@${scope.worktreeId}`
  }
}

export function getScopePrimaryPath(scope: RepositoryScope | BranchScope | WorktreeScope): string {
  return scope.primaryPath
}

export function getScopeBranchName(scope: BranchScope): string {
  return scope.branchName
}

export function getScopeWorktreeId(scope: WorktreeScope): string {
  return scope.worktreeId
}

export function getScopeWorktreePath(scope: WorktreeScope): string | undefined {
  return scope.worktreePath
}

function sanitizeForFile(value: string): string {
  return value.replace(FILE_SANITIZE_PATTERN, '-')
}

function getDisplayName(path: string): string {
  if (!path) {
    return ''
  }
  if (path === '/') {
    return '/'
  }
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path
  const name = basename(trimmed)
  return name || trimmed
}

function ensureNonEmpty(message: string, value: string): void {
  if (!value || value.trim() === '') {
    throw new Error(message)
  }
}
