package database

import (
	"database/sql"
	"fmt"

	sqldb "github.com/choplin/vault.md/internal/database/sqlc"
	"github.com/choplin/vault.md/internal/scope"
)

// ScopeRecordFromRow converts a database scope row to a ScopeRecord.
func ScopeRecordFromRow(row sqldb.Scope) ScopeRecord {
	domainScope := scope.Scope{Type: scope.ScopeType(row.Type)}
	switch domainScope.Type {
	case scope.ScopeGlobal:
	case scope.ScopeRepository:
		domainScope.PrimaryPath = optionalString(row.PrimaryPath)
	case scope.ScopeBranch:
		domainScope.PrimaryPath = optionalString(row.PrimaryPath)
		domainScope.BranchName = optionalString(row.BranchName)
	case scope.ScopeWorktree:
		domainScope.PrimaryPath = optionalString(row.PrimaryPath)
		domainScope.WorktreeID = optionalString(row.WorktreeID)
		domainScope.WorktreePath = optionalString(row.WorktreePath)
	default:
		domainScope.PrimaryPath = optionalString(row.PrimaryPath)
		domainScope.BranchName = optionalString(row.BranchName)
		domainScope.WorktreeID = optionalString(row.WorktreeID)
		domainScope.WorktreePath = optionalString(row.WorktreePath)
	}

	return ScopeRecord{
		ID:        row.ID,
		Scope:     domainScope,
		ScopePath: row.ScopePath,
		CreatedAt: optionalTime(row.CreatedAt),
		UpdatedAt: optionalTime(row.UpdatedAt),
	}
}

// ScopeInsertParams creates insert parameters from a scope.
func ScopeInsertParams(sc scope.Scope) (sqldb.InsertScopeParams, error) {
	params := sqldb.InsertScopeParams{
		Type:      string(sc.Type),
		ScopePath: scope.GetScopeStorageKey(sc),
	}

	switch sc.Type {
	case scope.ScopeGlobal:
	case scope.ScopeRepository:
		params.PrimaryPath = nullString(sc.PrimaryPath)
	case scope.ScopeBranch:
		params.PrimaryPath = nullString(sc.PrimaryPath)
		params.BranchName = nullString(sc.BranchName)
	case scope.ScopeWorktree:
		params.PrimaryPath = nullString(sc.PrimaryPath)
		params.WorktreeID = nullString(sc.WorktreeID)
		params.WorktreePath = nullString(sc.WorktreePath)
	default:
		return sqldb.InsertScopeParams{}, fmt.Errorf("unsupported scope type: %s", sc.Type)
	}

	return params, nil
}

// ScopeUpdateParams creates update parameters from a scope.
func ScopeUpdateParams(id int64, sc scope.Scope) (sqldb.UpdateScopeParams, error) {
	params, err := ScopeInsertParams(sc)
	if err != nil {
		return sqldb.UpdateScopeParams{}, err
	}

	return sqldb.UpdateScopeParams{
		Type:         params.Type,
		PrimaryPath:  params.PrimaryPath,
		WorktreeID:   params.WorktreeID,
		WorktreePath: params.WorktreePath,
		BranchName:   params.BranchName,
		ScopePath:    params.ScopePath,
		ID:           id,
	}, nil
}

// ScopeCountsFromRows converts database rows to scope counts.
func ScopeCountsFromRows(rows []sqldb.ListScopesWithCountsRow) []ScopeCounts {
	result := make([]ScopeCounts, 0, len(rows))
	for _, row := range rows {
		result = append(result, ScopeCounts{
			ScopeID:      row.ScopeID,
			EntryCount:   row.EntryCount,
			VersionCount: row.VersionCount,
		})
	}
	return result
}

// EntryRecordFromRow converts a database entry row to an EntryRecord.
func EntryRecordFromRow(row sqldb.Entry) EntryRecord {
	return EntryRecord{
		ID:        row.ID,
		ScopeID:   row.ScopeID,
		Key:       row.Key,
		CreatedAt: optionalTime(row.CreatedAt),
	}
}

// EntryStatusRecordFromRow converts a database entry status row to an EntryStatusRecord.
func EntryStatusRecordFromRow(row sqldb.EntryStatus) EntryStatusRecord {
	return EntryStatusRecord{
		EntryID:        row.EntryID,
		IsArchived:     optionalBool(row.IsArchived),
		CurrentVersion: optionalInt64(row.CurrentVersion),
		UpdatedAt:      optionalTime(row.UpdatedAt),
	}
}

// VersionRecordFromRow converts a database version row to a VersionRecord.
func VersionRecordFromRow(row sqldb.Version) VersionRecord {
	var description *string
	if row.Description.Valid {
		val := row.Description.String
		description = &val
	}

	return VersionRecord{
		ID:          row.ID,
		EntryID:     row.EntryID,
		Version:     row.Version,
		FilePath:    row.FilePath,
		Hash:        row.Hash,
		Description: description,
		CreatedAt:   optionalTime(row.CreatedAt),
	}
}

// ScopedEntryRecordFromRow creates a ScopedEntryRecord from individual fields.
func ScopedEntryRecordFromRow(entryID, scopeID int64, key string, entryCreatedAt sql.NullTime, isArchived sql.NullInt64, version int64, filePath, hash string, description sql.NullString) ScopedEntryRecord {
	var descPtr *string
	if description.Valid {
		val := description.String
		descPtr = &val
	}

	return ScopedEntryRecord{
		EntryID:     entryID,
		ScopeID:     scopeID,
		Key:         key,
		Version:     version,
		FilePath:    filePath,
		Hash:        hash,
		Description: descPtr,
		CreatedAt:   optionalTime(entryCreatedAt),
		IsArchived:  optionalBool(isArchived),
	}
}
