-- name: FindScopeByID :one
SELECT id, type, primary_path, worktree_id, worktree_path, branch_name, scope_path, created_at, updated_at
FROM scopes
WHERE id = ?
LIMIT 1;

-- name: FindScopeByPath :one
SELECT id, type, primary_path, worktree_id, worktree_path, branch_name, scope_path, created_at, updated_at
FROM scopes
WHERE scope_path = ?
LIMIT 1;

-- name: ListScopes :many
SELECT id, type, primary_path, worktree_id, worktree_path, branch_name, scope_path, created_at, updated_at
FROM scopes
ORDER BY type, primary_path, branch_name;

-- name: InsertScope :execresult
INSERT INTO scopes (type, primary_path, worktree_id, worktree_path, branch_name, scope_path)
VALUES (?, ?, ?, ?, ?, ?);

-- name: UpdateScope :exec
UPDATE scopes
SET type = ?,
    primary_path = ?,
    worktree_id = ?,
    worktree_path = ?,
    branch_name = ?,
    scope_path = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: DeleteScopeByID :execrows
DELETE FROM scopes
WHERE id = ?;

-- name: DeleteScopesByPrimaryPath :execrows
DELETE FROM scopes
WHERE primary_path = ?
  AND type IN ('repository', 'branch', 'worktree');

-- name: DeleteBranchScope :execrows
DELETE FROM scopes
WHERE type = 'branch'
  AND primary_path = ?
  AND branch_name = ?;
