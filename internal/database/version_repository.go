package database

import (
	"context"
	"database/sql"
	"fmt"

	sqldb "github.com/vault-md/vaultmd/internal/database/sqlc"
)

type VersionRepository struct {
	ctx *Context
}

func NewVersionRepository(dbCtx *Context) *VersionRepository {
	return &VersionRepository{ctx: dbCtx}
}

func (r *VersionRepository) FindByID(ctx context.Context, id int64) (*VersionRecord, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return nil, fmt.Errorf("version repository: missing database context")
	}

	row, err := queries.FindVersionByID(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	record := mapVersionRow(row)
	return &record, nil
}

func (r *VersionRepository) FindByEntryAndVersion(ctx context.Context, entryID, version int64) (*VersionRecord, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return nil, fmt.Errorf("version repository: missing database context")
	}

	row, err := queries.FindVersionByEntryAndVersion(ctx, sqldb.FindVersionByEntryAndVersionParams{EntryID: entryID, Version: version})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	record := mapVersionRow(row)
	return &record, nil
}

func (r *VersionRepository) ListByEntry(ctx context.Context, entryID int64) ([]VersionRecord, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return nil, fmt.Errorf("version repository: missing database context")
	}

	rows, err := queries.ListVersionsByEntry(ctx, entryID)
	if err != nil {
		return nil, err
	}

	result := make([]VersionRecord, 0, len(rows))
	for _, row := range rows {
		result = append(result, mapVersionRow(row))
	}
	return result, nil
}

func (r *VersionRepository) GetMaxVersion(ctx context.Context, entryID int64) (int64, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return 0, fmt.Errorf("version repository: missing database context")
	}

	maxVersion, err := queries.MaxVersionForEntry(ctx, entryID)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, nil
		}
		return 0, err
	}
	return maxVersion, nil
}

func (r *VersionRepository) Create(ctx context.Context, entryID, version int64, filePath, hash string, description *string) (int64, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return 0, fmt.Errorf("version repository: missing database context")
	}

	res, err := queries.InsertVersion(ctx, sqldb.InsertVersionParams{
		EntryID:     entryID,
		Version:     version,
		FilePath:    filePath,
		Hash:        hash,
		Description: stringPtrToNullString(description),
	})
	if err != nil {
		return 0, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (r *VersionRepository) Delete(ctx context.Context, id int64) (bool, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return false, fmt.Errorf("version repository: missing database context")
	}

	affected, err := queries.DeleteVersionByID(ctx, id)
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

func (r *VersionRepository) DeleteByEntryAndVersion(ctx context.Context, entryID, version int64) (bool, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return false, fmt.Errorf("version repository: missing database context")
	}

	affected, err := queries.DeleteVersionByEntryAndVersion(ctx, sqldb.DeleteVersionByEntryAndVersionParams{EntryID: entryID, Version: version})
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

func (r *VersionRepository) DeleteAllByEntry(ctx context.Context, entryID int64) (int64, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return 0, fmt.Errorf("version repository: missing database context")
	}

	return queries.DeleteVersionsByEntry(ctx, entryID)
}

func (r *VersionRepository) CountByEntry(ctx context.Context, entryID int64) (int64, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return 0, fmt.Errorf("version repository: missing database context")
	}

	count, err := queries.CountVersionsByEntry(ctx, entryID)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, nil
		}
		return 0, err
	}
	return count, nil
}

func mapVersionRow(row sqldb.Version) VersionRecord {
	var description *string
	if row.Description.Valid {
		val := row.Description.String
		description = &val
	}

	return VersionRecord{
		ID:          row.ID,
		EntryID:     row.EntryID,
		Version:     row.Version,
		FilePath:    row.FilePath,
		Hash:        row.Hash,
		Description: description,
		CreatedAt:   optionalTime(row.CreatedAt),
	}
}
