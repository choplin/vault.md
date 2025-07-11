import { Command } from 'commander'
import { Table } from 'console-table-printer'
import { VaultCore } from './core/index.js'

const program = new Command()

program
  .name('ccvault')
  .description('Claude Code Knowledge Vault - persistent storage for AI-assisted development')
  .version('0.1.0')

program
  .command('set <key> <file>')
  .description('Save content to vault')
  .option('-d, --description <desc>', 'Add description')
  .action((key, file, options) => {
    try {
      const vault = new VaultCore()
      const path = vault.set(key, file, {
        description: options.description,
      })
      console.log(path)
      vault.close()
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
      const vault = new VaultCore(options.project)
      const path = vault.get(key, {
        version: options.version,
        project: options.project,
      })

      if (path) {
        console.log(path)
      } else {
        console.error(`Key not found: ${key}`)
        process.exit(1)
      }
      vault.close()
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
      const vault = new VaultCore(options.project)
      const content = vault.cat(key, {
        version: options.version,
        project: options.project,
      })

      if (content !== undefined) {
        process.stdout.write(content)
      } else {
        console.error(`Key not found: ${key}`)
        process.exit(1)
      }
      vault.close()
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
      const vault = new VaultCore(options.project)
      const entries = vault.list({
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
      vault.close()
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
      const vault = new VaultCore(options.project)
      const deleted = vault.delete(key, {
        version: options.version,
        project: options.project,
      })

      if (deleted) {
        console.log(`Deleted: ${key}`)
      } else {
        console.error(`Key not found: ${key}`)
        process.exit(1)
      }
      vault.close()
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
      const vault = new VaultCore(options.project)
      const entry = vault.info(key, {
        version: options.version,
        project: options.project,
      })

      if (entry) {
        console.log(JSON.stringify(entry, null, 2))
      } else {
        console.error(`Key not found: ${key}`)
        process.exit(1)
      }
      vault.close()
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('mcp')
  .description('Start MCP server')
  .action(() => {
    console.log('TODO: Implement MCP server')
  })

program.parse()
