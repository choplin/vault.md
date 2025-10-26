package database

import (
	"time"

	"github.com/vault-md/vaultmd/internal/scope"
)

type ScopeRecord struct {
	ID        int64
	Scope     scope.Scope
	ScopePath string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type EntryRecord struct {
	ID        int64
	ScopeID   int64
	Key       string
	CreatedAt time.Time
}

type EntryStatusRecord struct {
	EntryID        int64
	IsArchived     bool
	CurrentVersion int64
	UpdatedAt      time.Time
}

type VersionRecord struct {
	ID          int64
	EntryID     int64
	Version     int64
	FilePath    string
	Hash        string
	Description *string
	CreatedAt   time.Time
}

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

type EntryVersionInfo struct {
	Version   int64
	FilePath  string
	CreatedAt time.Time
}

type EntryVersionCount struct {
	EntryID      int64
	VersionCount int64
}

type ScopeCounts struct {
	ScopeID      int64
	EntryCount   int64
	VersionCount int64
}
