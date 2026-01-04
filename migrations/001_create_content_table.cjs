/**
 * Create content table migration
 *
 * This table stores all generated content with metadata including:
 * - Generator information (id, name, priority)
 * - AI provider details (provider, model, tier, tokens)
 * - Failover tracking (primary provider, errors)
 * - Status and timing (generated, sent, type, status)
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('content', table => {
    // Primary key
    table.increments('id').primary();

    // Content data
    table.text('text').notNullable();
    table.enum('type', ['major', 'minor']).notNullable();

    // Timestamps
    table.dateTime('generatedAt').notNullable();
    table.dateTime('sentAt').nullable();

    // AI Provider information
    table.string('aiProvider', 50).notNullable();
    table.json('metadata').nullable();

    // Status tracking
    table.enum('status', ['success', 'failed']).notNullable().defaultTo('success');

    // Generator information
    table.string('generatorId', 100).nullable();
    table.string('generatorName', 200).nullable();
    table.integer('priority').nullable().defaultTo(2);

    // AI Model details
    table.string('aiModel', 100).nullable();
    table.string('modelTier', 20).nullable();

    // Failover tracking
    table.boolean('failedOver').nullable().defaultTo(false);
    table.string('primaryProvider', 50).nullable();
    table.text('primaryError').nullable();

    // Error tracking
    table.string('errorType', 100).nullable();
    table.text('errorMessage').nullable();

    // Token usage
    table.integer('tokensUsed').nullable();

    // Indexes for common queries
    table.index('generatedAt', 'idx_generated_at');
    table.index('status', 'idx_status');
    table.index('generatorId', 'idx_generator_id');
  });
};

/**
 * Rollback migration - drop content table
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('content');
};
