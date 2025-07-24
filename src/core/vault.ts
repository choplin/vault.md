import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { DatabaseContext } from './database.js'
import * as db from './database.js'
import * as fs from './filesystem.js'
import { getGitInfo } from './git.js'
import { type BranchScope, formatScope, isGlobalScope, type RepositoryScope, type Scope } from './scope.js'
import type { ListOptions, ScopeType, SetOptions, VaultEntry, VaultOptions } from './types.js'

export interface VaultContext {
  database: DatabaseContext
  scope: Scope
  scopeId: number
}

export interface CreateVaultOptions {
  scope?: ScopeType
  repo?: string
  branch?: string
}

export function resolveScope(options: CreateVaultOptions): Scope {
  const scopeType = options.scope || 'repository' // Default is repository

  switch (scopeType) {
    case 'global':
      return { type: 'global' }

    case 'repository': {
      const gitInfo = getGitInfo(options.repo)
      return {
        type: 'repository',
        identifier: gitInfo.isGitRepo ? gitInfo.repoRoot! : resolve(options.repo || process.cwd()),
        workPath: process.cwd(),
        remoteUrl: gitInfo.remoteUrl,
      }
    }

    case 'branch': {
      const gitInfoBranch = getGitInfo(options.repo)
      if (!gitInfoBranch.isGitRepo && !options.branch) {
        throw new Error('Not in a git repository. Branch scope requires git repository')
      }
      return {
        type: 'branch',
        identifier: gitInfoBranch.isGitRepo ? gitInfoBranch.repoRoot! : resolve(options.repo || process.cwd()),
        branch: options.branch || gitInfoBranch.currentBranch!,
        workPath: process.cwd(),
        remoteUrl: gitInfoBranch.remoteUrl,
      }
    }

    default:
      throw new Error(`Invalid scope: ${scopeType}. Valid scopes are: global, repository, branch`)
  }
}

export function createVault(options: CreateVaultOptions = {}): VaultContext {
  const database = db.createDatabase()

  // Resolve scope
  const scope = resolveScope(options)

  // Get or create scope in database
  const scopeId = db.getOrCreateScope(database, scope)

  return {
    database,
    scope,
    scopeId,
  }
}

export function setEntry(ctx: VaultContext, key: string, filePath: string, options: SetOptions = {}): string {
  // Read content from file or stdin
  let content: string
  if (filePath === '-') {
    content = readFileSync(0, 'utf-8')
  } else {
    content = fs.readFile(filePath)
  }

  // Get next version
  const version = db.getNextScopedVersion(ctx.database, ctx.scopeId, key)

  // Generate scope-specific path for file storage
  let scopePath: string
  if (isGlobalScope(ctx.scope)) {
    scopePath = 'global'
  } else if (ctx.scope.type === 'repository') {
    scopePath = ctx.scope.identifier.replace(/[/\\:]/g, '_')
  } else {
    scopePath = `${ctx.scope.identifier}/${ctx.scope.branch}`.replace(/[/\\:]/g, '_')
  }

  // Save file
  const { path, hash } = fs.saveFile(scopePath, key, version, content)

  // Save to database
  db.insertScopedEntry(ctx.database, {
    scopeId: ctx.scopeId,
    version,
    key,
    filePath: path,
    hash,
    description: options.description,
  })

  return path
}

export function getSearchOrder(currentScope: Scope): Scope[] {
  switch (currentScope.type) {
    case 'global':
      return [currentScope]

    case 'repository':
      return [currentScope, { type: 'global' }]

    case 'branch':
      return [
        currentScope,
        {
          type: 'repository',
          identifier: currentScope.identifier,
          workPath: currentScope.workPath,
          remoteUrl: currentScope.remoteUrl,
        },
        { type: 'global' },
      ]
  }
}

export function getEntryWithFallback(ctx: VaultContext, key: string, version?: number): string | undefined {
  const searchOrder = getSearchOrder(ctx.scope)

  for (const scope of searchOrder) {
    const scopeId = db.getOrCreateScope(ctx.database, scope)
    const entry = version
      ? db.getScopedEntry(ctx.database, scopeId, key, version)
      : db.getLatestScopedEntry(ctx.database, scopeId, key)

    if (entry) {
      // Verify file integrity
      if (!fs.verifyFile(entry.filePath, entry.hash)) {
        throw new Error(`File integrity check failed for ${key}`)
      }
      return entry.filePath
    }
  }

  return undefined
}

