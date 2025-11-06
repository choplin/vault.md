package vault

import (
	"time"

	"github.com/choplin/vault.md/internal/scope"
)

type VaultEntry struct {
	ID          int64
	ScopeID     int64
	Scope       string
	Version     int
	Key         string
	FilePath    string
	Hash        string
	Description *string
	CreatedAt   time.Time
	IsArchived  bool
}

type VaultOptions struct {
	Scope      *scope.ScopeType
	Repo       *string
	Branch     *string
	WorktreeID *string
	AllScopes  bool
	Version    *int
}

type ListOptions struct {
	VaultOptions
	AllVersions     bool
	IncludeArchived bool
	JSONOutput      bool
}

type SetOptions struct {
	VaultOptions
	Description *string
}

type ScopedVaultEntry struct {
	VaultEntry
	ScopeType    scope.ScopeType
	ScopeDisplay string
}
