package database

import (
	"context"
	"fmt"
)

type ScopeEntryQuery struct {
	ctx *Context
}

func NewScopeEntryQuery(dbCtx *Context) *ScopeEntryQuery {
	return &ScopeEntryQuery{ctx: dbCtx}
}

func (q *ScopeEntryQuery) GetEntriesWithVersionCount(ctx context.Context, scopeID int64) ([]EntryVersionCount, error) {
	queries := queriesFromContext(q.ctx)
	if queries == nil {
		return nil, fmt.Errorf("scope entry query: missing database context")
	}

	rows, err := queries.ListEntriesWithVersionCount(ctx, scopeID)
	if err != nil {
		return nil, err
	}

	result := make([]EntryVersionCount, 0, len(rows))
	for _, row := range rows {
		result = append(result, EntryVersionCount{EntryID: row.EntryID, VersionCount: row.VersionCount})
	}
	return result, nil
}

func (q *ScopeEntryQuery) GetTotalVersionCount(ctx context.Context, scopeID int64) (int64, error) {
	queries := queriesFromContext(q.ctx)
	if queries == nil {
		return 0, fmt.Errorf("scope entry query: missing database context")
	}

	return queries.CountVersionsForScope(ctx, scopeID)
}

func (q *ScopeEntryQuery) GetScopesWithCounts(ctx context.Context, primaryPath string) ([]ScopeCounts, error) {
	scopeRepo := NewScopeRepository(q.ctx)
	return scopeRepo.CountScopes(ctx, primaryPath)
}
