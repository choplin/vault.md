---
created: 2025-11-05
---

# ADR-0001: Git Auto-Detection and Default Repository Scope

## Status

Accepted

## Context

vault.md is a scope-based versioned content storage system that supports multiple scope types: global, repository, branch, and worktree. Users need to specify which scope to use when storing or retrieving content.

The initial implementation required explicit scope specification for all non-global scopes. For example, using repository scope required both `--scope repository` and `--repo /path/to/repo` flags. This created friction in the user experience, as developers working within a git repository had to repeatedly specify obvious context that could be automatically detected.

The core problem: How can we reduce the burden of explicit scope specification while maintaining flexibility and predictability?

## Decision

We implemented the following changes:

### 1. Git Information Detection

Created a new package `internal/git` for automatic git repository detection:

```go
type GitInfo struct {
    IsGitRepo           bool
    PrimaryWorktreePath string
    CurrentWorktreePath string
    CurrentBranch       string
    IsWorktree          bool
    WorktreeID          string
    WorktreePath        string
}

func GetGitInfo(dir string) (*GitInfo, error)
```

This package uses git commands (e.g., `git rev-parse`) to detect:

- Whether the current directory is in a git repository
- Primary worktree path
- Current branch name
- Whether it's a worktree and its ID

### 2. ResolveScope Refactoring

Moved `ResolveScope` from `internal/usecase/scope.go` to `internal/scope/resolve.go`:

- ResolveScope implements the Factory pattern for constructing Scope objects
- Aligns with DDD principles by placing factories in the domain layer
- Consolidates all scope-related functionality in the `scope/` package

### 3. Default Scope Changed to Repository

Modified `ResolveScope` behavior:

**Before**:

```go
case "", scope.ScopeGlobal:  // empty string = global
    s := scope.NewGlobal()
    return s, scope.Validate(s)
```

**After**:

```go
scopeType := ScopeType(opts.Type)
if scopeType == "" {
    scopeType = ScopeRepository  // default = repository
}
```

### 4. Auto-Detection Logic

When scope parameters are not explicitly specified, git information is automatically detected:

```go
case ScopeRepository:
    repo := opts.Repo
    if repo == "" {
        gitInfo, err := git.GetGitInfo(opts.WorkingDir)
        if err == nil && gitInfo.IsGitRepo {
            repo = gitInfo.PrimaryWorktreePath
        } else {
            // Fall back to global scope if not in a git repository
            return NewGlobal(), Validate(NewGlobal())
        }
    }
```

Similar auto-detection is implemented for branch and worktree scopes.

### 5. Explicit Specification Priority

Explicit flags (`--repo`, `--branch`, `--worktree`) always override auto-detection.

## Discussion

### Why Repository as Default

When developers work within a git repository, it's natural to assume that content should be scoped to that repository by default. This aligns with the principle of least surprise:

1. **Context awareness**: Most development work happens within repositories
2. **Reduced cognitive load**: Developers don't need to think about scope for the common case
3. **Explicit control remains**: Users can still specify `--scope global` when needed

### Domain Layer Placement

Moving ResolveScope from the usecase layer to the scope (domain) layer follows DDD principles:

1. **Factory pattern**: ResolveScope constructs Scope objects with complex logic
2. **DDD guidance**: Factories belong in the domain layer when they handle domain logic
3. **Cohesion**: All scope-related functionality (types, validation, formatting, construction) is now in the `scope/` package

### Performance Considerations

While git command execution has overhead:

1. **Conditional execution**: Only runs when parameters are not explicitly specified
2. **No caching needed**: CLI commands are short-lived, so caching adds unnecessary complexity
3. **No faster alternative**: Go's standard library doesn't provide git introspection; external command execution is the most reliable approach

## Consequences

### Positive

1. **Improved UX**: Users can work naturally without explicit scope specification in the common case
2. **Maintained flexibility**: Explicit flags override auto-detection when needed
3. **Better maintainability**: All scope-related logic is consolidated in the `scope/` package
4. **Testability**: Git detection functionality can be tested independently
5. **Intuitive behavior**: Aligns with developer expectations when working in repositories

### Negative

1. **Breaking change**: Changes default behavior from global to repository scope
   - **Mitigation**: Documented as breaking change, users can explicitly specify `--scope global` if needed
2. **Performance overhead**: Git command execution adds latency
   - **Impact**: Minimal (tens of milliseconds), acceptable for CLI usage
3. **Git dependency**: Auto-detection doesn't work when git is not installed
   - **Mitigation**: Falls back to global scope gracefully on error

### Future Considerations

1. **MCP support**: `ScopeOptions.WorkingDir` field added for MCP client working directory specification
2. **Configuration file**: Consider allowing users to configure default scope behavior
3. **Caching**: For long-running processes like MCP servers, consider caching git information

## Alternatives

### Alternative 1: Keep Global as Default

**Pros**:

- No breaking changes
- Avoids git dependency

**Cons**:

- Users must explicitly specify scope every time
- Less intuitive for common use cases
- Increases cognitive load

**Rejected because**: We prioritize improved UX and intuitive behavior

### Alternative 2: Environment Variable Control

Use `VAULT_DEFAULT_SCOPE` environment variable to control default scope.

**Pros**:

- Per-user customization
- Accommodates users who want the old behavior

**Cons**:

- Increases configuration complexity
- Many users won't know about the environment variable
- Adds another layer of indirection

**Decision**: Consider for future enhancement, but not necessary for initial implementation

### Alternative 3: Opt-in Auto-Detection

Only enable git auto-detection with an `--auto-detect` flag.

**Pros**:

- Complete backward compatibility
- Explicit user choice

**Cons**:

- Useful feature not available by default
- Users unaware of the flag miss the benefit
- Adds cognitive overhead

**Rejected because**: We prioritize convenience and intuitive defaults

## References

- Commit: `d8e9288 feat(scope): add git auto-detection and move ResolveScope to scope package`
- Implementation files:
  - `internal/git/git.go` - Git information detection
  - `internal/git/git_test.go` - Test coverage for git detection
  - `internal/scope/resolve.go` - Scope resolution with auto-detection
  - `cmd/vault/{set,get,list,cat}.go` - CLI commands updated to use scope package
