import { isatty } from 'node:tty'
import { Command } from 'commander'
import { Table } from 'console-table-printer'
import {
  catEntry,
  closeVault,
  createVault,
  deleteEntry,
  editEntry,
  getEntry,
  getInfo,
  listEntries,
  setEntry,
} from './core/index.js'
import { VaultMCPServer } from './mcp/server.js'

const program = new Command()

program.name('vault').description('vault.md - A knowledge vault for AI-assisted development').version('0.1.0')

program
  .command('set <key>')
  .description('Save content to vault (reads from stdin by default)')
  .option('-f, --file <path>', 'Read content from file')
  .option('-d, --description <desc>', 'Add description')
  .option('--global', 'Save to global scope')
  .option('--repo <path>', 'Save to specific repository')
  .option('--branch <name>', 'Save to specific branch')
  .action((key, options) => {
    try {
      const vault = createVault({
        global: options.global,
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
  .option('--version <version>', 'Get specific version', parseInt)
  .option('--global', 'Get from global scope')
  .option('--repo <path>', 'Get from specific repository')
  .option('--branch <name>', 'Get from specific branch')
  .action((key, options) => {
    try {
      const vault = createVault({
        global: options.global,
        repo: options.repo,
        branch: options.branch,
      })
      const path = getEntry(vault, key, {
        version: options.version,
        global: options.global,
        repo: options.repo,
        branch: options.branch,
      })

      if (path) {
        console.log(path)
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
  .option('--version <version>', 'Get specific version', parseInt)
  .option('--global', 'Get from global scope')
  .option('--repo <path>', 'Get from specific repository')
  .option('--branch <name>', 'Get from specific branch')
  .action((key, options) => {
    try {
      const vault = createVault({
        global: options.global,
        repo: options.repo,
        branch: options.branch,
      })
      const content = catEntry(vault, key, {
        version: options.version,
        global: options.global,
        repo: options.repo,
        branch: options.branch,
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
  .option('--global', 'List from global scope')
  .option('--repo <path>', 'List from specific repository')
  .option('--branch <name>', 'List from specific branch')
  .action((options) => {
    try {
      const vault = createVault({
        global: options.global,
        repo: options.repo,
        branch: options.branch,
      })
      const entries = listEntries(vault, {
        allVersions: options.allVersions,
        global: options.global,
        repo: options.repo,
        branch: options.branch,
      })

      if (options.json) {
        console.log(JSON.stringify(entries, null, 2))
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
  .command('delete <key>')
  .description('Delete key from vault')
  .option('--version <version>', 'Delete specific version', parseInt)
  .option('--global', 'Delete from global scope')
  .option('--repo <path>', 'Delete from specific repository')
  .option('--branch <name>', 'Delete from specific branch')
  .action((key, options) => {
    try {
      const vault = createVault({
        global: options.global,
        repo: options.repo,
        branch: options.branch,
      })
      const deleted = deleteEntry(vault, key, {
        version: options.version,
        global: options.global,
        repo: options.repo,
        branch: options.branch,
      })

      if (deleted) {
        console.log(`Deleted: ${key}`)
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
  .command('info <key>')
  .description('Show key metadata')
  .option('--version <version>', 'Show specific version', parseInt)
  .option('--global', 'Show from global scope')
  .option('--repo <path>', 'Show from specific repository')
  .option('--branch <name>', 'Show from specific branch')
  .action((key, options) => {
    try {
      const vault = createVault({
        global: options.global,
        repo: options.repo,
        branch: options.branch,
      })
      const entry = getInfo(vault, key, {
        version: options.version,
        global: options.global,
        repo: options.repo,
        branch: options.branch,
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
  .option('--global', 'Use global scope')
  .option('--repo <path>', 'Use specific repository')
  .option('--branch <name>', 'Use specific branch')
  .action(async (options) => {
    try {
      const { startWebServer } = await import('./web/server.js')
      const vault = createVault({
        global: options.global,
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
  .option('--version <version>', 'Edit specific version', parseInt)
  .option('--global', 'Edit from global scope')
  .option('--repo <path>', 'Edit from specific repository')
  .option('--branch <name>', 'Edit from specific branch')
  .action((key, options) => {
    try {
      const vault = createVault({
        global: options.global,
        repo: options.repo,
        branch: options.branch,
      })
      const changed = editEntry(vault, key, {
        global: options.global,
        repo: options.repo,
        branch: options.branch,
        version: options.version,
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

program.parse()
