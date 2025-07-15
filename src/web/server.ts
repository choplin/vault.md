import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { catEntry, getEntry, listEntries } from '../core/index.js'
import type { VaultEntry } from '../core/types.js'
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

  // Get all entries from all projects
  app.get('/api/entries/all', (c) => {
    try {
      // Get all unique projects from the database
      const stmt = vault.database.db.prepare(`
        SELECT DISTINCT project FROM entries
        ORDER BY project
      `)
      const projects = stmt.all() as { project: string }[]

      // Get entries for each project
      const allEntries: VaultEntry[] = []
      for (const { project } of projects) {
        const projectEntries = listEntries(vault, {
          allVersions: false,
          project,
        })
        allEntries.push(...projectEntries)
      }

      return c.json(allEntries)
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  })

  // Get current project path
  app.get('/api/current-project', (c) => {
    return c.json({ project: vault.project })
  })

  app.get('/api/entry/:project/:key/:version?', (c) => {
    try {
      const project = decodeURIComponent(c.req.param('project'))
      const key = c.req.param('key')
      const version = c.req.param('version') ? parseInt(c.req.param('version')!) : undefined

      const filePath = getEntry(vault, key, { project, version })
      if (!filePath) {
        return c.json({ error: 'Entry not found' }, 404)
      }

      const content = catEntry(vault, key, { project, version })
      return c.json({ content, filePath })
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  })

  // Serve static files
  // Determine the static files path based on what exists
  const staticPaths = [
    './src/web/static', // Development
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
