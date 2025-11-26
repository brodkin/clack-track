/**
 * CLI command to generate and preview Vestaboard frames
 */

import { generateFrame } from '../../content/frame/index.js';
import { codeToColorName } from '../../api/vestaboard/character-converter.js';
import { HomeAssistantClient } from '../../api/data-sources/home-assistant.js';
import { createAIProvider, AIProviderType } from '../../api/ai/index.js';
import type { AIProvider } from '../../types/index.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  // Background colors for Vestaboard color preview
  bgRed: '\x1b[41m',
  bgOrange: '\x1b[48;5;208m',
  bgYellow: '\x1b[43m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
  bgViolet: '\x1b[45m',
  bgWhite: '\x1b[47m',
};

export interface FrameCommandOptions {
  text?: string;
  skipWeather?: boolean;
  skipColors?: boolean;
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
    });

    // Display warnings
    if (result.warnings.length > 0) {
      console.log(`${colors.yellow}Warnings:${colors.reset}`);
      for (const warning of result.warnings) {
        console.log(`  ⚠ ${warning}`);
      }
      console.log('');
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

function renderAsciiPreview(layout: number[][]): string {
  const lines: string[] = [];

  // Top border
  lines.push('┌' + '─'.repeat(22) + '┐');

  // Content rows
  for (const row of layout) {
    let line = '│';
    for (const code of row) {
      line += renderCharCode(code);
    }
    line += '│';
    lines.push(line);
  }

  // Bottom border
  lines.push('└' + '─'.repeat(22) + '┘');

  return lines.join('\n');
}

function renderCharCode(code: number): string {
  // Check if this is a color code (63-69)
  const colorName = codeToColorName(code);
  if (colorName) {
    return renderColorBlock(colorName);
  }

  // Regular character - convert code back to char
  return codeToChar(code);
}

function renderColorBlock(colorName: string): string {
  const bgColors: Record<string, string> = {
    RED: colors.bgRed,
    ORANGE: colors.bgOrange,
    YELLOW: colors.bgYellow,
    GREEN: colors.bgGreen,
    BLUE: colors.bgBlue,
    VIOLET: colors.bgViolet,
    WHITE: colors.bgWhite,
  };

  const bg = bgColors[colorName] ?? '';
  return `${bg} ${colors.reset}`;
}

function codeToChar(code: number): string {
  // Map Vestaboard codes back to characters
  if (code === 0) return ' ';
  if (code >= 1 && code <= 26) return String.fromCharCode(64 + code); // A-Z
  if (code >= 27 && code <= 36) return String.fromCharCode(code === 36 ? 48 : 48 + code - 26); // 0-9
  // Punctuation and special chars would need more mapping
  return '?';
}
