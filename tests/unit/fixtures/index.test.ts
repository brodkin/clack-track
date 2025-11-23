/**
 * Fixture Index Exports Test
 *
 * Validates that the fixture index file exports all necessary test data
 * and that they can be imported through the convenience index.
 */

import { openaiResponses, anthropicResponses } from '@tests/fixtures';

describe('Fixture Index Exports', () => {
  test('should export openaiResponses', () => {
    expect(openaiResponses).toBeDefined();
    expect(openaiResponses).toHaveProperty('chatCompletion');
    expect(openaiResponses).toHaveProperty('errors');
    expect(openaiResponses).toHaveProperty('models');
    expect(openaiResponses).toHaveProperty('contentExamples');
  });

  test('should export anthropicResponses', () => {
    expect(anthropicResponses).toBeDefined();
    expect(anthropicResponses).toHaveProperty('message');
    expect(anthropicResponses).toHaveProperty('errors');
    expect(anthropicResponses).toHaveProperty('models');
    expect(anthropicResponses).toHaveProperty('contentExamples');
  });

  test('openaiResponses should be the same as direct import', () => {
    // This validates that the index export is correctly re-exporting the JSON
    expect(openaiResponses.chatCompletion.success.model).toBe('gpt-4-0613');
  });

  test('anthropicResponses should be the same as direct import', () => {
    // This validates that the index export is correctly re-exporting the JSON
    expect(anthropicResponses.message.success.model).toContain('claude');
  });
});
