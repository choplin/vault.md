import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
// Database imports are now handled through vault context services
import { deleteFile, deleteProjectFiles } from '../core/filesystem.js'
import { catEntry, getEntry, listEntries } from '../core/index.js'
import { getScopeStorageKey, type Scope } from '../core/scope.js'
import type { VaultOptions } from '../core/types.js'
import type { VaultContext } from '../core/vault.js'

export function createWebServer(vault: VaultContext) {
  const app = new Hono()

  // Middleware
  app.use('*', cors())

  type ScopePayload =
    | { type: 'global' }
    | { type: 'repository'; primaryPath: string }
    | { type: 'branch'; primaryPath: string; branchName: string }
    | { type: 'worktree'; primaryPath: string; worktreeId: string; worktreePath?: string }

  const toScopePayload = (scope: Scope): ScopePayload => {
    switch (scope.type) {
      case 'global':
        return { type: 'global' }
      case 'repository':
        return { type: 'repository', primaryPath: scope.primaryPath }
      case 'branch':
        return {
          type: 'branch',
          primaryPath: scope.primaryPath,
          branchName: scope.branchName,
        }
      case 'worktree':
        return {
          type: 'worktree',
          primaryPath: scope.primaryPath,
          worktreeId: scope.worktreeId,
          worktreePath: scope.worktreePath,
        }
    }
  }

  const validateScopePayload = (payload: ScopePayload): ScopePayload => {
    if (payload.type === 'repository' && !payload.primaryPath) {
      throw new Error('Repository scope requires primaryPath')
    }
    if (payload.type === 'branch' && (!payload.primaryPath || !payload.branchName)) {
      throw new Error('Branch scope requires primaryPath and branchName')
    }
    if (payload.type === 'worktree' && (!payload.primaryPath || !payload.worktreeId)) {
      throw new Error('Worktree scope requires primaryPath and worktreeId')
    }
    return payload
  }

  const fromScopePayload = (payload: ScopePayload): Scope => {
    const scope = validateScopePayload(payload)
    switch (scope.type) {
      case 'global':
        return { type: 'global' }
      case 'repository':
        return { type: 'repository', primaryPath: scope.primaryPath }
      case 'branch':
        return {
          type: 'branch',
          primaryPath: scope.primaryPath,
          branchName: scope.branchName,
        }
      case 'worktree':
        return {
          type: 'worktree',
          primaryPath: scope.primaryPath,
          worktreeId: scope.worktreeId,
          worktreePath: scope.worktreePath,
        }
    }
  }

  // API Routes
  app.get('/api/entries', async (c) => {
    try {
      const entries = listEntries(vault, { allVersions: true })
      return c.json(entries)
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  })

  // Get all entries from all scopes
  app.get('/api/entries/all', async (c) => {
    try {
      const scopedEntries = await vault.scopeService.getAllEntriesGrouped()
      const scopes = Array.from(scopedEntries.entries()).map(([scope, entries]) => ({
        scope: toScopePayload(scope),
        entries: entries.map((entry) => ({
          id: entry.id,
          scopeId: entry.scopeId,
          scope: toScopePayload(scope),
          version: entry.version,
          key: entry.key,
          filePath: entry.filePath,
          hash: entry.hash,
          description: entry.description,
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.createdAt.toISOString(),
          isArchived: entry.isArchived,
        })),
      }))

      return c.json({ currentScope: toScopePayload(vault.scope), scopes })
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  })

  // Get current scope
  app.get('/api/current-scope', (c) => {
    return c.json({ scope: toScopePayload(vault.scope) })
  })

  // Get entries for a specific scope
  app.post('/api/scope/entries', async (c) => {
    try {
      const body = await c.req.json()
      if (!body?.scope) {
        return c.json({ error: 'Scope payload is required' }, 400)
      }

      const scope = fromScopePayload(body.scope as ScopePayload)
      const allVersions = Boolean(body?.allVersions)

      // Get scope ID
      const scopeId = vault.scopeService.findScopeId(scope)

      if (!scopeId) {
        return c.json({ scope: toScopePayload(scope), entries: [] })
      }

      // Get entries for this scope
      const entries = await vault.entryService.list(scopeId, false, allVersions)

      // Convert to web format
      const vaultEntries = entries.map((entry) => ({
        id: entry.id,
        scopeId: entry.scopeId,
        scope: toScopePayload(scope),
        version: entry.version,
        key: entry.key,
        filePath: entry.filePath,
        hash: entry.hash,
        description: entry.description,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.createdAt.toISOString(),
        isArchived: entry.isArchived,
      }))

      return c.json({
        scope: toScopePayload(scope),
        entries: vaultEntries,
      })
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  })

  app.post('/api/entry/content', async (c) => {
    try {
      const body = await c.req.json()
      const { scope: scopePayload, key, version } = body ?? {}

      if (!scopePayload || !key) {
        return c.json({ error: 'Scope payload and key are required' }, 400)
      }

      const scope = fromScopePayload(scopePayload as ScopePayload)

      const options: VaultOptions = { version }
      if (scope.type === 'global') {
        options.scope = 'global'
      } else if (scope.type === 'repository') {
        options.scope = 'repository'
        options.repo = scope.primaryPath
      } else if (scope.type === 'branch') {
        options.scope = 'branch'
        options.repo = scope.primaryPath
        options.branch = scope.branchName
      } else {
        options.scope = 'worktree'
        options.repo = scope.primaryPath
        options.worktreeId = scope.worktreeId
      }

      const filePath = await getEntry(vault, key, options)

      if (!filePath) {
        return c.json({ error: 'Entry not found' }, 404)
      }

      const content = await catEntry(vault, key, options)

      return c.json({ content, filePath })
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  })

  // Delete endpoints
  app.delete('/api/entry', async (c) => {
    try {
      const body = await c.req.json()
      const { scope: scopePayload, key, version } = body ?? {}

      if (!scopePayload || !key) {
        return c.json({ error: 'Scope payload and key are required' }, 400)
      }

      const scope = fromScopePayload(scopePayload as ScopePayload)
      const versionNumber = typeof version === 'number' ? version : undefined

      // Get scope ID
      const scopeId = vault.scopeService.findScopeId(scope)

      if (!scopeId) {
        return c.json({ error: 'Scope not found' }, 404)
      }

      // Get entries to find file paths before deletion
      const entries = (await vault.entryService.list(scopeId, true, true)).filter((e) => e.key === key)

      if (versionNumber) {
        // Delete specific version
        const entry = entries.find((e) => e.version === versionNumber)
        if (!entry) {
          return c.json({ error: 'Version not found' }, 404)
        }

        // Delete file
        deleteFile(entry.filePath)

        // Delete from database
        const deleted = await vault.entryService.deleteVersion(scopeId, key, versionNumber)
        if (deleted) {
          return c.json({ message: `Deleted version ${versionNumber} of key '${key}'` })
        }
        return c.json({ error: 'Failed to delete version' }, 500)
      } else {
        // Delete all versions of key
        if (entries.length === 0) {
          return c.json({ error: 'Key not found' }, 404)
        }

        // Delete files
        entries.forEach((entry) => {
          deleteFile(entry.filePath)
        })

        // Delete from database
        const deletedCount = entries.length
        const success = await vault.entryService.deleteAll(scopeId, key)
        if (success && deletedCount > 0) {
          return c.json({ message: `Deleted ${deletedCount} versions of key '${key}'` })
        }
        return c.json({ error: 'Failed to delete key' }, 500)
      }
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  })

  app.delete('/api/scope', async (c) => {
    try {
      const body = await c.req.json()
      const { scope: scopePayload, cascade } = body ?? {}

      if (!scopePayload) {
        return c.json({ error: 'Scope payload is required' }, 400)
      }

      const scope = fromScopePayload(scopePayload as ScopePayload)

      if (scope.type === 'global') {
        return c.json({ error: 'Cannot delete global scope' }, 400)
      }

      if (scope.type === 'repository' && cascade) {
        const allScopes = await vault.scopeService.getAllEntriesGrouped()
        for (const existingScope of allScopes.keys()) {
          if (existingScope.type === 'global') continue
          if (existingScope.primaryPath === scope.primaryPath) {
            deleteProjectFiles(getScopeStorageKey(existingScope))
          }
        }
        const deletedCount = await vault.scopeService.deleteAllBranches(scope.primaryPath)
        return c.json({ message: `Deleted repository scopes with ${deletedCount} entries` })
      }

      const scopePath = getScopeStorageKey(scope)
      deleteProjectFiles(scopePath)

      const deletedCount = await vault.scopeService.deleteScope(scope)
      return c.json({ message: `Deleted scope with ${deletedCount} entries` })
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  })

  // Serve static files
  // Determine the static files path based on what exists
  const staticPaths = [
    './src/web/static', // Production build output
    './dist/web/static', // Production (from project root)
    './web/static', // Production (from dist directory)
  ]

  const staticRoot = staticPaths.find((path) => existsSync(path)) || staticPaths[0]

  app.use(
    '/*',
    serveStatic({
      root: staticRoot,
      rewriteRequestPath: (path) => (path === '/' ? '/index.html' : path),
    }),
  )

  return app
}

export function startWebServer(vault: VaultContext, port = 8080) {
  const app = createWebServer(vault)

  console.log(`Starting vault.md web server on http://localhost:${port}`)

  serve({
    fetch: app.fetch,
    port,
  })
}
