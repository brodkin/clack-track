/**
 * Content Test CLI Command
 *
 * Tests a specific content generator by ID without sending to Vestaboard.
 * Provides dry-run functionality with validation, timing, and optional frame preview.
 */

import { ContentRegistry } from '../../content/registry/content-registry.js';
import { FrameDecorator } from '../../content/frame/frame-decorator.js';
import { log, error } from '../../utils/logger.js';
import type { GenerationContext, ContentGenerator } from '../../types/content-generator.js';
import { bootstrap } from '../../bootstrap.js';
import { validateTextContent, validateLayoutContent } from '../../utils/validators.js';
import { HomeAssistantClient } from '../../api/data-sources/home-assistant.js';
import { createAIProvider, AIProviderType } from '../../api/ai/index.js';
import type { AIProvider } from '../../types/ai.js';
import { renderAsciiPreview } from '../display.js';
import { closeKnexInstance } from '../../storage/knex.js';
import { ToolBasedGenerator } from '../../content/generators/tool-based-generator.js';

/**
 * Options for content:test command
 */
export interface ContentTestOptions {
  /** Generator ID to test (e.g., 'motivational', 'news-summary') */
  generatorId?: string;
  /** Apply frame decoration to the generated content */
  withFrame?: boolean;
}

/**
 * Test a specific content generator without sending to Vestaboard
 *
 * @param options - Command options including generatorId and withFrame flag
 *
 * @example
 * ```typescript
 * // Test motivational generator
 * await contentTestCommand({ generatorId: 'motivational' });
 *
 * // Test with frame preview
 * await contentTestCommand({ generatorId: 'motivational', withFrame: true });
 *
 * // List available generators
 * await contentTestCommand({});
 * ```
 */
