package database

import (
	"context"
	"database/sql"
	"fmt"

	sqldb "github.com/vault-md/vaultmd/internal/database/sqlc"
)

type EntryStatusRepository struct {
	ctx *Context
}

func NewEntryStatusRepository(dbCtx *Context) *EntryStatusRepository {
	return &EntryStatusRepository{ctx: dbCtx}
}

func (r *EntryStatusRepository) FindByEntryID(ctx context.Context, entryID int64) (*EntryStatusRecord, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return nil, fmt.Errorf("entry status repository: missing database context")
	}

	row, err := queries.FindEntryStatusByEntryID(ctx, entryID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	record := mapEntryStatusRow(row)
	return &record, nil
}

func (r *EntryStatusRepository) Create(ctx context.Context, entryID, currentVersion int64, isArchived bool) error {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return fmt.Errorf("entry status repository: missing database context")
	}

	return queries.InsertEntryStatus(ctx, sqldb.InsertEntryStatusParams{
		EntryID:        entryID,
		IsArchived:     boolToNullInt64(isArchived),
		CurrentVersion: nullInt64(currentVersion),
	})
}

func (r *EntryStatusRepository) UpdateCurrentVersion(ctx context.Context, entryID, version int64) error {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return fmt.Errorf("entry status repository: missing database context")
	}

	return queries.UpdateEntryStatusCurrentVersion(ctx, sqldb.UpdateEntryStatusCurrentVersionParams{
		CurrentVersion: nullInt64(version),
		EntryID:        entryID,
	})
}

func (r *EntryStatusRepository) SetArchived(ctx context.Context, entryID int64, archived bool) (bool, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return false, fmt.Errorf("entry status repository: missing database context")
	}

	affected, err := queries.UpdateEntryStatusArchived(ctx, sqldb.UpdateEntryStatusArchivedParams{
		IsArchived: boolToNullInt64(archived),
		EntryID:    entryID,
	})
	if err != nil {
		return false, err
	}

	return affected > 0, nil
}

func (r *EntryStatusRepository) Delete(ctx context.Context, entryID int64) (bool, error) {
	queries := queriesFromContext(r.ctx)
	if queries == nil {
		return false, fmt.Errorf("entry status repository: missing database context")
	}

	affected, err := queries.DeleteEntryStatus(ctx, entryID)
	if err != nil {
		return false, err
	}

	return affected > 0, nil
}

func mapEntryStatusRow(row sqldb.EntryStatus) EntryStatusRecord {
	return EntryStatusRecord{
		EntryID:        row.EntryID,
		IsArchived:     optionalBool(row.IsArchived),
		CurrentVersion: optionalInt64(row.CurrentVersion),
		UpdatedAt:      optionalTime(row.UpdatedAt),
	}
}
