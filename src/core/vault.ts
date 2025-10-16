import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { clearDatabase, closeDatabase, createDatabase, type DatabaseContext } from './database/connection.js'
import { EntryStatusRepository } from './database/repositories/entry-status.repository.js'
import * as fs from './filesystem.js'
import { getGitInfo } from './git.js'
import {
  type BranchScope,
  formatScope,
  getScopeStorageKey,
  type RepositoryScope,
  type Scope,
  type WorktreeScope,
} from './scope.js'
import { EntryService } from './services/entry.service.js'
import { ScopeService } from './services/scope.service.js'
import type { ListOptions, ScopeType, SetOptions, VaultEntry, VaultOptions } from './types.js'

export interface VaultContext {
  database: DatabaseContext
  scope: Scope
  scopeId: number
  entryService: EntryService
  scopeService: ScopeService
}

export interface ResolveContextOptions {
  scope?: ScopeType
  repo?: string
  branch?: string
  worktreeId?: string
}

export function resolveScope(options: ResolveContextOptions = {}): Scope {
  const scopeType = options.scope || 'repository'
  const targetPath = options.repo || process.cwd()
  const resolvedTarget = resolve(targetPath)
  const gitInfo = getGitInfo(targetPath)

  switch (scopeType) {
    case 'global':
      return { type: 'global' }

    case 'repository': {
      if (gitInfo.isGitRepo) {
        const primaryPath = gitInfo.primaryWorktreePath
        if (!primaryPath) {
          throw new Error('Unable to resolve primary worktree path for repository scope')
        }
        return {
          type: 'repository',
          primaryPath,
        }
      }
      return {
        type: 'repository',
        primaryPath: resolvedTarget,
      }
    }

    case 'branch': {
      if (!gitInfo.isGitRepo) {
        throw new Error('Not in a git repository. Branch scope requires git repository')
      }

      const primaryPath = gitInfo.primaryWorktreePath
      if (!primaryPath) {
        throw new Error('Unable to resolve primary worktree path for branch scope')
      }
      const branchName = options.branch || gitInfo.currentBranch || 'main'

      return {
        type: 'branch',
        primaryPath,
        branchName,
      }
    }

    case 'worktree': {
      if (!gitInfo.isGitRepo) {
        throw new Error('Not in a git repository. Worktree scope requires git repository')
      }

      const primaryPath = gitInfo.primaryWorktreePath
      if (!primaryPath) {
        throw new Error('Unable to resolve primary worktree path for worktree scope')
      }

      const worktreeId = options.worktreeId || gitInfo.worktreeId
      if (!worktreeId) {
        throw new Error('Unable to resolve worktree id for worktree scope')
      }

      const worktreeScope: WorktreeScope = {
        type: 'worktree',
        primaryPath,
        worktreeId,
      }

      if (gitInfo.worktreePath) {
        worktreeScope.worktreePath = gitInfo.worktreePath
      }

      return worktreeScope
    }

    default:
      throw new Error(`Invalid scope: ${scopeType}. Valid scopes are: global, repository, branch, worktree`)
  }
}

/**
 * Resolves a vault context for accessing entries in the specified scope.
 *
 * This function determines the appropriate scope (global, repository, or branch)
 * based on the provided options and the current environment (git repository status,
 * current directory, etc.), then returns a context object for vault operations.
 *
 * @param options - Options to determine which scope to use
 * @param options.scope - The scope type: 'global', 'repository', or 'branch'
 * @param options.repo - Repository path (optional, defaults to current directory)
 * @param options.branch - Branch name (required for branch scope, defaults to current branch)
 * @returns A vault context containing database connection, resolved scope, and scope ID
 * @throws {Error} If branch scope is requested outside a git repository
 * @throws {Error} If the resolved scope is invalid
 *
 * @example
 * // Access global scope
 * const ctx = resolveVaultContext({ scope: 'global' })
 *
 * @example
 * // Access current repository scope
 * const ctx = resolveVaultContext({ scope: 'repository' })
 *
 * @example
 * // Access specific branch scope
 * const ctx = resolveVaultContext({ scope: 'branch', branch: 'feature-x' })
 */
