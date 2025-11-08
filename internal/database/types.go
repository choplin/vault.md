package database

import (
	"time"

	"github.com/choplin/vault.md/internal/scope"
)

// ScopeRecord represents a row in the scopes table. Each scope groups a set
// of entries and is identified by the combination of type + path metadata.
type ScopeRecord struct {
	ID        int64
	Scope     scope.Scope
	ScopePath string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// EntryRecord represents a row in the entries table. Each entry belongs to a
// single scope and acts as the parent for one or more versions.
type EntryRecord struct {
	ID        int64
	ScopeID   int64
	Key       string
	CreatedAt time.Time
}

// EntryStatusRecord mirrors the entry_status table and tracks the current
// lifecycle information (archival state and latest version) for an entry.
type EntryStatusRecord struct {
	EntryID        int64
	IsArchived     bool
	CurrentVersion int64
	UpdatedAt      time.Time
}

// VersionRecord corresponds to a row in the versions table and stores the
// concrete revision metadata for an entry.
type VersionRecord struct {
	ID          int64
	EntryID     int64
	Version     int64
	FilePath    string
	Hash        string
	Description *string
	CreatedAt   time.Time
}

// ScopedEntryRecord is a denormalised view combining information from
// entries, entry_status, and versions for easy consumption at the service
// layer.
type ScopedEntryRecord struct {
	EntryID     int64
	ScopeID     int64
	Key         string
	Version     int64
	FilePath    string
	Hash        string
	Description *string
	CreatedAt   time.Time
	IsArchived  bool
}

// EntryVersionInfo contains version information for an entry.
type EntryVersionInfo struct {
	Version   int64
	FilePath  string
	CreatedAt time.Time
}

// EntryVersionCount contains version count for an entry.
type EntryVersionCount struct {
	EntryID      int64
	VersionCount int64
}

// ScopeCounts contains entry and version counts for a scope.
type ScopeCounts struct {
	ScopeID      int64
	EntryCount   int64
	VersionCount int64
}
