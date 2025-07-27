Feature: Basic three-tier scope operations
  As a vault.md user
  I want to use three different scope levels
  So that I can organize my data appropriately

  Background:
    Given I have a temporary test directory
    And I have initialized a git repository
    And I have created a test file "README.md" with content "# Test Repo"

  Scenario: Store and retrieve data in repository scope by default
    When I run "vault set test-key -d 'Repository scope test' < README.md"
    Then the command should succeed
    When I run "vault get test-key"
    Then the output should be "# Test Repo"
    When I run "vault list"
    Then the output should contain "test-key"

  Scenario: Store and retrieve data in global scope
    When I run "vault set global-key --scope global -d 'Global scope test' < README.md"
    Then the command should succeed
    When I run "vault get global-key --scope global"
    Then the output should be "# Test Repo"
    When I run "vault list --scope global"
    Then the output should contain "global-key"

  Scenario: Store and retrieve data in branch scope
    Given I have created a git branch "feature-test"
    When I run "vault set branch-key --scope branch -d 'Branch scope test' < README.md"
    Then the command should succeed
    When I run "vault get branch-key --scope branch"
    Then the output should be "# Test Repo"
    When I run "vault list --scope branch"
    Then the output should contain "branch-key"
