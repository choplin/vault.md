import * as fs from 'node:fs'
import { isatty } from 'node:tty'
import { Command } from 'commander'
import { Table } from 'console-table-printer'
import {
  catEntry,
  closeVault,
  createVault,
  deleteAllBranches,
  deleteBranch,
  deleteCurrentScope,
  deleteKey,
  deleteVersion,
  editEntry,
  formatScopeShort,
  getEntry,
  getInfo,
  listEntries,
  moveScope,
  resolveScope,
  setEntry,
} from './core/index.js'
import type { ScopeType } from './core/types.js'
import { VaultMCPServer } from './mcp/server.js'

const program = new Command()

// Common validation function for scope options
interface ScopeOptions {
  scope?: string
  branch?: string
  [key: string]: unknown
}

function validateScopeOptions(options: ScopeOptions): void {
  // Validate scope value
  if (options.scope && !['global', 'repository', 'branch'].includes(options.scope)) {
    throw new Error(`Invalid scope type: ${options.scope}. Must be one of: global, repository, branch`)
  }

  // Validate scope combinations
  if (options.branch && (!options.scope || options.scope !== 'branch')) {
    throw new Error('--branch option can only be used with --scope branch')
  }
}

program.name('vault').description('vault.md - A knowledge vault for AI-assisted development').version('0.1.0')

