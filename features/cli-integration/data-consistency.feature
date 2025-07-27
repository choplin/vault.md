Feature: Data consistency
  As a vault.md user
  I want data to remain consistent across operations
  So that I can trust the integrity of my stored data

  Background:
    Given I have a temporary test directory
    And I have initialized a git repository

  Scenario: Maintain versions when moving between scopes
    # Set initial version
    Given I have created a test file "v1.txt" with content "Version 1"
    When I run "vault set versioned-key -d 'Version 1' < v1.txt"
    Then the command should succeed

    # Update to create version 2
    Given I have created a test file "v2.txt" with content "Version 2"
    When I run "vault set versioned-key -d 'Version 2' < v2.txt"
    Then the command should succeed

    # Get info to see versions
    When I run "vault info versioned-key"
    Then the JSON output should have "version" equal to 2

    # Move to global scope
    When I run "vault move-scope versioned-key --from-scope repository --to-scope global"
    Then the command should succeed

    # Check that versions are preserved
    When I run "vault info versioned-key --scope global"
    Then the JSON output should have "version" equal to 2

    # Access version 1
    When I run "vault get versioned-key --scope global -v 1"
    Then the output should be "Version 1"