export async function contentTestCommand(options: ContentTestOptions): Promise<void> {
  // Bootstrap to populate the registry with generators
  const { scheduler, haClient: bootstrapHaClient } = await bootstrap();
  // Track local HA client created for --with-frame (if any)
  let localHaClient: HomeAssistantClient | undefined;

  try {
    // Get registry singleton
    const registry = ContentRegistry.getInstance();

    // If no generator ID provided, list all available generators
    if (!options.generatorId) {
      log('\nAvailable generators:\n');
      const allGenerators = registry.getAll();

      allGenerators.forEach(registered => {
        const priority = getPriorityLabel(registered.registration.priority);
        log(
          `  ${registered.registration.id.padEnd(20)} - ${registered.registration.name} (${priority})`
        );
      });

      log(
        '\nUsage: npm run content:test <generator-id> [--with-frame]\nExample: npm run content:test motivational\n'
      );
      return;
    }

    // Look up the generator
    const registered = registry.getById(options.generatorId);

    if (!registered) {
      error(`Generator "${options.generatorId}" not found.\n`);
      log('Available generators:\n');
      const allGenerators = registry.getAll();
      allGenerators.forEach(reg => {
        log(`  ${reg.registration.id.padEnd(20)} - ${reg.registration.name}`);
      });
      process.exit(1);
      return; // TypeScript flow analysis
    }

    // Display generator info
    log(`\nTesting generator: ${registered.registration.name}`);
    log(`ID: ${registered.registration.id}`);
    log(`Priority: ${getPriorityLabel(registered.registration.priority)}\n`);

    // Create generation context
    const context: GenerationContext = {
      updateType: 'major',
      timestamp: new Date(),
    };

    // Setup AI provider for tool-based generation
    let aiProvider: AIProvider | undefined;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (anthropicKey) {
      try {
        aiProvider = createAIProvider(AIProviderType.ANTHROPIC, anthropicKey);
      } catch {
        // Fallback to OpenAI if Anthropic fails
      }
    }
    if (!aiProvider && openaiKey) {
      try {
        aiProvider = createAIProvider(AIProviderType.OPENAI, openaiKey);
      } catch {
        // Continue without AI provider
      }
    }

    // Wrap generator with ToolBasedGenerator for validation loop
    // This matches the orchestrator's behavior for consistent testing
    let generator: ContentGenerator = registered.generator;
    if (aiProvider) {
      const { toolBasedOptions } = registered.registration;
      generator = ToolBasedGenerator.wrap(registered.generator, {
        aiProvider,
        maxAttempts: toolBasedOptions?.maxAttempts ?? 3,
        exhaustionStrategy: toolBasedOptions?.exhaustionStrategy ?? 'throw',
      });
      log('Using tool-based generation (AI validation loop enabled)\n');
    } else {
      log('⚠ No AI provider configured - using legacy generation mode\n');
    }

    // Measure generation time
    const startTime = Date.now();

    // Generate content using wrapped generator
    const content = await generator.generate(context);

    const generationTime = Date.now() - startTime;

    // Display results
    log('='.repeat(60));
    log('GENERATED CONTENT');
    log('='.repeat(60));

    if (content.outputMode === 'text' && content.text) {
      log(`\n${content.text}\n`);

      // Display user prompt if available from AI generator
      if (content.metadata?.userPrompt) {
        log('='.repeat(60));
        log('USER PROMPT SENT TO LLM');
        log('='.repeat(60));
        log(`\n${content.metadata.userPrompt}\n`);
      }

      // Validation result
      const validationResult = validateTextContent(content.text);

      log('='.repeat(60));
      log('VALIDATION RESULT');
      log('='.repeat(60));
      log(`Status: ${validationResult.valid ? '✅ PASSED' : '❌ FAILED'}`);
      log(`Lines: ${validationResult.lineCount}/5`);
      log(`Max line length: ${validationResult.maxLineLength}/21`);
      log(
        `Invalid characters: ${
          validationResult.invalidChars.length === 0
            ? 'none'
            : validationResult.invalidChars.join(', ')
        }`
      );

      // Display old validation metrics section for backward compatibility
      const charCount = content.text.length;

      log('');
      log('='.repeat(60));
      log('VALIDATION METRICS');
      log('='.repeat(60));
      log(`Character count: ${charCount}`);
      log(`Line count: ${validationResult.lineCount}`);
      log(`Output mode: ${content.outputMode}`);

      // Apply frame if requested
      if (options.withFrame) {
        log('');
        log('='.repeat(60));
        log('FRAME PREVIEW');
        log('='.repeat(60));

        // Setup HA client for weather (if configured)
        const haUrl = process.env.HA_URL ?? process.env.HOME_ASSISTANT_URL;
        const haToken = process.env.HA_TOKEN ?? process.env.HOME_ASSISTANT_TOKEN;

        if (haUrl && haToken) {
          try {
            localHaClient = new HomeAssistantClient({
              url: haUrl,
              token: haToken,
              reconnection: { enabled: false },
            });
            await localHaClient.connect();
          } catch {
            log('  ⚠ Home Assistant connection failed, weather will be blank');
            localHaClient = undefined;
          }
        }

        // AI provider for color bar was already set up for tool-based generation
        // Reuse the existing aiProvider variable if available
        if (!aiProvider && openaiKey) {
          try {
            aiProvider = createAIProvider(AIProviderType.OPENAI, openaiKey);
          } catch {
            // Continue without AI provider
          }
        }

        // Create decorator with dependencies for weather and colors
        const decorator = new FrameDecorator({
          homeAssistant: localHaClient,
          aiProvider,
        });
        const frameResult = await decorator.decorate(content.text, context.timestamp);

        if (frameResult.warnings && frameResult.warnings.length > 0) {
          log('\nWarnings:');
          frameResult.warnings.forEach(warning => log(`  - ${warning}`));
        }

        log('');
        log('Frame preview:');
        console.log(renderAsciiPreview(frameResult.layout));
      }
    } else if (content.outputMode === 'layout' && content.layout) {
      log(`\nOutput mode: layout\n`);

      // Display user prompt if available from AI generator
      if (content.metadata?.userPrompt) {
        log('='.repeat(60));
        log('USER PROMPT SENT TO LLM');
        log('='.repeat(60));
        log(`\n${content.metadata.userPrompt}\n`);
      }

      // Validation result for layout mode
      const validationResult = validateLayoutContent(content.layout);

      log('='.repeat(60));
      log('VALIDATION RESULT');
      log('='.repeat(60));
      log(`Status: ${validationResult.valid ? '✅ PASSED' : '❌ FAILED'}`);
      log(`Lines: ${validationResult.lineCount}/6`);
      log(`Max line length: ${validationResult.maxLineLength}/22`);
      log(
        `Invalid characters: ${
          validationResult.invalidChars.length === 0
            ? 'none'
            : validationResult.invalidChars.join(', ')
        }`
      );

      log('\nPreview:');
      console.log(renderAsciiPreview(content.layout));
    }

    // Display timing
    log('');
    log('='.repeat(60));
    log('TIMING INFORMATION');
    log('='.repeat(60));
    log(`Generation time: ${generationTime}ms`);
    log(`Timestamp: ${context.timestamp.toISOString()}\n`);

    log('✅ Test completed successfully\n');
  } catch (err) {
    error('Failed to test content generator:', err);
    process.exit(1);
  } finally {
    // Clean shutdown - stop scheduler, disconnect HA clients, close database
    scheduler.stop();

    // Disconnect bootstrap HA client
    if (bootstrapHaClient) {
      try {
        await bootstrapHaClient.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }

    // Disconnect local HA client (if created for --with-frame)
    if (localHaClient) {
      try {
        await localHaClient.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }

    // Close database connection
    try {
      await closeKnexInstance();
    } catch {
      // Ignore database close errors
    }
  }
}

/**
 * Convert priority number to human-readable label
 */
function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 0:
      return 'P0-NOTIFICATION';
    case 2:
      return 'P2-NORMAL';
    case 3:
      return 'P3-FALLBACK';
    default:
      return `P${priority}`;
  }
}
