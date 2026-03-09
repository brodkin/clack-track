/**
 * Add user_id column to votes table
 *
 * Links votes to authenticated users. Nullable to support
 * guest/anonymous votes.
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('votes', table => {
    table.integer('user_id').unsigned().nullable();
  });
};

/**
 * Rollback migration - remove user_id column
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('votes', table => {
    table.dropColumn('user_id');
  });
};
