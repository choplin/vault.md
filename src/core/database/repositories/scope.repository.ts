import { getScopeStorageKey, type Scope } from '../../scope.js'
import type { DatabaseContext } from '../connection.js'
import type { DbScopeRow } from '../types.js'

type ScopePersistence = {
  identifier: string
  branch: string
  work_path: string | null
}

function toPersistence(scope: Scope): ScopePersistence {
  switch (scope.type) {
    case 'global':
      return { identifier: 'global', branch: 'global', work_path: null }
    case 'repository':
      return { identifier: scope.primaryPath, branch: 'repository', work_path: null }
    case 'branch':
      return { identifier: scope.primaryPath, branch: scope.branchName, work_path: null }
  }
}

function toDomain(row: DbScopeRow): Scope {
  if (row.identifier === 'global' && row.branch === 'global') {
    return { type: 'global' }
  }

  if (row.branch === 'repository') {
    return {
      type: 'repository',
      primaryPath: row.identifier,
    }
  }

  return {
    type: 'branch',
    primaryPath: row.identifier,
    branchName: row.branch,
  }
}

export class ScopeRepository {
  constructor(private ctx: DatabaseContext) {}

  findById(id: number): Scope | undefined {
    const row = this.ctx.db.prepare('SELECT * FROM scopes WHERE id = ?').get(id) as DbScopeRow | undefined
    return row ? toDomain(row) : undefined
  }

  findByPrimaryPathAndBranch(primaryPath: string, branchName: string): DbScopeRow | undefined {
    return this.ctx.db
      .prepare('SELECT * FROM scopes WHERE identifier = ? AND branch = ?')
      .get(primaryPath, branchName) as DbScopeRow | undefined
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
        INSERT INTO scopes (identifier, branch, scope_path, work_path, remote_url)
        VALUES (?, ?, ?, ?, NULL)
      `,
      )
      .run(dbScope.identifier, dbScope.branch, scopePath, dbScope.work_path)

    return result.lastInsertRowid as number
  }

  getOrCreate(scope: Scope): number {
    const dbScope = toPersistence(scope)
    const scopePath = getScopeStorageKey(scope)

    const existing = this.findByPrimaryPathAndBranch(dbScope.identifier, dbScope.branch)
    if (existing) {
      this.updateScope(existing.id, dbScope)
      return existing.id
    }

    const byPath = this.findByScopePath(scopePath)
    if (byPath) {
      this.updateScope(byPath.id, dbScope)
      return byPath.id
    }

    return this.create(scope)
  }

  private updateScope(id: number, dbScope: ScopePersistence): void {
    this.ctx.db
      .prepare(
        `
        UPDATE scopes
        SET identifier = ?,
            branch = ?,
            work_path = ?,
            remote_url = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      )
      .run(dbScope.identifier, dbScope.branch, dbScope.work_path, id)
  }

  findAll(): Scope[] {
    const rows = this.ctx.db.prepare('SELECT * FROM scopes ORDER BY identifier, branch').all() as DbScopeRow[]
    return rows.map(toDomain)
  }

  delete(id: number): boolean {
    const result = this.ctx.db.prepare('DELETE FROM scopes WHERE id = ?').run(id)
    return result.changes > 0
  }

  deleteByPrimaryPath(primaryPath: string): number {
    const result = this.ctx.db.prepare('DELETE FROM scopes WHERE identifier = ?').run(primaryPath)
    return result.changes
  }

  deleteBranch(primaryPath: string, branchName: string): boolean {
    const result = this.ctx.db
      .prepare('DELETE FROM scopes WHERE identifier = ? AND branch = ?')
      .run(primaryPath, branchName)
    return result.changes > 0
  }
}
