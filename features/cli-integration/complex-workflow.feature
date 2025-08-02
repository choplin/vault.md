Feature: Complex development workflow
  As a vault.md user
  I want to support typical development workflows
  So that vault integrates seamlessly with my work

  Background:
    Given I have a temporary test directory
    And I have initialized a git repository

  Scenario: Typical development workflow
    # Set project configuration in repository scope (initial branch)
    Given I have created a test file "config.json" with content '{"version": "1.0.0"}'
    When I run "vault set project-config -d 'Project configuration' < config.json"
    Then the command should succeed

    # Set global tool configuration
    Given I have created a test file "tool-config.json" with content '{"theme": "dark"}'
    When I run "vault set tool-config --scope global -d 'Tool settings' < tool-config.json"
    Then the command should succeed

    # Create feature branch and set branch-specific data
    Given I have created a git branch "feature/new-ui"
    And I have created a test file "ui-notes.md" with content "# UI Design Notes"
    When I run "vault set ui-notes --scope branch -d 'UI design notes' < ui-notes.md"
    Then the command should succeed

    # Verify all data is accessible with proper scope
    When I run "vault get project-config"
    Then the output should be '{"version": "1.0.0"}'
    When I run "vault get tool-config --scope global"
    Then the output should be '{"theme": "dark"}'
    When I run "vault get ui-notes --scope branch"
    Then the output should be "# UI Design Notes"

    # After feature completion, move notes to repository scope
    When I run "vault move-scope ui-notes --from-scope branch --to-scope repository"
    Then the command should succeed

    # Switch to initial branch and verify shared notes are accessible
    When I switch to the initial branch
    And I run "vault get ui-notes"
    Then the output should be "# UI Design Notes"
