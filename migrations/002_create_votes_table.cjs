/**
 * Create votes table migration
 *
 * This table stores user votes (good/bad) for content quality tracking.
 * Includes foreign key constraint to content table with CASCADE DELETE.
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('votes', table => {
    // Primary key
    table.increments('id').primary();

    // Foreign key to content table
    table.integer('content_id').unsigned().notNullable();
    table.foreign('content_id').references('id').inTable('content').onDelete('CASCADE');

    // Vote data
    table.enum('vote_type', ['good', 'bad']).notNullable();

    // Timestamp
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Optional tracking fields
    table.string('userAgent', 500).nullable();
    table.string('ipAddress', 45).nullable(); // IPv6 max length

    // Index for queries by content
    table.index('content_id', 'idx_votes_content_id');
  });
};

/**
 * Rollback migration - drop votes table
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('votes');
};
