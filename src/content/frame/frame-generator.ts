import { charToCode, wrapText, COLOR_CODES } from '../../api/vestaboard/character-converter.js';
import { formatInfoBar } from './info-bar.js';
import { ColorBarService, FALLBACK_COLORS } from './color-bar.js';
import { WeatherService, type WeatherData } from '../../services/weather-service.js';
import type { HomeAssistantClient } from '../../api/data-sources/home-assistant.js';
import type { AIProvider } from '../../types/ai.js';
import type { GeneratorFormatOptions } from '../../types/content-generator.js';

export interface FrameOptions {
  text: string;
  homeAssistant?: HomeAssistantClient;
  aiProvider?: AIProvider;
  dateTime?: Date; // For testing - defaults to new Date()
  debug?: boolean; // Enable timing output
  weather?: WeatherData; // Pre-fetched weather data (skips fetch if provided)
  colorBar?: number[]; // Pre-fetched color bar (skips fetch if provided)
  formatOptions?: GeneratorFormatOptions; // Optional formatting options from generator registration
}

export interface TimingEntry {
  operation: string;
  durationMs: number;
  cacheHit?: boolean; // Only for ColorBarService
}

export interface FrameResult {
  layout: number[][]; // 6 rows × 22 columns
  warnings: string[];
  timing?: TimingEntry[]; // Only present when debug: true
  totalMs?: number; // Only present when debug: true
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
  const startTime = performance.now();
  const warnings: string[] = [];
  const timing: TimingEntry[] = [];

  // 1. Process and validate text content
  const { lines, contentWarnings } = processContent(options.text);
  warnings.push(...contentWarnings);

  // 2. Fetch weather data (graceful failure) - skip if pre-fetched data provided
  let weatherData: WeatherData | null = null;
  if (options.weather) {
    // Use pre-fetched weather data
    weatherData = options.weather;
  } else if (options.homeAssistant) {
    // Fetch weather if not pre-fetched
    try {
      const weatherService = new WeatherService(options.homeAssistant);
      const weatherStart = performance.now();
      weatherData = await weatherService.getWeather();
      const weatherDuration = Math.round(performance.now() - weatherStart);

      if (options.debug) {
        timing.push({
          operation: 'WeatherService.getWeather()',
          durationMs: weatherDuration,
        });
      }
    } catch (error) {
      warnings.push(
        'Weather unavailable: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  // 3. Fetch seasonal colors (graceful failure) - skip if pre-fetched data provided
  let colorBar: number[] = FALLBACK_COLORS;
  if (options.colorBar) {
    // Use pre-fetched color bar
    colorBar = options.colorBar;
  } else if (options.aiProvider) {
    // Fetch colors if not pre-fetched
    try {
      const colorService = ColorBarService.getInstance(options.aiProvider);
      const colorStart = performance.now();
      const colorResult = await colorService.getColors();
      const colorDuration = Math.round(performance.now() - colorStart);

      colorBar = colorResult.colors;

      if (options.debug) {
        timing.push({
          operation: 'ColorBarService.getColors()',
          durationMs: colorDuration,
          cacheHit: colorResult.cacheHit,
        });
      }
    } catch (error) {
      warnings.push(
        'Color bar unavailable: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  // 4. Generate info bar
  const infoBarStart = performance.now();
  const infoBar = formatInfoBar({
    weatherData: weatherData ?? undefined,
    dateTime: options.dateTime,
  });
  const infoBarDuration = Math.round(performance.now() - infoBarStart);

  if (options.debug) {
    timing.push({
      operation: 'Format info bar',
      durationMs: infoBarDuration,
    });
  }

  // 5. Compose the complete 6×22 layout
  const layoutStart = performance.now();
  const layout = composeLayout(lines, infoBar, colorBar);
  const layoutDuration = Math.round(performance.now() - layoutStart);

  if (options.debug) {
    timing.push({
      operation: 'Frame assembled',
      durationMs: layoutDuration,
    });
  }

  const totalMs = Math.round(performance.now() - startTime);

  // Return with optional timing data
  if (options.debug) {
    return { layout, warnings, timing, totalMs };
  }

  return { layout, warnings };
}

interface ContentResult {
  lines: string[]; // 5 lines, each exactly 21 chars
  contentWarnings: string[];
}

/**
 * Process text content: validate characters, word wrap, pad/trim lines, vertically center.
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

  // Determine actual content lines (capped at MAX_ROWS)
  const contentLineCount = Math.min(wrappedLines.length, MAX_ROWS);

  // Calculate vertical centering padding
  const topPadding = Math.floor((MAX_ROWS - contentLineCount) / 2);

  // Build lines array with vertical centering
  const lines: string[] = [];
  const emptyLine = ' '.repeat(MAX_COLS);

  // Add top padding (blank rows)
  for (let i = 0; i < topPadding; i++) {
    lines.push(emptyLine);
  }

  // Add content lines
  for (let i = 0; i < contentLineCount; i++) {
    const line = wrappedLines[i] ?? '';
    lines.push(line.padEnd(MAX_COLS, ' ').substring(0, MAX_COLS));
  }

  // Add bottom padding to reach MAX_ROWS
  while (lines.length < MAX_ROWS) {
    lines.push(emptyLine);
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
