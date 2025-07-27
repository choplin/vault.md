Feature: Error handling
  As a vault.md user
  I want clear error messages
  So that I can understand and fix issues

  Background:
    Given I have a temporary test directory
    And I have initialized a git repository

  Scenario: Invalid scope type
    Given I have created a test file "test.txt" with content "Test"
    When I run "vault set test-key --scope invalid -d 'Test' < test.txt"
    Then the command should fail with "Invalid scope: invalid"

  Scenario: Using --branch with non-branch scope
    When I run "vault get test-key --scope global --branch main"
    Then the command should fail with "--branch option can only be used with --scope branch"

  Scenario: Moving to same scope
    Given I have created a test file "test.txt" with content "Test"
    When I run "vault set same-scope-key -d 'Test' < test.txt"
    Then the command should succeed
    When I run "vault move-scope same-scope-key --from-scope repository --to-scope repository"
    Then the command should fail with "Source and target scopes must be different"

  Scenario: Moving non-existent key
    When I run "vault move-scope non-existent --from-scope repository --to-scope global"
    Then the command should fail with "Key not found in source scope"
