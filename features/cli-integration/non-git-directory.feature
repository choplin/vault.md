Feature: Non-git directory behavior
  As a vault.md user
  I want to use vault in non-git directories
  So that I can store data even outside git repositories

  Background:
    Given I have a temporary test directory
    And I am in a non-git directory

  Scenario: Use repository scope in non-git directory
    Given I have created a test file "non-git.txt" with content "Non-git content"
    When I run "vault set non-git-key -d 'Non-git test' < non-git.txt"
    Then the command should succeed
    When I run "vault get non-git-key"
    Then the output should be "Non-git content"
    When I run "vault list"
    Then the output should contain "non-git-key"

  Scenario: Error when trying to use branch scope in non-git directory
    Given I have created a test file "error.txt" with content "Should not be saved"
    When I run "vault set error-key --scope branch -d 'Error' < error.txt"
    Then the command should fail with "Not in a git repository"
    When I run "vault list --scope branch"
    Then the command should fail with "Not in a git repository"
