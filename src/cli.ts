import * as fs from 'node:fs'
import { isatty } from 'node:tty'
import { Command } from 'commander'
import { Table } from 'console-table-printer'
import * as git from './core/git.js'
import {
  archiveEntry,
  catEntry,
  closeVault,
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
  resolveVaultContext,
  restoreEntry,
  setEntry,
} from './core/index.js'
import type { ScopeType } from './core/types.js'
import type { ResolveContextOptions } from './core/vault.js'
import { VaultMCPServer } from './mcp/server.js'

const program = new Command()

// Common validation function for scope options
interface ScopeOptions {
  scope?: string
  branch?: string
  worktree?: string
  [key: string]: unknown
}

function validateScopeOptions(options: ScopeOptions): void {
  // Validate scope value
  if (options.scope && !['global', 'repository', 'branch', 'worktree'].includes(options.scope)) {
    throw new Error(`Invalid scope: ${options.scope}. Valid scopes are: global, repository, branch, worktree`)
  }

  // Validate scope combinations
  if (options.branch && (!options.scope || options.scope !== 'branch')) {
    throw new Error('--branch option can only be used with --scope branch')
  }

  if (options.worktree && (!options.scope || options.scope !== 'worktree')) {
    throw new Error('--worktree option can only be used with --scope worktree')
  }
}

program.name('vault').description('vault.md - A knowledge vault for AI-assisted development').version('0.1.0')

