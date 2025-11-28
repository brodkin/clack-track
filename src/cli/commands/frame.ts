/**
 * CLI command to generate and preview Vestaboard frames
 */

import { generateFrame } from '../../content/frame/index.js';
import { HomeAssistantClient } from '../../api/data-sources/home-assistant.js';
import { createAIProvider, AIProviderType } from '../../api/ai/index.js';
import type { AIProvider } from '../../types/index.js';
import { renderAsciiPreview, terminalColors as colors } from '../display.js';

export interface FrameCommandOptions {
  text?: string;
  skipWeather?: boolean;
  skipColors?: boolean;
  verbose?: boolean;
}

/**
 * Generate and preview a Vestaboard frame.
 *
 * Usage:
 *   npm run frame "Your message here"
 *   npm run frame -- --skip-weather "Test without HA"
 *   npm run frame -- --skip-colors "Test without AI"
 */
export async function frameCommand(options: FrameCommandOptions): Promise<void> {
  const text = options.text ?? 'HELLO WORLD';

  console.log('\n📺 Vestaboard Frame Generator\n');
  console.log(`Input: "${text}"\n`);

  // Setup clients based on options and environment
  let haClient: HomeAssistantClient | undefined;
  let aiProvider: AIProvider | undefined;

  if (!options.skipWeather) {
    haClient = await setupHomeAssistant();
  }

  if (!options.skipColors) {
    aiProvider = setupAIProvider();
  }

  try {
    // Generate the frame
    const result = await generateFrame({
      text,
      homeAssistant: haClient,
      aiProvider,
      debug: options.verbose,
    });

    // Display warnings
    if (result.warnings.length > 0) {
      console.log(`${colors.yellow}Warnings:${colors.reset}`);
      for (const warning of result.warnings) {
        console.log(`  ⚠ ${warning}`);
      }
      console.log('');
    }

    // Display timing when verbose is enabled and timing data exists
    if (options.verbose && result.timing) {
      console.log('\nTiming:');
      for (const entry of result.timing) {
        const cacheStatus =
          entry.cacheHit !== undefined ? ` [CACHE ${entry.cacheHit ? 'HIT' : 'MISS'}]` : '';
        const prefix = entry === result.timing[result.timing.length - 1] ? '└─' : '├─';
        console.log(
          `${prefix} ${entry.operation}${cacheStatus} ... ${entry.durationMs.toLocaleString()}ms`
        );
      }
      console.log(`Total: ${result.totalMs?.toLocaleString()}ms\n`);
    }

    // Display ASCII preview
    console.log('Preview:');
    console.log(renderAsciiPreview(result.layout));

    console.log(`\n${colors.green}✓${colors.reset} Frame generated successfully\n`);
  } finally {
    // Cleanup
    if (haClient) {
      try {
        await haClient.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
  }
}

async function setupHomeAssistant(): Promise<HomeAssistantClient | undefined> {
  const url = process.env.HA_URL ?? process.env.HOME_ASSISTANT_URL;
  const token = process.env.HA_TOKEN ?? process.env.HOME_ASSISTANT_TOKEN;

  if (!url || !token) {
    console.log(`${colors.dim}ℹ No Home Assistant configured, skipping weather${colors.reset}`);
    return undefined;
  }

  try {
    // HomeAssistantClient uses home-assistant-js-websocket which expects the base HTTP URL
    // The library's createLongLivedTokenAuth internally constructs the websocket URL
    const client = new HomeAssistantClient({
      url,
      token,
      reconnection: { enabled: false },
    });
    await client.connect();
    return client;
  } catch {
    console.log(
      `${colors.yellow}⚠${colors.reset} Home Assistant connection failed, skipping weather`
    );
    return undefined;
  }
}

function setupAIProvider(): AIProvider | undefined {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (anthropicKey) {
    try {
      return createAIProvider(AIProviderType.ANTHROPIC, anthropicKey);
    } catch {
      console.log(`${colors.yellow}⚠${colors.reset} Anthropic setup failed`);
    }
  }

  if (openaiKey) {
    try {
      return createAIProvider(AIProviderType.OPENAI, openaiKey);
    } catch {
      console.log(`${colors.yellow}⚠${colors.reset} OpenAI setup failed`);
    }
  }

  console.log(`${colors.dim}ℹ No AI provider configured, using fallback colors${colors.reset}`);
  return undefined;
}
