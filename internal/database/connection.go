// Package database provides database connection management and operations for vault.md.
package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"

	"github.com/choplin/vault.md/db/migrations"
	"github.com/choplin/vault.md/internal/config"
	sqldb "github.com/choplin/vault.md/internal/database/sqlc"

	// Import SQLite driver for database/sql
	_ "modernc.org/sqlite"
)

// Context holds the database connection and query interface.
type Context struct {
	DB      *sql.DB
	Queries *sqldb.Queries
}

// CreateDatabase creates and initializes a database connection with migrations.
func CreateDatabase(dbPath string) (*Context, error) {
	path := dbPath
	if path == "" {
		path = config.GetDBPath()
	}

	useMemory := path == ":memory:"

	if !useMemory {
		if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
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
		_ = db.Close()
		return nil, fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	if err := runMigrations(db); err != nil {
		_ = db.Close()
		return nil, err
	}

	return &Context{
		DB:      db,
		Queries: sqldb.New(db),
	}, nil
}

// CloseDatabase closes the database connection.
func CloseDatabase(ctx *Context) error {
	if ctx == nil || ctx.DB == nil {
		return nil
	}
	return ctx.DB.Close()
}

// ClearDatabase removes all data from the database.
func ClearDatabase(ctx *Context) error {
	if ctx == nil || ctx.DB == nil {
		return nil
	}

	tx, err := ctx.DB.BeginTx(context.Background(), nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	queries := ctx.Queries
	if queries == nil {
		queries = sqldb.New(ctx.DB)
	}
	queries = queries.WithTx(tx)
	bg := context.Background()

	if err := queries.DeleteAllVersions(bg); err != nil {
		if rbErr := tx.Rollback(); rbErr != nil {
			return fmt.Errorf("failed to delete versions: %w (rollback error: %w)", err, rbErr)
		}
		return fmt.Errorf("failed to delete versions: %w", err)
	}

	if err := queries.DeleteAllEntryStatus(bg); err != nil {
		if rbErr := tx.Rollback(); rbErr != nil {
			return fmt.Errorf("failed to delete entry_status: %w (rollback error: %w)", err, rbErr)
		}
		return fmt.Errorf("failed to delete entry_status: %w", err)
	}

	if err := queries.DeleteAllEntries(bg); err != nil {
		if rbErr := tx.Rollback(); rbErr != nil {
			return fmt.Errorf("failed to delete entries: %w (rollback error: %w)", err, rbErr)
		}
		return fmt.Errorf("failed to delete entries: %w", err)
	}

	if err := queries.DeleteAllScopes(bg); err != nil {
		if rbErr := tx.Rollback(); rbErr != nil {
			return fmt.Errorf("failed to delete scopes: %w (rollback error: %w)", err, rbErr)
		}
		return fmt.Errorf("failed to delete scopes: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit clear transaction: %w", err)
	}

	return nil
}

func runMigrations(db *sql.DB) error {
	driver, err := sqlite.WithInstance(db, &sqlite.Config{})
	if err != nil {
		return fmt.Errorf("failed to initialise migrate driver: %w", err)
	}

	sourceDriver, err := iofs.New(migrations.Files, ".")
	if err != nil {
		return fmt.Errorf("failed to load embedded migrations: %w", err)
	}
	defer func() {
		_ = sourceDriver.Close()
	}()

	migrator, err := migrate.NewWithInstance("iofs", sourceDriver, "sqlite", driver)
	if err != nil {
		return fmt.Errorf("failed to create migrator: %w", err)
	}

	if err := migrator.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("failed to apply migrations: %w", err)
	}

	return nil
}
