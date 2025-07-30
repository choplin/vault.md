import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import * as vault from '../core/vault.js'
import { resolveVaultContext } from '../core/vault.js'

// Zod schemas for tool parameters
const SetEntrySchema = z.object({
  key: z.string().describe('The key for the vault entry'),
  content: z.string().describe('The content to store'),
  description: z.string().optional().describe('Optional description for the entry'),
  scope: z.enum(['global', 'repository', 'branch']).optional().describe('Scope type'),
  repo: z.string().optional().describe('Repository path'),
  branch: z.string().optional().describe('Branch name (for branch scope)'),
})

const GetEntrySchema = z.object({
  key: z.string().describe('The key for the vault entry'),
  version: z.number().optional().describe('Specific version to retrieve (latest if not specified)'),
  scope: z.enum(['global', 'repository', 'branch']).optional().describe('Scope type'),
  repo: z.string().optional().describe('Repository path'),
  branch: z.string().optional().describe('Branch name (for branch scope)'),
  allScopes: z.boolean().optional().describe('Search all scopes in order'),
})

const ListEntriesSchema = z.object({
  allVersions: z.boolean().optional().describe('Include all versions, not just latest'),
  scope: z.enum(['global', 'repository', 'branch']).optional().describe('Scope type'),
  repo: z.string().optional().describe('Repository path'),
  branch: z.string().optional().describe('Branch name (for branch scope)'),
})

const DeleteEntrySchema = z.object({
  key: z.string().describe('The key for the vault entry to delete'),
  version: z.number().optional().describe('Specific version to delete (all versions if not specified)'),
  scope: z.enum(['global', 'repository', 'branch']).optional().describe('Scope type'),
  repo: z.string().optional().describe('Repository path'),
  branch: z.string().optional().describe('Branch name (for branch scope)'),
})

const DeleteVersionSchema = z.object({
  key: z.string().describe('The key for the vault entry'),
  version: z.number().describe('Specific version to delete'),
  force: z.boolean().optional().describe('Skip confirmation (always true for MCP)'),
})

const DeleteKeySchema = z.object({
  key: z.string().describe('The key to delete completely'),
  force: z.boolean().optional().describe('Skip confirmation (always true for MCP)'),
})

const DeleteBranchSchema = z.object({
  branch: z.string().optional().describe('Branch to delete (current branch if not specified)'),
  scope: z.string().optional().describe('Scope identifier (current scope if not specified)'),
  force: z.boolean().optional().describe('Skip confirmation (always true for MCP)'),
})

const DeleteScopeSchema = z.object({
  scope: z.string().optional().describe('Scope identifier (current scope if not specified)'),
  force: z.boolean().optional().describe('Skip confirmation (always true for MCP)'),
})

const InfoEntrySchema = z.object({
  key: z.string().describe('The key for the vault entry'),
  version: z.number().optional().describe('Specific version (latest if not specified)'),
  scope: z.enum(['global', 'repository', 'branch']).optional().describe('Scope type'),
  repo: z.string().optional().describe('Repository path'),
  branch: z.string().optional().describe('Branch name (for branch scope)'),
})

