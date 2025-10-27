package services

import (
	"context"
	"testing"

	"github.com/vault-md/vaultmd/internal/database"
	"github.com/vault-md/vaultmd/internal/scope"
)

func TestScopeServiceDeleteScope(t *testing.T) {
	dbCtx := setupServiceDB(t)
	ctx := context.Background()

	scopeSvc := NewScopeService(dbCtx)
	entrySvc := NewEntryService(dbCtx)

	repoScope := scope.NewRepository("/repo")
	scopeID, err := scopeSvc.GetOrCreate(ctx, repoScope)
	if err != nil {
		t.Fatalf("GetOrCreate failed: %v", err)
	}

	record := database.ScopedEntryRecord{
		ScopeID:  scopeID,
		Key:      "notes",
		FilePath: "file",
		Hash:     "hash",
	}
	for v := int64(1); v <= 2; v++ {
		record.Version = v
		if _, err := entrySvc.Create(ctx, record); err != nil {
			t.Fatalf("Create version %d failed: %v", v, err)
		}
	}

	total, err := scopeSvc.DeleteScope(ctx, repoScope)
	if err != nil {
		t.Fatalf("DeleteScope failed: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected to delete 2 versions, got %d", total)
	}

	grouped, err := scopeSvc.GetAllEntriesGrouped(ctx)
	if err != nil {
		t.Fatalf("GetAllEntriesGrouped failed: %v", err)
	}
	if len(grouped[repoScope]) != 0 {
		t.Fatalf("expected no entries for deleted scope")
	}
}

func TestScopeServiceDeleteAllBranches(t *testing.T) {
	dbCtx := setupServiceDB(t)
	ctx := context.Background()

	scopeSvc := NewScopeService(dbCtx)
	entrySvc := NewEntryService(dbCtx)

	branch1 := scope.Scope{Type: scope.ScopeBranch, PrimaryPath: "/repo", BranchName: "feature"}
	branch2 := scope.Scope{Type: scope.ScopeBranch, PrimaryPath: "/repo", BranchName: "fix"}

	for _, sc := range []scope.Scope{branch1, branch2} {
		scopeID, err := scopeSvc.GetOrCreate(ctx, sc)
		if err != nil {
			t.Fatalf("GetOrCreate failed: %v", err)
		}

		entry := database.ScopedEntryRecord{
			ScopeID:  scopeID,
			Key:      "notes",
			Version:  1,
			FilePath: "file",
			Hash:     "hash",
		}
		if _, err := entrySvc.Create(ctx, entry); err != nil {
			t.Fatalf("Create failed: %v", err)
		}
	}

	total, err := scopeSvc.DeleteAllBranches(ctx, "/repo")
	if err != nil {
		t.Fatalf("DeleteAllBranches failed: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected to delete 2 versions, got %d", total)
	}

	list, err := scopeSvc.GetAll(ctx)
	if err != nil {
		t.Fatalf("GetAll failed: %v", err)
	}
	for _, sc := range list {
		if sc.Scope.PrimaryPath == "/repo" && sc.Scope.Type == scope.ScopeBranch {
			t.Fatalf("expected branch scopes to be deleted")
		}
	}
}
