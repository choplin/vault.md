package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/choplin/vault.md/internal/database"
	sqldb "github.com/choplin/vault.md/internal/database/sqlc"
)

// ErrNotFound is returned when a requested entry is not found.
var ErrNotFound = errors.New("entry not found")

// EntryService exposes high-level operations for scoped entries using sqlc-generated queries.
type EntryService struct {
	ctx *database.Context
}

// NewEntryService creates a new EntryService.
func NewEntryService(ctx *database.Context) *EntryService {
	return &EntryService{
		ctx: ctx,
	}
}

// GetLatest retrieves the latest version of an entry.
func (s *EntryService) GetLatest(ctx context.Context, scopeID int64, key string) (*database.ScopedEntryRecord, error) {
	q, err := s.queries()
	if err != nil {
		return nil, err
	}

	row, err := q.GetScopedEntryLatest(ctx, sqldb.GetScopedEntryLatestParams{
		ScopeID: scopeID,
		Key:     key,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	record := database.ScopedEntryRecordFromRow(row.EntryID, row.ScopeID, row.Key, row.EntryCreatedAt, row.IsArchived, row.Version, row.FilePath, row.Hash, row.Description)
	return &record, nil
}

// GetByVersion retrieves a specific version of an entry.
func (s *EntryService) GetByVersion(ctx context.Context, scopeID int64, key string, version int64) (*database.ScopedEntryRecord, error) {
	q, err := s.queries()
	if err != nil {
		return nil, err
	}

	row, err := q.GetScopedEntryByVersion(ctx, sqldb.GetScopedEntryByVersionParams{
		ScopeID: scopeID,
		Key:     key,
		Version: version,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	record := database.ScopedEntryRecordFromRow(row.EntryID, row.ScopeID, row.Key, row.EntryCreatedAt, row.IsArchived, row.Version, row.FilePath, row.Hash, row.Description)
	return &record, nil
}

// GetNextVersion returns the next version number for an entry.
func (s *EntryService) GetNextVersion(ctx context.Context, scopeID int64, key string) (int64, error) {
	q, err := s.queries()
	if err != nil {
		return 0, err
	}

	row, err := q.FindEntryByScopeAndKey(ctx, sqldb.FindEntryByScopeAndKeyParams{
		ScopeID: scopeID,
		Key:     key,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 1, nil
		}
		return 0, err
	}

	maxVersion, err := q.MaxVersionForEntry(ctx, row.ID)
	if err != nil {
		return 0, err
	}
	return maxVersion + 1, nil
}

// Create persists a new entry version, provisioning the entry/status rows as needed.
func (s *EntryService) Create(ctx context.Context, entry database.ScopedEntryRecord) (versionID int64, err error) {
	err = s.withTx(ctx, func(txCtx context.Context, q *sqldb.Queries) error {
		row, err := q.FindEntryByScopeAndKey(txCtx, sqldb.FindEntryByScopeAndKeyParams{
			ScopeID: entry.ScopeID,
			Key:     entry.Key,
		})

		var entryID int64
		switch {
		case err == nil:
			entryID = row.ID
		case errors.Is(err, sql.ErrNoRows):
			res, err := q.InsertEntry(txCtx, sqldb.InsertEntryParams{
				ScopeID: entry.ScopeID,
				Key:     entry.Key,
			})
			if err != nil {
				return err
			}
			entryID, err = res.LastInsertId()
			if err != nil {
				return err
			}
			isArchived := sql.NullInt64{Int64: 0, Valid: true}
			if entry.IsArchived {
				isArchived.Int64 = 1
			}
			if err := q.InsertEntryStatus(txCtx, sqldb.InsertEntryStatusParams{
				EntryID:        entryID,
				IsArchived:     isArchived,
				CurrentVersion: sql.NullInt64{Int64: entry.Version, Valid: true},
			}); err != nil {
				return err
			}
		default:
			return err
		}

		if err == nil {
			_, err = q.FindEntryStatusByEntryID(txCtx, entryID)
			if errors.Is(err, sql.ErrNoRows) {
				isArchived := sql.NullInt64{Int64: 0, Valid: true}
				if entry.IsArchived {
					isArchived.Int64 = 1
				}
				if err := q.InsertEntryStatus(txCtx, sqldb.InsertEntryStatusParams{
					EntryID:        entryID,
					IsArchived:     isArchived,
					CurrentVersion: sql.NullInt64{Int64: entry.Version, Valid: true},
				}); err != nil {
					return err
				}
			} else if err != nil {
				return err
			}
		}

		var description sql.NullString
		if entry.Description != nil {
			description = sql.NullString{String: *entry.Description, Valid: true}
		}

		res, err := q.InsertVersion(txCtx, sqldb.InsertVersionParams{
			EntryID:     entryID,
			Version:     entry.Version,
			FilePath:    entry.FilePath,
			Hash:        entry.Hash,
			Description: description,
		})
		if err != nil {
			return err
		}
		if versionID, err = res.LastInsertId(); err != nil {
			return err
		}

		return q.UpdateEntryStatusCurrentVersion(txCtx, sqldb.UpdateEntryStatusCurrentVersionParams{
			CurrentVersion: sql.NullInt64{Int64: entry.Version, Valid: true},
			EntryID:        entryID,
		})
	})
	if err != nil {
		return 0, err
	}
	return versionID, nil
}

// List retrieves entries from the vault with specified filters.
func (s *EntryService) List(ctx context.Context, scopeID int64, includeArchived, allVersions bool) ([]database.ScopedEntryRecord, error) {
	q, err := s.queries()
	if err != nil {
		return nil, err
	}

	if allVersions {
		rows, err := q.ListScopedEntriesAllVersions(ctx, sqldb.ListScopedEntriesAllVersionsParams{
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

	rows, err := q.ListScopedEntriesLatest(ctx, sqldb.ListScopedEntriesLatestParams{
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

// DeleteVersion deletes a specific version of an entry and returns true if deleted.
func (s *EntryService) DeleteVersion(ctx context.Context, scopeID int64, key string, version int64) (bool, error) {
	var deleted bool
	err := s.withTx(ctx, func(txCtx context.Context, q *sqldb.Queries) error {
		row, err := q.FindEntryByScopeAndKey(txCtx, sqldb.FindEntryByScopeAndKeyParams{
			ScopeID: scopeID,
			Key:     key,
		})
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				deleted = false
				return nil
			}
			return err
		}

		affected, err := q.DeleteVersionByEntryAndVersion(txCtx, sqldb.DeleteVersionByEntryAndVersionParams{
			EntryID: row.ID,
			Version: version,
		})
		if err != nil {
			return err
		}

		maxVersion, err := q.MaxVersionForEntry(txCtx, row.ID)
		if err != nil {
			return err
		}
		if maxVersion > 0 {
			if err := q.UpdateEntryStatusCurrentVersion(txCtx, sqldb.UpdateEntryStatusCurrentVersionParams{
				CurrentVersion: sql.NullInt64{Int64: maxVersion, Valid: true},
				EntryID:        row.ID,
			}); err != nil {
				return err
			}
		}

		deleted = affected > 0
		return nil
	})
	if err != nil {
		return false, err
	}
	return deleted, nil
}

// DeleteAll deletes all versions of an entry and returns true if deleted.
func (s *EntryService) DeleteAll(ctx context.Context, scopeID int64, key string) (bool, error) {
	var deleted bool
	err := s.withTx(ctx, func(txCtx context.Context, q *sqldb.Queries) error {
		row, err := q.FindEntryByScopeAndKey(txCtx, sqldb.FindEntryByScopeAndKeyParams{
			ScopeID: scopeID,
			Key:     key,
		})
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				deleted = false
				return nil
			}
			return err
		}

		if _, err := q.DeleteVersionsByEntry(txCtx, row.ID); err != nil {
			return err
		}
		if _, err := q.DeleteEntryStatus(txCtx, row.ID); err != nil {
			return err
		}
		affected, err := q.DeleteEntryByID(txCtx, row.ID)
		if err != nil {
			return err
		}

		deleted = affected > 0
		return nil
	})
	if err != nil {
		return false, err
	}
	return deleted, nil
}

// Archive marks an entry as archived and returns true if archived.
func (s *EntryService) Archive(ctx context.Context, scopeID int64, key string) (bool, error) {
	q, err := s.queries()
	if err != nil {
		return false, err
	}

	entryRow, err := q.FindEntryByScopeAndKey(ctx, sqldb.FindEntryByScopeAndKeyParams{
		ScopeID: scopeID,
		Key:     key,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}

	statusRow, err := q.FindEntryStatusByEntryID(ctx, entryRow.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	status := database.EntryStatusRecordFromRow(statusRow)
	if status.IsArchived {
		return false, nil
	}

	affected, err := q.UpdateEntryStatusArchived(ctx, sqldb.UpdateEntryStatusArchivedParams{
		IsArchived: sql.NullInt64{Int64: 1, Valid: true},
		EntryID:    entryRow.ID,
	})
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

// Restore unarchives an entry and returns true if restored.
func (s *EntryService) Restore(ctx context.Context, scopeID int64, key string) (bool, error) {
	q, err := s.queries()
	if err != nil {
		return false, err
	}

	entryRow, err := q.FindEntryByScopeAndKey(ctx, sqldb.FindEntryByScopeAndKeyParams{
		ScopeID: scopeID,
		Key:     key,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}

	statusRow, err := q.FindEntryStatusByEntryID(ctx, entryRow.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	status := database.EntryStatusRecordFromRow(statusRow)
	if !status.IsArchived {
		return false, nil
	}

	affected, err := q.UpdateEntryStatusArchived(ctx, sqldb.UpdateEntryStatusArchivedParams{
		IsArchived: sql.NullInt64{Int64: 0, Valid: true},
		EntryID:    entryRow.ID,
	})
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

// GetEntryByKey retrieves the entry record for a given key.
func (s *EntryService) GetEntryByKey(ctx context.Context, scopeID int64, key string) (*database.EntryRecord, error) {
	q, err := s.queries()
	if err != nil {
		return nil, err
	}
	row, err := q.FindEntryByScopeAndKey(ctx, sqldb.FindEntryByScopeAndKeyParams{
		ScopeID: scopeID,
		Key:     key,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	record := database.EntryRecordFromRow(row)
	return &record, nil
}

func (s *EntryService) withTx(ctx context.Context, fn func(context.Context, *sqldb.Queries) error) error {
	if s.ctx == nil || s.ctx.DB == nil {
		return fmt.Errorf("entry service: missing database context")
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

func (s *EntryService) queries() (*sqldb.Queries, error) {
	if s.ctx == nil {
		return nil, fmt.Errorf("entry service: missing database context")
	}
	if s.ctx.Queries == nil {
		if s.ctx.DB == nil {
			return nil, fmt.Errorf("entry service: database handle not initialised")
		}
		s.ctx.Queries = sqldb.New(s.ctx.DB)
	}
	return s.ctx.Queries, nil
}
