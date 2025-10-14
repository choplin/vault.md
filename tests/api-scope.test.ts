import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from 'better-sqlite3'
import { Hono } from 'hono'
import { createWebServer } from '../src/web/server.js'
import type { VaultContext } from '../src/core/vault.js'
import type { Scope } from '../src/core/scope.js'
import { EntryService } from '../src/core/services/entry.service.js'
import { ScopeService } from '../src/core/services/scope.service.js'
import * as vaultCore from '../src/core/index.js'
import * as scopeModule from '../src/core/scope.js'
import * as filesystem from '../src/core/filesystem.js'

vi.mock('../src/core/index.js')
vi.mock('../src/core/scope.js')
vi.mock('../src/core/filesystem.js')

describe('Web API – Scope JSON contract', () => {
  let app: Hono
  let mockVaultContext: VaultContext
  let mockDb: Partial<Database>
  let mockScopeService: Partial<ScopeService>
  let mockEntryService: Partial<EntryService>

  beforeEach(() => {
    const prepareMock = vi.fn()
    mockDb = {
      prepare: prepareMock,
    }

    mockScopeService = {
      getAllEntriesGrouped: vi.fn(),
      deleteScope: vi.fn(),
      deleteAllBranches: vi.fn(),
    }

    mockEntryService = {
      list: vi.fn(),
      deleteAll: vi.fn(),
      deleteVersion: vi.fn(),
    }

    mockVaultContext = {
      database: {
        db: mockDb as Database,
        path: ':memory:',
      },
      scope: {
        type: 'repository',
        primaryPath: '/test/repo',
      } as Scope,
      scopeId: 1,
      scopeService: mockScopeService as ScopeService,
      entryService: mockEntryService as EntryService,
    }

    vi.mocked(scopeModule.getScopeStorageKey).mockImplementation((scope) => `storage-${scope.type}`)
    vi.mocked(filesystem.deleteFile).mockImplementation(() => undefined)
    vi.mocked(filesystem.deleteProjectFiles).mockImplementation(() => undefined)
    vi.mocked(vaultCore.listEntries).mockReturnValue([])
    vi.mocked(vaultCore.catEntry).mockResolvedValue('')
    vi.mocked(vaultCore.getEntry).mockResolvedValue(undefined)

    app = createWebServer(mockVaultContext)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/current-scope', () => {
    it('returns the current scope payload', async () => {
      mockVaultContext.scope = {
        type: 'branch',
        primaryPath: '/test/repo',
        branchName: 'main',
      }

      const res = await app.request('/api/current-scope')
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data).toEqual({
        scope: { type: 'branch', primaryPath: '/test/repo', branchName: 'main' },
      })
    })
  })

  describe('GET /api/entries/all', () => {
    it('returns grouped entries with Scope payloads', async () => {
      const scopedEntries = new Map<Scope, any[]>([
        [
          { type: 'global' },
          [
            {
              id: 1,
              scopeId: 10,
              key: 'global-key',
              version: 1,
              filePath: '/path/1',
              hash: 'hash1',
              description: 'Global entry',
              createdAt: new Date('2025-01-01T00:00:00Z'),
              isArchived: false,
            },
          ],
        ],
        [
          { type: 'repository', primaryPath: '/test/repo' },
          [
            {
              id: 2,
              scopeId: 20,
              key: 'repo-key',
              version: 1,
              filePath: '/path/2',
              hash: 'hash2',
              description: 'Repo entry',
              createdAt: new Date('2025-01-02T00:00:00Z'),
              isArchived: false,
            },
          ],
        ],
        [
          { type: 'branch', primaryPath: '/test/repo', branchName: 'main' },
          [
            {
              id: 3,
              scopeId: 30,
              key: 'branch-key',
              version: 1,
              filePath: '/path/3',
              hash: 'hash3',
              description: 'Branch entry',
              createdAt: new Date('2025-01-03T00:00:00Z'),
              isArchived: false,
            },
          ],
        ],
      ])

      vi.mocked(mockScopeService.getAllEntriesGrouped!).mockResolvedValue(scopedEntries)

      const res = await app.request('/api/entries/all')
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.currentScope).toEqual({
        type: 'repository',
        primaryPath: '/test/repo',
      })
      expect(data.scopes).toHaveLength(3)
      expect(data.scopes[0]).toMatchObject({
        scope: { type: 'global' },
        entries: [
          {
            id: 1,
            scopeId: 10,
            scope: { type: 'global' },
            key: 'global-key',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      })
    })

    it('handles empty scope sets', async () => {
      vi.mocked(mockScopeService.getAllEntriesGrouped!).mockResolvedValue(new Map())

      const res = await app.request('/api/entries/all')
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.scopes).toEqual([])
    })
  })

  describe('POST /api/scope/entries', () => {
    it('returns entries for a known scope', async () => {
      const getMock = vi.fn().mockReturnValue({ id: 42 })
      vi.mocked(mockDb.prepare as any).mockReturnValue({
        get: getMock,
      })

      vi.mocked(mockEntryService.list!).mockResolvedValue([
        {
          id: 7,
          scopeId: 42,
          key: 'note',
          version: 1,
          filePath: '/file',
          hash: 'hash',
          description: 'desc',
          createdAt: new Date('2025-01-05T00:00:00Z'),
          isArchived: false,
        },
      ])

      const res = await app.request('/api/scope/entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: { type: 'branch', primaryPath: '/test/repo', branchName: 'main' },
          allVersions: true,
        }),
      })

      const data = await res.json()

      expect(res.status).toBe(200)
      expect(getMock).toHaveBeenCalledWith('/test/repo', 'main')
      expect(data.scope).toEqual({ type: 'branch', primaryPath: '/test/repo', branchName: 'main' })
      expect(data.entries[0]).toMatchObject({
        id: 7,
        key: 'note',
        scopeId: 42,
        scope: { type: 'branch', primaryPath: '/test/repo', branchName: 'main' },
      })
    })

    it('returns empty list when scope is missing', async () => {
      const getMock = vi.fn().mockReturnValue(undefined)
      vi.mocked(mockDb.prepare as any).mockReturnValue({
        get: getMock,
      })

      const res = await app.request('/api/scope/entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: { type: 'repository', primaryPath: '/missing/repo' },
        }),
      })

      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.entries).toEqual([])
    })
  })

  describe('POST /api/entry/content', () => {
    it('returns entry content for repository scope', async () => {
      vi.mocked(vaultCore.getEntry).mockResolvedValue('/path/to/file')
      vi.mocked(vaultCore.catEntry).mockResolvedValue('file content')

      const res = await app.request('/api/entry/content', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: { type: 'repository', primaryPath: '/test/repo' },
          key: 'note',
        }),
      })

      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data).toEqual({ content: 'file content', filePath: '/path/to/file' })
      expect(vaultCore.getEntry).toHaveBeenCalledWith(
        mockVaultContext,
        'note',
        expect.objectContaining({ scope: 'repository', repo: '/test/repo' }),
      )
    })

    it('returns 404 when entry is missing', async () => {
      vi.mocked(vaultCore.getEntry).mockResolvedValue(undefined)

      const res = await app.request('/api/entry/content', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: { type: 'global' },
          key: 'missing',
        }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/entry', () => {
    it('deletes a specific version', async () => {
      const getMock = vi.fn().mockReturnValue({ id: 5 })
      vi.mocked(mockDb.prepare as any).mockReturnValue({ get: getMock })
      vi.mocked(mockEntryService.list!).mockResolvedValue([
        {
          id: 12,
          scopeId: 5,
          key: 'note',
          version: 2,
          filePath: '/file',
          hash: 'hash',
          description: 'desc',
          createdAt: new Date(),
          isArchived: false,
        },
      ])
      vi.mocked(mockEntryService.deleteVersion!).mockResolvedValue(true)

      const res = await app.request('/api/entry', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: { type: 'branch', primaryPath: '/test/repo', branchName: 'feature' },
          key: 'note',
          version: 2,
        }),
      })

      expect(res.status).toBe(200)
      expect(mockEntryService.deleteVersion).toHaveBeenCalledWith(5, 'note', 2)
    })

    it('deletes all versions when version is omitted', async () => {
      const getMock = vi.fn().mockReturnValue({ id: 9 })
      vi.mocked(mockDb.prepare as any).mockReturnValue({ get: getMock })
      vi.mocked(mockEntryService.list!).mockResolvedValue([
        {
          id: 1,
          scopeId: 9,
          key: 'note',
          version: 1,
          filePath: '/file1',
          hash: 'hash1',
          description: '',
          createdAt: new Date(),
          isArchived: false,
        },
      ])
      vi.mocked(mockEntryService.deleteAll!).mockResolvedValue(true)

      const res = await app.request('/api/entry', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: { type: 'repository', primaryPath: '/test/repo' },
          key: 'note',
        }),
      })

      expect(res.status).toBe(200)
      expect(mockEntryService.deleteAll).toHaveBeenCalledWith(9, 'note')
    })
  })

  describe('DELETE /api/scope', () => {
    it('removes a branch scope', async () => {
      vi.mocked(mockScopeService.deleteScope!).mockResolvedValue(3)

      const res = await app.request('/api/scope', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: { type: 'branch', primaryPath: '/test/repo', branchName: 'main' },
        }),
      })

      expect(res.status).toBe(200)
      expect(mockScopeService.deleteScope).toHaveBeenCalledWith('/test/repo', 'main')
    })

    it('removes an entire repository when cascade is true', async () => {
      const scopedEntries = new Map<Scope, any[]>([
        [{ type: 'repository', primaryPath: '/test/repo' }, []],
        [{ type: 'branch', primaryPath: '/test/repo', branchName: 'dev' }, []],
      ])
      vi.mocked(mockScopeService.getAllEntriesGrouped!).mockResolvedValue(scopedEntries)
      vi.mocked(mockScopeService.deleteAllBranches!).mockResolvedValue(5)

      const res = await app.request('/api/scope', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: { type: 'repository', primaryPath: '/test/repo' },
          cascade: true,
        }),
      })

      expect(res.status).toBe(200)
      expect(mockScopeService.deleteAllBranches).toHaveBeenCalledWith('/test/repo')
    })
  })
})
