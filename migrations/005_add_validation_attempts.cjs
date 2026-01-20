/**
 * Add validation attempts tracking to content table
 *
 * This migration adds columns to track LLM tool-based content submission attempts:
 * - validationAttempts: Number of times content was submitted before passing validation
 * - rejectionReasons: JSON array of rejection details per failed attempt
 *
 * These columns enable debugging and analytics for tool-based content generation
 * where LLMs may submit content multiple times until it passes validation.
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('content', table => {
    // Track number of validation attempts before success
    // Default 0 means first attempt succeeded (or legacy record)
    table.integer('validationAttempts').nullable().defaultTo(0);

    // JSON array of rejection reasons per failed attempt
    // Each entry: { attempt: number, reason: string, timestamp?: string }
    table.json('rejectionReasons').nullable();
  });
};

/**
 * Rollback migration - remove validation attempts columns
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('content', table => {
    table.dropColumn('validationAttempts');
    table.dropColumn('rejectionReasons');
  });
};
