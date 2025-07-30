import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Scope } from '../../scope.js'
import { closeDatabase, createDatabase, type DatabaseContext } from '../connection.js'
import { ScopeRepository } from './scope.repository.js'

describe('ScopeRepository', () => {
  let ctx: DatabaseContext
  let repo: ScopeRepository

  beforeEach(() => {
    // Use in-memory database for tests
    ctx = createDatabase(':memory:')
    repo = new ScopeRepository(ctx)
  })

  afterEach(() => {
    closeDatabase(ctx)
  })

  describe('create', () => {
    it('should create a new scope', () => {
      const scope: Scope = {
        type: 'repository',
        identifier: '/test/repo',
        workPath: '/test/repo',
        remoteUrl: 'https://github.com/test/repo.git',
      }

      const id = repo.create(scope)
      expect(id).toBeGreaterThan(0)

      const found = repo.findById(id)
      expect(found).toBeDefined()
      if (found?.type === 'repository') {
        expect(found.identifier).toBe('/test/repo')
      }
    })

    it('should create global scope', () => {
      const scope: Scope = { type: 'global' }

      const id = repo.create(scope)
      expect(id).toBeGreaterThan(0)

      const found = repo.findById(id)
      expect(found).toBeDefined()
      expect(found?.type).toBe('global')
    })

    it('should create branch scope', () => {
      const scope: Scope = {
        type: 'branch',
        identifier: '/test/repo',
        branch: 'feature-x',
        workPath: '/test/repo',
      }

      const id = repo.create(scope)
      expect(id).toBeGreaterThan(0)

      const found = repo.findById(id)
      expect(found).toBeDefined()
      expect(found?.type).toBe('branch')
      if (found?.type === 'branch') {
        expect(found.branch).toBe('feature-x')
      }
    })
  })

  describe('findByIdentifierAndBranch', () => {
    it('should find existing scope', () => {
      const scope: Scope = {
        type: 'repository',
        identifier: '/test/repo',
      }
      repo.create(scope)

      const found = repo.findByIdentifierAndBranch('/test/repo', 'repository')
      expect(found).toBeDefined()
      expect(found?.identifier).toBe('/test/repo')
      expect(found?.branch).toBe('repository')
    })

    it('should return undefined for non-existent scope', () => {
      const found = repo.findByIdentifierAndBranch('/non/existent', 'repository')
      expect(found).toBeUndefined()
    })
  })

  describe('getOrCreate', () => {
    it('should create new scope if not exists', () => {
      const scope: Scope = {
        type: 'repository',
        identifier: '/test/repo',
      }

      const id1 = repo.getOrCreate(scope)
      expect(id1).toBeGreaterThan(0)

      // Should return same ID on second call
      const id2 = repo.getOrCreate(scope)
      expect(id2).toBe(id1)
    })

    it('should update work_path for existing scope', () => {
      const scope1: Scope = {
        type: 'repository',
        identifier: '/test/repo',
        workPath: '/old/path',
      }
      const id = repo.getOrCreate(scope1)

      const scope2: Scope = {
        type: 'repository',
        identifier: '/test/repo',
        workPath: '/new/path',
      }
      repo.getOrCreate(scope2)

      // Verify work_path was updated
      const row = ctx.db.prepare('SELECT work_path FROM scopes WHERE id = ?').get(id) as { work_path: string }
      expect(row.work_path).toBe('/new/path')
    })
  })

  describe('findAll', () => {
    it('should return all scopes ordered by identifier and branch', () => {
      const scopes: Scope[] = [
        { type: 'global' },
        { type: 'repository', identifier: '/b/repo' },
        { type: 'repository', identifier: '/a/repo' },
        { type: 'branch', identifier: '/a/repo', branch: 'main' },
        { type: 'branch', identifier: '/a/repo', branch: 'dev' },
      ]

      scopes.forEach((s) => repo.create(s))

      const all = repo.findAll()
      expect(all).toHaveLength(5)

      // Check ordering - sorted by identifier then branch
      // /a/repo branches come first (dev, then main)
      expect(all[0].type).toBe('branch')
      if (all[0].type === 'branch') {
        expect(all[0].identifier).toBe('/a/repo')
        expect(all[0].branch).toBe('dev') // 'dev' comes before 'main' alphabetically
      }

      expect(all[1].type).toBe('branch')
      if (all[1].type === 'branch') {
        expect(all[1].identifier).toBe('/a/repo')
        expect(all[1].branch).toBe('main')
      }

      // Then /a/repo repository scope (empty branch)
      expect(all[2].type).toBe('repository')
      if (all[2].type === 'repository') {
        expect(all[2].identifier).toBe('/a/repo')
      }

      // Then /b/repo repository
      expect(all[3].type).toBe('repository')
      if (all[3].type === 'repository') {
        expect(all[3].identifier).toBe('/b/repo')
      }

      // Finally global (empty identifier)
      expect(all[4].type).toBe('global')
    })
  })

  describe('delete operations', () => {
    it('should delete by id', () => {
      const scope: Scope = { type: 'repository', identifier: '/test/repo' }
      const id = repo.create(scope)

      const deleted = repo.delete(id)
      expect(deleted).toBe(true)

      const found = repo.findById(id)
      expect(found).toBeUndefined()
    })

    it('should delete by identifier', () => {
      const scopes: Scope[] = [
        { type: 'repository', identifier: '/test/repo' },
        { type: 'branch', identifier: '/test/repo', branch: 'main' },
        { type: 'branch', identifier: '/test/repo', branch: 'dev' },
      ]
      scopes.forEach((s) => repo.create(s))

      const deletedCount = repo.deleteByIdentifier('/test/repo')
      expect(deletedCount).toBe(3)

      const remaining = repo.findAll()
      expect(remaining).toHaveLength(0)
    })

    it('should delete by identifier and branch', () => {
      const scope: Scope = { type: 'branch', identifier: '/test/repo', branch: 'main' }
      repo.create(scope)

      const deleted = repo.deleteByIdentifierAndBranch('/test/repo', 'main')
      expect(deleted).toBe(true)

      const found = repo.findByIdentifierAndBranch('/test/repo', 'main')
      expect(found).toBeUndefined()
    })
  })
})
