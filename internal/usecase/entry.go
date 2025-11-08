// Package usecase provides high-level use case implementations for vault operations.
package usecase

import (
	"context"
	"errors"
	"fmt"

	"github.com/choplin/vault.md/internal/database"
	"github.com/choplin/vault.md/internal/filesystem"
	"github.com/choplin/vault.md/internal/scope"
	"github.com/choplin/vault.md/internal/services"
)

// Entry provides use case operations for vault entries.
type Entry struct {
	scopeService *services.ScopeService
	entryService *services.EntryService
}

// NewEntry creates a new Entry use case.
func NewEntry(dbCtx *database.Context) *Entry {
	scopeSvc := services.NewScopeService(dbCtx)
	entrySvc := services.NewEntryService(dbCtx)
	return &Entry{
		scopeService: scopeSvc,
		entryService: entrySvc,
	}
}

// SetOptions contains options for the Set operation.
type SetOptions struct {
	Description *string
}

// Set stores content in the vault.
func (u *Entry) Set(ctx context.Context, sc scope.Scope, key, content string, opts *SetOptions) (string, error) {
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

	var description *string
	if opts != nil {
		description = opts.Description
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

// GetOptions contains options for the Get operation.
type GetOptions struct {
	Version *int
}

// GetResult contains the result of a Get operation.
type GetResult struct {
	Record database.ScopedEntryRecord
	Scope  scope.Scope
}

// Get retrieves content from the vault.
func (u *Entry) Get(ctx context.Context, sc scope.Scope, key string, opts *GetOptions) (*GetResult, error) {
	if err := scope.Validate(sc); err != nil {
		return nil, err
	}

	scopeID, err := u.scopeService.GetOrCreate(ctx, sc)
	if err != nil {
		return nil, err
	}

	var entry *database.ScopedEntryRecord
	if opts != nil && opts.Version != nil {
		entry, err = u.entryService.GetByVersion(ctx, scopeID, key, int64(*opts.Version))
	} else {
		entry, err = u.entryService.GetLatest(ctx, scopeID, key)
	}
	if err != nil {
		return nil, err
	}

	ok, err := filesystem.VerifyFile(entry.FilePath, entry.Hash)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("file integrity check failed for %s", key)
	}

	return &GetResult{
		Record: *entry,
		Scope:  sc,
	}, nil
}

// ListOptions contains options for the List operation.
type ListOptions struct {
	IncludeArchived bool
	AllVersions     bool
	AllScopes       bool
}

// ListResult contains the result of a List operation.
type ListResult struct {
	Entries []ListEntry
}

// ListEntry represents a single entry in list results.
type ListEntry struct {
	Record     database.ScopedEntryRecord
	Scope      scope.Scope
	ScopeType  scope.ScopeType
	ScopeShort string
}

// List retrieves entries from the vault.
func (u *Entry) List(ctx context.Context, sc scope.Scope, opts *ListOptions) (*ListResult, error) {
	var allEntries []ListEntry

	includeArchived := opts != nil && opts.IncludeArchived
	allVersions := opts != nil && opts.AllVersions
	allScopes := opts != nil && opts.AllScopes

	if allScopes {
		// Get all scopes from database
		scopes, err := u.scopeService.GetAll(ctx)
		if err != nil {
			return nil, err
		}

		for _, scopeRecord := range scopes {
			entries, err := u.entryService.List(ctx, scopeRecord.ID, includeArchived, allVersions)
			if err != nil {
				return nil, err
			}

			for _, entry := range entries {
				allEntries = append(allEntries, ListEntry{
					Record:     entry,
					Scope:      scopeRecord.Scope,
					ScopeType:  scopeRecord.Scope.Type,
					ScopeShort: scope.FormatScopeShort(scopeRecord.Scope),
				})
			}
		}
	} else {
		// List from single scope
		scopeID, err := u.scopeService.GetOrCreate(ctx, sc)
		if err != nil {
			return nil, err
		}

		entries, err := u.entryService.List(ctx, scopeID, includeArchived, allVersions)
		if err != nil {
			return nil, err
		}

		for _, entry := range entries {
			allEntries = append(allEntries, ListEntry{
				Record:     entry,
				Scope:      sc,
				ScopeType:  sc.Type,
				ScopeShort: scope.FormatScopeShort(sc),
			})
		}
	}

	return &ListResult{Entries: allEntries}, nil
}

// DeleteVersion deletes a specific version of an entry.
// Returns true if the version was deleted, false if it didn't exist.
func (u *Entry) DeleteVersion(ctx context.Context, sc scope.Scope, key string, version int) (bool, error) {
	if err := scope.Validate(sc); err != nil {
		return false, err
	}

	scopeID, err := u.scopeService.GetOrCreate(ctx, sc)
	if err != nil {
		return false, err
	}

	// Get the entry before deleting to get the file path
	entry, err := u.entryService.GetByVersion(ctx, scopeID, key, int64(version))
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			return false, nil
		}
		return false, err
	}

	// Delete from database first (within transaction)
	deleted, err := u.entryService.DeleteVersion(ctx, scopeID, key, int64(version))
	if err != nil {
		return false, err
	}

	// Delete file from filesystem
	if deleted {
		if err := filesystem.DeleteFile(entry.FilePath); err != nil {
			// Log error but don't fail - DB is already updated
			return true, fmt.Errorf("deleted from database but failed to delete file %s: %w", entry.FilePath, err)
		}
	}

	return deleted, nil
}

// DeleteKey deletes all versions of an entry.
// Returns the number of versions deleted.
func (u *Entry) DeleteKey(ctx context.Context, sc scope.Scope, key string) (int, error) {
	if err := scope.Validate(sc); err != nil {
		return 0, err
	}

	scopeID, err := u.scopeService.GetOrCreate(ctx, sc)
	if err != nil {
		return 0, err
	}

	// Get all versions before deleting to get file paths
	entries, err := u.entryService.List(ctx, scopeID, true, true)
	if err != nil {
		return 0, err
	}

	// Filter entries by key
	var filePaths []string
	for _, entry := range entries {
		if entry.Key == key {
			filePaths = append(filePaths, entry.FilePath)
		}
	}

	if len(filePaths) == 0 {
		return 0, nil
	}

	// Delete from database first (within transaction)
	deleted, err := u.entryService.DeleteAll(ctx, scopeID, key)
	if err != nil {
		return 0, err
	}

	if !deleted {
		return 0, nil
	}

	// Delete all files from filesystem
	deletedCount := len(filePaths)
	for _, filePath := range filePaths {
		if err := filesystem.DeleteFile(filePath); err != nil {
			// Log error but continue with other files
			return deletedCount, fmt.Errorf("deleted from database but failed to delete some files: %w", err)
		}
	}

	return deletedCount, nil
}
