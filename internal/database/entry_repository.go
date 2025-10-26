package database

import (
	"context"
	"database/sql"
	"fmt"

	sqldb "github.com/vault-md/vaultmd/internal/database/sqlc"
)

type EntryRepository struct {
	ctx *Context
}

func NewEntryRepository(dbCtx *Context) *EntryRepository {
	return &EntryRepository{ctx: dbCtx}
}

func (r *EntryRepository) FindByID(ctx context.Context, id int64) (*EntryRecord, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return nil, fmt.Errorf("entry repository: missing database context")
	}

	row, err := queries.FindEntryByID(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	record := mapEntryRow(row)
	return &record, nil
}

func (r *EntryRepository) FindByScopeAndKey(ctx context.Context, scopeID int64, key string) (*EntryRecord, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return nil, fmt.Errorf("entry repository: missing database context")
	}

	row, err := queries.FindEntryByScopeAndKey(ctx, sqldb.FindEntryByScopeAndKeyParams{ScopeID: scopeID, Key: key})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	record := mapEntryRow(row)
	return &record, nil
}

func (r *EntryRepository) ListByScope(ctx context.Context, scopeID int64) ([]EntryRecord, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return nil, fmt.Errorf("entry repository: missing database context")
	}

	rows, err := queries.ListEntriesByScope(ctx, scopeID)
	if err != nil {
		return nil, err
	}

	result := make([]EntryRecord, 0, len(rows))
	for _, row := range rows {
		result = append(result, mapEntryRow(row))
	}
	return result, nil
}

func (r *EntryRepository) Create(ctx context.Context, scopeID int64, key string) (int64, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return 0, fmt.Errorf("entry repository: missing database context")
	}

	res, err := queries.InsertEntry(ctx, sqldb.InsertEntryParams{ScopeID: scopeID, Key: key})
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (r *EntryRepository) Delete(ctx context.Context, id int64) (bool, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return false, fmt.Errorf("entry repository: missing database context")
	}

	affected, err := queries.DeleteEntryByID(ctx, id)
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

func (r *EntryRepository) DeleteByScope(ctx context.Context, scopeID int64) (int64, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return 0, fmt.Errorf("entry repository: missing database context")
	}

	return queries.DeleteEntriesByScope(ctx, scopeID)
}

func mapEntryRow(row sqldb.Entry) EntryRecord {
	return EntryRecord{
		ID:        row.ID,
		ScopeID:   row.ScopeID,
		Key:       row.Key,
		CreatedAt: optionalTime(row.CreatedAt),
	}
}
