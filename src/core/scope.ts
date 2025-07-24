// Scope type definitions and utilities

// Discriminated union for type safety
export type Scope = GlobalScope | RepositoryScope | BranchScope

export interface GlobalScope {
  type: 'global'
}

export interface RepositoryScope {
  type: 'repository'
  identifier: string // repository root path
  workPath?: string // current working directory
  remoteUrl?: string // git remote URL
}

export interface BranchScope {
  type: 'branch'
  identifier: string // repository root path
  branch: string
  workPath?: string // current working directory
  remoteUrl?: string // git remote URL
}

// Legacy RepoScope type for backward compatibility during migration
export type RepoScope = BranchScope

// Type guards
export function isGlobalScope(scope: Scope): scope is GlobalScope {
  return scope.type === 'global'
}

export function isRepositoryScope(scope: Scope): scope is RepositoryScope {
  return scope.type === 'repository'
}

export function isBranchScope(scope: Scope): scope is BranchScope {
  return scope.type === 'branch'
}

// Legacy type guard for backward compatibility
export function isRepoScope(scope: Scope): scope is RepoScope {
  return scope.type === 'branch' || (scope as any).type === 'repo'
}

// Database representation
export interface DbScope {
  id?: number
  identifier: string
  branch: string
  work_path: string | null
  remote_url: string | null
  created_at?: string
  updated_at?: string
}

// Conversion functions
export function scopeToDb(scope: Scope): Omit<DbScope, 'id' | 'created_at' | 'updated_at'> {
  if (scope.type === 'global') {
    return {
      identifier: 'global',
      branch: 'global',
      work_path: null,
      remote_url: null,
    }
  }

  if (scope.type === 'repository') {
    return {
      identifier: scope.identifier,
      branch: 'repository', // Special marker for repository scope
      work_path: scope.workPath || null,
      remote_url: scope.remoteUrl || null,
    }
  }

  // Branch scope
  return {
    identifier: scope.identifier,
    branch: scope.branch,
    work_path: scope.workPath || null,
    remote_url: scope.remoteUrl || null,
  }
}

export function dbToScope(db: DbScope): Scope {
  if (db.identifier === 'global' && db.branch === 'global') {
    return { type: 'global' }
  }

  if (db.branch === 'repository') {
    return {
      type: 'repository',
      identifier: db.identifier,
      workPath: db.work_path || undefined,
      remoteUrl: db.remote_url || undefined,
    }
  }

  // Default to branch scope for backward compatibility
  return {
    type: 'branch',
    identifier: db.identifier,
    branch: db.branch,
    workPath: db.work_path || undefined,
    remoteUrl: db.remote_url || undefined,
  }
}

// Validation
export function validateScope(scope: Scope): void {
  if (isGlobalScope(scope)) {
    // Global scope has no additional validation
    return
  }

  if (isRepositoryScope(scope)) {
    if (!scope.identifier || scope.identifier.trim() === '') {
      throw new Error('Repository scope requires a valid identifier (repository path)')
    }
    if (scope.identifier === 'global') {
      throw new Error('Repository identifier cannot be "global" (reserved for global scope)')
    }
  }

  if (isBranchScope(scope)) {
    if (!scope.identifier || scope.identifier.trim() === '') {
      throw new Error('Branch scope requires a valid identifier (repository path)')
    }
    if (!scope.branch || scope.branch.trim() === '') {
      throw new Error('Branch scope requires a valid branch name')
    }
    if (scope.identifier === 'global') {
      throw new Error('Branch identifier cannot be "global" (reserved for global scope)')
    }
    if (scope.branch === 'repository') {
      throw new Error('Branch name "repository" is reserved for repository scope')
    }
    if (scope.branch === 'global') {
      throw new Error('Branch name "global" is reserved for global scope')
    }
  }
}

// Display helpers
export function formatScope(scope: Scope): string {
  if (isGlobalScope(scope)) {
    return 'global'
  }

  if (isRepositoryScope(scope)) {
    // Handle special case of root directory
    if (scope.identifier === '/') {
      return '/'
    }
    // Extract repository name from path
    const cleanPath = scope.identifier.replace(/\/$/, '') // Remove trailing slash
    const parts = cleanPath.split('/')
    const repoName = parts[parts.length - 1] || cleanPath
    return repoName
  }

  if (isBranchScope(scope)) {
    // Handle special case of root directory
    if (scope.identifier === '/') {
      return `/:${scope.branch}`
    }
    // Extract repository name from path
    const cleanPath = scope.identifier.replace(/\/$/, '') // Remove trailing slash
    const parts = cleanPath.split('/')
    const repoName = parts[parts.length - 1] || cleanPath
    return `${repoName}:${scope.branch}`
  }

  // Fallback for any future scope types
  return 'unknown'
}

export function formatScopeShort(scope: Scope): string {
  if (isGlobalScope(scope)) {
    return 'global'
  }

  if (isRepositoryScope(scope)) {
    return 'repository'
  }

  if (isBranchScope(scope)) {
    return scope.branch
  }

  // Fallback
  return 'unknown'
}
