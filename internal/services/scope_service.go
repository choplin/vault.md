package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/choplin/vault.md/internal/database"
	sqldb "github.com/choplin/vault.md/internal/database/sqlc"
	"github.com/choplin/vault.md/internal/scope"
)

// ScopeService provides higher-level operations on scopes and their entries.
type ScopeService struct {
	ctx *database.Context
}

func NewScopeService(ctx *database.Context) *ScopeService {
	return &ScopeService{ctx: ctx}
}

func (s *ScopeService) GetOrCreate(ctx context.Context, sc scope.Scope) (int64, error) {
	q, err := s.queries()
	if err != nil {
		return 0, err
	}

	scopePath := scope.GetScopeStorageKey(sc)
	row, err := q.FindScopeByPath(ctx, scopePath)
	switch {
	case err == nil:
		params, err := database.ScopeUpdateParams(row.ID, sc)
		if err != nil {
			return 0, err
		}
		if err := q.UpdateScope(ctx, params); err != nil {
			return 0, err
		}
		return row.ID, nil
	case errors.Is(err, sql.ErrNoRows):
		params, err := database.ScopeInsertParams(sc)
		if err != nil {
			return 0, err
		}
		res, err := q.InsertScope(ctx, params)
		if err != nil {
			return 0, err
		}
		id, err := res.LastInsertId()
		if err != nil {
			return 0, err
		}
		return id, nil
	default:
		return 0, err
	}
}

func (s *ScopeService) GetByID(ctx context.Context, id int64) (*database.ScopeRecord, error) {
	q, err := s.queries()
	if err != nil {
		return nil, err
	}
	row, err := q.FindScopeByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	record := database.ScopeRecordFromRow(row)
	return &record, nil
}

func (s *ScopeService) FindScopeID(ctx context.Context, sc scope.Scope) (int64, error) {
	q, err := s.queries()
	if err != nil {
		return 0, err
	}
	row, err := q.FindScopeByPath(ctx, scope.GetScopeStorageKey(sc))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, database.ErrNotFound
		}
		return 0, err
	}
	return row.ID, nil
}

func (s *ScopeService) GetAll(ctx context.Context) ([]database.ScopeRecord, error) {
	q, err := s.queries()
	if err != nil {
		return nil, err
	}

	rows, err := q.ListScopes(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]database.ScopeRecord, 0, len(rows))
	for _, row := range rows {
		result = append(result, database.ScopeRecordFromRow(row))
	}
	return result, nil
}

func (s *ScopeService) GetAllEntriesGrouped(ctx context.Context) (map[scope.Scope][]database.ScopedEntryRecord, error) {
	scopes, err := s.GetAll(ctx)
	if err != nil {
		return nil, err
	}

	if len(scopes) == 0 {
		return map[scope.Scope][]database.ScopedEntryRecord{}, nil
	}

	scopeIDs := make([]int64, len(scopes))
	for i, scRecord := range scopes {
		id, err := s.GetOrCreate(ctx, scRecord.Scope)
		if err != nil {
			return nil, err
		}
		scopeIDs[i] = id
	}

	entriesByScope, err := s.listEntriesByScopes(ctx, scopeIDs)
	if err != nil {
		return nil, err
	}

	result := make(map[scope.Scope][]database.ScopedEntryRecord, len(scopes))
	for i, scRecord := range scopes {
		result[scRecord.Scope] = entriesByScope[scopeIDs[i]]
	}
	return result, nil
}

func (s *ScopeService) DeleteScope(ctx context.Context, sc scope.Scope) (int64, error) {
	var totalVersions int64
	err := s.withTx(ctx, func(txCtx context.Context, q *sqldb.Queries) error {
		row, err := q.FindScopeByPath(txCtx, scope.GetScopeStorageKey(sc))
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				totalVersions = 0
				return nil
			}
			return err
		}

		entriesInfo, err := q.ListEntriesWithVersionCount(txCtx, row.ID)
		if err != nil {
			return err
		}

		var versions int64
		for _, info := range entriesInfo {
			versions += info.VersionCount
			if _, err := q.DeleteVersionsByEntry(txCtx, info.EntryID); err != nil {
				return err
			}
			if _, err := q.DeleteEntryStatus(txCtx, info.EntryID); err != nil {
				return err
			}
			if _, err := q.DeleteEntryByID(txCtx, info.EntryID); err != nil {
				return err
			}
		}

		if _, err := q.DeleteScopeByID(txCtx, row.ID); err != nil {
			return err
		}

		totalVersions = versions
		return nil
	})
	if err != nil {
		return 0, err
	}
	return totalVersions, nil
}

func (s *ScopeService) DeleteAllBranches(ctx context.Context, primaryPath string) (int64, error) {
	var totalVersions int64
	err := s.withTx(ctx, func(txCtx context.Context, q *sqldb.Queries) error {
		rows, err := q.ListScopesWithCounts(txCtx, sql.NullString{String: primaryPath, Valid: primaryPath != ""})
		if err != nil {
			return err
		}
		counts := database.ScopeCountsFromRows(rows)

		for _, info := range counts {
			totalVersions += info.VersionCount

			entries, err := q.ListEntriesByScope(txCtx, info.ScopeID)
			if err != nil {
				return err
			}

			for _, entry := range entries {
				if _, err := q.DeleteVersionsByEntry(txCtx, entry.ID); err != nil {
					return err
				}
				if _, err := q.DeleteEntryStatus(txCtx, entry.ID); err != nil {
					return err
				}
				if _, err := q.DeleteEntryByID(txCtx, entry.ID); err != nil {
					return err
				}
			}
		}

		if _, err := q.DeleteScopesByPrimaryPath(txCtx, sql.NullString{String: primaryPath, Valid: primaryPath != ""}); err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return 0, err
	}
	return totalVersions, nil
}

func (s *ScopeService) listEntriesByScopes(ctx context.Context, scopeIDs []int64) (map[int64][]database.ScopedEntryRecord, error) {
	q, err := s.queries()
	if err != nil {
		return nil, err
	}

	result := make(map[int64][]database.ScopedEntryRecord, len(scopeIDs))
	for _, scopeID := range scopeIDs {
		rows, err := q.ListScopedEntriesLatest(ctx, sqldb.ListScopedEntriesLatestParams{
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

func (s *ScopeService) withTx(ctx context.Context, fn func(context.Context, *sqldb.Queries) error) error {
	if s.ctx == nil || s.ctx.DB == nil {
		return fmt.Errorf("scope service: missing database context")
	}

	tx, err := s.ctx.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	queries := sqldb.New(tx)
	if err := fn(ctx, queries); err != nil {
		_ = tx.Rollback()
		return err
	}

	if err := tx.Commit(); err != nil {
		_ = tx.Rollback()
		return err
	}

	return nil
}

func (s *ScopeService) queries() (*sqldb.Queries, error) {
	if s.ctx == nil {
		return nil, fmt.Errorf("scope service: missing database context")
	}
	if s.ctx.Queries == nil {
		if s.ctx.DB == nil {
			return nil, fmt.Errorf("scope service: database handle not initialised")
		}
		s.ctx.Queries = sqldb.New(s.ctx.DB)
	}
	return s.ctx.Queries, nil
}
