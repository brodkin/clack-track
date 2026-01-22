/**
 * Commitlint Configuration
 *
 * Enforces SPICE commit message standards with Beads reference requirement
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
 *
 * Beads Reference Required:
 * - Footer must include a reference starting with "clack-"
 * - Format: Refs: clack-123 or Closes: clack-456
 */

// Custom plugin to validate Beads references
const beadsRefPlugin = {
  rules: {
    'beads-ref-required': ({ raw }) => {
      // Match clack- followed by digits or alphanumeric ID
      const beadsRefPattern = /\bclack-[a-z0-9]+\b/i;
      const hasBeadsRef = beadsRefPattern.test(raw);

      return [hasBeadsRef, 'Commit must include a Beads reference (e.g., "Refs: clack-123")'];
    },
  },
};

module.exports = {
  extends: ['@commitlint/config-conventional'],
  plugins: [beadsRefPlugin],
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

    // Beads reference required in commit message
    'beads-ref-required': [2, 'always'],
  },
};
