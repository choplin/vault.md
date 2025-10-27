package services

import (
	"context"
	"database/sql"
	"errors"

	"github.com/vault-md/vaultmd/internal/database"
	sqldb "github.com/vault-md/vaultmd/internal/database/sqlc"
)

type scopedEntryQuery struct {
	ctx *database.Context
}

func newScopedEntryQuery(ctx *database.Context) *scopedEntryQuery {
	return &scopedEntryQuery{ctx: ctx}
}

func (q *scopedEntryQuery) getQueries() (*sqldb.Queries, error) {
	if q.ctx == nil {
		return nil, errors.New("scoped entry query: missing database context")
	}
	if q.ctx.Queries == nil {
		if q.ctx.DB == nil {
			return nil, errors.New("scoped entry query: database handle not initialised")
		}
		q.ctx.Queries = sqldb.New(q.ctx.DB)
	}
	return q.ctx.Queries, nil
}

func (q *scopedEntryQuery) getLatest(ctx context.Context, scopeID int64, key string) (*database.ScopedEntryRecord, error) {
	queries, err := q.getQueries()
	if err != nil {
		return nil, err
	}

	row, err := queries.GetScopedEntryLatest(ctx, sqldb.GetScopedEntryLatestParams{
		ScopeID: scopeID,
		Key:     key,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	record := database.ScopedEntryRecordFromRow(row.EntryID, row.ScopeID, row.Key, row.EntryCreatedAt, row.IsArchived, row.Version, row.FilePath, row.Hash, row.Description)
	return &record, nil
}

func (q *scopedEntryQuery) getByVersion(ctx context.Context, scopeID int64, key string, version int64) (*database.ScopedEntryRecord, error) {
	queries, err := q.getQueries()
	if err != nil {
		return nil, err
	}

	row, err := queries.GetScopedEntryByVersion(ctx, sqldb.GetScopedEntryByVersionParams{
		ScopeID: scopeID,
		Key:     key,
		Version: version,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	record := database.ScopedEntryRecordFromRow(row.EntryID, row.ScopeID, row.Key, row.EntryCreatedAt, row.IsArchived, row.Version, row.FilePath, row.Hash, row.Description)
	return &record, nil
}

func (q *scopedEntryQuery) list(ctx context.Context, scopeID int64, includeArchived, allVersions bool) ([]database.ScopedEntryRecord, error) {
	queries, err := q.getQueries()
	if err != nil {
		return nil, err
	}

	var rows []sqldb.ListScopedEntriesLatestRow
	if allVersions {
		allRows, err := queries.ListScopedEntriesAllVersions(ctx, sqldb.ListScopedEntriesAllVersionsParams{
			ScopeID:         scopeID,
			IncludeArchived: includeArchived,
		})
		if err != nil {
			return nil, err
		}

		result := make([]database.ScopedEntryRecord, 0, len(allRows))
		for _, row := range allRows {
			result = append(result, database.ScopedEntryRecordFromRow(row.EntryID, row.ScopeID, row.Key, row.EntryCreatedAt, row.IsArchived, row.Version, row.FilePath, row.Hash, row.Description))
		}
		return result, nil
	}

	rows, err = queries.ListScopedEntriesLatest(ctx, sqldb.ListScopedEntriesLatestParams{
		ScopeID:         scopeID,
		IncludeArchived: includeArchived,
	})
	if err != nil {
		return nil, err
	}

	result := make([]database.ScopedEntryRecord, 0, len(rows))
	for _, row := range rows {
		result = append(result, database.ScopedEntryRecordFromRow(row.EntryID, row.ScopeID, row.Key, row.EntryCreatedAt, row.IsArchived, row.Version, row.FilePath, row.Hash, row.Description))
	}
	return result, nil
}

func (q *scopedEntryQuery) listByScopes(ctx context.Context, scopeIDs []int64) (map[int64][]database.ScopedEntryRecord, error) {
	queries, err := q.getQueries()
	if err != nil {
		return nil, err
	}

	result := make(map[int64][]database.ScopedEntryRecord, len(scopeIDs))
	for _, scopeID := range scopeIDs {
		rows, err := queries.ListScopedEntriesLatest(ctx, sqldb.ListScopedEntriesLatestParams{
			ScopeID:         scopeID,
			IncludeArchived: false,
		})
		if err != nil {
			return nil, err
		}

		entries := make([]database.ScopedEntryRecord, 0, len(rows))
		for _, row := range rows {
			entries = append(entries, database.ScopedEntryRecordFromRow(row.EntryID, row.ScopeID, row.Key, row.EntryCreatedAt, row.IsArchived, row.Version, row.FilePath, row.Hash, row.Description))
		}
		result[scopeID] = entries
	}

	return result, nil
}
