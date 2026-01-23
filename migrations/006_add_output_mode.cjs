/**
 * Add outputMode column to content table
 *
 * This migration adds a column to track whether content needs frame decoration:
 * - 'text': Content needs frame decoration (time/weather bar)
 * - 'layout': Raw characterCodes, displayed as-is (e.g., sleep mode art)
 * - null: Legacy records (treat as 'text' for backwards compatibility)
 *
 * The outputMode enables the frontend to determine how to render content
 * in the VestaboardPreview component.
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('content', table => {
    // Output mode determines frame decoration behavior
    // VARCHAR allows 'text', 'layout', or null for backwards compatibility
    // Default to 'text' for new records (standard content with frame)
    table.string('outputMode', 20).nullable().defaultTo('text');
  });
};

/**
 * Rollback migration - remove outputMode column
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('content', table => {
    table.dropColumn('outputMode');
  });
};
