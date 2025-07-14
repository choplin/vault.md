import { isatty } from 'node:tty'
import { Command } from 'commander'
import { Table } from 'console-table-printer'
import {
  catEntry,
  closeVault,
  createVault,
  deleteEntry,
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
  .action((key, options) => {
    try {
      const vault = createVault()
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
  .option('--project <path>', 'Get from different project')
  .action((key, options) => {
    try {
      const vault = createVault(options.project)
      const path = getEntry(vault, key, {
        version: options.version,
        project: options.project,
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
  .option('--project <path>', 'Get from different project')
  .action((key, options) => {
    try {
      const vault = createVault(options.project)
      const content = catEntry(vault, key, {
        version: options.version,
        project: options.project,
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
  .option('--project <path>', 'List from different project')
  .action((options) => {
    try {
      const vault = createVault(options.project)
      const entries = listEntries(vault, {
        allVersions: options.allVersions,
        project: options.project,
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
  .option('--project <path>', 'Delete from different project')
  .action((key, options) => {
    try {
      const vault = createVault(options.project)
      const deleted = deleteEntry(vault, key, {
        version: options.version,
        project: options.project,
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
  .option('--project <path>', 'Show from different project')
  .action((key, options) => {
    try {
      const vault = createVault(options.project)
      const entry = getInfo(vault, key, {
        version: options.version,
        project: options.project,
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
  .command('serve')
  .description('Start web UI server')
  .option('-p, --port <port>', 'Port to listen on', '8080')
  .action(async (options) => {
    try {
      const { startWebServer } = await import('./web/server.js')
      const vault = createVault()
      const port = parseInt(options.port)
      startWebServer(vault, port)
    } catch (error) {
      console.error('Web server error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program.parse()
