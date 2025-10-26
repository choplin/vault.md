package database

import (
	"context"
	"database/sql"
	"fmt"

	sqldb "github.com/vault-md/vaultmd/internal/database/sqlc"
)

type ScopedEntryQuery struct {
	ctx *Context
}

func NewScopedEntryQuery(dbCtx *Context) *ScopedEntryQuery {
	return &ScopedEntryQuery{ctx: dbCtx}
}

func (q *ScopedEntryQuery) GetLatest(ctx context.Context, scopeID int64, key string) (*ScopedEntryRecord, error) {
	queries := queriesFromContext(q.ctx)
	if queries == nil {
		return nil, fmt.Errorf("scoped entry query: missing database context")
	}

	row, err := queries.GetScopedEntryLatest(ctx, sqldb.GetScopedEntryLatestParams{ScopeID: scopeID, Key: key})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	record := mapScopedEntryRow(row.EntryID, row.ScopeID, row.Key, row.EntryCreatedAt, row.IsArchived, row.Version, row.FilePath, row.Hash, row.Description)
	return &record, nil
}

func (q *ScopedEntryQuery) GetByVersion(ctx context.Context, scopeID int64, key string, version int64) (*ScopedEntryRecord, error) {
	queries := queriesFromContext(q.ctx)
	if queries == nil {
		return nil, fmt.Errorf("scoped entry query: missing database context")
	}

	row, err := queries.GetScopedEntryByVersion(ctx, sqldb.GetScopedEntryByVersionParams{ScopeID: scopeID, Key: key, Version: version})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	record := mapScopedEntryRow(row.EntryID, row.ScopeID, row.Key, row.EntryCreatedAt, row.IsArchived, row.Version, row.FilePath, row.Hash, row.Description)
	return &record, nil
}

func (q *ScopedEntryQuery) List(ctx context.Context, scopeID int64, includeArchived bool, allVersions bool) ([]ScopedEntryRecord, error) {
	queries := queriesFromContext(q.ctx)
	if queries == nil {
		return nil, fmt.Errorf("scoped entry query: missing database context")
	}

	if allVersions {
		rows, err := queries.ListScopedEntriesAllVersions(ctx, sqldb.ListScopedEntriesAllVersionsParams{ScopeID: scopeID, IncludeArchived: includeArchived})
		if err != nil {
			return nil, err
		}
		result := make([]ScopedEntryRecord, 0, len(rows))
		for _, row := range rows {
			result = append(result, mapScopedEntryRow(row.EntryID, row.ScopeID, row.Key, row.EntryCreatedAt, row.IsArchived, row.Version, row.FilePath, row.Hash, row.Description))
		}
		return result, nil
	}

	rows, err := queries.ListScopedEntriesLatest(ctx, sqldb.ListScopedEntriesLatestParams{ScopeID: scopeID, IncludeArchived: includeArchived})
	if err != nil {
		return nil, err
	}
	result := make([]ScopedEntryRecord, 0, len(rows))
	for _, row := range rows {
		result = append(result, mapScopedEntryRow(row.EntryID, row.ScopeID, row.Key, row.EntryCreatedAt, row.IsArchived, row.Version, row.FilePath, row.Hash, row.Description))
	}
	return result, nil
}

func (q *ScopedEntryQuery) ListByScopes(ctx context.Context, scopeIDs []int64) (map[int64][]ScopedEntryRecord, error) {
	queries := queriesFromContext(q.ctx)
	if queries == nil {
		return nil, fmt.Errorf("scoped entry query: missing database context")
	}

	result := make(map[int64][]ScopedEntryRecord, len(scopeIDs))
	for _, scopeID := range scopeIDs {
		rows, err := queries.ListScopedEntriesLatest(ctx, sqldb.ListScopedEntriesLatestParams{ScopeID: scopeID, IncludeArchived: false})
		if err != nil {
			return nil, err
		}
		entries := make([]ScopedEntryRecord, 0, len(rows))
		for _, row := range rows {
			entries = append(entries, mapScopedEntryRow(row.EntryID, row.ScopeID, row.Key, row.EntryCreatedAt, row.IsArchived, row.Version, row.FilePath, row.Hash, row.Description))
		}
		result[scopeID] = entries
	}
	return result, nil
}

func mapScopedEntryRow(entryID, scopeID int64, key string, entryCreatedAt sql.NullTime, isArchived sql.NullInt64, version int64, filePath, hash string, description sql.NullString) ScopedEntryRecord {
	var descPtr *string
	if description.Valid {
		val := description.String
		descPtr = &val
	}

	return ScopedEntryRecord{
		EntryID:     entryID,
		ScopeID:     scopeID,
		Key:         key,
		Version:     version,
		FilePath:    filePath,
		Hash:        hash,
		Description: descPtr,
		CreatedAt:   optionalTime(entryCreatedAt),
		IsArchived:  optionalBool(isArchived),
	}
}
