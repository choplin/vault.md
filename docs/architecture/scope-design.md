---
date: 2025-07-16
---

# Scope Design Documentation

## Overview

This document describes the design decisions for the scope-based key system in vault.md. The scope system allows entries to be organized into different contexts: global or repository-based.

**Update (2025-07-16)**: After further discussion, the design was simplified to only two scope types, removing the `local` scope and simplifying the database schema.

## Problem Statement

The original design used a simple "project path" as the key for organizing entries. This approach had limitations:

1. **Git Worktree Support**: When using git worktrees, the physical path differs from the main repository path
2. **Branch-based Context**: Users often want to store context specific to a git branch
3. **Global Context**: Some entries should be accessible globally, not tied to any specific directory
4. **Context Identification**: Need clear identification of where entries belong without physical path dependencies

## Design Decisions

### Scope Types

After iterating on the design, we settled on two scope types:

1. **Global**
   - For entries accessible from anywhere
   - Repository-independent information
   - Example use cases: AI prompts, personal templates, global configurations

2. **Repository**
   - For entries tied to a specific git repository and branch
   - Tracks both repository root path and branch name
   - Example use cases: Branch-specific work context, feature documentation, development notes

**Removed**: The `local` scope was eliminated because:

- Git repositories cover most use cases
- Non-git directories can be initialized as git repos if needed
- Reduces complexity and ambiguity

### Database Schema

The final schema eliminates NULL values and special type columns by using a convention:

```sql
-- Scopes table: Defines the context for entries
CREATE TABLE scopes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,  -- 'global' for global scope, repo path for repository scope
  branch TEXT NOT NULL,      -- 'global' for global scope, branch name for repository scope

  -- Auxiliary information (not part of the key)
  work_path TEXT,            -- Actual working directory (for git worktrees)
  remote_url TEXT,           -- Git remote URL (optional)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure uniqueness
  UNIQUE(identifier, branch)
);

-- Entries table: Actual content storage
CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope_id INTEGER NOT NULL REFERENCES scopes(id),
  key TEXT NOT NULL,
  version INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  hash TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scope_id, key, version)
);

-- Indexes for performance
CREATE INDEX idx_scopes_lookup ON scopes(identifier, branch);
CREATE INDEX idx_entries_lookup ON entries(scope_id, key, version DESC);
```

**Design Note**: The global scope is represented by `identifier='global'` and `branch='global'`. This eliminates NULL values and simplifies the schema.

### Scope Identification

| Scope | identifier | branch | Notes |
|-------|------------|--------|-------|
| Global | `'global'` | `'global'` | Single global scope |
| Repository | Repository root path | Branch name | Multiple branches per repo |

### Key Components

An entry is uniquely identified by:

- **Scope** (identifier + branch)
- **Key** (user-defined string)
- **Version** (integer)

### Design Trade-offs

1. **Single Table with NULLs vs Multiple Tables**
   - Chose single table for simplicity
   - Application layer enforces field requirements
   - Avoids complex JOINs

2. **work_path as Auxiliary Data**
   - Not part of the unique key
   - Records where the entry was created (for reference)
   - Allows sharing entries across different worktrees of the same branch

3. **Naming: "scopes" vs "contexts"**
   - Avoided "contexts" to prevent confusion with LLM context engineering
   - "Scopes" clearly indicates the organizational boundary

## Implementation Guidelines

### TypeScript Type Definitions

```typescript
// Scope types with discriminated unions for type safety
type Scope = GlobalScope | RepoScope

interface GlobalScope {
  type: 'global'
}

interface RepoScope {
  type: 'repo'
  identifier: string  // repository root path
  branch: string
  workPath?: string   // current working directory
  remoteUrl?: string  // git remote URL
}

// Type guards
function isGlobalScope(scope: Scope): scope is GlobalScope {
  return scope.type === 'global'
}

function isRepoScope(scope: Scope): scope is RepoScope {
  return scope.type === 'repo'
}

// Database conversion functions
function scopeToDb(scope: Scope): DbScope {
  if (scope.type === 'global') {
    return {
      identifier: 'global',
      branch: 'global',
      work_path: null,
      remote_url: null
    }
  }
  return {
    identifier: scope.identifier,
    branch: scope.branch,
    work_path: scope.workPath || null,
    remote_url: scope.remoteUrl || null
  }
}

function dbToScope(db: DbScope): Scope {
  if (db.identifier === 'global' && db.branch === 'global') {
    return { type: 'global' }
  }
  return {
    type: 'repo',
    identifier: db.identifier,
    branch: db.branch,
    workPath: db.work_path || undefined,
    remoteUrl: db.remote_url || undefined
  }
}
```

### Scope Resolution

When a user doesn't specify a scope explicitly:

1. Check if current directory is in a git repository
   - If yes → Use repository scope with current branch
   - If no → Error (require git repository or explicit `--global` flag)

2. Allow explicit scope selection:
   - `--global` flag for global scope
   - `--branch <name>` to specify different branch

### Migration Strategy

From the current `project`-based system:

1. Create new `scopes` table with the schema above
2. Analyze existing entries:
   - For each unique `project` path, check if it's a git repository
   - If git repo: Create repository scope with detected branch
   - If not: Create repository scope with 'main' as default branch (or error)
3. Migrate entries table:
   - Add `scope_id` column
   - Populate based on project → scope mapping
   - Drop `project` column
4. Update application code to use scope_id

## Future Considerations

1. **Scope Hierarchies**: Could support nested scopes (e.g., repo/feature/task)
2. **Scope Aliases**: User-defined aliases for frequently used scopes
3. **Scope Metadata**: Additional fields like tags, descriptions, or access controls
4. **Cross-Scope References**: Ability to reference entries from other scopes

## CLI Usage Examples

```bash
# Global scope
vault set "ai-prompts" --global
vault get "ai-prompts" --global

# Current repo and branch (default)
vault set "work-context"

# Specific branch
vault set "experiment-notes" --branch feature/new-ui
vault get "work-context" --branch main

# List entries in current scope
vault list

# List entries from specific scope
vault list --global
vault list --branch main
```

## Design Evolution Summary

1. **Initial Design**: Three scope types (global, repo, local)
2. **Simplification**: Removed local scope as unnecessary
3. **Schema Optimization**: Eliminated NULLs using 'global'/'global' convention
4. **Type Safety**: Separate TypeScript types while keeping DB schema simple

This design balances simplicity in the database with type safety in the application layer.
