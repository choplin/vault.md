import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getAllScopedEntriesGroupedByScope } from '../core/database.js'
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

  app.get('/api/entry/:scope/:key/:version?', (c) => {
    try {
      const scopeParam = decodeURIComponent(c.req.param('scope'))
      const key = c.req.param('key')
      const version = c.req.param('version') ? parseInt(c.req.param('version')!) : undefined

      // Parse scope parameter to determine if it's global or repo
      const options: VaultOptions = { version }
      if (scopeParam === 'Global' || scopeParam === 'global') {
        options.global = true
      } else {
        // For repo scopes, we need to parse the formatted string
        // Format is "repoPath (branch)" - we'll use global for now as a fallback
        options.global = true // TODO: implement proper scope parsing
      }

      const filePath = getEntry(vault, key, options)
      if (!filePath) {
        return c.json({ error: 'Entry not found' }, 404)
      }

      const content = catEntry(vault, key, options)
      return c.json({ content, filePath })
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
