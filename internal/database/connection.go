package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	"github.com/vault-md/vaultmd/internal/config"

	_ "modernc.org/sqlite"
)

type Context struct {
	DB *sql.DB
}

const currentVersion = 1

func CreateDatabase(dbPath string) (*Context, error) {
	path := dbPath
	if path == "" {
		path = config.GetDbPath()
	}

	useMemory := path == ":memory:"

	if !useMemory {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return nil, fmt.Errorf("failed to create database directory: %w", err)
		}
	}

	var dsn string
	if useMemory {
		dsn = "file::memory:?cache=shared&_pragma=foreign_keys(ON)"
	} else {
		absPath, err := filepath.Abs(path)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve database path: %w", err)
		}
		dsn = fmt.Sprintf("file:%s?_pragma=foreign_keys(ON)", filepath.ToSlash(absPath))
	}

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	if err := migrate(db); err != nil {
		db.Close()
		return nil, err
	}

	return &Context{DB: db}, nil
}

func CloseDatabase(ctx *Context) error {
	if ctx == nil || ctx.DB == nil {
		return nil
	}
	return ctx.DB.Close()
}

func ClearDatabase(ctx *Context) error {
	tx, err := ctx.DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	statements := []string{
		"DELETE FROM versions",
		"DELETE FROM entry_status",
		"DELETE FROM entries",
		"DELETE FROM scopes",
	}

	for _, stmt := range statements {
		if _, err := tx.Exec(stmt); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to execute %s: %w", stmt, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit clear transaction: %w", err)
	}
	return nil
}

func migrate(db *sql.DB) error {
	current, err := getSchemaVersion(db)
	if err != nil {
		return err
	}

	switch {
	case current < currentVersion:
		for v := current + 1; v <= currentVersion; v++ {
			if err := runMigration(db, v); err != nil {
				return err
			}
		}
		if err := setSchemaVersion(db, currentVersion); err != nil {
			return err
		}
	case current > currentVersion:
		return fmt.Errorf("database schema version %d is newer than expected %d", current, currentVersion)
	}

	return nil
}

func getSchemaVersion(db *sql.DB) (int, error) {
	var version int
	if err := db.QueryRow("PRAGMA user_version").Scan(&version); err != nil {
		return 0, fmt.Errorf("failed to read schema version: %w", err)
	}
	return version, nil
}

func setSchemaVersion(db *sql.DB, version int) error {
	if _, err := db.Exec(fmt.Sprintf("PRAGMA user_version = %d", version)); err != nil {
		return fmt.Errorf("failed to set schema version: %w", err)
	}
	return nil
}

func runMigration(db *sql.DB, version int) error {
	switch version {
	case 1:
		tx, err := db.Begin()
		if err != nil {
			return fmt.Errorf("failed to begin migration transaction: %w", err)
		}

		stmts := []string{
			`CREATE TABLE scopes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                primary_path TEXT,
                worktree_id TEXT,
                worktree_path TEXT,
                branch_name TEXT,
                scope_path TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(type, primary_path, worktree_id, branch_name),
                UNIQUE(scope_path)
            )`,
			`CREATE INDEX idx_scopes_lookup ON scopes(type, primary_path, branch_name)`,
			`CREATE INDEX idx_scopes_primary_path ON scopes(primary_path)`,
			`CREATE TABLE entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scope_id INTEGER NOT NULL REFERENCES scopes(id),
                key TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(scope_id, key)
            )`,
			`CREATE INDEX idx_entries_lookup ON entries(scope_id, key)`,
			`CREATE TABLE entry_status (
                entry_id INTEGER PRIMARY KEY REFERENCES entries(id),
                is_archived INTEGER DEFAULT 0,
                current_version INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
			`CREATE TABLE versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id INTEGER NOT NULL REFERENCES entries(id),
                version INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                hash TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(entry_id, version)
            )`,
			`CREATE INDEX idx_versions_lookup ON versions(entry_id, version DESC)`,
		}

		for _, stmt := range stmts {
			if _, err := tx.Exec(stmt); err != nil {
				tx.Rollback()
				return fmt.Errorf("migration statement failed: %w", err)
			}
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit migration: %w", err)
		}
		return nil
	default:
		return fmt.Errorf("unknown migration version %d", version)
	}
}
