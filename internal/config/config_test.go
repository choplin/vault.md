package config

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestGetVaultDirWithExplicitEnv(t *testing.T) {
	tmpDir := t.TempDir()
	customDir := filepath.Join(tmpDir, "custom")

	t.Setenv("VAULT_DIR", customDir)
	t.Setenv("XDG_DATA_HOME", "")

	got := GetVaultDir()
	if got != customDir {
		t.Fatalf("expected %q, got %q", customDir, got)
	}
}

func TestGetVaultDirFallsBackToXDG(t *testing.T) {
	tmpDir := t.TempDir()
	xdgDir := filepath.Join(tmpDir, "xdg")

	t.Setenv("VAULT_DIR", "")
	t.Setenv("XDG_DATA_HOME", xdgDir)

	got := GetVaultDir()
	want := filepath.Join(xdgDir, "vault.md")
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestGetDbAndObjectsPath(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("VAULT_DIR", tmpDir)

	if got, want := GetDbPath(), filepath.Join(tmpDir, "index.db"); got != want {
		t.Fatalf("GetDbPath expected %q, got %q", want, got)
	}

	if got, want := GetObjectsDir(), filepath.Join(tmpDir, "objects"); got != want {
		t.Fatalf("GetObjectsDir expected %q, got %q", want, got)
	}
}

func TestEncodeProjectPath(t *testing.T) {
	input := "/Users/example/project_name.v1"
	got := EncodeProjectPath(input)
	if strings.ContainsAny(got, "/._") {
		t.Fatalf("expected encoded path to replace '/', '.', '_' but got %q", got)
	}
	if got == input {
		t.Fatalf("expected encoded path to differ from input")
	}
}
