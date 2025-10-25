-- name: DeleteAllVersions :exec
DELETE FROM versions;

-- name: DeleteAllEntryStatus :exec
DELETE FROM entry_status;

-- name: DeleteAllEntries :exec
DELETE FROM entries;

-- name: DeleteAllScopes :exec
DELETE FROM scopes;