program
  .command('set <key>')
  .description('Save content to vault (reads from stdin by default)')
  .option('-f, --file <path>', 'Read content from file')
  .option('-d, --description <desc>', 'Add description')
  .option('--scope <type>', 'Scope type: global, repository, or branch')
  .option('--repo <path>', 'Save to specific repository')
  .option('--branch <name>', 'Save to specific branch')
  .action((key, options) => {
    try {
      validateScopeOptions(options)

      const vault = createVault({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
      })
      // Show prompt for interactive TTY input
      if (!options.file && isatty(0)) {
        console.error('Enter content (Ctrl-D when done):')
      }
      const path = setEntry(vault, key, options.file || '-', {
        description: options.description,
      })
      console.log(path)
      closeVault(vault)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('get <key>')
  .description('Get file path from vault')
  .option('-v, --ver <version>', 'Get specific version', parseInt)
  .option('--scope <type>', 'Scope type: global, repository, or branch')
  .option('--repo <path>', 'Repository path')
  .option('--branch <name>', 'Branch name (for branch scope)')
  .option('--all-scopes', 'Search all scopes in order')
  .action((key, options) => {
    try {
      validateScopeOptions(options)

      const vault = createVault({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
      })
      const path = getEntry(vault, key, {
        version: options.ver,
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        allScopes: options.allScopes,
      })

      if (path) {
        // Output file content instead of path
        const content = fs.readFileSync(path, 'utf8')
        process.stdout.write(content)
      } else {
        console.error(`Key not found: ${key}`)
        process.exit(1)
      }
      closeVault(vault)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('cat <key>')
  .description('Output file content')
  .option('-v, --ver <version>', 'Get specific version', parseInt)
  .option('--scope <type>', 'Scope type: global, repository, or branch')
  .option('--repo <path>', 'Repository path')
  .option('--branch <name>', 'Branch name (for branch scope)')
  .option('--all-scopes', 'Search all scopes in order')
  .action((key, options) => {
    try {
      validateScopeOptions(options)

      const vault = createVault({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
      })
      const content = catEntry(vault, key, {
        version: options.ver,
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        allScopes: options.allScopes,
      })

      if (content !== undefined) {
        process.stdout.write(content)
      } else {
        console.error(`Key not found: ${key}`)
        process.exit(1)
      }
      closeVault(vault)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('list')
  .description('List keys in vault')
  .option('--all-versions', 'Show all versions')
  .option('--json', 'Output as JSON')
  .option('--scope <type>', 'Scope type: global, repository, or branch')
  .option('--repo <path>', 'List from specific repository')
  .option('--branch <name>', 'List from specific branch')
  .action((options) => {
    try {
      validateScopeOptions(options)

      const vault = createVault({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
      })
      const entries = listEntries(vault, {
        allVersions: options.allVersions,
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        allScopes: options.allScopes,
      })

      if (options.json) {
        console.log(JSON.stringify({ entries }, null, 2))
      } else if (entries.length === 0) {
        console.log('No entries found')
      } else {
        const table = new Table({
          columns: [
            { name: 'key', alignment: 'left', color: 'cyan' },
            { name: 'version', alignment: 'center', color: 'yellow' },
            { name: 'created', alignment: 'left' },
            { name: 'description', alignment: 'left', color: 'dim' },
          ],
        })

        entries.forEach((entry) => {
          table.addRow({
            key: entry.key,
            version: `v${entry.version}`,
            created: entry.createdAt.toLocaleString(),
            description: entry.description || '',
          })
        })

        table.printTable()
      }
      closeVault(vault)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('delete [key]')
  .description('Delete entries from vault')
  .option('-v, --ver <version>', 'Delete specific version', parseInt)
  .option('--scope <type>', 'Scope type: global, repository, or branch')
  .option('--repo <path>', 'Delete from specific repository')
  .option('--branch <name>', 'Delete from specific branch')
  .option('--current-scope', 'Delete vault for current scope (identifier + branch)')
  .option('--delete-branch <branch>', 'Delete vault for specific branch')
  .option('--all-branches', 'Delete entire vault (all branches) of current identifier')
  .option('--force', 'Skip confirmation prompt')
  .action(async (key, options) => {
    try {
      validateScopeOptions(options)

      const vault = createVault({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
      })

      // Determine what to delete
      if (options.currentScope) {
        // Delete current scope
        if (!options.force) {
          const readline = await import('node:readline/promises')
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          })
          const answer = await rl.question(
            `Delete scope '${vault.scope.type === 'branch' ? `${vault.scope.identifier} (${vault.scope.branch})` : 'global'}' with all entries? This action cannot be undone. (y/N) `,
          )
          rl.close()
          if (answer.toLowerCase() !== 'y') {
            console.log('Deletion cancelled')
            closeVault(vault)
            return
          }
        }
        const deletedCount = deleteCurrentScope(vault)
        console.log(`Deleted scope with ${deletedCount} entries`)
      } else if (options.deleteBranch) {
        // Delete vault for specific branch
        if (!options.force) {
          const readline = await import('node:readline/promises')
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          })
          const answer = await rl.question(
            `Delete vault for branch '${options.deleteBranch}' of '${vault.scope.type === 'branch' ? vault.scope.identifier : 'global'}'? This action cannot be undone. (y/N) `,
          )
          rl.close()
          if (answer.toLowerCase() !== 'y') {
            console.log('Deletion cancelled')
            closeVault(vault)
            return
          }
        }
        const deletedCount = deleteBranch(vault, options.deleteBranch)
        console.log(`Deleted vault for branch with ${deletedCount} entries`)
      } else if (options.allBranches) {
        // Delete entire vault
        if (!options.force) {
          const readline = await import('node:readline/promises')
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          })
          const answer = await rl.question(
            `Delete entire vault for '${vault.scope.type === 'branch' ? vault.scope.identifier : 'global'}'? This will remove all data across all branches. (y/N) `,
          )
          rl.close()
          if (answer.toLowerCase() !== 'y') {
            console.log('Deletion cancelled')
            closeVault(vault)
            return
          }
        }
        const deletedCount = deleteAllBranches(vault)
        console.log(`Deleted entire vault with ${deletedCount} total entries`)
      } else if (key) {
        // Delete key or version
        if (options.ver) {
          // Delete specific version
          if (!options.force) {
            const readline = await import('node:readline/promises')
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout,
            })
            const answer = await rl.question(`Delete version ${options.ver} of '${key}'? (y/N) `)
            rl.close()
            if (answer.toLowerCase() !== 'y') {
              console.log('Deletion cancelled')
              closeVault(vault)
              return
            }
          }
          const deleted = deleteVersion(vault, key, options.ver)
          if (deleted) {
            console.log(`Deleted version ${options.ver} of key '${key}'`)
          } else {
            console.error(`Version ${options.ver} of key '${key}' not found`)
            process.exit(1)
          }
        } else {
          // Delete all versions of key
          if (!options.force) {
            const readline = await import('node:readline/promises')
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout,
            })
            const answer = await rl.question(
              `Delete all versions of key '${key}'? This key will be permanently removed. (y/N) `,
            )
            rl.close()
            if (answer.toLowerCase() !== 'y') {
              console.log('Deletion cancelled')
              closeVault(vault)
              return
            }
          }
          const deletedCount = deleteKey(vault, key)
          if (deletedCount > 0) {
            console.log(`Deleted ${deletedCount} versions of key '${key}'`)
          } else {
            console.error(`Key '${key}' not found`)
            process.exit(1)
          }
        }
      } else {
        console.error('Please specify a key or use --current-scope, --delete-branch, or --all-branches')
        process.exit(1)
      }

      closeVault(vault)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('info <key>')
  .description('Show key metadata')
  .option('-v, --ver <version>', 'Show specific version', parseInt)
  .option('--scope <type>', 'Scope type: global, repository, or branch')
  .option('--repo <path>', 'Show from specific repository')
  .option('--branch <name>', 'Show from specific branch')
  .action((key, options) => {
    try {
      validateScopeOptions(options)

      const vault = createVault({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
      })
      const entry = getInfo(vault, key, {
        version: options.ver,
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        allScopes: options.allScopes,
      })

      if (entry) {
        console.log(JSON.stringify(entry, null, 2))
      } else {
        console.error(`Key not found: ${key}`)
        process.exit(1)
      }
      closeVault(vault)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('mcp')
  .description('Start MCP server')
  .action(async () => {
    try {
      const server = new VaultMCPServer()
      await server.run()
    } catch (error) {
      console.error('MCP server error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('web')
  .description('Start web UI server')
  .option('-p, --port <port>', 'Port to listen on', '8080')
  .option('--scope <type>', 'Scope type: global, repository, or branch')
  .option('--repo <path>', 'Use specific repository')
  .option('--branch <name>', 'Use specific branch')
  .action(async (options) => {
    try {
      validateScopeOptions(options)

      const { startWebServer } = await import('./web/server.js')
      const vault = createVault({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
      })
      const port = parseInt(options.port)
      startWebServer(vault, port)
    } catch (error) {
      console.error('Web server error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('edit <key>')
  .description('Edit entry with $EDITOR')
  .option('-v, --ver <version>', 'Edit specific version', parseInt)
  .option('--scope <type>', 'Scope type: global, repository, or branch')
  .option('--repo <path>', 'Edit from specific repository')
  .option('--branch <name>', 'Edit from specific branch')
  .action((key, options) => {
    try {
      validateScopeOptions(options)

      const vault = createVault({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
      })
      const changed = editEntry(vault, key, {
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        allScopes: options.allScopes,
        version: options.ver,
      })

      if (changed) {
        console.log('Entry updated')
      } else {
        console.log('No changes made')
      }

      closeVault(vault)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('move-scope <key>')
  .description('Move an entry between scopes')
  .requiredOption('--from-scope <type>', 'Source scope type')
  .option('--from-repo <path>', 'Source repository')
  .option('--from-branch <name>', 'Source branch')
  .requiredOption('--to-scope <type>', 'Target scope type')
  .option('--to-repo <path>', 'Target repository')
  .option('--to-branch <name>', 'Target branch')
  .action((key, options) => {
    try {
      // Validate branch options
      if (options.fromBranch && options.fromScope !== 'branch') {
        throw new Error('--from-branch option can only be used with --from-scope branch')
      }
      if (options.toBranch && options.toScope !== 'branch') {
        throw new Error('--to-branch option can only be used with --to-scope branch')
      }

      const ctx = createVault() // Current context

      const fromScope = resolveScope({
        scope: options.fromScope as ScopeType,
        repo: options.fromRepo,
        branch: options.fromBranch,
      })

      const toScope = resolveScope({
        scope: options.toScope as ScopeType,
        repo: options.toRepo,
        branch: options.toBranch,
      })

      moveScope(ctx, key, fromScope, toScope)
      console.log(`Moved ${key} from ${formatScopeShort(fromScope)} to ${formatScopeShort(toScope)}`)
      closeVault(ctx)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program.parse()
