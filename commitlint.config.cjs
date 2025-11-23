/**
 * Commitlint Configuration
 *
 * Enforces SPICE commit message standards without Jira requirement
 *
 * Format: <type>(<scope>): <subject>
 *
 * Types:
 * - feat: New feature (MINOR version bump)
 * - fix: Bug fix (PATCH version bump)
 * - docs: Documentation changes
 * - style: Code style changes (formatting, etc.)
 * - refactor: Code refactoring
 * - perf: Performance improvements
 * - test: Adding or updating tests
 * - chore: Maintenance tasks
 * - ci: CI/CD changes
 * - BREAKING CHANGE: in footer triggers MAJOR version bump
 */

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Enforce conventional types
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation
        'style', // Formatting
        'refactor', // Code restructuring
        'perf', // Performance
        'test', // Tests
        'chore', // Maintenance
        'ci', // CI/CD
        'revert', // Revert previous commit
      ],
    ],

    // Subject line rules
    'subject-case': [2, 'never', ['upper-case']], // Don't start with uppercase
    'subject-empty': [2, 'never'], // Subject required
    'subject-max-length': [2, 'always', 72], // Max 72 characters

    // Type rules
    'type-case': [2, 'always', 'lower-case'], // Type must be lowercase
    'type-empty': [2, 'never'], // Type required

    // Scope rules (optional but recommended)
    'scope-case': [2, 'always', 'lower-case'], // Scope lowercase if present

    // Body rules
    'body-leading-blank': [2, 'always'], // Blank line before body
    'body-max-line-length': [2, 'always', 100], // Max 100 chars per line

    // Footer rules
    'footer-leading-blank': [2, 'always'], // Blank line before footer

    // Header (first line) rules
    'header-max-length': [2, 'always', 72], // Total header max 72 chars

    // ⚠️ NOTE: Jira references NOT required for this project
    // Remove or comment out these rules if you add Jira integration later:
    // 'footer-required': [0, 'never'],           // Footer optional
    // 'references-empty': [0, 'never'],          // Refs optional
  },
};