export function resolveVaultContext(options: ResolveContextOptions = {}): VaultContext {
  const database = createDatabase()
  const entryService = new EntryService(database)
  const scopeService = new ScopeService(database)

  // Resolve scope
  const scope = resolveScope(options)

  // Get or create scope in database (synchronous operation)
  const scopeId = scopeService.getOrCreate(scope)

  return {
    database,
    scope,
    scopeId,
    entryService,
    scopeService,
  }
}

export async function setEntry(
  ctx: VaultContext,
  key: string,
  filePath: string,
  options: SetOptions = {},
): Promise<string> {
  // Read content from file or stdin
  let content: string
  if (filePath === '-') {
    content = readFileSync(0, 'utf-8')
  } else {
    content = fs.readFile(filePath)
  }

  // Handle different scope if specified
  let scopeId = ctx.scopeId
  let scope = ctx.scope
  const altScope = getAlternativeScope(ctx.scope, options)
  if (altScope) {
    scope = altScope
    scopeId = await ctx.scopeService.getOrCreate(scope)
  }

  // Get next version
  const version = await ctx.entryService.getNextVersion(scopeId, key)

  // Generate scope-specific path for file storage
  const scopePath = getScopeStorageKey(scope)

  // Save file
  const { path, hash } = fs.saveFile(scopePath, key, version, content)

  // Save to database
  await ctx.entryService.create({
    scopeId,
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
          primaryPath: currentScope.primaryPath,
        },
        { type: 'global' },
      ]

    case 'worktree':
      return [
        currentScope,
        {
          type: 'repository',
          primaryPath: currentScope.primaryPath,
        },
        { type: 'global' },
      ]
  }
}

