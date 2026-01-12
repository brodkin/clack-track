/**
 * Create circuit_breaker_state table migration
 *
 * This table stores circuit breaker states for system resilience:
 * - Manual circuits (MASTER, SLEEP_MODE) for system-wide controls
 * - Provider circuits (PROVIDER_OPENAI, PROVIDER_ANTHROPIC) for AI failover
 *
 * Circuit states:
 * - 'on' / 'off' for manual circuits
 * - 'on' / 'off' / 'half_open' for provider circuits (half_open = testing recovery)
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('circuit_breaker_state', table => {
    // Primary key
    table.increments('id').primary();

    // Circuit identification
    // Use string (VARCHAR) instead of text for columns with unique constraints (MySQL compatibility)
    table.string('circuit_id', 50).unique().notNullable();
    table.string('circuit_type', 20).notNullable();

    // State management
    table.text('state').notNullable();
    table.text('default_state').notNullable();
    table.text('description').nullable();

    // Failure tracking for provider circuits
    table.integer('failure_count').defaultTo(0);
    table.integer('success_count').defaultTo(0);
    table.integer('failure_threshold').defaultTo(5);

    // Timestamps for state transitions
    table.text('last_failure_at').nullable();
    table.text('last_success_at').nullable();
    table.text('state_changed_at').nullable();

    // Audit timestamps
    table.text('created_at').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.text('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP'));

    // Indexes for common queries
    table.index('circuit_id', 'idx_circuit_breaker_circuit_id');
    table.index('circuit_type', 'idx_circuit_breaker_circuit_type');
  });
};

/**
 * Rollback migration - drop circuit_breaker_state table
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('circuit_breaker_state');
};
