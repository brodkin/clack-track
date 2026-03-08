/**
 * Add reason column to votes table
 *
 * This migration adds a nullable reason column to the votes table,
 * allowing users to provide a short explanation for their vote
 * (e.g., "boring", "repetitive", "inappropriate").
 *
 * The column is nullable to maintain backward compatibility with
 * existing votes that were submitted without a reason.
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('votes', table => {
    // Optional short reason for the vote (e.g., "boring", "repetitive")
    table.string('reason', 50).nullable();
  });
};

/**
 * Rollback migration - remove reason column
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('votes', table => {
    table.dropColumn('reason');
  });
};
