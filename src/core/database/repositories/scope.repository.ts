import { type DbScope, dbToScope, isGlobalScope, type Scope, scopeToDb } from '../../scope.js'
import type { DatabaseContext } from '../connection.js'
import type { DbScopeRow } from '../types.js'

// Calculate scope path for file storage
export function calculateScopePath(scope: Scope): string {
  if (isGlobalScope(scope)) {
    return 'global'
  } else if (scope.type === 'repository') {
    return scope.identifier.replace(/[/\\:]/g, '_')
  } else {
    return `${scope.identifier}/${scope.branch}`.replace(/[/\\:]/g, '_')
  }
}

export class ScopeRepository {
  constructor(private ctx: DatabaseContext) {}

  findById(id: number): Scope | undefined {
    const row = this.ctx.db.prepare('SELECT * FROM scopes WHERE id = ?').get(id) as DbScope | undefined
    return row ? dbToScope(row) : undefined
  }

  findByIdentifierAndBranch(identifier: string, branch: string): DbScopeRow | undefined {
    return this.ctx.db.prepare('SELECT * FROM scopes WHERE identifier = ? AND branch = ?').get(identifier, branch) as
      | DbScopeRow
      | undefined
  }

  create(scope: Scope): number {
    const dbScope = scopeToDb(scope)
    const scopePath = calculateScopePath(scope)

    const result = this.ctx.db
      .prepare(`
        INSERT INTO scopes (identifier, branch, scope_path, work_path, remote_url)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(dbScope.identifier, dbScope.branch, scopePath, dbScope.work_path, dbScope.remote_url)

    return result.lastInsertRowid as number
  }

  updateWorkPath(id: number, workPath?: string): void {
    this.ctx.db
      .prepare(`
        UPDATE scopes
        SET work_path = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(workPath, id)
  }

  getOrCreate(scope: Scope): number {
    const dbScope = scopeToDb(scope)
    const existing = this.findByIdentifierAndBranch(dbScope.identifier, dbScope.branch)

    if (existing) {
      // Update work_path and updated_at
      this.updateWorkPath(existing.id, dbScope.work_path || undefined)
      return existing.id
    }

    return this.create(scope)
  }

  findAll(): Scope[] {
    const rows = this.ctx.db.prepare('SELECT * FROM scopes ORDER BY identifier, branch').all() as DbScope[]
    return rows.map(dbToScope)
  }

  delete(id: number): boolean {
    const result = this.ctx.db.prepare('DELETE FROM scopes WHERE id = ?').run(id)
    return result.changes > 0
  }

  deleteByIdentifier(identifier: string): number {
    const result = this.ctx.db.prepare('DELETE FROM scopes WHERE identifier = ?').run(identifier)
    return result.changes
  }

  deleteByIdentifierAndBranch(identifier: string, branch: string): boolean {
    const result = this.ctx.db.prepare('DELETE FROM scopes WHERE identifier = ? AND branch = ?').run(identifier, branch)
    return result.changes > 0
  }
}
