Feature: Cross-branch operations
  As a vault.md user
  I want to access data from different branches
  So that I can share information across development branches

  Background:
    Given I have a temporary test directory
    And I have initialized a git repository

  Scenario: Access data from different branches
    # Create and set data in feature-a branch
    Given I have created a git branch "feature-a"
    And I have created a test file "feature-a.txt" with content "Feature A data"
    When I run "vault set feature-a-key --scope branch -d 'Feature A' < feature-a.txt"
    Then the command should succeed

    # Switch to feature-b branch
    Given I have created a git branch "feature-b"

    # Access data from feature-a branch
    When I run "vault get feature-a-key --scope branch --branch feature-a"
    Then the output should be "Feature A data"

    # Set data in feature-b branch for feature-a branch
    Given I have created a test file "for-feature-a.txt" with content "Data for feature A from B"
    When I run "vault set shared-key --scope branch --branch feature-a -d 'Shared' < for-feature-a.txt"
    Then the command should succeed

    # Switch back to feature-a and verify
    When I switch to git branch "feature-a"
    And I run "vault get shared-key --scope branch"
    Then the output should be "Data for feature A from B"
