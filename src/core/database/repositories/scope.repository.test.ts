import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BranchScope, RepositoryScope, Scope, WorktreeScope } from '../../scope.js'
import { getScopeStorageKey } from '../../scope.js'
import { closeDatabase, createDatabase, type DatabaseContext } from '../connection.js'
import { ScopeRepository } from './scope.repository.js'

describe('ScopeRepository', () => {
  let ctx: DatabaseContext
  let repo: ScopeRepository

  beforeEach(() => {
    ctx = createDatabase(':memory:')
    repo = new ScopeRepository(ctx)
  })

  afterEach(() => {
    closeDatabase(ctx)
  })

  describe('getScopeStorageKey integration', () => {
    it('returns global string for global scope', () => {
      expect(getScopeStorageKey({ type: 'global' })).toBe('global')
    })

    it('sanitizes repository paths', () => {
      expect(getScopeStorageKey({ type: 'repository', primaryPath: '/a/b' })).toBe('-a-b')
    })

    it('includes branch name for branch scopes', () => {
      const scope: BranchScope = { type: 'branch', primaryPath: '/repo', branchName: 'feature/x' }
      expect(getScopeStorageKey(scope)).toBe('-repo-feature-x')
    })

    it('includes worktree id for worktree scopes', () => {
      const scope: WorktreeScope = { type: 'worktree', primaryPath: '/repo', worktreeId: 'feature-x' }
      expect(getScopeStorageKey(scope)).toBe('-repo-feature-x')
    })
  })

  describe('create', () => {
    it('persists repository scope', () => {
      const scope: RepositoryScope = {
        type: 'repository',
        primaryPath: '/test/repo',
      }

      const id = repo.create(scope)
      expect(id).toBeGreaterThan(0)

      const found = repo.findById(id)
      expect(found).toMatchObject(scope)
    })

    it('persists branch scope', () => {
      const scope: BranchScope = {
        type: 'branch',
        primaryPath: '/test/repo',
        branchName: 'feature-x',
      }

      const id = repo.create(scope)
      expect(repo.findById(id)).toMatchObject(scope)
    })

    it('persists worktree scope', () => {
      const scope: WorktreeScope = {
        type: 'worktree',
        primaryPath: '/test/repo',
        worktreeId: 'feature-x',
        worktreePath: '/worktrees/feature-x',
      }

      const id = repo.create(scope)
      expect(repo.findById(id)).toMatchObject(scope)
    })
  })

  describe('getOrCreate', () => {
    it('creates scope when missing', () => {
      const scope: RepositoryScope = { type: 'repository', primaryPath: '/test/repo' }
      const id1 = repo.getOrCreate(scope)
      const id2 = repo.getOrCreate(scope)
      expect(id1).toBeGreaterThan(0)
      expect(id2).toBe(id1)
    })
  })

  describe('findAll', () => {
    it('returns scopes ordered by primary path and branch', () => {
      const scopes: Scope[] = [
        { type: 'global' },
        { type: 'repository', primaryPath: '/b/repo' },
        { type: 'repository', primaryPath: '/a/repo' },
        { type: 'branch', primaryPath: '/a/repo', branchName: 'main' },
        { type: 'branch', primaryPath: '/a/repo', branchName: 'dev' },
        { type: 'worktree', primaryPath: '/a/repo', worktreeId: 'feature-x', worktreePath: '/worktrees/feature-x' },
      ]
      scopes.forEach((s) => repo.create(s))

      const all = repo.findAll()
      expect(all.map((s) => s.type)).toEqual(['branch', 'branch', 'global', 'repository', 'repository', 'worktree'])
      expect(all[0]).toMatchObject({ type: 'branch', primaryPath: '/a/repo', branchName: 'dev' })
      expect(all[1]).toMatchObject({ type: 'branch', primaryPath: '/a/repo', branchName: 'main' })
      expect(all[2]).toMatchObject({ type: 'global' })
      expect(all[3]).toMatchObject({ type: 'repository', primaryPath: '/a/repo' })
      expect(all[4]).toMatchObject({ type: 'repository', primaryPath: '/b/repo' })
      expect(all[5]).toMatchObject({ type: 'worktree', worktreeId: 'feature-x' })
    })
  })

  describe('delete operations', () => {
    it('deletes by id', () => {
      const scope: RepositoryScope = { type: 'repository', primaryPath: '/test/repo' }
      const id = repo.create(scope)
      expect(repo.delete(id)).toBe(true)
      expect(repo.findById(id)).toBeUndefined()
    })

    it('deletes all scopes for primary path', () => {
      const scopes: Scope[] = [
        { type: 'repository', primaryPath: '/test/repo' },
        { type: 'branch', primaryPath: '/test/repo', branchName: 'main' },
        { type: 'branch', primaryPath: '/test/repo', branchName: 'dev' },
        { type: 'worktree', primaryPath: '/test/repo', worktreeId: 'tree-a' },
      ]
      scopes.forEach((s) => repo.create(s))

      const removed = repo.deleteByPrimaryPath('/test/repo')
      expect(removed).toBe(4)
      expect(repo.findAll()).toHaveLength(0)
    })

    it('deletes specific branch', () => {
      const scope: BranchScope = { type: 'branch', primaryPath: '/test/repo', branchName: 'main' }
      repo.create(scope)

      expect(repo.deleteBranch('/test/repo', 'main')).toBe(true)
      expect(repo.findAll()).toHaveLength(0)
    })
  })
})
