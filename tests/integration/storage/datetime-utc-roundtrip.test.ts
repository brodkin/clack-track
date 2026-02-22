/**
 * Integration test for MySQL DATETIME UTC round-trip correctness
 *
 * Proves that parseMySQLDateTime() correctly interprets MySQL DATETIME strings
 * ("YYYY-MM-DD HH:MM:SS") as UTC, preventing timezone offset bugs when the
 * host system runs in a non-UTC timezone (e.g., TZ=America/Los_Angeles).
 *
 * @group integration
 */

import knex, { Knex } from 'knex';
import { parseMySQLDateTime } from '@/storage/parse-datetime.js';
import { withTimezone } from '@tests/__helpers__/timezone';

describe('MySQL DATETIME UTC round-trip', () => {
  let db: Knex;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration001 = require('../../../migrations/001_create_content_table.js');

  beforeEach(async () => {
    db = knex({
      client: 'sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });
    await migration001.up(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('preserves UTC time when reading MySQL DATETIME strings under non-UTC timezone', async () => {
    // Known UTC timestamp: 2026-02-22T05:26:11.000Z
    const originalDate = new Date('2026-02-22T05:26:11.000Z');
    const mysqlFormat = originalDate.toISOString().slice(0, 19).replace('T', ' ');
    // mysqlFormat === "2026-02-22 05:26:11"

    // Insert content record using MySQL DATETIME format (no timezone indicator)
    await db('content').insert({
      text: 'Test content for datetime round-trip',
      type: 'major',
      generatedAt: mysqlFormat,
      aiProvider: 'test',
      status: 'success',
    });

    // Read back the raw value
    const row = await db('content').select('generatedAt').first();
    const rawDatetime = row.generatedAt as string;

    // Simulate reading under Pacific timezone (UTC-8)
    // Without the fix, new Date("2026-02-22 05:26:11") would be parsed as local time,
    // producing 2026-02-22T13:26:11.000Z (8 hours ahead of intended UTC)
    const parsedDate = withTimezone('America/Los_Angeles', () => {
      return parseMySQLDateTime(rawDatetime);
    });

    expect(parsedDate).toBeInstanceOf(Date);
    expect((parsedDate as Date).toISOString()).toBe('2026-02-22T05:26:11.000Z');
  });

  it('handles ISO format strings gracefully (idempotent)', () => {
    const isoString = '2026-02-22T05:26:11.000Z';
    const result = parseMySQLDateTime(isoString);

    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2026-02-22T05:26:11.000Z');
  });

  it('returns Date objects as-is (SQLite test environment may return Date objects)', () => {
    const date = new Date('2026-02-22T05:26:11.000Z');
    const result = parseMySQLDateTime(date);

    expect(result).toBe(date);
    expect(result.toISOString()).toBe('2026-02-22T05:26:11.000Z');
  });

  it('returns null for null input', () => {
    const result = parseMySQLDateTime(null);
    expect(result).toBeNull();
  });

  it('returns undefined for undefined input', () => {
    const result = parseMySQLDateTime(undefined);
    expect(result).toBeUndefined();
  });
});