// Server implementation
export class VaultMCPServer {
  private server: Server

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
              scope: { type: 'string', enum: ['global', 'repository', 'branch'], description: 'Scope type' },
              repo: { type: 'string', description: 'Repository path' },
              branch: { type: 'string', description: 'Branch name (for branch scope)' },
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
              scope: { type: 'string', enum: ['global', 'repository', 'branch'], description: 'Scope type' },
              repo: { type: 'string', description: 'Repository path' },
              branch: { type: 'string', description: 'Branch name (for branch scope)' },
              allScopes: { type: 'boolean', description: 'Search all scopes in order' },
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
              scope: { type: 'string', enum: ['global', 'repository', 'branch'], description: 'Scope type' },
              repo: { type: 'string', description: 'Repository path' },
              branch: { type: 'string', description: 'Branch name (for branch scope)' },
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
              scope: { type: 'string', enum: ['global', 'repository', 'branch'], description: 'Scope type' },
              repo: { type: 'string', description: 'Repository path' },
              branch: { type: 'string', description: 'Branch name (for branch scope)' },
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
              scope: { type: 'string', enum: ['global', 'repository', 'branch'], description: 'Scope type' },
              repo: { type: 'string', description: 'Repository path' },
              branch: { type: 'string', description: 'Branch name (for branch scope)' },
            },
            required: ['key'],
          },
        },
        {
          name: 'vault_delete_version',
          description: 'Delete a specific version of an entry',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'The key for the vault entry' },
              version: { type: 'number', description: 'Specific version to delete' },
              force: { type: 'boolean', description: 'Skip confirmation (always true for MCP)' },
            },
            required: ['key', 'version'],
          },
        },
        {
          name: 'vault_delete_key',
          description: 'Delete all versions of a key',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'The key to delete completely' },
              force: { type: 'boolean', description: 'Skip confirmation (always true for MCP)' },
            },
            required: ['key'],
          },
        },
        {
          name: 'vault_delete_branch',
          description: 'Delete vault for a specific branch and all its entries',
          inputSchema: {
            type: 'object',
            properties: {
              branch: { type: 'string', description: 'Branch to delete (current branch if not specified)' },
              scope: { type: 'string', description: 'Scope identifier (current scope if not specified)' },
              force: { type: 'boolean', description: 'Skip confirmation (always true for MCP)' },
            },
          },
        },
        {
          name: 'vault_delete_scope',
          description: 'Delete current scope (identifier + branch)',
          inputSchema: {
            type: 'object',
            properties: {
              scope: { type: 'string', description: 'Scope identifier (current scope if not specified)' },
              force: { type: 'boolean', description: 'Skip confirmation (always true for MCP)' },
            },
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
            // Create vault context for this request
            const vaultContext = resolveVaultContext({
              scope: params.scope as 'global' | 'repository' | 'branch' | undefined,
              repo: params.repo,
              branch: params.branch,
            })

            // Create a temporary file to store the content
            const tmpFile = `/tmp/vault-mcp-${Date.now()}.txt`
            const { writeFileSync, unlinkSync } = await import('node:fs')

            try {
              writeFileSync(tmpFile, params.content)
              const path = await vault.setEntry(vaultContext, params.key, tmpFile, {
                description: params.description,
              })
              unlinkSync(tmpFile)
              vault.closeVault(vaultContext)

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
              vault.closeVault(vaultContext)
              throw error
            }
          }

          case 'vault_get': {
            const params = GetEntrySchema.parse(args)
            // Create vault context for this request
            const vaultContext = resolveVaultContext({
              scope: params.scope as 'global' | 'repository' | 'branch' | undefined,
              repo: params.repo,
              branch: params.branch,
            })

            const content = await vault.catEntry(vaultContext, params.key, {
              version: params.version,
              allScopes: params.allScopes,
            })
            vault.closeVault(vaultContext)

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
            // Create vault context for this request
            const vaultContext = resolveVaultContext({
              scope: params.scope as 'global' | 'repository' | 'branch' | undefined,
              repo: params.repo,
              branch: params.branch,
            })

            const entries = await vault.listEntries(vaultContext, {
              allVersions: params.allVersions,
            })
            vault.closeVault(vaultContext)

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
            // Create vault context for this request
            const vaultContext = resolveVaultContext({
              scope: params.scope as 'global' | 'repository' | 'branch' | undefined,
              repo: params.repo,
              branch: params.branch,
            })

            const success = await vault.deleteEntry(vaultContext, params.key, {
              version: params.version,
            })
            vault.closeVault(vaultContext)

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

          case 'vault_delete_version': {
            const params = DeleteVersionSchema.parse(args)
            // Use default vault context for this operation
            const vaultContext = resolveVaultContext({})
            const success = await vault.deleteVersion(vaultContext, params.key, params.version)
            vault.closeVault(vaultContext)

            return {
              content: [
                {
                  type: 'text',
                  text: success
                    ? `Deleted version ${params.version} of key '${params.key}'`
                    : `Version ${params.version} of key '${params.key}' not found`,
                },
              ],
            }
          }

          case 'vault_delete_key': {
            const params = DeleteKeySchema.parse(args)
            // Use default vault context for this operation
            const vaultContext = resolveVaultContext({})
            const deletedCount = await vault.deleteKey(vaultContext, params.key)
            vault.closeVault(vaultContext)

            return {
              content: [
                {
                  type: 'text',
                  text:
                    deletedCount > 0
                      ? `Deleted ${deletedCount} versions of key '${params.key}'`
                      : `Key '${params.key}' not found`,
                },
              ],
            }
          }

          case 'vault_delete_branch': {
            const params = DeleteBranchSchema.parse(args)
            // Use default vault context for this operation
            const vaultContext = resolveVaultContext({})
            try {
              const deletedCount = params.branch
                ? await vault.deleteBranch(vaultContext, params.branch)
                : await vault.deleteCurrentScope(vaultContext)
              vault.closeVault(vaultContext)

              return {
                content: [
                  {
                    type: 'text',
                    text: `Deleted ${params.branch ? `branch '${params.branch}'` : 'current scope'} with ${deletedCount} entries`,
                  },
                ],
              }
            } catch (error) {
              vault.closeVault(vaultContext)
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error: ${error instanceof Error ? error.message : 'Failed to delete branch'}`,
                  },
                ],
              }
            }
          }

          case 'vault_delete_scope': {
            DeleteScopeSchema.parse(args) // Validate args but we don't need params
            // Use default vault context for this operation
            const vaultContext = resolveVaultContext({})
            try {
              const deletedCount = await vault.deleteCurrentScope(vaultContext)
              vault.closeVault(vaultContext)

              return {
                content: [
                  {
                    type: 'text',
                    text: `Deleted current scope with ${deletedCount} entries`,
                  },
                ],
              }
            } catch (error) {
              vault.closeVault(vaultContext)
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error: ${error instanceof Error ? error.message : 'Failed to delete scope'}`,
                  },
                ],
              }
            }
          }

          case 'vault_info': {
            const params = InfoEntrySchema.parse(args)
            // Create vault context for this request
            const vaultContext = resolveVaultContext({
              scope: params.scope as 'global' | 'repository' | 'branch' | undefined,
              repo: params.repo,
              branch: params.branch,
            })

            const info = await vault.getInfo(vaultContext, params.key, {
              version: params.version,
            })
            vault.closeVault(vaultContext)

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
    }
  }
}
