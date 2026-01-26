/**
 * Create magic_links table migration
 *
 * This table stores registration invite tokens (magic links) for user onboarding:
 * - Token for one-time-use registration links (unique, indexed for fast lookup)
 * - Email address for the invited user
 * - Expiration tracking for link validity
 * - Usage tracking (used_at) to prevent replay attacks
 * - Creator tracking (created_by) for audit trail
 *
 * Magic links are used to invite new users to register. They:
 * - Are single-use (used_at set on consumption)
 * - Expire after a configurable period (expires_at)
 * - Track who created them for auditing (created_by, nullable for system-generated)
 * - Allow multiple links per email (for re-sending invites)
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('magic_links', table => {
    // Primary key
    table.increments('id').primary();

    // Token for magic link (unique, required for lookup)
    // Use string (VARCHAR) instead of text for columns with unique constraints (MySQL compatibility)
    table.string('token', 255).unique().notNullable();

    // Email address of the invited user
    table.string('email', 255).notNullable();

    // Expiration timestamp for link validity
    table.timestamp('expires_at').notNullable();

    // Usage tracking - null means unused, timestamp means when it was used
    table.timestamp('used_at').nullable();

    // Creator tracking - foreign key to users table (nullable for system-generated links)
    table.integer('created_by').unsigned().nullable();
    table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');

    // Creation timestamp
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes for common queries
    table.index('token', 'idx_magic_links_token');
    table.index('email', 'idx_magic_links_email');
    table.index(['email', 'used_at'], 'idx_magic_links_email_used_at');
    table.index('expires_at', 'idx_magic_links_expires_at');
  });
};

/**
 * Rollback migration - drop magic_links table
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('magic_links');
};