export function getEntry(ctx: VaultContext, key: string, options: VaultOptions = {}): string | undefined {
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  const altScope = getAlternativeScope(ctx.scope, options)
  if (altScope) {
    scopeId = db.getOrCreateScope(ctx.database, altScope)
  }

  // Handle all scopes search
  if (options.allScopes) {
    return getEntryWithFallback(ctx, key, options.version)
  }

  const entry = options.version
    ? db.getScopedEntry(ctx.database, scopeId, key, options.version)
    : db.getLatestScopedEntry(ctx.database, scopeId, key)

  if (!entry) {
    return undefined
  }

  // Verify file integrity
  if (!fs.verifyFile(entry.filePath, entry.hash)) {
    throw new Error(`File integrity check failed for ${key}`)
  }

  return entry.filePath
}

export function catEntry(ctx: VaultContext, key: string, options: VaultOptions = {}): string | undefined {
  const filePath = getEntry(ctx, key, options)

  if (!filePath) {
    return undefined
  }

  return fs.readFile(filePath)
}

export function listEntries(ctx: VaultContext, options: ListOptions = {}): VaultEntry[] {
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  let scope = ctx.scope
  const altScope = getAlternativeScope(ctx.scope, options)
  if (altScope) {
    scope = altScope
    scopeId = db.getOrCreateScope(ctx.database, scope)
  }

  const scopedEntries = db.listScopedEntries(ctx.database, scopeId, options.allVersions)

  // Convert to VaultEntry format
  return scopedEntries.map((entry) => ({
    id: entry.id,
    scopeId: entry.scopeId,
    scope: formatScope(scope),
    version: entry.version,
    key: entry.key,
    filePath: entry.filePath,
    hash: entry.hash,
    description: entry.description,
    createdAt: entry.createdAt,
  }))
}

export function deleteEntry(ctx: VaultContext, key: string, options: VaultOptions = {}): boolean {
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  const altScope = getAlternativeScope(ctx.scope, options)
  if (altScope) {
    scopeId = db.getOrCreateScope(ctx.database, altScope)
  }

  // Get entries to delete
  const entries = options.version
    ? [db.getScopedEntry(ctx.database, scopeId, key, options.version)].filter(Boolean)
    : db.listScopedEntries(ctx.database, scopeId, true).filter((e) => e.key === key)

  if (entries.length === 0) {
    return false
  }

  // Delete files
  entries.forEach((entry) => {
    if (entry) {
      fs.deleteFile(entry.filePath)
    }
  })

  // Delete from database
  return db.deleteScopedEntry(ctx.database, scopeId, key, options.version)
}

// Helper function to check if two scopes are equal
function areScopesEqual(scope1: Scope, scope2: Scope): boolean {
  if (scope1.type !== scope2.type) {
    return false
  }

  switch (scope1.type) {
    case 'global':
      return true // All global scopes are equal

    case 'repository':
      return scope1.identifier === (scope2 as RepositoryScope).identifier

    case 'branch': {
      const branch2 = scope2 as BranchScope
      return scope1.identifier === branch2.identifier && scope1.branch === branch2.branch
    }
  }
}

// Move an entry between scopes
export function moveScope(ctx: VaultContext, key: string, fromScope: Scope, toScope: Scope): void {
  // Validate that scopes are different
  if (areScopesEqual(fromScope, toScope)) {
    throw new Error('Source and target scopes must be different')
  }

  // Get scope IDs
  const fromScopeId = db.getOrCreateScope(ctx.database, fromScope)
  const toScopeId = db.getOrCreateScope(ctx.database, toScope)

  // Check if key exists in source scope
  const entries = db.listScopedEntries(ctx.database, fromScopeId, true).filter((e) => e.key === key)
  if (entries.length === 0) {
    throw new Error('Key not found in source scope')
  }

  // Check if key already exists in target scope
  const targetEntry = db.getLatestScopedEntry(ctx.database, toScopeId, key)
  if (targetEntry) {
    throw new Error('Key already exists in target scope')
  }

  // Move all versions
  entries.forEach((entry) => {
    // Insert into target scope with same version
    db.insertScopedEntry(ctx.database, {
      scopeId: toScopeId,
      key: entry.key,
      version: entry.version,
      filePath: entry.filePath,
      hash: entry.hash,
      description: entry.description,
    })
  })

  // Delete from source scope
  db.deleteScopedEntry(ctx.database, fromScopeId, key)
}

// Delete a specific version
export function deleteVersion(ctx: VaultContext, key: string, version: number): number {
  const entry = db.getScopedEntry(ctx.database, ctx.scopeId, key, version)
  if (!entry) {
    return 0
  }

  // Delete file
  fs.deleteFile(entry.filePath)

  // Delete from database
  return db.deleteEntryVersion(ctx.database, ctx.scopeId, key, version)
}

// Delete all versions of a key
export function deleteKey(ctx: VaultContext, key: string): number {
  // Get all entries for this key
  const entries = db.listScopedEntries(ctx.database, ctx.scopeId, true).filter((e) => e.key === key)

  // Delete files
  entries.forEach((entry) => {
    fs.deleteFile(entry.filePath)
  })

  // Delete from database
  return db.deleteEntryAllVersions(ctx.database, ctx.scopeId, key)
}

