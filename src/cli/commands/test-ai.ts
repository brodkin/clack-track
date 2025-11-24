/**
 * test-ai CLI Command
 *
 * Tests AI provider connectivity and basic generation functionality.
 * Supports testing OpenAI, Anthropic, or both providers.
 *
 * @module cli/commands/test-ai
 */

import { createAIProvider, AIProviderType } from '../../api/ai/index.js';
import type { AIProvider, AIGenerationResponse } from '../../types/ai.js';

/**
 * Options for the test-ai command
 */
export interface TestAIOptions {
  /**
   * AI provider to test: 'openai', 'anthropic', or 'all'
   * @default 'all'
   */
  provider?: string;

  /**
   * Enable interactive mode for custom prompts
   * @default false
   */
  interactive?: boolean;

  /**
   * Custom prompt to use (only used in interactive mode)
   */
  customPrompt?: string;
}

/**
 * Provider configuration for testing
 */
interface ProviderConfig {
  type: AIProviderType;
  name: string;
  envVar: string;
}

/**
 * Valid provider names
 */
const VALID_PROVIDERS = ['openai', 'anthropic', 'all'] as const;

/**
 * Default test prompts
 */
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant for testing AI connectivity.';
const DEFAULT_USER_PROMPT =
  'Hello! This is a connectivity test. Please respond with a brief confirmation message.';

/**
 * Test AI provider connectivity and basic generation
 *
 * This command validates that AI providers are properly configured and can:
 * 1. Establish a connection using API credentials
 * 2. Generate content responses
 * 3. Return proper metrics (tokens, model info, etc.)
 *
 * @param options - Command configuration options
 * @returns Promise that resolves when testing is complete
 *
 * @example
 * ```typescript
 * // Test all providers
 * await testAICommand({ provider: 'all' });
 *
 * // Test specific provider
 * await testAICommand({ provider: 'openai' });
 *
 * // Test with custom prompt
 * await testAICommand({
 *   provider: 'anthropic',
 *   interactive: true,
 *   customPrompt: 'Tell me a joke'
 * });
 * ```
 */
export async function testAICommand(options: TestAIOptions): Promise<void> {
  const { provider = 'all', interactive = false, customPrompt } = options;

  // Validate provider selection
  type ValidProvider = (typeof VALID_PROVIDERS)[number];
  const validProviderNames = [...VALID_PROVIDERS];
  if (!validProviderNames.includes(provider as ValidProvider)) {
    console.error(
      `Error: Invalid provider "${provider}". Must be one of: ${validProviderNames.join(', ')}`
    );
    return;
  }

  // Determine which providers to test
  const providersToTest = getProvidersToTest(provider);

  console.log('\n🔍 AI Provider Connectivity Test\n');

  // Test each provider sequentially
  for (const providerInfo of providersToTest) {
    await testProvider(providerInfo, interactive, customPrompt);
  }

  console.log('\n✅ Testing complete\n');
}

/**
 * Get list of providers to test based on user selection
 *
 * @param provider - Provider selection ('openai', 'anthropic', or 'all')
 * @returns Array of provider configurations to test
 */
function getProvidersToTest(provider: string): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  if (provider === 'all' || provider === 'openai') {
    providers.push({
      type: AIProviderType.OPENAI,
      name: 'OpenAI',
      envVar: 'OPENAI_API_KEY',
    });
  }

  if (provider === 'all' || provider === 'anthropic') {
    providers.push({
      type: AIProviderType.ANTHROPIC,
      name: 'Anthropic',
      envVar: 'ANTHROPIC_API_KEY',
    });
  }

  return providers;
}

/**
 * Test a single AI provider
 *
 * Performs comprehensive testing including:
 * - API key validation
 * - Connection test
 * - Content generation test
 * - Performance metrics
 *
 * @param providerInfo - Provider configuration
 * @param interactive - Whether interactive mode is enabled (unused but kept for future features)
 * @param customPrompt - Optional custom prompt for testing
 */
async function testProvider(
  providerInfo: ProviderConfig,
  interactive: boolean,
  customPrompt?: string
): Promise<void> {
  const { type, name, envVar } = providerInfo;

  console.log(`\n━━━ Testing ${name} ━━━`);

  // Validate API key is available
  const apiKey = process.env[envVar];
  if (!apiKey) {
    console.error(`✗ Error: API key not found`);
    console.error(`  Please set ${envVar} environment variable`);
    return;
  }

  try {
    // Create provider instance using factory
    const provider = createAIProvider(type, apiKey);

    // Step 1: Test connection
    await testConnection(provider);

    // Step 2: Test content generation
    await testGeneration(provider, customPrompt);
  } catch (error) {
    handleProviderError(error, name);
  }
}

/**
 * Test provider connection
 *
 * @param provider - AI provider instance
 */
async function testConnection(provider: AIProvider): Promise<void> {
  console.log('\n1. Testing connection...');
  const startTime = Date.now();
  const isValid = await provider.validateConnection();
  const duration = Date.now() - startTime;

  if (isValid) {
    console.log(`   ✓ Connection successful (${duration}ms)`);
  } else {
    console.log(`   ✗ Connection failed`);
    throw new Error('Connection validation failed');
  }
}

/**
 * Test content generation
 *
 * @param provider - AI provider instance
 * @param customPrompt - Optional custom prompt
 */
async function testGeneration(provider: AIProvider, customPrompt?: string): Promise<void> {
  console.log('\n2. Testing content generation...');
  const startTime = Date.now();

  const userPrompt = customPrompt || DEFAULT_USER_PROMPT;

  const response = await provider.generate({
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPrompt,
  });

  const duration = Date.now() - startTime;

  // Display results
  console.log(`   ✓ Generation successful (${duration}ms)`);
  displayGenerationMetrics(response);
  displayGenerationResponse(response.text);
}

/**
 * Display generation metrics
 *
 * @param response - AI generation response
 */
function displayGenerationMetrics(response: AIGenerationResponse): void {
  console.log(`\n   Model: ${response.model}`);
  console.log(`   Tokens: ${response.tokensUsed ?? 0}`);
  console.log(`   Finish Reason: ${response.finishReason ?? 'unknown'}`);
}

/**
 * Display formatted generation response
 *
 * @param text - Response text to display
 */
function displayGenerationResponse(text: string): void {
  console.log(`\n   Response:`);
  console.log(`   ┌─────────────────────────────────────────`);

  const lines = text.split('\n');
  lines.forEach(line => {
    console.log(`   │ ${line}`);
  });

  console.log(`   └─────────────────────────────────────────`);
}

/**
 * Handle provider testing errors
 *
 * @param error - Error object
 * @param name - Provider name
 */
function handleProviderError(error: unknown, name: string): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`✗ Error testing ${name}:`);
  console.error(`  ${errorMessage}`);
}