program
  .command('set <key>')
  .description('Save content to vault (reads from stdin by default)')
  .option('-f, --file <path>', 'Read content from file')
  .option('-d, --description <desc>', 'Add description')
  .option('--scope <type>', 'Scope type: global, repository, branch, or worktree')
  .option('--repo <path>', 'Save to specific repository')
  .option('--branch <name>', 'Save to specific branch')
  .option('--worktree <id>', 'Save to specific worktree (for worktree scope)')
  .action(async (key, options) => {
    try {
      validateScopeOptions(options)

      const vault = resolveVaultContext({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
      })
      // Show prompt for interactive TTY input
      if (!options.file && isatty(0)) {
        console.error('Enter content (Ctrl-D when done):')
      }
      const path = await setEntry(vault, key, options.file || '-', {
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
  .option('--scope <type>', 'Scope type: global, repository, branch, or worktree')
  .option('--repo <path>', 'Repository path')
  .option('--branch <name>', 'Branch name (for branch scope)')
  .option('--worktree <id>', 'Worktree key (for worktree scope)')
  .option('--all-scopes', 'Search all scopes in order')
  .action(async (key, options) => {
    try {
      validateScopeOptions(options)

      // When --all-scopes is used and no explicit scope is provided,
      // detect if we're in a git repo with a branch to start from branch scope
      const contextOptions: ResolveContextOptions = {
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
      }

      if (options.allScopes && !options.scope) {
        const gitInfo = git.getGitInfo()
        if (gitInfo.isGitRepo) {
          if (gitInfo.isWorktree && gitInfo.worktreeId) {
            contextOptions.scope = 'worktree'
            contextOptions.worktreeId = gitInfo.worktreeId
          } else if (gitInfo.currentBranch) {
            contextOptions.scope = 'branch'
          }
        }
      }

      const vault = resolveVaultContext(contextOptions)
      const path = await getEntry(vault, key, {
        version: options.ver,
        scope: contextOptions.scope as ScopeType,
        repo: contextOptions.repo,
        branch: contextOptions.branch,
        worktreeId: contextOptions.worktreeId,
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
  .option('--scope <type>', 'Scope type: global, repository, branch, or worktree')
  .option('--repo <path>', 'Repository path')
  .option('--branch <name>', 'Branch name (for branch scope)')
  .option('--worktree <id>', 'Worktree key (for worktree scope)')
  .option('--all-scopes', 'Search all scopes in order')
  .action(async (key, options) => {
    try {
      validateScopeOptions(options)

      const vault = resolveVaultContext({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
      })
      const content = await catEntry(vault, key, {
        version: options.ver,
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
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
  .option('--include-archived', 'Include archived entries')
  .option('--json', 'Output as JSON')
  .option('--scope <type>', 'Scope type: global, repository, branch, or worktree')
  .option('--repo <path>', 'List from specific repository')
  .option('--branch <name>', 'List from specific branch')
  .option('--worktree <id>', 'List from specific worktree (for worktree scope)')
  .action(async (options) => {
    try {
      validateScopeOptions(options)

      const vault = resolveVaultContext({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
      })
      const entries = await listEntries(vault, {
        allVersions: options.allVersions,
        includeArchived: options.includeArchived,
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
        allScopes: options.allScopes,
      })

      if (options.json) {
        console.log(JSON.stringify({ entries }, null, 2))
      } else if (entries.length === 0) {
        console.log('No entries found')
      } else {
        const columns = [
          { name: 'key', alignment: 'left', color: 'cyan' },
          { name: 'version', alignment: 'center', color: 'yellow' },
          { name: 'created', alignment: 'left' },
          { name: 'description', alignment: 'left', color: 'dim' },
        ]

        // Add archived column if includeArchived is set
        if (options.includeArchived) {
          columns.push({ name: 'archived', alignment: 'center', color: 'red' })
        }

        const table = new Table({ columns })

        entries.forEach((entry) => {
          const row: Record<string, string> = {
            key: entry.key,
            version: `v${entry.version}`,
            created: entry.createdAt.toLocaleString(),
            description: entry.description || '',
          }

          // Add archived status if includeArchived is set
          if (options.includeArchived) {
            row.archived = entry.isArchived ? 'Yes' : 'No'
          }

          table.addRow(row)
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
  .option('--scope <type>', 'Scope type: global, repository, branch, or worktree')
  .option('--repo <path>', 'Delete from specific repository')
  .option('--branch <name>', 'Delete from specific branch')
  .option('--worktree <id>', 'Delete from specific worktree (for worktree scope)')
  .option('--current-scope', 'Delete vault for current scope (repository or branch)')
  .option('--delete-branch <branch>', 'Delete vault for specific branch')
  .option('--all-branches', 'Delete entire vault (all branches) of current repository')
  .option('--force', 'Skip confirmation prompt')
  .action(async (key, options) => {
    try {
      validateScopeOptions(options)

      const vault = resolveVaultContext({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
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
          const scopeLabel =
            vault.scope.type === 'branch'
              ? `${vault.scope.primaryPath} (${vault.scope.branchName})`
              : vault.scope.type === 'worktree'
                ? `${vault.scope.primaryPath}@${vault.scope.worktreeId}`
                : vault.scope.type === 'repository'
                  ? vault.scope.primaryPath
                  : 'global'
          const answer = await rl.question(
            `Delete scope '${scopeLabel}' with all entries? This action cannot be undone. (y/N) `,
          )
          rl.close()
          if (answer.toLowerCase() !== 'y') {
            console.log('Deletion cancelled')
            closeVault(vault)
            return
          }
        }
        const deletedCount = await deleteCurrentScope(vault)
        console.log(`Deleted scope with ${deletedCount} entries`)
      } else if (options.deleteBranch) {
        // Delete vault for specific branch
        if (!options.force) {
          const readline = await import('node:readline/promises')
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          })
          const scopeLabel =
            vault.scope.type === 'branch' || vault.scope.type === 'repository'
              ? vault.scope.primaryPath
              : vault.scope.type === 'worktree'
                ? `${vault.scope.primaryPath}@${vault.scope.worktreeId}`
                : 'global'
          const answer = await rl.question(
            `Delete vault for branch '${options.deleteBranch}' of '${scopeLabel}'? This action cannot be undone. (y/N) `,
          )
          rl.close()
          if (answer.toLowerCase() !== 'y') {
            console.log('Deletion cancelled')
            closeVault(vault)
            return
          }
        }
        const deletedCount = await deleteBranch(vault, options.deleteBranch)
        console.log(`Deleted vault for branch with ${deletedCount} entries`)
      } else if (options.allBranches) {
        // Delete entire vault
        if (!options.force) {
          const readline = await import('node:readline/promises')
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          })
          const scopeLabel =
            vault.scope.type === 'branch' || vault.scope.type === 'repository'
              ? vault.scope.primaryPath
              : vault.scope.type === 'worktree'
                ? `${vault.scope.primaryPath}@${vault.scope.worktreeId}`
                : 'global'
          const answer = await rl.question(
            `Delete entire vault for '${scopeLabel}'? This will remove all data across all branches. (y/N) `,
          )
          rl.close()
          if (answer.toLowerCase() !== 'y') {
            console.log('Deletion cancelled')
            closeVault(vault)
            return
          }
        }
        const deletedCount = await deleteAllBranches(vault)
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
          const deleted = await deleteVersion(vault, key, options.ver)
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
          const deletedCount = await deleteKey(vault, key)
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
  .option('--scope <type>', 'Scope type: global, repository, branch, or worktree')
  .option('--repo <path>', 'Show from specific repository')
  .option('--branch <name>', 'Show from specific branch')
  .option('--worktree <id>', 'Show from specific worktree (for worktree scope)')
  .action(async (key, options) => {
    try {
      validateScopeOptions(options)

      const vault = resolveVaultContext({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
      })
      const entry = await getInfo(vault, key, {
        version: options.ver,
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
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
  .command('archive <key>')
  .description('Archive an entry')
  .option('--scope <type>', 'Scope type: global, repository, branch, or worktree')
  .option('--repo <path>', 'Archive from specific repository')
  .option('--branch <name>', 'Archive from specific branch')
  .option('--worktree <id>', 'Archive from specific worktree (for worktree scope)')
  .action(async (key, options) => {
    try {
      validateScopeOptions(options)

      const vault = resolveVaultContext({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
      })
      const result = await archiveEntry(vault, key, {
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
      })

      if (result) {
        console.log(`Archived entry: ${key}`)
      } else {
        console.error(`Failed to archive entry: ${key}`)
        process.exit(1)
      }
      closeVault(vault)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('restore <key>')
  .description('Restore an archived entry')
  .option('--scope <type>', 'Scope type: global, repository, branch, or worktree')
  .option('--repo <path>', 'Restore from specific repository')
  .option('--branch <name>', 'Restore from specific branch')
  .option('--worktree <id>', 'Restore from specific worktree (for worktree scope)')
  .action(async (key, options) => {
    try {
      validateScopeOptions(options)

      const vault = resolveVaultContext({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
      })
      const result = await restoreEntry(vault, key, {
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
      })

      if (result) {
        console.log(`Restored entry: ${key}`)
      } else {
        console.error(`Failed to restore entry: ${key}`)
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
  .command('ui')
  .description('Start Web UI server')
  .option('-p, --port <port>', 'Port to listen on', '8080')
  .option('--scope <type>', 'Scope type: global, repository, branch, or worktree')
  .option('--repo <path>', 'Use specific repository')
  .option('--branch <name>', 'Use specific branch')
  .option('--worktree <id>', 'Use specific worktree (for worktree scope)')
  .action(async (options) => {
    try {
      validateScopeOptions(options)

      const { startWebServer } = await import('./web/server.js')
      const vault = resolveVaultContext({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
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
  .option('--scope <type>', 'Scope type: global, repository, branch, or worktree')
  .option('--repo <path>', 'Edit from specific repository')
  .option('--branch <name>', 'Edit from specific branch')
  .option('--worktree <id>', 'Edit from specific worktree (for worktree scope)')
  .action(async (key, options) => {
    try {
      validateScopeOptions(options)

      const vault = resolveVaultContext({
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
      })
      const changed = await editEntry(vault, key, {
        scope: options.scope as ScopeType,
        repo: options.repo,
        branch: options.branch,
        worktreeId: options.worktree,
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
  .option('--from-worktree <id>', 'Source worktree key')
  .requiredOption('--to-scope <type>', 'Target scope type')
  .option('--to-repo <path>', 'Target repository')
  .option('--to-branch <name>', 'Target branch')
  .option('--to-worktree <id>', 'Target worktree key')
  .action(async (key, options) => {
    try {
      // Validate branch options
      if (options.fromBranch && options.fromScope !== 'branch') {
        throw new Error('--from-branch option can only be used with --from-scope branch')
      }
      if (options.toBranch && options.toScope !== 'branch') {
        throw new Error('--to-branch option can only be used with --to-scope branch')
      }
      if (options.fromWorktree && options.fromScope !== 'worktree') {
        throw new Error('--from-worktree option can only be used with --from-scope worktree')
      }
      if (options.toWorktree && options.toScope !== 'worktree') {
        throw new Error('--to-worktree option can only be used with --to-scope worktree')
      }

      const ctx = resolveVaultContext() // Current context

      const fromScope = resolveScope({
        scope: options.fromScope as ScopeType,
        repo: options.fromRepo,
        branch: options.fromBranch,
        worktreeId: options.fromWorktree,
      })

      const toScope = resolveScope({
        scope: options.toScope as ScopeType,
        repo: options.toRepo,
        branch: options.toBranch,
        worktreeId: options.toWorktree,
      })

      await moveScope(ctx, key, fromScope, toScope)
      console.log(`Moved ${key} from ${formatScopeShort(fromScope)} to ${formatScopeShort(toScope)}`)
      closeVault(ctx)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program.parse()
