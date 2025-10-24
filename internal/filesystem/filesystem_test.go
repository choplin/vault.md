package filesystem

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func setupEnv(t *testing.T) string {
	t.Helper()
	tmp := t.TempDir()
	t.Setenv("VAULT_DIR", tmp)
	t.Setenv("XDG_DATA_HOME", "")
	ensureOnce = sync.Once{}
	return tmp
}

func TestSaveFileReadAndVerify(t *testing.T) {
	tmp := setupEnv(t)
	project := "/Users/example/project"
	key := "notes"

	path, hash, err := SaveFile(project, key, 1, "hello world")
	if err != nil {
		t.Fatalf("SaveFile returned error: %v", err)
	}

	if _, err := os.Stat(path); err != nil {
		t.Fatalf("expected file to exist at %s: %v", path, err)
	}

	content, err := ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile error: %v", err)
	}
	if content != "hello world" {
		t.Fatalf("expected content 'hello world', got %q", content)
	}

	ok, err := VerifyFile(path, hash)
	if err != nil {
		t.Fatalf("VerifyFile error: %v", err)
	}
	if !ok {
		t.Fatalf("VerifyFile expected true")
	}

	projectDir := GetProjectDir(project)
	if !strings.HasPrefix(path, projectDir) {
		t.Fatalf("expected path %s to reside under project dir %s", path, projectDir)
	}

	if !strings.HasPrefix(projectDir, filepath.Join(tmp, "objects")) {
		t.Fatalf("project dir should be under objects directory")
	}
}

func TestDeleteKeyAndProjectFiles(t *testing.T) {
	setupEnv(t)
	project := "/tmp/repo"

	for version := 1; version <= 3; version++ {
		if _, _, err := SaveFile(project, "key", version, "content"); err != nil {
			t.Fatalf("SaveFile error: %v", err)
		}
	}

	count, err := DeleteKeyFiles(project, "key")
	if err != nil {
		t.Fatalf("DeleteKeyFiles error: %v", err)
	}
	if count != 3 {
		t.Fatalf("expected to delete 3 files, got %d", count)
	}

	if err := DeleteProjectFiles(project); err != nil {
		t.Fatalf("DeleteProjectFiles error: %v", err)
	}

	dir := GetProjectDir(project)
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatalf("expected project dir to be removed, stat err: %v", err)
	}
}