export async function getEntryWithFallback(
  ctx: VaultContext,
  key: string,
  version?: number,
): Promise<string | undefined> {
  const searchOrder = getSearchOrder(ctx.scope)

  for (const scope of searchOrder) {
    const scopeId = ctx.scopeService.getOrCreate(scope)
    const entry = version
      ? await ctx.entryService.getByVersion(scopeId, key, version)
      : await ctx.entryService.getLatest(scopeId, key)

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

export async function getEntry(
  ctx: VaultContext,
  key: string,
  options: VaultOptions = {},
): Promise<string | undefined> {
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  const altScope = getAlternativeScope(ctx.scope, options)
  if (altScope) {
    scopeId = ctx.scopeService.getOrCreate(altScope)
  } else if (ctx.scopeId === -1) {
    // Lazy load scopeId if not set
    scopeId = ctx.scopeService.getOrCreate(ctx.scope)
  }

  // Handle all scopes search
  if (options.allScopes) {
    return await getEntryWithFallback(ctx, key, options.version)
  }

  const entry = options.version
    ? await ctx.entryService.getByVersion(scopeId, key, options.version)
    : await ctx.entryService.getLatest(scopeId, key)

  if (!entry) {
    return undefined
  }

  // Verify file integrity
  if (!fs.verifyFile(entry.filePath, entry.hash)) {
    throw new Error(`File integrity check failed for ${key}`)
  }

  return entry.filePath
}

export async function catEntry(
  ctx: VaultContext,
  key: string,
  options: VaultOptions = {},
): Promise<string | undefined> {
  const filePath = await getEntry(ctx, key, options)

  if (!filePath) {
    return undefined
  }

  return fs.readFile(filePath)
}

export async function listEntries(ctx: VaultContext, options: ListOptions = {}): Promise<VaultEntry[]> {
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  let scope = ctx.scope
  const altScope = getAlternativeScope(ctx.scope, options)
  if (altScope) {
    scope = altScope
    scopeId = await ctx.scopeService.getOrCreate(scope)
  }

  const scopedEntries = await ctx.entryService.list(
    scopeId,
    options.includeArchived || false,
    options.allVersions || false,
  )

  // Filter out archived entries unless includeArchived is true
  const filteredEntries = options.includeArchived ? scopedEntries : scopedEntries.filter((entry) => !entry.isArchived)

  // Convert to VaultEntry format
  return filteredEntries.map((entry) => ({
    id: entry.id,
    scopeId: entry.scopeId,
    scope: formatScope(scope),
    version: entry.version,
    key: entry.key,
    filePath: entry.filePath,
    hash: entry.hash,
    description: entry.description,
    createdAt: entry.createdAt,
    isArchived: entry.isArchived,
  }))
}

export async function deleteEntry(ctx: VaultContext, key: string, options: VaultOptions = {}): Promise<boolean> {
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  const altScope = getAlternativeScope(ctx.scope, options)
  if (altScope) {
    scopeId = ctx.scopeService.getOrCreate(altScope)
  } else if (ctx.scopeId === -1) {
    // Lazy load scopeId if not set
    scopeId = ctx.scopeService.getOrCreate(ctx.scope)
  }

  // Get entries to delete
  const entries = options.version
    ? [await ctx.entryService.getByVersion(scopeId, key, options.version)].filter(Boolean)
    : (await ctx.entryService.list(scopeId, true, true)).filter((e) => e.key === key)

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
  return options.version
    ? await ctx.entryService.deleteVersion(scopeId, key, options.version)
    : await ctx.entryService.deleteAll(scopeId, key)
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
      return scope1.primaryPath === (scope2 as RepositoryScope).primaryPath

    case 'branch': {
      const branch2 = scope2 as BranchScope
      return scope1.primaryPath === branch2.primaryPath && scope1.branchName === branch2.branchName
    }

    case 'worktree': {
      const worktree2 = scope2 as WorktreeScope
      return scope1.primaryPath === worktree2.primaryPath && scope1.worktreeId === worktree2.worktreeId
    }
  }

  return false
}

// Move an entry between scopes
export async function moveScope(ctx: VaultContext, key: string, fromScope: Scope, toScope: Scope): Promise<void> {
  // Validate that scopes are different
  if (areScopesEqual(fromScope, toScope)) {
    throw new Error('Source and target scopes must be different')
  }

  // Get scope IDs
  const fromScopeId = await ctx.scopeService.getOrCreate(fromScope)
  const toScopeId = await ctx.scopeService.getOrCreate(toScope)

  // Check if key exists in source scope
  const entries = (await ctx.entryService.list(fromScopeId, true, true)).filter((e) => e.key === key)
  if (entries.length === 0) {
    throw new Error('Key not found in source scope')
  }

  // Check if key already exists in target scope
  const existingEntry = await ctx.entryService.getLatest(toScopeId, key)
  if (existingEntry) {
    throw new Error('Key already exists in target scope')
  }

  // Find the current version in source scope
  const sourceLatest = await ctx.entryService.getLatest(fromScopeId, key)
  const currentVersion = sourceLatest?.version || 1

  // Move all versions
  for (const entry of entries) {
    // Insert into target scope with same version
    await ctx.entryService.create({
      scopeId: toScopeId,
      key: entry.key,
      version: entry.version,
      filePath: entry.filePath,
      hash: entry.hash,
      description: entry.description,
    })
  }

  // Set the correct current version in target scope
  const targetEntry = await ctx.entryService.getEntryByKey(toScopeId, key)
  if (targetEntry) {
    const statusRepo = new EntryStatusRepository(ctx.database)
    statusRepo.updateCurrentVersion(targetEntry.id, currentVersion)
  }

  // Delete from source scope
  await ctx.entryService.deleteAll(fromScopeId, key)
}

// Delete a specific version
export async function deleteVersion(ctx: VaultContext, key: string, version: number): Promise<number> {
  const scopeId = ctx.scopeId
  const entry = await ctx.entryService.getByVersion(scopeId, key, version)
  if (!entry) {
    return 0
  }

  // Delete file
  fs.deleteFile(entry.filePath)

  // Delete from database
  const result = await ctx.entryService.deleteVersion(scopeId, key, version)
  return result ? 1 : 0
}

// Delete all versions of a key
export async function deleteKey(ctx: VaultContext, key: string): Promise<number> {
  const scopeId = ctx.scopeId
  // Get all entries for this key
  const entries = (await ctx.entryService.list(scopeId, true, true)).filter((e) => e.key === key)

  // Delete files
  entries.forEach((entry) => {
    fs.deleteFile(entry.filePath)
  })

  // Delete from database
  const count = entries.length
  await ctx.entryService.deleteAll(scopeId, key)
  return count
}

// Archive an entry
export async function archiveEntry(ctx: VaultContext, key: string, options: VaultOptions = {}): Promise<boolean> {
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  const altScope = getAlternativeScope(ctx.scope, options)
  if (altScope) {
    scopeId = ctx.scopeService.getOrCreate(altScope)
  }

  return await ctx.entryService.archive(scopeId, key)
}

// Restore an archived entry
export async function restoreEntry(ctx: VaultContext, key: string, options: VaultOptions = {}): Promise<boolean> {
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  const altScope = getAlternativeScope(ctx.scope, options)
  if (altScope) {
    scopeId = ctx.scopeService.getOrCreate(altScope)
  }

  return await ctx.entryService.restore(scopeId, key)
}

// Delete current scope (repository or branch)
export async function deleteCurrentScope(ctx: VaultContext): Promise<number> {
  if (ctx.scope.type === 'global') {
    throw new Error('Cannot delete global scope')
  }

  let scopePath: string
  let deletedCount: number

  if (ctx.scope.type === 'repository' || ctx.scope.type === 'branch' || ctx.scope.type === 'worktree') {
    scopePath = getScopeStorageKey(ctx.scope)
    fs.deleteProjectFiles(scopePath)
    deletedCount = await ctx.scopeService.deleteScope(ctx.scope)
  } else {
    throw new Error('Cannot delete scope for the current scope type')
  }

  return deletedCount
}

// Delete a specific branch of the current repository
export async function deleteBranch(ctx: VaultContext, branch: string): Promise<number> {
  if (ctx.scope.type === 'global') {
    throw new Error('Cannot delete branches from global scope')
  }

  const primaryPath =
    ctx.scope.type === 'branch' || ctx.scope.type === 'repository' || ctx.scope.type === 'worktree'
      ? ctx.scope.primaryPath
      : null

  if (!primaryPath) {
    throw new Error('No repository path found in current scope')
  }

  const branchScope: BranchScope = {
    type: 'branch',
    primaryPath,
    branchName: branch,
  }
  const scopePath = getScopeStorageKey(branchScope)

  // Delete all files for this branch
  fs.deleteProjectFiles(scopePath)

  // Delete from database
  return await ctx.scopeService.deleteScope(branchScope)
}

// Delete all branches of the current repository
export async function deleteAllBranches(ctx: VaultContext): Promise<number> {
  if (ctx.scope.type === 'global') {
    throw new Error('Cannot delete branches from global scope')
  }

  const primaryPath =
    ctx.scope.type === 'branch' || ctx.scope.type === 'repository' || ctx.scope.type === 'worktree'
      ? ctx.scope.primaryPath
      : null

  if (!primaryPath) {
    throw new Error('No repository path found in current scope')
  }

  // Get all scopes for this repository path
  const allScopes = ctx.scopeService.getAll()
  const scopesToDelete = allScopes.filter((s) => {
    if (s.type === 'branch' && s.primaryPath === primaryPath) {
      return true
    }
    if (s.type === 'repository' && s.primaryPath === primaryPath) {
      return true
    }
    return false
  })

  // Delete files for each scope
  scopesToDelete.forEach((scope) => {
    const scopePath = getScopeStorageKey(scope)
    fs.deleteProjectFiles(scopePath)
  })

  // Delete from database
  return await ctx.scopeService.deleteAllBranches(primaryPath)
}

export async function getInfo(
  ctx: VaultContext,
  key: string,
  options: VaultOptions = {},
): Promise<VaultEntry | undefined> {
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  let scope = ctx.scope
  const altScope = getAlternativeScope(ctx.scope, options)
  if (altScope) {
    scope = altScope
    scopeId = await ctx.scopeService.getOrCreate(scope)
  }

  const entry = options.version
    ? await ctx.entryService.getByVersion(scopeId, key, options.version)
    : await ctx.entryService.getLatest(scopeId, key)

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
    isArchived: entry.isArchived,
  }
}

export function closeVault(ctx: VaultContext): void {
  closeDatabase(ctx.database)
}

export function clearVault(ctx: VaultContext): void {
  clearDatabase(ctx.database)
}

// Helper function to get alternative scope from options
function getAlternativeScope(_currentScope: Scope, options: VaultOptions): Scope | null {
  // If no scope options provided, use current scope
  if (!options.scope && !options.repo && !options.branch) {
    return null
  }

  // Create alternative scope based on options
  const createOptions: ResolveContextOptions = {
    scope: options.scope,
    repo: options.repo,
    branch: options.branch,
    worktreeId: options.worktreeId,
  }

  return resolveScope(createOptions)
}

export type { Scope } from './scope.js'
// Export scope-related functions for use in other modules
export { formatScope, formatScopeShort } from './scope.js'
