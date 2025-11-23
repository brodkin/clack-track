/**
 * Test Fixtures Index
 *
 * Central export point for all test fixture data.
 * Import fixtures from this index for convenience.
 *
 * @example
 * ```typescript
 * import { openaiResponses, anthropicResponses } from '@tests/fixtures';
 * ```
 */

import openaiResponsesData from './openai-responses.json';
import anthropicResponsesData from './anthropic-responses.json';

/**
 * OpenAI API response fixtures for testing
 *
 * Includes successful responses, error responses, model lists,
 * and content examples for various use cases.
 */
export const openaiResponses = openaiResponsesData;

/**
 * Anthropic API response fixtures for testing
 *
 * Includes successful messages, error responses, model validation,
 * and content examples for various use cases.
 */
export const anthropicResponses = anthropicResponsesData;
