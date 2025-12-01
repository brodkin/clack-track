/**
 * Create logs table migration
 *
 * This table stores application logs with structured metadata.
 * Supports log levels: info, warn, error, debug
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('logs', table => {
    // Primary key
    table.increments('id').primary();

    // Log data
    table.enum('level', ['info', 'warn', 'error', 'debug']).notNullable();
    table.text('message').notNullable();

    // Timestamp
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Structured metadata (JSON)
    table.json('metadata').nullable();

    // Indexes for common queries
    table.index('level', 'idx_logs_level');
    table.index('created_at', 'idx_logs_created_at');
  });
};

/**
 * Rollback migration - drop logs table
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('logs');
};
