// Package filesystem provides content-addressable storage operations for vault entries.
package filesystem

import (
	"crypto/sha256"
	"encoding/hex"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/choplin/vault.md/internal/config"
)

var ensureOnce sync.Once

// ensureObjectsDir initialises the objects directory the first time it is needed.
func ensureObjectsDir() error {
	var setupErr error
	ensureOnce.Do(func() {
		setupErr = os.MkdirAll(config.GetObjectsDir(), 0o750)
	})
	return setupErr
}

// GetProjectDir returns the directory that stores files for a specific scope/project.
func GetProjectDir(project string) string {
	encoded := config.EncodeProjectPath(project)
	return filepath.Join(config.GetObjectsDir(), encoded)
}

// SaveFile writes content to the on-disk object store and returns the file path and hash.
func SaveFile(project, key string, version int, content string) (string, string, error) {
	if err := ensureObjectsDir(); err != nil {
		return "", "", err
	}

	projectDir := GetProjectDir(project)
	if err := os.MkdirAll(projectDir, 0o750); err != nil {
		return "", "", err
	}

	filePath := getFilePath(project, key, version)
	hash := calculateHash(content)

	if err := os.WriteFile(filePath, []byte(content), 0o600); err != nil {
		return "", "", err
	}

	return filePath, hash, nil
}

// ReadFile reads a file from disk and returns its contents as a string.
func ReadFile(path string) (string, error) {
	//nolint:gosec // G304: path is from database, controlled by application
	bytes, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// DeleteFile removes a file if it exists.
func DeleteFile(path string) error {
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return os.Remove(path)
}

// FileExists reports whether the given path exists.
func FileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// VerifyFile ensures the file exists and its SHA-256 hash matches the expected hash.
func VerifyFile(path, expectedHash string) (bool, error) {
	if !FileExists(path) {
		return false, nil
	}

	content, err := ReadFile(path)
	if err != nil {
		return false, err
	}

	actualHash := calculateHash(content)
	return actualHash == expectedHash, nil
}

// DeleteProjectFiles removes all stored files for a project/scope.
func DeleteProjectFiles(project string) error {
	dir := GetProjectDir(project)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return nil
	}
	return os.RemoveAll(dir)
}

// DeleteKeyFiles removes all versions of a key within a project and returns the number of removed files.
func DeleteKeyFiles(project, key string) (int, error) {
	dir := GetProjectDir(project)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}

	encodedKey := urlEncode(key)
	prefix := encodedKey + "_v"
	count := 0

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasPrefix(name, prefix) && strings.HasSuffix(name, ".txt") {
			if err := os.Remove(filepath.Join(dir, name)); err != nil {
				return count, err
			}
			count++
		}
	}

	return count, nil
}

// getFilePath constructs the storage path for a key/version pair.
func getFilePath(project, key string, version int) string {
	filename := urlEncode(key) + "_v" + strconv.Itoa(version) + ".txt"
	return filepath.Join(GetProjectDir(project), filename)
}

func calculateHash(content string) string {
	sum := sha256.Sum256([]byte(content))
	return hex.EncodeToString(sum[:])
}

func urlEncode(value string) string {
	// url.QueryEscape encodes spaces as '+', so convert to '%20' to match encodeURIComponent.
	return strings.ReplaceAll(url.QueryEscape(value), "+", "%20")
}

// WalkFunc explores each entry under the project's object directory.
type WalkFunc func(path string, d fs.DirEntry) error

// WalkProjectFiles iterates over all files in a project directory.
func WalkProjectFiles(project string, fn WalkFunc) error {
	dir := GetProjectDir(project)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return nil
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if err := fn(filepath.Join(dir, entry.Name()), entry); err != nil {
			return err
		}
	}

	return nil
}
