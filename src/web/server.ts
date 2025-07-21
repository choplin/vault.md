import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  deleteEntryAllVersions,
  deleteEntryVersion,
  deleteIdentifierAllBranches,
  deleteScope,
  getAllScopedEntriesGroupedByScope,
  getOrCreateScope,
  listScopedEntries,
} from '../core/database.js'
import { deleteFile, deleteProjectFiles } from '../core/filesystem.js'
import { catEntry, getEntry, listEntries } from '../core/index.js'
import { formatScope } from '../core/scope.js'
import type { VaultOptions } from '../core/types.js'
import type { VaultContext } from '../core/vault.js'

export function createWebServer(vault: VaultContext) {
  const app = new Hono()

  // Middleware
  app.use('*', cors())

  // API Routes
  app.get('/api/entries', (c) => {
    try {
      const entries = listEntries(vault, { allVersions: true })
      return c.json(entries)
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  })

  // Get all entries from all scopes
  app.get('/api/entries/all', (c) => {
    try {
      const scopedEntries = getAllScopedEntriesGroupedByScope(vault.database)
      const currentScope = formatScope(vault.scope)

      // Convert to array format expected by frontend
      const scopes = Array.from(scopedEntries.entries()).map(([scope, entries]) => {
        // Convert scoped entries to web format (with scope field)
        const vaultEntries = entries.map((entry) => ({
          id: entry.id,
          scope: formatScope(scope),
          version: entry.version,
          key: entry.key,
          filePath: entry.filePath,
          hash: entry.hash,
          description: entry.description,
          created_at: entry.createdAt,
          updated_at: entry.createdAt,
        }))

        return {
          scope: formatScope(scope),
          entries: vaultEntries,
        }
      })

      return c.json({ currentScope: currentScope, scopes: scopes })
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  })

  // Get current scope
  app.get('/api/current-scope', (c) => {
    return c.json({ scope: formatScope(vault.scope) })
  })

  // Get entries for a specific scope
  app.get('/api/scopes/:identifier/:branch/entries', (c) => {
    try {
      const identifier = decodeURIComponent(c.req.param('identifier'))
      const branch = decodeURIComponent(c.req.param('branch'))

      // Parse query parameters
      const allVersions = c.req.query('allVersions') === 'true'

      // Build scope based on identifier and branch
      const scope =
        identifier === 'global' && branch === 'global'
          ? { type: 'global' as const }
          : {
              type: 'branch' as const,
              identifier,
              branch,
              workPath:
                vault.scope.type === 'branch' && vault.scope.identifier === identifier
                  ? vault.scope.workPath
                  : undefined,
              remoteUrl:
                vault.scope.type === 'branch' && vault.scope.identifier === identifier
                  ? vault.scope.remoteUrl
                  : undefined,
            }

      // Get scope ID
      const scopeId = vault.database.db
        .prepare('SELECT id FROM scopes WHERE identifier = ? AND branch = ?')
        .get(identifier, branch) as { id: number } | undefined

      if (!scopeId) {
        return c.json({ entries: [] })
      }

      // Get entries for this scope
      const entries = listScopedEntries(vault.database, scopeId.id, allVersions)

      // Convert to web format
      const vaultEntries = entries.map((entry) => ({
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

      return c.json({
        scope: formatScope(scope),
        entries: vaultEntries,
      })
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  })

  app.get('/api/entry/:scope/:key/:version?', (c) => {
    try {
      const scopeParam = decodeURIComponent(c.req.param('scope'))
      const key = decodeURIComponent(c.req.param('key'))
      const version = c.req.param('version') ? parseInt(c.req.param('version')!) : undefined

      console.log('API entry request:', { scopeParam, key, version })

      // Parse scope parameter to determine if it's global or repo
      const options: VaultOptions = { version }
      if (scopeParam === 'Global' || scopeParam === 'global') {
        options.scope = 'global'
      } else {
        // For repo scopes, the frontend sends the formatted string "repoPath (branch)"
        // We need to parse this to extract the repo path and branch
        const match = scopeParam.match(/^(.+) \((.+)\)$/)
        if (match) {
          options.scope = 'branch'
          options.repo = match[1]
          options.branch = match[2]
        } else if (scopeParam.includes(':')) {
          // Handle repository:branch format
          const [repo, branch] = scopeParam.split(':')
          options.scope = 'branch'
          options.repo = repo
          options.branch = branch
        } else {
          // Assume repository scope
          options.scope = 'repository'
          options.repo = scopeParam
        }
      }

      const filePath = getEntry(vault, key, options)
      console.log('Got filePath:', filePath)

      if (!filePath) {
        return c.json({ error: 'Entry not found' }, 404)
      }

      const content = catEntry(vault, key, options)
      console.log('Got content length:', content?.length)

      return c.json({ content, filePath })
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  })

  // Delete endpoints
  app.delete('/api/entries/:identifier/:branch/:key/:version?', (c) => {
    try {
      const identifier = decodeURIComponent(c.req.param('identifier'))
      const branch = decodeURIComponent(c.req.param('branch'))
      const key = decodeURIComponent(c.req.param('key'))
      const version = c.req.param('version') ? parseInt(c.req.param('version')!) : undefined

      // Create scope object for database lookup
      const scope =
        identifier === 'global' && branch === 'global'
          ? { type: 'global' as const }
          : {
              type: 'branch' as const,
              identifier,
              branch,
              workPath:
                vault.scope.type === 'branch' && vault.scope.identifier === identifier
                  ? vault.scope.workPath
                  : undefined,
              remoteUrl:
                vault.scope.type === 'branch' && vault.scope.identifier === identifier
                  ? vault.scope.remoteUrl
                  : undefined,
            }

      // Get scope ID
      const scopeId = getOrCreateScope(vault.database, scope)

      // Get entries to find file paths before deletion
      const entries = listScopedEntries(vault.database, scopeId, true).filter((e) => e.key === key)

      if (version) {
        // Delete specific version
        const entry = entries.find((e) => e.version === version)
        if (!entry) {
          return c.json({ error: 'Version not found' }, 404)
        }

        // Delete file
        deleteFile(entry.filePath)

        // Delete from database
        const deleted = deleteEntryVersion(vault.database, scopeId, key, version)
        if (deleted > 0) {
          return c.json({ message: `Deleted version ${version} of key '${key}'` })
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
        const deletedCount = deleteEntryAllVersions(vault.database, scopeId, key)
        if (deletedCount > 0) {
          return c.json({ message: `Deleted ${deletedCount} versions of key '${key}'` })
        }
        return c.json({ error: 'Failed to delete key' }, 500)
      }
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  })

  app.delete('/api/branches/:identifier/:branch', (c) => {
    try {
      const identifier = decodeURIComponent(c.req.param('identifier'))
      const branch = decodeURIComponent(c.req.param('branch'))

      // Delete project files
      const scopePath = `${identifier}/${branch}`.replace(/[/\\:]/g, '_')
      deleteProjectFiles(scopePath)

      // Delete from database
      const deletedCount = deleteScope(vault.database, identifier, branch)
      return c.json({ message: `Deleted scope with ${deletedCount} entries` })
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  })

  app.delete('/api/identifiers/:identifier', (c) => {
    try {
      const identifier = decodeURIComponent(c.req.param('identifier'))

      // Get all scopes for this identifier to delete files
      const allScopes = getAllScopedEntriesGroupedByScope(vault.database)
      for (const [scope, _] of allScopes) {
        if ((scope.type === 'branch' || scope.type === 'repository') && scope.identifier === identifier) {
          if (scope.type === 'branch') {
            const scopePath = `${scope.identifier}/${scope.branch}`.replace(/[/\\:]/g, '_')
            deleteProjectFiles(scopePath)
          } else {
            const scopePath = scope.identifier.replace(/[/\\:]/g, '_')
            deleteProjectFiles(scopePath)
          }
        }
      }

      // Delete from database
      const deletedCount = deleteIdentifierAllBranches(vault.database, identifier)
      return c.json({ message: `Deleted all branches with ${deletedCount} total entries` })
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
