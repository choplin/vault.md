package services

import (
	"context"
	"testing"

	"github.com/vault-md/vaultmd/internal/database"
	"github.com/vault-md/vaultmd/internal/scope"
)

func setupServiceDB(t *testing.T) *database.Context {
	t.Helper()
	ctx, err := database.CreateDatabase(":memory:")
	if err != nil {
		t.Fatalf("CreateDatabase error: %v", err)
	}

	t.Cleanup(func() {
		if err := database.CloseDatabase(ctx); err != nil {
			t.Fatalf("CloseDatabase error: %v", err)
		}
	})

	return ctx
}

func TestEntryServiceCreateAndRetrieve(t *testing.T) {
	dbCtx := setupServiceDB(t)
	ctx := context.Background()

	scopeSvc := NewScopeService(dbCtx)
	scopeID, err := scopeSvc.GetOrCreate(ctx, scope.NewRepository("/repo"))
	if err != nil {
		t.Fatalf("GetOrCreate scope failed: %v", err)
	}

	svc := NewEntryService(dbCtx)

	record := database.ScopedEntryRecord{
		ScopeID:  scopeID,
		Key:      "notes",
		Version:  1,
		FilePath: "file1",
		Hash:     "hash1",
	}

	if _, err := svc.Create(ctx, record); err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	latest, err := svc.GetLatest(ctx, scopeID, "notes")
	if err != nil {
		t.Fatalf("GetLatest failed: %v", err)
	}
	if latest == nil || latest.Version != 1 {
		t.Fatalf("unexpected latest entry: %#v", latest)
	}

	next, err := svc.GetNextVersion(ctx, scopeID, "notes")
	if err != nil {
		t.Fatalf("GetNextVersion failed: %v", err)
	}
	if next != 2 {
		t.Fatalf("expected next version 2, got %d", next)
	}
}

func TestEntryServiceDeleteAndArchive(t *testing.T) {
	dbCtx := setupServiceDB(t)
	ctx := context.Background()

	scopeSvc := NewScopeService(dbCtx)
	scopeID, err := scopeSvc.GetOrCreate(ctx, scope.NewRepository("/repo"))
	if err != nil {
		t.Fatalf("GetOrCreate scope failed: %v", err)
	}

	svc := NewEntryService(dbCtx)

	base := database.ScopedEntryRecord{
		ScopeID:  scopeID,
		Key:      "notes",
		FilePath: "file",
		Hash:     "hash",
	}

	for v := int64(1); v <= 2; v++ {
		base.Version = v
		if _, err := svc.Create(ctx, base); err != nil {
			t.Fatalf("Create version %d failed: %v", v, err)
		}
	}

	deleted, err := svc.DeleteVersion(ctx, scopeID, "notes", 2)
	if err != nil || !deleted {
		t.Fatalf("DeleteVersion failed: err=%v deleted=%v", err, deleted)
	}

	all, err := svc.List(ctx, scopeID, false, true)
	if err != nil {
		t.Fatalf("List all versions failed: %v", err)
	}
	if len(all) != 1 || all[0].Version != 1 {
		t.Fatalf("unexpected versions after delete: %#v", all)
	}

	archived, err := svc.Archive(ctx, scopeID, "notes")
	if err != nil || !archived {
		t.Fatalf("Archive failed: err=%v archived=%v", err, archived)
	}

	restored, err := svc.Restore(ctx, scopeID, "notes")
	if err != nil || !restored {
		t.Fatalf("Restore failed: err=%v restored=%v", err, restored)
	}

	removed, err := svc.DeleteAll(ctx, scopeID, "notes")
	if err != nil || !removed {
		t.Fatalf("DeleteAll failed: err=%v removed=%v", err, removed)
	}

	latest, err := svc.GetLatest(ctx, scopeID, "notes")
	if err != nil {
		t.Fatalf("GetLatest after delete failed: %v", err)
	}
	if latest != nil {
		t.Fatalf("expected no entry after delete, got %#v", latest)
	}
}
