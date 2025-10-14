import { getScopeStorageKey, type Scope, type ScopeType } from '../../scope.js'
import type { DatabaseContext } from '../connection.js'
import type { DbScopeRow } from '../types.js'

type ScopePersistence = {
  type: ScopeType
  primary_path: string | null
  worktree_id: string | null
  worktree_path: string | null
  branch_name: string | null
}

function toPersistence(scope: Scope): ScopePersistence {
  switch (scope.type) {
    case 'global':
      return {
        type: 'global',
        primary_path: null,
        worktree_id: null,
        worktree_path: null,
        branch_name: null,
      }
    case 'repository':
      return {
        type: 'repository',
        primary_path: scope.primaryPath,
        worktree_id: null,
        worktree_path: null,
        branch_name: null,
      }
    case 'branch':
      return {
        type: 'branch',
        primary_path: scope.primaryPath,
        worktree_id: null,
        worktree_path: null,
        branch_name: scope.branchName,
      }
  }
}

function toDomain(row: DbScopeRow): Scope {
  if (row.type === 'global') {
    return { type: 'global' }
  }

  if (row.type === 'repository') {
    return {
      type: 'repository',
      primaryPath: row.primary_path || '',
    }
  }

  return {
    type: 'branch',
    primaryPath: row.primary_path || '',
    branchName: row.branch_name || '',
  }
}

export class ScopeRepository {
  constructor(private ctx: DatabaseContext) {}

  findById(id: number): Scope | undefined {
    const row = this.ctx.db.prepare('SELECT * FROM scopes WHERE id = ?').get(id) as DbScopeRow | undefined
    return row ? toDomain(row) : undefined
  }

  findByScope(scope: Scope): DbScopeRow | undefined {
    const scopePath = getScopeStorageKey(scope)
    return this.findByScopePath(scopePath)
  }

  private findByScopePath(scopePath: string): DbScopeRow | undefined {
    return this.ctx.db.prepare('SELECT * FROM scopes WHERE scope_path = ?').get(scopePath) as DbScopeRow | undefined
  }

  create(scope: Scope): number {
    const dbScope = toPersistence(scope)
    const scopePath = getScopeStorageKey(scope)

    const result = this.ctx.db
      .prepare(
        `
        INSERT INTO scopes (type, primary_path, worktree_id, worktree_path, branch_name, scope_path)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        dbScope.type,
        dbScope.primary_path,
        dbScope.worktree_id,
        dbScope.worktree_path,
        dbScope.branch_name,
        scopePath,
      )

    return result.lastInsertRowid as number
  }

  getOrCreate(scope: Scope): number {
    const scopePath = getScopeStorageKey(scope)

    const existing = this.findByScopePath(scopePath)
    if (existing) {
      this.updateScope(existing.id, scope)
      return existing.id
    }

    return this.create(scope)
  }

  private updateScope(id: number, scope: Scope): void {
    const dbScope = toPersistence(scope)
    const scopePath = getScopeStorageKey(scope)
    this.ctx.db
      .prepare(
        `
        UPDATE scopes
        SET type = ?,
            primary_path = ?,
            worktree_id = ?,
            worktree_path = ?,
            branch_name = ?,
            scope_path = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      )
      .run(
        dbScope.type,
        dbScope.primary_path,
        dbScope.worktree_id,
        dbScope.worktree_path,
        dbScope.branch_name,
        scopePath,
        id,
      )
  }

  findAll(): Scope[] {
    const rows = this.ctx.db
      .prepare('SELECT * FROM scopes ORDER BY type, primary_path, branch_name')
      .all() as DbScopeRow[]
    return rows.map(toDomain)
  }

  delete(id: number): boolean {
    const result = this.ctx.db.prepare('DELETE FROM scopes WHERE id = ?').run(id)
    return result.changes > 0
  }

  deleteByPrimaryPath(primaryPath: string): number {
    const result = this.ctx.db
      .prepare("DELETE FROM scopes WHERE primary_path = ? AND type IN ('repository', 'branch', 'worktree')")
      .run(primaryPath)
    return result.changes
  }

  deleteBranch(primaryPath: string, branchName: string): boolean {
    const result = this.ctx.db
      .prepare("DELETE FROM scopes WHERE type = 'branch' AND primary_path = ? AND branch_name = ?")
      .run(primaryPath, branchName)
    return result.changes > 0
  }
}
