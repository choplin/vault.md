-- name: GetScopedEntryLatest :one
SELECT
    e.id AS entry_id,
    e.scope_id,
    e.key,
    e.created_at AS entry_created_at,
    es.is_archived,
    es.current_version,
    v.version,
    v.file_path,
    v.hash,
    v.description,
    v.created_at AS version_created_at
FROM entries e
JOIN entry_status es ON e.id = es.entry_id
JOIN versions v ON e.id = v.entry_id AND v.version = es.current_version
WHERE e.scope_id = ? AND e.key = ?
LIMIT 1;

-- name: GetScopedEntryByVersion :one
SELECT
    e.id AS entry_id,
    e.scope_id,
    e.key,
    e.created_at AS entry_created_at,
    es.is_archived,
    v.version,
    v.file_path,
    v.hash,
    v.description,
    v.created_at AS version_created_at
FROM entries e
JOIN entry_status es ON e.id = es.entry_id
JOIN versions v ON e.id = v.entry_id
WHERE e.scope_id = ? AND e.key = ? AND v.version = ?
LIMIT 1;

-- name: ListScopedEntriesLatest :many
SELECT
    e.id AS entry_id,
    e.scope_id,
    e.key,
    e.created_at AS entry_created_at,
    es.is_archived,
    es.current_version,
    v.version,
    v.file_path,
    v.hash,
    v.description,
    v.created_at AS version_created_at
FROM entries e
JOIN entry_status es ON e.id = es.entry_id
JOIN versions v ON e.id = v.entry_id AND v.version = es.current_version
WHERE e.scope_id = ?
  AND (sqlc.arg('include_archived') OR es.is_archived = 0)
ORDER BY e.key;

-- name: ListScopedEntriesAllVersions :many
SELECT
    e.id AS entry_id,
    e.scope_id,
    e.key,
    e.created_at AS entry_created_at,
    es.is_archived,
    v.version,
    v.file_path,
    v.hash,
    v.description,
    v.created_at AS version_created_at
FROM entries e
JOIN entry_status es ON e.id = es.entry_id
JOIN versions v ON e.id = v.entry_id
WHERE e.scope_id = ?
  AND (sqlc.arg('include_archived') OR es.is_archived = 0)
ORDER BY e.key, v.version DESC;

-- name: ListEntriesWithVersionCount :many
SELECT
    e.id AS entry_id,
    COUNT(v.id) AS version_count
FROM entries e
LEFT JOIN versions v ON e.id = v.entry_id
WHERE e.scope_id = ?
GROUP BY e.id;

-- name: CountVersionsForScope :one
SELECT COUNT(v.id) AS version_count
FROM entries e
JOIN versions v ON e.id = v.entry_id
WHERE e.scope_id = ?;

-- name: ListScopesWithCounts :many
SELECT
    s.id AS scope_id,
    COUNT(DISTINCT e.id) AS entry_count,
    COUNT(v.id) AS version_count
FROM scopes s
LEFT JOIN entries e ON s.id = e.scope_id
LEFT JOIN versions v ON e.id = v.entry_id
WHERE s.primary_path = ?
GROUP BY s.id;