// Delete current scope (identifier + branch)
export function deleteCurrentScope(ctx: VaultContext): number {
  if (ctx.scope.type === 'global') {
    throw new Error('Cannot delete global scope')
  }

  let scopePath: string
  let deletedCount: number

  switch (ctx.scope.type) {
    case 'repository':
      scopePath = ctx.scope.identifier.replace(/[/\\:]/g, '_')
      fs.deleteProjectFiles(scopePath)
      // Delete repository scope (empty branch)
      deletedCount = db.deleteScope(ctx.database, ctx.scope.identifier, '')
      break

    case 'branch':
      scopePath = `${ctx.scope.identifier}/${ctx.scope.branch}`.replace(/[/\\:]/g, '_')
      fs.deleteProjectFiles(scopePath)
      // Delete specific branch scope
      deletedCount = db.deleteScope(ctx.database, ctx.scope.identifier, ctx.scope.branch)
      break
  }

  return deletedCount
}

// Delete a specific branch of current identifier
export function deleteBranch(ctx: VaultContext, branch: string): number {
  if (ctx.scope.type === 'global') {
    throw new Error('Cannot delete branches from global scope')
  }

  const identifier = ctx.scope.type === 'branch' || ctx.scope.type === 'repository' ? ctx.scope.identifier : null

  if (!identifier) {
    throw new Error('No identifier found in current scope')
  }

  const scopePath = `${identifier}/${branch}`.replace(/[/\\:]/g, '_')

  // Delete all files for this branch
  fs.deleteProjectFiles(scopePath)

  // Delete from database
  return db.deleteScope(ctx.database, identifier, branch)
}

// Delete all branches of current identifier
export function deleteAllBranches(ctx: VaultContext): number {
  if (ctx.scope.type === 'global') {
    throw new Error('Cannot delete branches from global scope')
  }

  const identifier = ctx.scope.type === 'branch' || ctx.scope.type === 'repository' ? ctx.scope.identifier : null

  if (!identifier) {
    throw new Error('No identifier found in current scope')
  }

  // Get all scopes for this identifier
  const allScopes = db.getAllScopes(ctx.database)
  const scopesToDelete = allScopes.filter((s) => {
    if (s.type === 'branch' && s.identifier === identifier) {
      return true
    }
    if (s.type === 'repository' && s.identifier === identifier) {
      return true
    }
    return false
  })

  // Delete files for each scope
  scopesToDelete.forEach((scope) => {
    if (scope.type === 'branch') {
      const scopePath = `${scope.identifier}/${scope.branch}`.replace(/[/\\:]/g, '_')
      fs.deleteProjectFiles(scopePath)
    } else if (scope.type === 'repository') {
      const scopePath = scope.identifier.replace(/[/\\:]/g, '_')
      fs.deleteProjectFiles(scopePath)
    }
  })

  // Delete from database
  return db.deleteIdentifierAllBranches(ctx.database, identifier)
}

export function getInfo(ctx: VaultContext, key: string, options: VaultOptions = {}): VaultEntry | undefined {
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  let scope = ctx.scope
  const altScope = getAlternativeScope(ctx.scope, options)
  if (altScope) {
    scope = altScope
    scopeId = db.getOrCreateScope(ctx.database, scope)
  }

  const entry = options.version
    ? db.getScopedEntry(ctx.database, scopeId, key, options.version)
    : db.getLatestScopedEntry(ctx.database, scopeId, key)

  if (!entry) {
    return undefined
  }

  // Convert to VaultEntry format
  return {
    id: entry.id,
    scopeId: entry.scopeId,
    scope: formatScope(scope),
    version: entry.version,
    key: entry.key,
    filePath: entry.filePath,
    hash: entry.hash,
    description: entry.description,
    createdAt: entry.createdAt,
  }
}

export function closeVault(ctx: VaultContext): void {
  db.closeDatabase(ctx.database)
}

export function clearVault(ctx: VaultContext): void {
  db.clearDatabase(ctx.database)
}

// Helper function to get alternative scope from options
function getAlternativeScope(_currentScope: Scope, options: VaultOptions): Scope | null {
  // If no scope options provided, use current scope
  if (!options.scope && !options.repo && !options.branch) {
    return null
  }

  // Create alternative scope based on options
  const createOptions: CreateVaultOptions = {
    scope: options.scope,
    repo: options.repo,
    branch: options.branch,
  }

  return resolveScope(createOptions)
}

export type { Scope } from './scope.js'
// Export scope-related functions for use in other modules
export { formatScope, formatScopeShort } from './scope.js'
