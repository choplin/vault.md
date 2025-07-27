Feature: Scope priority and fallback
  As a vault.md user
  I want the system to search scopes in the correct order
  So that I get the most appropriate data

  Background:
    Given I have a temporary test directory
    And I have initialized a git repository
    And I have created a test file "global.txt" with content "Global content"
    And I have created a test file "repo.txt" with content "Repository content"
    And I have created a test file "branch.txt" with content "Branch content"

  Scenario: Scope priority when using --all-scopes
    # Set same key in all three scopes
    When I run "vault set priority-key --scope global -d 'Global' < global.txt"
    Then the command should succeed
    When I run "vault set priority-key -d 'Repository' < repo.txt"
    Then the command should succeed
    Given I have created a git branch "priority-test"
    When I run "vault set priority-key --scope branch -d 'Branch' < branch.txt"
    Then the command should succeed

    # Get with --all-scopes should return branch scope value first
    When I run "vault get priority-key --all-scopes"
    Then the output should be "Branch content"

    # Delete from branch scope and check fallback
    When I run "vault delete priority-key --scope branch"
    Then the command should succeed
    When I run "vault get priority-key --scope repository"
    Then the output should be "Repository content"

    # Delete from repository scope and check fallback to global
    When I run "vault delete priority-key"
    Then the command should succeed
    When I run "vault get priority-key --scope global"
    Then the output should be "Global content"
