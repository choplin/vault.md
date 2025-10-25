package config

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/adrg/xdg"
)

// GetVaultDir resolves the base directory for all vault storage. It mirrors the
// TypeScript implementation by checking VAULT_DIR first, then XDG paths, and
// finally falling back to the user's home directory.
func GetVaultDir() string {
	if explicit := os.Getenv("VAULT_DIR"); explicit != "" {
		return explicit
	}

	xdg.Reload()

	dataHome := xdg.DataHome
	if dataHome == "" {
		home := xdg.Home
		if home == "" {
			var err error
			home, err = os.UserHomeDir()
			if err != nil {
				return filepath.Join(os.TempDir(), "vault.md")
			}
		}
		dataHome = filepath.Join(home, ".local", "share")
	}

	return filepath.Join(dataHome, "vault.md")
}

// GetDbPath returns the absolute path to the SQLite database file.
func GetDbPath() string {
	return filepath.Join(GetVaultDir(), "index.db")
}

// GetObjectsDir returns the directory that stores entry contents.
func GetObjectsDir() string {
	return filepath.Join(GetVaultDir(), "objects")
}

// EncodeProjectPath sanitizes repository paths so they can be used as directory names.
func EncodeProjectPath(projectPath string) string {
	replacer := strings.NewReplacer("/", "-", ".", "-", "_", "-")
	return replacer.Replace(projectPath)
}
