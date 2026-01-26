/**
 * Create sessions table migration
 *
 * This table stores user sessions for authentication:
 * - Links to users table via user_id (nullable for anonymous sessions)
 * - Token for session lookup (unique, indexed for fast access)
 * - Expiration tracking for session validity
 * - Optional JSON data for session metadata (user agent, IP, etc.)
 *
 * Anonymous sessions (user_id = null) support pre-login state tracking.
 * Sessions are CASCADE deleted when the associated user is deleted.
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('sessions', table => {
    // Primary key
    table.increments('id').primary();

    // Foreign key to users table (nullable for anonymous sessions)
    table.integer('user_id').unsigned().nullable();
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // Session token (unique, required for lookup)
    // Use string (VARCHAR) instead of text for columns with unique constraints (MySQL compatibility)
    table.string('token', 255).unique().notNullable();

    // Session expiration
    table.timestamp('expires_at').notNullable();

    // Session creation timestamp
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Last access timestamp for session activity tracking
    table.timestamp('last_accessed_at').notNullable().defaultTo(knex.fn.now());

    // Optional session metadata (JSON)
    table.json('data').nullable();

    // Indexes for common queries
    table.index('token', 'idx_sessions_token');
    table.index('user_id', 'idx_sessions_user_id');
    table.index('expires_at', 'idx_sessions_expires_at');
  });
};

/**
 * Rollback migration - drop sessions table
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('sessions');
};
