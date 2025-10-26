package database

import (
	"context"
	"testing"
	"time"

	"github.com/vault-md/vaultmd/internal/scope"
)

func TestScopeRepositoryLifecycle(t *testing.T) {
	ctx := context.Background()
	dbCtx := setupTestDB(t)
	repo := NewScopeRepository(dbCtx)

	repoScope := scope.NewRepository("/repo")

	id, err := repo.GetOrCreate(ctx, repoScope)
	if err != nil {
		t.Fatalf("GetOrCreate returned error: %v", err)
	}
	if id == 0 {
		t.Fatalf("expected non-zero scope id")
	}

	fetched, err := repo.FindByID(ctx, id)
	if err != nil {
		t.Fatalf("FindByID returned error: %v", err)
	}
	if fetched == nil || fetched.Scope.Type != scope.ScopeRepository {
		t.Fatalf("expected repository scope, got %#v", fetched)
	}

	sameID, err := repo.GetOrCreate(ctx, repoScope)
	if err != nil {
		t.Fatalf("GetOrCreate second call error: %v", err)
	}
	if sameID != id {
		t.Fatalf("expected id %d, got %d", id, sameID)
	}

	scopes, err := repo.FindAll(ctx)
	if err != nil {
		t.Fatalf("FindAll error: %v", err)
	}
	if len(scopes) != 1 {
		t.Fatalf("expected 1 scope, got %d", len(scopes))
	}

	deleted, err := repo.Delete(ctx, id)
	if err != nil {
		t.Fatalf("Delete error: %v", err)
	}
	if !deleted {
		t.Fatalf("expected delete to remove record")
	}
}

