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
import homeAssistantResponsesData from './home-assistant-responses.json';

/**
 * OpenAI API response fixtures for testing
 *
 * Includes successful responses, error responses, model lists,
 * and content examples for various use cases.
 */
export const openaiResponses = openaiResponsesData;
export const openaiFixtures = openaiResponsesData;

/**
 * Anthropic API response fixtures for testing
 *
 * Includes successful messages, error responses, model validation,
 * and content examples for various use cases.
 */
export const anthropicResponses = anthropicResponsesData;
export const anthropicFixtures = anthropicResponsesData;

/**
 * Home Assistant WebSocket response fixtures for testing
 *
 * Includes auth messages, entity states, events, service call responses,
 * and error responses for various scenarios.
 */
export const homeAssistantResponses = homeAssistantResponsesData;
export const homeAssistantFixtures = homeAssistantResponsesData;
