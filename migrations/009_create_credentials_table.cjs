/**
 * Create credentials table migration
 *
 * This table stores WebAuthn credentials (passkeys) for passwordless authentication:
 * - Links to users table via user_id (CASCADE DELETE)
 * - credential_id: Base64-encoded WebAuthn credential identifier (unique for auth lookup)
 * - public_key: Base64-encoded COSE public key for signature verification
 * - counter: Signature counter for replay attack prevention
 * - device_type: Platform (built-in) or cross-platform (security key)
 * - name: Human-readable identifier for the credential
 * - Timestamps for auditing and last-used tracking
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('credentials', table => {
    // Primary key
    table.increments('id').primary();

    // Foreign key to users table (required - every credential belongs to a user)
    table.integer('user_id').unsigned().notNullable();
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // WebAuthn credential identifier (base64 encoded)
    // Unique constraint enables fast lookup during authentication
    // Use string (VARCHAR) instead of text for columns with unique constraints (MySQL compatibility)
    table.string('credential_id', 512).unique().notNullable();

    // WebAuthn public key (base64 encoded COSE key)
    // Text type for potentially long base64-encoded keys
    table.text('public_key').notNullable();

    // Signature counter for replay attack prevention
    // Incremented on each successful authentication
    table.integer('counter').unsigned().notNullable().defaultTo(0);

    // Device type (platform = built-in like Touch ID, cross-platform = security key like YubiKey)
    table.string('device_type', 50).nullable();

    // Human-readable name for the credential (e.g., "MacBook Touch ID", "YubiKey 5")
    table.string('name', 255).nullable();

    // Audit timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('last_used_at').nullable();

    // Indexes for common queries
    table.index('user_id', 'idx_credentials_user_id');
    table.index('credential_id', 'idx_credentials_credential_id');
  });
};

/**
 * Rollback migration - drop credentials table
 *
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('credentials');
};
