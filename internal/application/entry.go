package application

import (
	"context"

	"github.com/vault-md/vaultmd/internal/database"
	"github.com/vault-md/vaultmd/internal/filesystem"
	"github.com/vault-md/vaultmd/internal/scope"
	"github.com/vault-md/vaultmd/internal/services"
)

// SetEntryInput aggregates the information needed to persist a vault entry.
type SetEntryInput struct {
	Scope       scope.Scope
	Key         string
	Content     string
	Description *string
}

// SetEntry stores the provided content in the objects directory, creates the corresponding
// metadata records, and returns the file path that holds the entry content.
func SetEntry(ctx context.Context, dbCtx *database.Context, input SetEntryInput) (string, error) {
	scopeService := services.NewScopeService(dbCtx)
	scopeID, err := scopeService.GetOrCreate(ctx, input.Scope)
	if err != nil {
		return "", err
	}

	entryService := services.NewEntryService(dbCtx)
	nextVersion, err := entryService.GetNextVersion(ctx, scopeID, input.Key)
	if err != nil {
		return "", err
	}

	scopeKey := scope.GetScopeStorageKey(input.Scope)
	path, hash, err := filesystem.SaveFile(scopeKey, input.Key, int(nextVersion), input.Content)
	if err != nil {
		return "", err
	}

	if _, err := entryService.Create(ctx, database.ScopedEntryRecord{
		ScopeID:     scopeID,
		Key:         input.Key,
		Version:     nextVersion,
		FilePath:    path,
		Hash:        hash,
		Description: input.Description,
		IsArchived:  false,
	}); err != nil {
		return "", err
	}

	return path, nil
}
