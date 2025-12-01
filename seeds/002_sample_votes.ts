import { Knex } from 'knex';

/**
 * Seed file for sample votes data
 *
 * Provides sample votes referencing content records.
 * Includes mix of 'good' and 'bad' votes for quality tracking.
 *
 * DEPENDENCIES: Must run after 001_sample_content.ts
 */

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries (for clean, idempotent seeding)
  await knex('votes').del();

  // Sample votes referencing content IDs from 001_sample_content.ts
  await knex('votes').insert([
    {
      content_id: 1, // Motivational quote - Steve Jobs
      vote_type: 'good',
      created_at: new Date('2025-11-28T10:35:00Z'),
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      ipAddress: '192.168.1.100',
    },
    {
      content_id: 1, // Motivational quote - another positive vote
      vote_type: 'good',
      created_at: new Date('2025-11-28T10:42:00Z'),
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      ipAddress: '192.168.1.105',
    },
    {
      content_id: 2, // Weather update - positive vote
      vote_type: 'good',
      created_at: new Date('2025-11-28T14:10:00Z'),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ipAddress: '192.168.1.110',
    },
    {
      content_id: 3, // News summary - mixed reaction
      vote_type: 'bad',
      created_at: new Date('2025-11-28T16:50:00Z'),
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      ipAddress: '192.168.1.115',
    },
    {
      content_id: 3, // News summary - another negative vote
      vote_type: 'bad',
      created_at: new Date('2025-11-28T17:05:00Z'),
      userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0',
      ipAddress: '192.168.1.120',
    },
    {
      content_id: 4, // Door notification - positive vote
      vote_type: 'good',
      created_at: new Date('2025-11-28T15:30:00Z'),
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      ipAddress: '192.168.1.100',
    },
    {
      content_id: 5, // Fallback error content - negative vote
      vote_type: 'bad',
      created_at: new Date('2025-11-28T18:05:00Z'),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ipAddress: '192.168.1.125',
    },
    {
      content_id: 6, // Minor update - positive vote
      vote_type: 'good',
      created_at: new Date('2025-11-28T12:15:00Z'),
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      ipAddress: '192.168.1.130',
    },
  ]);
}
