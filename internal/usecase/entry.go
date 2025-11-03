package usecase

import (
	"context"
	"fmt"

	"github.com/vault-md/vaultmd/internal/database"
	"github.com/vault-md/vaultmd/internal/filesystem"
	"github.com/vault-md/vaultmd/internal/scope"
	"github.com/vault-md/vaultmd/internal/services"
)

type Entry struct {
	scopeService *services.ScopeService
	entryService *services.EntryService
}

func NewEntry(dbCtx *database.Context) *Entry {
	scopeSvc := services.NewScopeService(dbCtx)
	entrySvc := services.NewEntryService(dbCtx)
	return &Entry{
		scopeService: scopeSvc,
		entryService: entrySvc,
	}
}

func (u *Entry) Set(ctx context.Context, sc scope.Scope, key, content string, description *string) (string, error) {
	scopeID, err := u.scopeService.GetOrCreate(ctx, sc)
	if err != nil {
		return "", err
	}

	nextVersion, err := u.entryService.GetNextVersion(ctx, scopeID, key)
	if err != nil {
		return "", err
	}

	scopeKey := scope.GetScopeStorageKey(sc)
	path, hash, err := filesystem.SaveFile(scopeKey, key, int(nextVersion), content)
	if err != nil {
		return "", err
	}

	if _, err := u.entryService.Create(ctx, database.ScopedEntryRecord{
		ScopeID:     scopeID,
		Key:         key,
		Version:     nextVersion,
		FilePath:    path,
		Hash:        hash,
		Description: description,
		IsArchived:  false,
	}); err != nil {
		return "", err
	}

	return path, nil
}

type GetInput struct {
	Scope     scope.Scope
	Key       string
	Version   *int
	AllScopes bool
}

type GetResult struct {
	Record database.ScopedEntryRecord
}

func (u *Entry) Get(ctx context.Context, input GetInput) (*GetResult, error) {
	searchScopes := []scope.Scope{input.Scope}
	if input.AllScopes {
		searchScopes = append(searchScopes, getSearchOrder(input.Scope)[1:]...)
	}

	for idx, sc := range searchScopes {
		if idx > 0 {
			if err := scope.Validate(sc); err != nil {
				return nil, err
			}
		}

		scopeID, err := u.scopeService.GetOrCreate(ctx, sc)
		if err != nil {
			return nil, err
		}

		var entry *database.ScopedEntryRecord
		if input.Version != nil {
			entry, err = u.entryService.GetByVersion(ctx, scopeID, input.Key, int64(*input.Version))
		} else {
			entry, err = u.entryService.GetLatest(ctx, scopeID, input.Key)
		}
		if err != nil {
			return nil, err
		}
		if entry == nil {
			continue
		}

		ok, err := filesystem.VerifyFile(entry.FilePath, entry.Hash)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, fmt.Errorf("file integrity check failed for %s", input.Key)
		}

		return &GetResult{Record: *entry}, nil
	}

	return nil, nil
}

func getSearchOrder(current scope.Scope) []scope.Scope {
	switch current.Type {
	case scope.ScopeGlobal:
		return []scope.Scope{scope.NewGlobal()}
	case scope.ScopeRepository:
		return []scope.Scope{
			scope.NewRepository(current.PrimaryPath),
			scope.NewGlobal(),
		}
	case scope.ScopeBranch:
		return []scope.Scope{
			scope.NewBranch(current.PrimaryPath, current.BranchName),
			scope.NewRepository(current.PrimaryPath),
			scope.NewGlobal(),
		}
	case scope.ScopeWorktree:
		return []scope.Scope{
			scope.NewWorktree(current.PrimaryPath, current.WorktreeID, current.WorktreePath),
			scope.NewRepository(current.PrimaryPath),
			scope.NewGlobal(),
		}
	default:
		return []scope.Scope{scope.NewGlobal()}
	}
}
