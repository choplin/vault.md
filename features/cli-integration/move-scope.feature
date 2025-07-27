Feature: Move entries between scopes
  As a vault.md user
  I want to move data between different scopes
  So that I can reorganize my data as needed

  Background:
    Given I have a temporary test directory
    And I have initialized a git repository

  Scenario: Move data between scopes
    # Create a feature branch and set data
    Given I have created a git branch "move-test"
    And I have created a test file "move-test.txt" with content "Data to move"
    When I run "vault set move-key --scope branch -d 'To be moved' < move-test.txt"
    Then the command should succeed

    # Move from branch to repository scope
    When I run "vault move-scope move-key --from-scope branch --to-scope repository"
    Then the command should succeed

    # Verify data is no longer in branch scope
    When I run "vault get move-key --scope branch"
    Then the command should fail with "Key not found"

    # Verify data is in repository scope
    When I run "vault get move-key"
    Then the output should be "Data to move"

    # Move from repository to global scope
    When I run "vault move-scope move-key --from-scope repository --to-scope global"
    Then the command should succeed

    # Verify data is in global scope
    When I run "vault get move-key --scope global"
    Then the output should be "Data to move"
