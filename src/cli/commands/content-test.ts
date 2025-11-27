/**
 * Content Test CLI Command
 *
 * Tests a specific content generator by ID without sending to Vestaboard.
 * Provides dry-run functionality with validation, timing, and optional frame preview.
 */

import { ContentRegistry } from '../../content/registry/content-registry.js';
import { FrameDecorator } from '../../content/frame/frame-decorator.js';
import { log, error } from '../../utils/logger.js';
import type { GenerationContext } from '../../types/content-generator.js';
import { bootstrap } from '../../bootstrap.js';
import { HomeAssistantClient } from '../../api/data-sources/home-assistant.js';
import { createAIProvider, AIProviderType } from '../../api/ai/index.js';
import type { AIProvider } from '../../types/ai.js';

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
  const { scheduler } = await bootstrap();

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

    // Measure generation time
    const startTime = Date.now();

    // Generate content
    const content = await registered.generator.generate(context);

    const generationTime = Date.now() - startTime;

    // Display results
    log('='.repeat(60));
    log('GENERATED CONTENT');
    log('='.repeat(60));

    if (content.outputMode === 'text' && content.text) {
      log(`\n${content.text}\n`);

      // Validation metrics
      const charCount = content.text.length;
      const lineCount = content.text.split('\n').length;

      log('='.repeat(60));
      log('VALIDATION METRICS');
      log('='.repeat(60));
      log(`Character count: ${charCount}`);
      log(`Line count: ${lineCount}`);
      log(`Output mode: ${content.outputMode}`);

      // Apply frame if requested
      if (options.withFrame) {
        log('\n' + '='.repeat(60));
        log('FRAME PREVIEW');
        log('='.repeat(60));

        // Setup HA client for weather (if configured)
        let haClient: HomeAssistantClient | undefined;
        const haUrl = process.env.HA_URL ?? process.env.HOME_ASSISTANT_URL;
        const haToken = process.env.HA_TOKEN ?? process.env.HOME_ASSISTANT_TOKEN;

        if (haUrl && haToken) {
          try {
            haClient = new HomeAssistantClient({
              url: haUrl,
              token: haToken,
              reconnection: { enabled: false },
            });
            await haClient.connect();
          } catch {
            log('  ⚠ Home Assistant connection failed, weather will be blank');
            haClient = undefined;
          }
        }

        // Setup AI provider for color bar (if configured)
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

        // Create decorator with dependencies for weather and colors
        const decorator = new FrameDecorator({
          homeAssistant: haClient,
          aiProvider,
        });
        const frameResult = await decorator.decorate(content.text, context.timestamp);

        if (frameResult.warnings && frameResult.warnings.length > 0) {
          log('\nWarnings:');
          frameResult.warnings.forEach(warning => log(`  - ${warning}`));
        }

        log('\nFrame layout (6x22):');
        log(JSON.stringify(frameResult.layout, null, 2));
      }
    } else if (content.outputMode === 'layout' && content.layout) {
      log(`\nOutput mode: layout\n`);
      log('Layout:');
      log(JSON.stringify(content.layout, null, 2));
    }

    // Display timing
    log('\n' + '='.repeat(60));
    log('TIMING INFORMATION');
    log('='.repeat(60));
    log(`Generation time: ${generationTime}ms`);
    log(`Timestamp: ${context.timestamp.toISOString()}\n`);

    log('✅ Test completed successfully\n');
  } catch (err) {
    error('Failed to test content generator:', err);
    process.exit(1);
  } finally {
    // Clean shutdown - stop scheduler
    scheduler.stop();
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
