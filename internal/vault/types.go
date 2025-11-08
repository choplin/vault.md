// Package vault provides data types for vault entries and operations.
package vault

import (
	"time"

	"github.com/choplin/vault.md/internal/scope"
)

// VaultEntry represents a stored entry in the vault.
//
//nolint:revive // VaultEntry is intentionally prefixed for clarity in external contexts
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

// VaultOptions specifies filtering options for vault operations.
//
//nolint:revive // VaultOptions is intentionally prefixed for clarity in external contexts
type VaultOptions struct {
	Scope      *scope.ScopeType
	Repo       *string
	Branch     *string
	WorktreeID *string
	AllScopes  bool
	Version    *int
}

// ListOptions extends VaultOptions with list-specific options.
type ListOptions struct {
	VaultOptions
	AllVersions     bool
	IncludeArchived bool
	JSONOutput      bool
}

// SetOptions extends VaultOptions with set-specific options.
type SetOptions struct {
	VaultOptions
	Description *string
}

// ScopedVaultEntry extends VaultEntry with scope display information.
type ScopedVaultEntry struct {
	VaultEntry
	ScopeType    scope.ScopeType
	ScopeDisplay string
}
