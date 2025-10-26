package database

import (
	"context"
	"fmt"
)

type EntryVersionQuery struct {
	entries  *EntryRepository
	versions *VersionRepository
}

func NewEntryVersionQuery(ctx *Context) *EntryVersionQuery {
	return &EntryVersionQuery{
		entries:  NewEntryRepository(ctx),
		versions: NewVersionRepository(ctx),
	}
}

func (q *EntryVersionQuery) GetNextVersion(ctx context.Context, scopeID int64, key string) (int64, error) {
	entry, err := q.entries.FindByScopeAndKey(ctx, scopeID, key)
	if err != nil {
		return 0, err
	}
	if entry == nil {
		return 1, nil
	}

	maxVersion, err := q.versions.GetMaxVersion(ctx, entry.ID)
	if err != nil {
		return 0, err
	}
	return maxVersion + 1, nil
}

func (q *EntryVersionQuery) GetEntryID(ctx context.Context, scopeID int64, key string) (int64, bool, error) {
	entry, err := q.entries.FindByScopeAndKey(ctx, scopeID, key)
	if err != nil {
		return 0, false, err
	}
	if entry == nil {
		return 0, false, nil
	}
	return entry.ID, true, nil
}

func (q *EntryVersionQuery) GetAllVersions(ctx context.Context, scopeID int64, key string) ([]EntryVersionInfo, error) {
	entry, err := q.entries.FindByScopeAndKey(ctx, scopeID, key)
	if err != nil {
		return nil, err
	}
	if entry == nil {
		return []EntryVersionInfo{}, nil
	}

	versions, err := q.versions.ListByEntry(ctx, entry.ID)
	if err != nil {
		return nil, err
	}

	result := make([]EntryVersionInfo, 0, len(versions))
	for _, v := range versions {
		result = append(result, EntryVersionInfo{
			Version:   v.Version,
			FilePath:  v.FilePath,
			CreatedAt: v.CreatedAt,
		})
	}
	return result, nil
}

func (q *EntryVersionQuery) EnsureEntryExists(ctx context.Context, scopeID int64, key string) (int64, error) {
	id, found, err := q.GetEntryID(ctx, scopeID, key)
	if err != nil {
		return 0, err
	}
	if found {
		return id, nil
	}

	if q.entries == nil {
		return 0, fmt.Errorf("entry version query: missing entry repository")
	}

	return q.entries.Create(ctx, scopeID, key)
}
