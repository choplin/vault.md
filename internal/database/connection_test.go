package database

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	"github.com/vault-md/vaultmd/internal/config"
)

func setupTestDB(t *testing.T) *Context {
	t.Helper()
	tmp := t.TempDir()
	t.Setenv("VAULT_DIR", tmp)

	ctx, err := CreateDatabase("")
	if err != nil {
		t.Fatalf("CreateDatabase returned error: %v", err)
	}

	t.Cleanup(func() {
		if err := CloseDatabase(ctx); err != nil {
			t.Fatalf("CloseDatabase error: %v", err)
		}
	})

	return ctx
}

func TestDatabaseCreationAndMigration(t *testing.T) {
	ctx := setupTestDB(t)

	dbPath := filepath.Join(config.GetVaultDir(), "index.db")
	if _, err := os.Stat(dbPath); err != nil {
		t.Fatalf("expected database file to exist at %s: %v", dbPath, err)
	}

	var userVersion int
	if err := ctx.DB.QueryRow("PRAGMA user_version").Scan(&userVersion); err != nil {
		t.Fatalf("failed to read user_version: %v", err)
	}

	if userVersion != currentVersion {
		t.Fatalf("expected user_version %d, got %d", currentVersion, userVersion)
	}

	tables := []string{"scopes", "entries", "entry_status", "versions"}
	for _, table := range tables {
		if !tableExists(t, ctx.DB, table) {
			t.Fatalf("expected table %s to exist", table)
		}
	}
}

func TestClearDatabaseRemovesAllRows(t *testing.T) {
	ctx := setupTestDB(t)

	scopeID := insertScope(t, ctx.DB, "repository", "/repo", "repo-scope")
	entryID := insertEntry(t, ctx.DB, scopeID, "notes")
	insertEntryStatus(t, ctx.DB, entryID, 1, false)
	insertVersion(t, ctx.DB, entryID, 1, "/tmp/file.txt", "hash")

	assertCount(t, ctx.DB, "scopes", 1)
	assertCount(t, ctx.DB, "entries", 1)
	assertCount(t, ctx.DB, "entry_status", 1)
	assertCount(t, ctx.DB, "versions", 1)

	if err := ClearDatabase(ctx); err != nil {
		t.Fatalf("ClearDatabase returned error: %v", err)
	}

	assertCount(t, ctx.DB, "scopes", 0)
	assertCount(t, ctx.DB, "entries", 0)
	assertCount(t, ctx.DB, "entry_status", 0)
	assertCount(t, ctx.DB, "versions", 0)
}

func tableExists(t *testing.T, db *sql.DB, table string) bool {
	t.Helper()
	var name string
	err := db.QueryRow(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, table).Scan(&name)
	if err == sql.ErrNoRows {
		return false
	}
	if err != nil {
		t.Fatalf("tableExists query failed for %s: %v", table, err)
	}
	return true
}

func insertScope(t *testing.T, db *sql.DB, scopeType, primaryPath, scopePath string) int64 {
	t.Helper()
	res, err := db.Exec(`INSERT INTO scopes(type, primary_path, scope_path) VALUES(?, ?, ?)`, scopeType, primaryPath, scopePath)
	if err != nil {
		t.Fatalf("insertScope failed: %v", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("insertScope LastInsertId failed: %v", err)
	}
	return id
}

func insertEntry(t *testing.T, db *sql.DB, scopeID int64, key string) int64 {
	t.Helper()
	res, err := db.Exec(`INSERT INTO entries(scope_id, key) VALUES(?, ?)`, scopeID, key)
	if err != nil {
		t.Fatalf("insertEntry failed: %v", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("insertEntry LastInsertId failed: %v", err)
	}
	return id
}

func insertEntryStatus(t *testing.T, db *sql.DB, entryID int64, currentVersion int, archived bool) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO entry_status(entry_id, current_version, is_archived) VALUES(?, ?, ?)`, entryID, currentVersion, archived); err != nil {
		t.Fatalf("insertEntryStatus failed: %v", err)
	}
}

func insertVersion(t *testing.T, db *sql.DB, entryID int64, version int, filePath, hash string) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO versions(entry_id, version, file_path, hash) VALUES(?, ?, ?, ?)`, entryID, version, filePath, hash); err != nil {
		t.Fatalf("insertVersion failed: %v", err)
	}
}

func assertCount(t *testing.T, db *sql.DB, table string, expected int) {
	t.Helper()
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM " + table).Scan(&count); err != nil {
		t.Fatalf("count query failed for %s: %v", table, err)
	}
	if count != expected {
		t.Fatalf("expected %s to have %d rows, got %d", table, expected, count)
	}
}
