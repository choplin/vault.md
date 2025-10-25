package sqldb

import (
	"context"
	"database/sql"
)

// DBTX matches the interface sqlc generates for database access objects.
type DBTX interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	PrepareContext(ctx context.Context, query string) (*sql.Stmt, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Queries wraps a DBTX and exposes the prepared statements defined in sqlc queries.
type Queries struct {
	db DBTX
}

// New constructs a new Queries helper around the provided DB interface.
func New(db DBTX) *Queries {
	return &Queries{db: db}
}

// WithTx returns a copy of the Queries helper scoped to the supplied transaction.
func (q *Queries) WithTx(tx *sql.Tx) *Queries {
	return &Queries{db: tx}
}
