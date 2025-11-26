import { charToCode, wrapText, COLOR_CODES } from '../../api/vestaboard/character-converter.js';
import { formatInfoBar } from './info-bar.js';
import { ColorBarService, FALLBACK_COLORS } from './color-bar.js';
import { WeatherService, type WeatherData } from '../../services/weather-service.js';
import type { HomeAssistantClient } from '../../api/data-sources/home-assistant.js';
import type { AIProvider } from '../../types/ai.js';

export interface FrameOptions {
  text: string;
  homeAssistant?: HomeAssistantClient;
  aiProvider?: AIProvider;
  dateTime?: Date; // For testing - defaults to new Date()
}

export interface FrameResult {
  layout: number[][]; // 6 rows × 22 columns
  warnings: string[];
}

/**
 * Generate a complete 6×22 Vestaboard frame.
 *
 * Layout:
 * - Rows 0-4: Content text (21 chars) + Color bar (1 char)
 * - Row 5: Info bar (21 chars) + Color bar (1 char)
 *
 * @param options - Frame generation options
 * @returns Complete frame layout with any warnings
 */
export async function generateFrame(options: FrameOptions): Promise<FrameResult> {
  const warnings: string[] = [];

  // 1. Process and validate text content
  const { lines, contentWarnings } = processContent(options.text);
  warnings.push(...contentWarnings);

  // 2. Fetch weather data (graceful failure)
  let weatherData: WeatherData | null = null;
  if (options.homeAssistant) {
    try {
      const weatherService = new WeatherService(options.homeAssistant);
      weatherData = await weatherService.getWeather();
    } catch (error) {
      warnings.push(
        'Weather unavailable: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  // 3. Fetch seasonal colors (graceful failure)
  let colorBar: number[] = FALLBACK_COLORS;
  if (options.aiProvider) {
    try {
      const colorService = new ColorBarService(options.aiProvider);
      colorBar = await colorService.getColors();
    } catch (error) {
      warnings.push(
        'Color bar unavailable: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  // 4. Generate info bar
  const infoBar = formatInfoBar({
    weatherData: weatherData ?? undefined,
    dateTime: options.dateTime,
  });

  // 5. Compose the complete 6×22 layout
  const layout = composeLayout(lines, infoBar, colorBar);

  return { layout, warnings };
}

interface ContentResult {
  lines: string[]; // 5 lines, each exactly 21 chars
  contentWarnings: string[];
}

/**
 * Process text content: validate characters, word wrap, pad/trim lines.
 */
function processContent(text: string): ContentResult {
  const warnings: string[] = [];
  const MAX_ROWS = 5;
  const MAX_COLS = 21;

  // Find and warn about unsupported characters
  const { sanitized, unsupported } = sanitizeText(text);
  if (unsupported.length > 0) {
    warnings.push(`Unsupported characters replaced with space: ${unsupported.join(', ')}`);
  }

  // Word wrap the sanitized text
  const wrappedLines = wrapText(sanitized, MAX_COLS);

  // Limit to 5 rows, pad each to exactly 21 chars
  const lines: string[] = [];
  for (let i = 0; i < MAX_ROWS; i++) {
    const line = wrappedLines[i] ?? '';
    lines.push(line.padEnd(MAX_COLS, ' ').substring(0, MAX_COLS));
  }

  // Warn if content was truncated
  if (wrappedLines.length > MAX_ROWS) {
    warnings.push(`Content truncated: ${wrappedLines.length} lines reduced to ${MAX_ROWS}`);
  }

  return { lines, contentWarnings: warnings };
}

interface SanitizeResult {
  sanitized: string;
  unsupported: string[];
}

/**
 * Sanitize text by replacing unsupported characters with spaces.
 */
function sanitizeText(text: string): SanitizeResult {
  const upperText = text.toUpperCase();
  const unsupported: string[] = [];
  let sanitized = '';

  for (const char of upperText) {
    const code = charToCode(char);
    if (code === 0 && char !== ' ' && char !== '\n') {
      // Character not supported (returned 0 which is space code)
      if (!unsupported.includes(char)) {
        unsupported.push(char);
      }
      sanitized += ' ';
    } else {
      sanitized += char;
    }
  }

  return { sanitized, unsupported };
}

/**
 * Compose the complete 6×22 layout from content, info bar, and color bar.
 */
function composeLayout(contentLines: string[], infoBar: number[], colorBar: number[]): number[][] {
  const layout: number[][] = [];

  // Rows 0-4: Content + color bar
  for (let row = 0; row < 5; row++) {
    const rowCodes: number[] = [];
    const line = contentLines[row];

    // Columns 0-20: Content characters
    for (let col = 0; col < 21; col++) {
      rowCodes.push(charToCode(line[col] ?? ' '));
    }

    // Column 21: Color bar
    rowCodes.push(colorBar[row] ?? COLOR_CODES.WHITE);

    layout.push(rowCodes);
  }

  // Row 5: Info bar + color bar
  const infoRow: number[] = [...infoBar];
  // Ensure exactly 21 info bar codes
  while (infoRow.length < 21) {
    infoRow.push(0); // Space
  }
  // Add color bar for row 5
  infoRow.push(colorBar[5] ?? COLOR_CODES.WHITE);
  layout.push(infoRow);

  return layout;
}
