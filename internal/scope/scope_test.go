package scope

import (
	"strings"
	"testing"
)

func TestValidateScopes(t *testing.T) {
	cases := []struct {
		name    string
		scope   Scope
		wantErr bool
	}{
		{"global", NewGlobal(), false},
		{"repository", NewRepository("/repo"), false},
		{"branch", NewBranch("/repo", "main"), false},
		{"worktree", NewWorktree("/repo", "wt-1", "/repo-wt"), false},
		{"missing repo", NewRepository(""), true},
		{"branch no name", NewBranch("/repo", ""), true},
		{"branch reserved", NewBranch("/repo", "global"), true},
		{"worktree no id", NewWorktree("/repo", "", ""), true},
		{"worktree reserved", NewWorktree("/repo", "repository", ""), true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := Validate(tc.scope)
			if tc.wantErr && err == nil {
				t.Fatalf("expected error but got nil")
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestFormatScope(t *testing.T) {
	repo := NewRepository("/repo")
	if got, want := FormatScope(repo), "/repo"; got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}

	branch := NewBranch("/repo", "main")
	if got, want := FormatScope(branch), "/repo:main"; got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}

	worktree := NewWorktree("/repo", "wt-1", "")
	if got, want := FormatScope(worktree), "/repo@wt-1"; got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestFormatScopeShort(t *testing.T) {
	repo := NewRepository("/path/to/repo")
	if got, want := FormatScopeShort(repo), "repo"; got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}

	branch := NewBranch("/path/to/repo", "main")
	if got, want := FormatScopeShort(branch), "repo:main"; got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestGetScopeStorageKeySanitises(t *testing.T) {
	branch := NewBranch("/repo", "feat/new@feature")
	key := GetScopeStorageKey(branch)
	if strings.ContainsAny(key, "@/\\:?*\"<>|") {
		t.Fatalf("expected key to be sanitised, got %q", key)
	}
}
