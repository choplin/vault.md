package database

import (
	"database/sql"
	"time"
)

func nullString(value string) sql.NullString {
	if value == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: value, Valid: true}
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
