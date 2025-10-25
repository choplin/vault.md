CREATE TABLE IF NOT EXISTS scopes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    primary_path TEXT,
    worktree_id TEXT,
    worktree_path TEXT,
    branch_name TEXT,
    scope_path TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (type, primary_path, worktree_id, branch_name),
    UNIQUE (scope_path)
);

CREATE INDEX IF NOT EXISTS idx_scopes_lookup ON scopes (type, primary_path, branch_name);
CREATE INDEX IF NOT EXISTS idx_scopes_primary_path ON scopes (primary_path);

CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope_id INTEGER NOT NULL REFERENCES scopes (id),
    key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (scope_id, key)
);

CREATE INDEX IF NOT EXISTS idx_entries_lookup ON entries (scope_id, key);

CREATE TABLE IF NOT EXISTS entry_status (
    entry_id INTEGER PRIMARY KEY REFERENCES entries (id),
    is_archived INTEGER DEFAULT 0,
    current_version INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL REFERENCES entries (id),
    version INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    hash TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (entry_id, version)
);

CREATE INDEX IF NOT EXISTS idx_versions_lookup ON versions (entry_id, version DESC);
