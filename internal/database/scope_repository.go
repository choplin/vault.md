package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	sqldb "github.com/vault-md/vaultmd/internal/database/sqlc"
	"github.com/vault-md/vaultmd/internal/scope"
)

type ScopeRepository struct {
	ctx *Context
}

func NewScopeRepository(dbCtx *Context) *ScopeRepository {
	return &ScopeRepository{ctx: dbCtx}
}

func (r *ScopeRepository) FindByID(ctx context.Context, id int64) (*ScopeRecord, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return nil, fmt.Errorf("scope repository: missing database context")
	}

	row, err := queries.FindScopeByID(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	record := mapScopeRow(row)
	return &record, nil
}

func (r *ScopeRepository) FindByScope(ctx context.Context, s scope.Scope) (*ScopeRecord, error) {
	scopePath := scope.GetScopeStorageKey(s)
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return nil, fmt.Errorf("scope repository: missing database context")
	}

	row, err := queries.FindScopeByPath(ctx, scopePath)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	record := mapScopeRow(row)
	return &record, nil
}

func (r *ScopeRepository) GetOrCreate(ctx context.Context, s scope.Scope) (int64, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return 0, fmt.Errorf("scope repository: missing database context")
	}

	existing, err := r.FindByScope(ctx, s)
	if err != nil {
		return 0, err
	}
	if existing != nil {
		if err := r.updateScope(ctx, existing.ID, s); err != nil {
			return 0, err
		}
		return existing.ID, nil
	}

	params, err := scopeToInsertParams(s)
	if err != nil {
		return 0, err
	}

	result, err := queries.InsertScope(ctx, params)
	if err != nil {
		return 0, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (r *ScopeRepository) FindAll(ctx context.Context) ([]ScopeRecord, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return nil, fmt.Errorf("scope repository: missing database context")
	}

	rows, err := queries.ListScopes(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]ScopeRecord, 0, len(rows))
	for _, row := range rows {
		record := mapScopeRow(row)
		result = append(result, record)
	}
	return result, nil
}

func (r *ScopeRepository) Delete(ctx context.Context, id int64) (bool, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return false, fmt.Errorf("scope repository: missing database context")
	}

	affected, err := queries.DeleteScopeByID(ctx, id)
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

func (r *ScopeRepository) DeleteByPrimaryPath(ctx context.Context, primaryPath string) (int64, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return 0, fmt.Errorf("scope repository: missing database context")
	}

	return queries.DeleteScopesByPrimaryPath(ctx, nullString(primaryPath))
}

func (r *ScopeRepository) DeleteBranch(ctx context.Context, primaryPath, branchName string) (bool, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return false, fmt.Errorf("scope repository: missing database context")
	}

	affected, err := queries.DeleteBranchScope(ctx, sqldb.DeleteBranchScopeParams{
		PrimaryPath: nullString(primaryPath),
		BranchName:  nullString(branchName),
	})
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

func (r *ScopeRepository) updateScope(ctx context.Context, id int64, s scope.Scope) error {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return fmt.Errorf("scope repository: missing database context")
	}

	params, err := scopeToUpdateParams(id, s)
	if err != nil {
		return err
	}
	return queries.UpdateScope(ctx, params)
}

func mapScopeRow(row sqldb.Scope) ScopeRecord {
	domainScope := scope.Scope{Type: scope.ScopeType(row.Type)}
	switch domainScope.Type {
	case scope.ScopeGlobal:
		// nothing extra
	case scope.ScopeRepository:
		domainScope.PrimaryPath = optionalString(row.PrimaryPath)
	case scope.ScopeBranch:
		domainScope.PrimaryPath = optionalString(row.PrimaryPath)
		domainScope.BranchName = optionalString(row.BranchName)
	case scope.ScopeWorktree:
		domainScope.PrimaryPath = optionalString(row.PrimaryPath)
		domainScope.WorktreeID = optionalString(row.WorktreeID)
		domainScope.WorktreePath = optionalString(row.WorktreePath)
	default:
		domainScope.PrimaryPath = optionalString(row.PrimaryPath)
		domainScope.BranchName = optionalString(row.BranchName)
		domainScope.WorktreeID = optionalString(row.WorktreeID)
		domainScope.WorktreePath = optionalString(row.WorktreePath)
	}

	return ScopeRecord{
		ID:        row.ID,
		Scope:     domainScope,
		ScopePath: row.ScopePath,
		CreatedAt: optionalTime(row.CreatedAt),
		UpdatedAt: optionalTime(row.UpdatedAt),
	}
}

func scopeToInsertParams(s scope.Scope) (sqldb.InsertScopeParams, error) {
	scopePath := scope.GetScopeStorageKey(s)
	params := sqldb.InsertScopeParams{
		Type:      string(s.Type),
		ScopePath: scopePath,
	}

	switch s.Type {
	case scope.ScopeGlobal:
		// all null
	case scope.ScopeRepository:
		params.PrimaryPath = nullString(s.PrimaryPath)
	case scope.ScopeBranch:
		params.PrimaryPath = nullString(s.PrimaryPath)
		params.BranchName = nullString(s.BranchName)
	case scope.ScopeWorktree:
		params.PrimaryPath = nullString(s.PrimaryPath)
		params.WorktreeID = nullString(s.WorktreeID)
		params.WorktreePath = nullString(s.WorktreePath)
	default:
		return sqldb.InsertScopeParams{}, fmt.Errorf("unsupported scope type: %s", s.Type)
	}

	return params, nil
}

func scopeToUpdateParams(id int64, s scope.Scope) (sqldb.UpdateScopeParams, error) {
	insertParams, err := scopeToInsertParams(s)
	if err != nil {
		return sqldb.UpdateScopeParams{}, err
	}

	return sqldb.UpdateScopeParams{
		Type:         insertParams.Type,
		PrimaryPath:  insertParams.PrimaryPath,
		WorktreeID:   insertParams.WorktreeID,
		WorktreePath: insertParams.WorktreePath,
		BranchName:   insertParams.BranchName,
		ScopePath:    insertParams.ScopePath,
		ID:           id,
	}, nil
}

func (r *ScopeRepository) CountScopes(ctx context.Context, primaryPath string) ([]ScopeCounts, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return nil, fmt.Errorf("scope repository: missing database context")
	}

	rows, err := queries.ListScopesWithCounts(ctx, nullString(primaryPath))
	if err != nil {
		return nil, err
	}

	counts := make([]ScopeCounts, 0, len(rows))
	for _, row := range rows {
		counts = append(counts, ScopeCounts{
			ScopeID:      row.ScopeID,
			EntryCount:   row.EntryCount,
			VersionCount: row.VersionCount,
		})
	}
	return counts, nil
}

func (r *ScopeRepository) LastUpdated(ctx context.Context, id int64) (time.Time, error) {
	record, err := r.FindByID(ctx, id)
	if err != nil {
		return time.Time{}, err
	}
	if record == nil {
		return time.Time{}, ErrNotFound
	}
	return record.UpdatedAt, nil
}
