Feature: Archive CLI Commands

  Scenario: Archive and restore an entry
    Given a new vault
    When I run `vault set test-key` with content "test content"
    And I run `vault archive test-key`
    Then the command should succeed with output "Archived entry: test-key"
    When I run `vault list`
    Then the output should not contain "test-key"
    When I run `vault list --include-archived`
    Then the output should contain "test-key"
    And the output should contain "Yes" in the archived column
    When I run `vault restore test-key`
    Then the command should succeed with output "Restored entry: test-key"
    When I run `vault list`
    Then the output should contain "test-key"

  Scenario: Archive non-existent entry
    Given a new vault
    When I run `vault archive non-existent`
    Then the command should fail with error "Failed to archive entry: non-existent"

  Scenario: Restore non-archived entry
    Given a new vault
    When I run `vault set test-key` with content "test content"
    And I run `vault restore test-key`
    Then the command should fail with error "Failed to restore entry: test-key"

  Scenario: List with include-archived flag
    Given a new vault
    When I run `vault set active1` with content "active content 1"
    And I run `vault set active2` with content "active content 2"
    And I run `vault set archived1` with content "archived content"
    And I run `vault archive archived1`
    When I run `vault list`
    Then the output should contain "active1"
    And the output should contain "active2"
    And the output should not contain "archived1"
    When I run `vault list --include-archived`
    Then the output should contain "active1"
    And the output should contain "active2"
    And the output should contain "archived1"

  Scenario: Archive and restore with scopes
    Given a new vault
    When I run `vault set test-key --scope global` with content "global content"
    And I run `vault archive test-key --scope global`
    Then the command should succeed
    When I run `vault list --scope global`
    Then the output should not contain "test-key"
    When I run `vault restore test-key --scope global`
    Then the command should succeed
    When I run `vault list --scope global`
    Then the output should contain "test-key"