func TestEntryRepositoryLifecycle(t *testing.T) {
	ctx := context.Background()
	dbCtx := setupTestDB(t)

	scopeRepo := NewScopeRepository(dbCtx)
	entryRepo := NewEntryRepository(dbCtx)

	scopeID, err := scopeRepo.GetOrCreate(ctx, scope.NewRepository("/repo"))
	if err != nil {
		t.Fatalf("scope creation failed: %v", err)
	}

	entryID, err := entryRepo.Create(ctx, scopeID, "notes")
	if err != nil {
		t.Fatalf("entry create failed: %v", err)
	}

	byID, err := entryRepo.FindByID(ctx, entryID)
	if err != nil || byID == nil {
		t.Fatalf("FindByID failed: %v", err)
	}
	if byID.ScopeID != scopeID || byID.Key != "notes" {
		t.Fatalf("unexpected entry %+v", byID)
	}

	byKey, err := entryRepo.FindByScopeAndKey(ctx, scopeID, "notes")
	if err != nil || byKey == nil {
		t.Fatalf("FindByScopeAndKey failed: %v", err)
	}

	list, err := entryRepo.ListByScope(ctx, scopeID)
	if err != nil {
		t.Fatalf("ListByScope failed: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(list))
	}

	deleted, err := entryRepo.Delete(ctx, entryID)
	if err != nil || !deleted {
		t.Fatalf("Delete failed: %v deleted=%v", err, deleted)
	}
}

func TestEntryStatusRepositoryLifecycle(t *testing.T) {
	ctx := context.Background()
	dbCtx := setupTestDB(t)

	scopeRepo := NewScopeRepository(dbCtx)
	entryRepo := NewEntryRepository(dbCtx)
	statusRepo := NewEntryStatusRepository(dbCtx)

	scopeID, err := scopeRepo.GetOrCreate(ctx, scope.NewRepository("/repo"))
	if err != nil {
		t.Fatalf("scope creation failed: %v", err)
	}

	entryID, err := entryRepo.Create(ctx, scopeID, "notes")
	if err != nil {
		t.Fatalf("entry create failed: %v", err)
	}

	if err := statusRepo.Create(ctx, entryID, 1, false); err != nil {
		t.Fatalf("Create status failed: %v", err)
	}

	status, err := statusRepo.FindByEntryID(ctx, entryID)
	if err != nil || status == nil {
		t.Fatalf("FindByEntryID failed: %v", err)
	}
	if status.IsArchived {
		t.Fatalf("expected isArchived false")
	}

	if err := statusRepo.UpdateCurrentVersion(ctx, entryID, 2); err != nil {
		t.Fatalf("UpdateCurrentVersion failed: %v", err)
	}

	updated, err := statusRepo.FindByEntryID(ctx, entryID)
	if err != nil || updated == nil {
		t.Fatalf("Find after update failed: %v", err)
	}
	if updated.CurrentVersion != 2 {
		t.Fatalf("expected version 2, got %d", updated.CurrentVersion)
	}

	archived, err := statusRepo.SetArchived(ctx, entryID, true)
	if err != nil || !archived {
		t.Fatalf("SetArchived failed: %v", err)
	}

	removed, err := statusRepo.Delete(ctx, entryID)
	if err != nil || !removed {
		t.Fatalf("Delete failed: %v", err)
	}
}

func TestVersionRepositoryLifecycle(t *testing.T) {
	ctx := context.Background()
	dbCtx := setupTestDB(t)

	scopeRepo := NewScopeRepository(dbCtx)
	entryRepo := NewEntryRepository(dbCtx)
	statusRepo := NewEntryStatusRepository(dbCtx)
	versionRepo := NewVersionRepository(dbCtx)

	scopeID, err := scopeRepo.GetOrCreate(ctx, scope.NewRepository("/repo"))
	if err != nil {
		t.Fatalf("scope creation failed: %v", err)
	}

	entryID, err := entryRepo.Create(ctx, scopeID, "notes")
	if err != nil {
		t.Fatalf("entry create failed: %v", err)
	}

	if err := statusRepo.Create(ctx, entryID, 1, false); err != nil {
		t.Fatalf("status create failed: %v", err)
	}

	versionID, err := versionRepo.Create(ctx, entryID, 1, "file1", "hash1", nil)
	if err != nil {
		t.Fatalf("version create failed: %v", err)
	}

	maxVersion, err := versionRepo.GetMaxVersion(ctx, entryID)
	if err != nil {
		t.Fatalf("GetMaxVersion failed: %v", err)
	}
	if maxVersion != 1 {
		t.Fatalf("expected max version 1, got %d", maxVersion)
	}

	found, err := versionRepo.FindByID(ctx, versionID)
	if err != nil || found == nil {
		t.Fatalf("FindByID failed: %v", err)
	}

	list, err := versionRepo.ListByEntry(ctx, entryID)
	if err != nil || len(list) != 1 {
		t.Fatalf("ListByEntry failed: %v len=%d", err, len(list))
	}

	count, err := versionRepo.CountByEntry(ctx, entryID)
	if err != nil || count != 1 {
		t.Fatalf("CountByEntry failed: %v count=%d", err, count)
	}

	deleted, err := versionRepo.Delete(ctx, versionID)
	if err != nil || !deleted {
		t.Fatalf("Delete failed: %v", err)
	}
}

func TestEntryVersionQuery(t *testing.T) {
	ctx := context.Background()
	dbCtx := setupTestDB(t)

	scopeRepo := NewScopeRepository(dbCtx)
	entryRepo := NewEntryRepository(dbCtx)
	statusRepo := NewEntryStatusRepository(dbCtx)
	versionRepo := NewVersionRepository(dbCtx)
	q := NewEntryVersionQuery(dbCtx)

	scopeID, err := scopeRepo.GetOrCreate(ctx, scope.NewRepository("/repo"))
	if err != nil {
		t.Fatalf("scope creation failed: %v", err)
	}

	next, err := q.GetNextVersion(ctx, scopeID, "notes")
	if err != nil || next != 1 {
		t.Fatalf("expected next version 1, got %d err=%v", next, err)
	}

	entryID, err := entryRepo.Create(ctx, scopeID, "notes")
	if err != nil {
		t.Fatalf("entry create failed: %v", err)
	}

	if err := statusRepo.Create(ctx, entryID, 1, false); err != nil {
		t.Fatalf("status create failed: %v", err)
	}

	if _, err := versionRepo.Create(ctx, entryID, 1, "file1", "hash1", nil); err != nil {
		t.Fatalf("version create failed: %v", err)
	}

	next, err = q.GetNextVersion(ctx, scopeID, "notes")
	if err != nil || next != 2 {
		t.Fatalf("expected next version 2, got %d err=%v", next, err)
	}

	versions, err := q.GetAllVersions(ctx, scopeID, "notes")
	if err != nil || len(versions) != 1 {
		t.Fatalf("GetAllVersions failed: %v len=%d", err, len(versions))
	}
}

func TestScopedEntryQuery(t *testing.T) {
	ctx := context.Background()
	dbCtx := setupTestDB(t)

	scopeRepo := NewScopeRepository(dbCtx)
	entryRepo := NewEntryRepository(dbCtx)
	statusRepo := NewEntryStatusRepository(dbCtx)
	versionRepo := NewVersionRepository(dbCtx)
	scopedQuery := NewScopedEntryQuery(dbCtx)

	scopeID, err := scopeRepo.GetOrCreate(ctx, scope.NewRepository("/repo"))
	if err != nil {
		t.Fatalf("scope creation failed: %v", err)
	}

	entryID, err := entryRepo.Create(ctx, scopeID, "notes")
	if err != nil {
		t.Fatalf("entry create failed: %v", err)
	}

	if err := statusRepo.Create(ctx, entryID, 1, false); err != nil {
		t.Fatalf("status create failed: %v", err)
	}

	if _, err := versionRepo.Create(ctx, entryID, 1, "file1", "hash1", nil); err != nil {
		t.Fatalf("version create failed: %v", err)
	}

	latest, err := scopedQuery.GetLatest(ctx, scopeID, "notes")
	if err != nil || latest == nil {
		t.Fatalf("GetLatest failed: %v", err)
	}

	list, err := scopedQuery.List(ctx, scopeID, false, false)
	if err != nil || len(list) != 1 {
		t.Fatalf("List latest failed: %v len=%d", err, len(list))
	}

	allVersions, err := scopedQuery.List(ctx, scopeID, false, true)
	if err != nil || len(allVersions) != 1 {
		t.Fatalf("List all versions failed: %v len=%d", err, len(allVersions))
	}

	mapResult, err := scopedQuery.ListByScopes(ctx, []int64{scopeID})
	if err != nil {
		t.Fatalf("ListByScopes failed: %v", err)
	}
	if len(mapResult[scopeID]) != 1 {
		t.Fatalf("expected 1 entry for scope")
	}
}

func TestScopeEntryQuery(t *testing.T) {
	ctx := context.Background()
	dbCtx := setupTestDB(t)

	scopeRepo := NewScopeRepository(dbCtx)
	entryRepo := NewEntryRepository(dbCtx)
	statusRepo := NewEntryStatusRepository(dbCtx)
	versionRepo := NewVersionRepository(dbCtx)
	scopedQuery := NewScopeEntryQuery(dbCtx)

	scopeID, err := scopeRepo.GetOrCreate(ctx, scope.NewRepository("/repo"))
	if err != nil {
		t.Fatalf("scope creation failed: %v", err)
	}

	entryID, err := entryRepo.Create(ctx, scopeID, "notes")
	if err != nil {
		t.Fatalf("entry create failed: %v", err)
	}

	if err := statusRepo.Create(ctx, entryID, 1, false); err != nil {
		t.Fatalf("status create failed: %v", err)
	}

	if _, err := versionRepo.Create(ctx, entryID, 1, "file1", "hash1", nil); err != nil {
		t.Fatalf("version create failed: %v", err)
	}

	counts, err := scopedQuery.GetEntriesWithVersionCount(ctx, scopeID)
	if err != nil || len(counts) != 1 || counts[0].VersionCount != 1 {
		t.Fatalf("GetEntriesWithVersionCount failed: %v counts=%v", err, counts)
	}

	total, err := scopedQuery.GetTotalVersionCount(ctx, scopeID)
	if err != nil || total != 1 {
		t.Fatalf("GetTotalVersionCount failed: %v total=%d", err, total)
	}

	scopeCounts, err := scopedQuery.GetScopesWithCounts(ctx, "/repo")
	if err != nil || len(scopeCounts) != 1 {
		t.Fatalf("GetScopesWithCounts failed: %v len=%d", err, len(scopeCounts))
	}
}

func TestEntryStatusTimestamps(t *testing.T) {
	ctx := context.Background()
	dbCtx := setupTestDB(t)

	scopeRepo := NewScopeRepository(dbCtx)
	entryRepo := NewEntryRepository(dbCtx)
	statusRepo := NewEntryStatusRepository(dbCtx)

	scopeID, err := scopeRepo.GetOrCreate(ctx, scope.NewRepository("/repo"))
	if err != nil {
		t.Fatalf("scope creation failed: %v", err)
	}

	entryID, err := entryRepo.Create(ctx, scopeID, "notes")
	if err != nil {
		t.Fatalf("entry create failed: %v", err)
	}

	if err := statusRepo.Create(ctx, entryID, 1, false); err != nil {
		t.Fatalf("status create failed: %v", err)
	}

	status, err := statusRepo.FindByEntryID(ctx, entryID)
	if err != nil || status == nil {
		t.Fatalf("Find status failed: %v", err)
	}
	if status.UpdatedAt.IsZero() {
		t.Fatalf("expected updated_at timestamp to be set")
	}

	before := status.UpdatedAt
	time.Sleep(1100 * time.Millisecond)
	if err := statusRepo.UpdateCurrentVersion(ctx, entryID, 2); err != nil {
		t.Fatalf("UpdateCurrentVersion failed: %v", err)
	}
	status, err = statusRepo.FindByEntryID(ctx, entryID)
	if err != nil || status == nil {
		t.Fatalf("Find status failed: %v", err)
	}
	if !status.UpdatedAt.After(before) {
		t.Fatalf("expected updated_at to advance")
	}
}
