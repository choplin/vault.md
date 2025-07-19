import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { VaultContext } from '../core/vault.js'
import * as vault from '../core/vault.js'
import { createVault } from '../core/vault.js'

// Zod schemas for tool parameters
const SetEntrySchema = z.object({
  key: z.string().describe('The key for the vault entry'),
  content: z.string().describe('The content to store'),
  description: z.string().optional().describe('Optional description for the entry'),
  global: z.boolean().optional().describe('Use global scope instead of current repository'),
  repo: z.string().optional().describe('Use specific repository path'),
  branch: z.string().optional().describe('Use specific branch (with repo option)'),
})

const GetEntrySchema = z.object({
  key: z.string().describe('The key for the vault entry'),
  version: z.number().optional().describe('Specific version to retrieve (latest if not specified)'),
  global: z.boolean().optional().describe('Use global scope instead of current repository'),
  repo: z.string().optional().describe('Use specific repository path'),
  branch: z.string().optional().describe('Use specific branch (with repo option)'),
})

const ListEntriesSchema = z.object({
  allVersions: z.boolean().optional().describe('Include all versions, not just latest'),
  global: z.boolean().optional().describe('Use global scope instead of current repository'),
  repo: z.string().optional().describe('Use specific repository path'),
  branch: z.string().optional().describe('Use specific branch (with repo option)'),
})

const DeleteEntrySchema = z.object({
  key: z.string().describe('The key for the vault entry to delete'),
  version: z.number().optional().describe('Specific version to delete (all versions if not specified)'),
  global: z.boolean().optional().describe('Use global scope instead of current repository'),
  repo: z.string().optional().describe('Use specific repository path'),
  branch: z.string().optional().describe('Use specific branch (with repo option)'),
})

const InfoEntrySchema = z.object({
  key: z.string().describe('The key for the vault entry'),
  version: z.number().optional().describe('Specific version (latest if not specified)'),
  global: z.boolean().optional().describe('Use global scope instead of current repository'),
  repo: z.string().optional().describe('Use specific repository path'),
  branch: z.string().optional().describe('Use specific branch (with repo option)'),
})

// Server implementation
export class VaultMCPServer {
  private server: Server
  private vaultContext: VaultContext

  constructor() {
    this.server = new Server(
      {
        name: 'vault.md',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    )

    // Initialize vault context with default scope (current repository)
    this.vaultContext = createVault({})

    this.setupHandlers()
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'vault_set',
          description: 'Store content in the vault with a key',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'The key for the vault entry' },
              content: { type: 'string', description: 'The content to store' },
              description: { type: 'string', description: 'Optional description for the entry' },
              global: { type: 'boolean', description: 'Use global scope instead of current repository' },
              repo: { type: 'string', description: 'Use specific repository path' },
              branch: { type: 'string', description: 'Use specific branch (with repo option)' },
            },
            required: ['key', 'content'],
          },
        },
        {
          name: 'vault_get',
          description: 'Retrieve content from the vault by key',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'The key for the vault entry' },
              version: { type: 'number', description: 'Specific version to retrieve (latest if not specified)' },
              global: { type: 'boolean', description: 'Use global scope instead of current repository' },
              repo: { type: 'string', description: 'Use specific repository path' },
              branch: { type: 'string', description: 'Use specific branch (with repo option)' },
            },
            required: ['key'],
          },
        },
        {
          name: 'vault_list',
          description: 'List all entries in the vault',
          inputSchema: {
            type: 'object',
            properties: {
              allVersions: { type: 'boolean', description: 'Include all versions, not just latest' },
              global: { type: 'boolean', description: 'Use global scope instead of current repository' },
              repo: { type: 'string', description: 'Use specific repository path' },
              branch: { type: 'string', description: 'Use specific branch (with repo option)' },
            },
          },
        },
        {
          name: 'vault_delete',
          description: 'Delete an entry from the vault',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'The key for the vault entry to delete' },
              version: { type: 'number', description: 'Specific version to delete (all versions if not specified)' },
              global: { type: 'boolean', description: 'Use global scope instead of current repository' },
              repo: { type: 'string', description: 'Use specific repository path' },
              branch: { type: 'string', description: 'Use specific branch (with repo option)' },
            },
            required: ['key'],
          },
        },
        {
          name: 'vault_info',
          description: 'Get metadata about a vault entry',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'The key for the vault entry' },
              version: { type: 'number', description: 'Specific version (latest if not specified)' },
              global: { type: 'boolean', description: 'Use global scope instead of current repository' },
              repo: { type: 'string', description: 'Use specific repository path' },
              branch: { type: 'string', description: 'Use specific branch (with repo option)' },
            },
            required: ['key'],
          },
        },
      ],
    }))

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        switch (name) {
          case 'vault_set': {
            const params = SetEntrySchema.parse(args)
            // Create a temporary file to store the content
            const tmpFile = `/tmp/vault-mcp-${Date.now()}.txt`
            const { writeFileSync, unlinkSync } = await import('node:fs')

            try {
              writeFileSync(tmpFile, params.content)
              const path = vault.setEntry(this.vaultContext, params.key, tmpFile, {
                description: params.description,
                global: params.global,
                repo: params.repo,
                branch: params.branch,
              })
              unlinkSync(tmpFile)

              return {
                content: [
                  {
                    type: 'text',
                    text: `Stored content at: ${path}`,
                  },
                ],
              }
            } catch (error) {
              // Clean up temp file on error
              try {
                unlinkSync(tmpFile)
              } catch {}
              throw error
            }
          }

          case 'vault_get': {
            const params = GetEntrySchema.parse(args)
            const content = vault.catEntry(this.vaultContext, params.key, {
              version: params.version,
              global: params.global,
              repo: params.repo,
              branch: params.branch,
            })

            if (!content) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Entry not found: ${params.key}`,
                  },
                ],
              }
            }

            return {
              content: [
                {
                  type: 'text',
                  text: content,
                },
              ],
            }
          }

          case 'vault_list': {
            const params = ListEntriesSchema.parse(args)
            const entries = vault.listEntries(this.vaultContext, {
              allVersions: params.allVersions,
              global: params.global,
              repo: params.repo,
              branch: params.branch,
            })

            if (entries.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: 'No entries found in vault',
                  },
                ],
              }
            }

            const formatted = entries
              .map((e) => `${e.key} (v${e.version})${e.description ? `: ${e.description}` : ''}`)
              .join('\n')

            return {
              content: [
                {
                  type: 'text',
                  text: formatted,
                },
              ],
            }
          }

          case 'vault_delete': {
            const params = DeleteEntrySchema.parse(args)
            const success = vault.deleteEntry(this.vaultContext, params.key, {
              version: params.version,
              global: params.global,
              repo: params.repo,
              branch: params.branch,
            })

            return {
              content: [
                {
                  type: 'text',
                  text: success
                    ? `Deleted: ${params.key}${params.version ? ` v${params.version}` : ' (all versions)'}`
                    : `Entry not found: ${params.key}`,
                },
              ],
            }
          }

          case 'vault_info': {
            const params = InfoEntrySchema.parse(args)
            const info = vault.getInfo(this.vaultContext, params.key, {
              version: params.version,
              global: params.global,
              repo: params.repo,
              branch: params.branch,
            })

            if (!info) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Entry not found: ${params.key}`,
                  },
                ],
              }
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(info, null, 2),
                },
              ],
            }
          }

          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        }
      }
    })
  }

  async run() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
  }

  async connect(transport: StdioServerTransport) {
    await this.server.connect(transport)
    return async () => {
      await this.server.close()
      vault.closeVault(this.vaultContext)
    }
  }
}
