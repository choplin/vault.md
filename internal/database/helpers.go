package database

import (
	"database/sql"
	"time"

	sqldb "github.com/vault-md/vaultmd/internal/database/sqlc"
)

func nullString(value string) sql.NullString {
	if value == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: value, Valid: true}
}

func stringPtrToNullString(value *string) sql.NullString {
	if value == nil {
		return sql.NullString{}
	}
	if *value == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: *value, Valid: true}
}

func nullInt64(value int64) sql.NullInt64 {
	return sql.NullInt64{Int64: value, Valid: true}
}

func boolToNullInt64(value bool) sql.NullInt64 {
	return sql.NullInt64{Int64: boolToInt64(value), Valid: true}
}

func optionalString(ns sql.NullString) string {
	if !ns.Valid {
		return ""
	}
	return ns.String
}

func optionalInt64(ni sql.NullInt64) int64 {
	if !ni.Valid {
		return 0
	}
	return ni.Int64
}

func optionalBool(ni sql.NullInt64) bool {
	if !ni.Valid {
		return false
	}
	return ni.Int64 != 0
}

func optionalTime(nt sql.NullTime) time.Time {
	if !nt.Valid {
		return time.Time{}
	}
	return nt.Time
}

func boolToInt64(value bool) int64 {
	if value {
		return 1
	}
	return 0
}

func queriesFromContext(ctx *Context) *sqldb.Queries {
	if ctx == nil {
		return nil
	}
	if ctx.Queries != nil {
		return ctx.Queries
	}
	if ctx.DB == nil {
		return nil
	}
	return sqldb.New(ctx.DB)
}
