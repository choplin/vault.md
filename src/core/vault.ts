import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { DatabaseContext } from './database.js'
import * as db from './database.js'
import * as fs from './filesystem.js'
import { getGitInfo } from './git.js'
import { formatScope, isGlobalScope, type Scope } from './scope.js'
import type { ListOptions, SetOptions, VaultEntry, VaultOptions } from './types.js'

export interface VaultContext {
  database: DatabaseContext
  scope: Scope
  scopeId: number
}

export interface CreateVaultOptions {
  global?: boolean
  repo?: string
  branch?: string
}

export function createVault(options: CreateVaultOptions = {}): VaultContext {
  const database = db.createDatabase()

  // Determine scope
  let scope: Scope

  if (options.global) {
    scope = { type: 'global' }
  } else if (options.repo) {
    // Specific repo provided
    const gitInfo = getGitInfo(options.repo)
    if (gitInfo.isGitRepo) {
      scope = {
        type: 'repo',
        identifier: gitInfo.repoRoot!,
        branch: options.branch || gitInfo.currentBranch!,
        workPath: process.cwd(),
        remoteUrl: gitInfo.remoteUrl,
      }
    } else {
      // Not a git repo - use directory as scope
      scope = {
        type: 'repo',
        identifier: resolve(options.repo),
        branch: options.branch || 'default',
        workPath: process.cwd(),
        remoteUrl: undefined,
      }
    }
  } else {
    // Current directory
    const gitInfo = getGitInfo()
    if (gitInfo.isGitRepo) {
      scope = {
        type: 'repo',
        identifier: gitInfo.repoRoot!,
        branch: options.branch || gitInfo.currentBranch!,
        workPath: process.cwd(),
        remoteUrl: gitInfo.remoteUrl,
      }
    } else {
      // Not a git repo - use current directory as scope
      scope = {
        type: 'repo',
        identifier: process.cwd(),
        branch: options.branch || 'default',
        workPath: process.cwd(),
        remoteUrl: undefined,
      }
    }
  }

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
  const scopePath = isGlobalScope(ctx.scope)
    ? 'global'
    : `${ctx.scope.identifier}/${ctx.scope.branch}`.replace(/[/\\:]/g, '_')

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

export function getEntry(ctx: VaultContext, key: string, options: VaultOptions = {}): string | undefined {
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  if (options.global || options.repo || options.branch) {
    const altScope = resolveScope(options)
    scopeId = db.getOrCreateScope(ctx.database, altScope)
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
  if (options.global || options.repo || options.branch) {
    scope = resolveScope(options)
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
  if (options.global || options.repo || options.branch) {
    const altScope = resolveScope(options)
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

  const scopePath = `${ctx.scope.identifier}/${ctx.scope.branch}`.replace(/[/\\:]/g, '_')

  // Delete all files for this scope
  fs.deleteProjectFiles(scopePath)

  // Delete from database
  return db.deleteScope(ctx.database, ctx.scope.identifier, ctx.scope.branch)
}

// Delete a specific branch of current identifier
export function deleteBranch(ctx: VaultContext, branch: string): number {
  if (ctx.scope.type === 'global') {
    throw new Error('Cannot delete branches from global scope')
  }

  const scopePath = `${ctx.scope.identifier}/${branch}`.replace(/[/\\:]/g, '_')

  // Delete all files for this branch
  fs.deleteProjectFiles(scopePath)

  // Delete from database
  return db.deleteScope(ctx.database, ctx.scope.identifier, branch)
}

// Delete all branches of current identifier
export function deleteAllBranches(ctx: VaultContext): number {
  if (ctx.scope.type === 'global') {
    throw new Error('Cannot delete branches from global scope')
  }

  // Get all scopes for this identifier
  const allScopes = db.getAllScopes(ctx.database)
  const scopesToDelete = allScopes.filter((s) => {
    if (ctx.scope.type !== 'repo' || s.type !== 'repo') return false
    return s.identifier === ctx.scope.identifier
  })

  // Delete files for each scope
  scopesToDelete.forEach((scope) => {
    if (scope.type === 'repo') {
      const scopePath = `${scope.identifier}/${scope.branch}`.replace(/[/\\:]/g, '_')
      fs.deleteProjectFiles(scopePath)
    }
  })

  // Delete from database
  return db.deleteIdentifierAllBranches(ctx.database, ctx.scope.identifier)
}

export function getInfo(ctx: VaultContext, key: string, options: VaultOptions = {}): VaultEntry | undefined {
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  let scope = ctx.scope
  if (options.global || options.repo || options.branch) {
    scope = resolveScope(options)
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

// Helper function to resolve scope from options
function resolveScope(options: VaultOptions): Scope {
  if (options.global) {
    return { type: 'global' }
  }

  if (options.repo) {
    const gitInfo = getGitInfo(options.repo)
    if (gitInfo.isGitRepo) {
      return {
        type: 'repo',
        identifier: gitInfo.repoRoot!,
        branch: options.branch || gitInfo.currentBranch!,
        workPath: process.cwd(),
        remoteUrl: gitInfo.remoteUrl,
      }
    } else {
      // Not a git repo - use directory as scope
      return {
        type: 'repo',
        identifier: resolve(options.repo),
        branch: options.branch || 'default',
        workPath: process.cwd(),
        remoteUrl: undefined,
      }
    }
  }

  // Current directory with different branch
  const gitInfo = getGitInfo()
  if (gitInfo.isGitRepo) {
    return {
      type: 'repo',
      identifier: gitInfo.repoRoot!,
      branch: options.branch || gitInfo.currentBranch!,
      workPath: process.cwd(),
      remoteUrl: gitInfo.remoteUrl,
    }
  } else {
    // Not a git repo - use current directory as scope
    return {
      type: 'repo',
      identifier: process.cwd(),
      branch: options.branch || 'default',
      workPath: process.cwd(),
      remoteUrl: undefined,
    }
  }
}

export type { Scope } from './scope.js'
// Export scope-related functions for use in other modules
export { formatScope, formatScopeShort } from './scope.js'
