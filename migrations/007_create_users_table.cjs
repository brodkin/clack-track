/**
 * Create users table migration
 *
 * This table stores authenticated users for the Clack Track application:
 * - Basic user profile (email, name)
 * - Timestamps for auditing (created_at, updated_at)
 *
 * Email is unique and required (used for magic link authentication).
 * Name is optional (can be set during registration or updated later).
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('users', table => {
    // Primary key
    table.increments('id').primary();

    // User profile
    // Use string (VARCHAR) instead of text for columns with unique constraints (MySQL compatibility)
    table.string('email', 255).unique().notNullable();
    table.string('name', 255).nullable();

    // Audit timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Index for email lookups (already unique, so indexed)
    // Additional indexes can be added here if needed
  });
};

/**
 * Rollback migration - drop users table
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('users');
};
