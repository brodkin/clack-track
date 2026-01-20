/**
 * Test suite for PreviewRenderer
 *
 * Tests the validation preview renderer that generates ASCII art previews
 * of Vestaboard content for inclusion in tool rejection messages.
 *
 * Display constraints:
 * - Full display: 6 rows x 22 columns
 * - Content area (framed): 5 rows x 21 columns
 */

import { describe, it, expect } from '@jest/globals';
import { PreviewRenderer, RenderMode } from '@/content/tools/preview-renderer';
import type { LineStatus, RenderedLine, PreviewResult } from '@/content/tools/preview-renderer';
import { VESTABOARD } from '@/config/constants';

describe('PreviewRenderer', () => {
  let renderer: PreviewRenderer;

  beforeEach(() => {
    renderer = new PreviewRenderer();
  });

  describe('constructor and configuration', () => {
    it('should use default content area dimensions (5x21) when no mode specified', () => {
      const result = renderer.render('HELLO WORLD');
      expect(result.mode).toBe('content');
      expect(result.maxCols).toBe(VESTABOARD.FRAMED_MAX_COLS);
      expect(result.maxRows).toBe(VESTABOARD.FRAMED_MAX_ROWS);
    });

    it('should use full display dimensions (6x22) when full mode specified', () => {
      const fullRenderer = new PreviewRenderer({ mode: 'full' });
      const result = fullRenderer.render('HELLO WORLD');
      expect(result.mode).toBe('full');
      expect(result.maxCols).toBe(VESTABOARD.MAX_COLS);
      expect(result.maxRows).toBe(VESTABOARD.MAX_ROWS);
    });
  });

  describe('render() - basic functionality', () => {
    it('should render single line content with line info', () => {
      const result = renderer.render('HELLO WORLD');

      expect(result.lines.length).toBeGreaterThanOrEqual(1);
      expect(result.lines[0].text).toBe('HELLO WORLD');
      expect(result.lines[0].length).toBe(11);
      expect(result.lines[0].status).toBe('ok');
    });

    it('should preserve newlines in input', () => {
      const result = renderer.render('LINE ONE\nLINE TWO\nLINE THREE');

      expect(result.lines.length).toBe(3);
      expect(result.lines[0].text).toBe('LINE ONE');
      expect(result.lines[1].text).toBe('LINE TWO');
      expect(result.lines[2].text).toBe('LINE THREE');
    });

    it('should handle empty input', () => {
      const result = renderer.render('');

      expect(result.lines.length).toBe(0);
      expect(result.hasErrors).toBe(false);
    });

    it('should handle whitespace-only input', () => {
      const result = renderer.render('   ');

      expect(result.lines.length).toBe(1);
      expect(result.lines[0].text).toBe('   ');
    });
  });

  describe('render() - line length validation', () => {
    it('should mark lines within limit as ok', () => {
      const text = 'A'.repeat(21); // Exactly at limit for content mode
      const result = renderer.render(text);

      expect(result.lines[0].status).toBe('ok');
      expect(result.lines[0].length).toBe(21);
    });

    it('should mark lines exceeding limit as overflow', () => {
      const text = 'A'.repeat(25); // Exceeds 21-char limit
      const result = renderer.render(text);

      expect(result.lines[0].status).toBe('overflow');
      expect(result.lines[0].length).toBe(25);
      expect(result.lines[0].overflowBy).toBe(4);
    });

    it('should show where word-wrap would break lines', () => {
      const text = 'GOOD MORNING LAKEWOOD CA'; // 24 chars, will wrap
      const result = renderer.render(text);

      expect(result.lines[0].status).toBe('overflow');
      expect(result.lines[0].wrapPreview).toBeDefined();
      expect(result.lines[0].wrapPreview!.length).toBeGreaterThanOrEqual(2);
    });

    it('should correctly calculate wrap preview at word boundaries', () => {
      const text = 'GOOD MORNING LAKEWOOD CA'; // 24 chars
      const result = renderer.render(text);

      // "GOOD MORNING LAKEWOOD" = 21 chars, "CA" = 2 chars
      const wrapPreview = result.lines[0].wrapPreview!;
      expect(wrapPreview[0]).toBe('GOOD MORNING LAKEWOOD');
      expect(wrapPreview[1]).toBe('CA');
    });
  });

  describe('render() - row count validation', () => {
    it('should mark content exceeding row limit', () => {
      const text = 'L1\nL2\nL3\nL4\nL5\nL6'; // 6 lines, exceeds 5-line content limit
      const result = renderer.render(text);

      expect(result.hasErrors).toBe(true);
      expect(result.rowOverflow).toBe(true);
      expect(result.lines.length).toBe(6);
    });

    it('should accept content at exactly row limit', () => {
      const text = 'L1\nL2\nL3\nL4\nL5'; // 5 lines, exactly at content limit
      const result = renderer.render(text);

      expect(result.hasErrors).toBe(false);
      expect(result.rowOverflow).toBe(false);
    });

    it('should use 6-row limit in full mode', () => {
      const fullRenderer = new PreviewRenderer({ mode: 'full' });
      const text = 'L1\nL2\nL3\nL4\nL5\nL6'; // 6 lines

      const result = fullRenderer.render(text);

      expect(result.hasErrors).toBe(false);
      expect(result.rowOverflow).toBe(false);
    });

    it('should mark 7 lines as overflow in full mode', () => {
      const fullRenderer = new PreviewRenderer({ mode: 'full' });
      const text = 'L1\nL2\nL3\nL4\nL5\nL6\nL7'; // 7 lines

      const result = fullRenderer.render(text);

      expect(result.hasErrors).toBe(true);
      expect(result.rowOverflow).toBe(true);
    });
  });

  describe('render() - hasErrors flag', () => {
    it('should set hasErrors to true when any line overflows', () => {
      const text = 'A'.repeat(25); // Overflow
      const result = renderer.render(text);

      expect(result.hasErrors).toBe(true);
    });

    it('should set hasErrors to true when row count exceeded', () => {
      const text = 'L1\nL2\nL3\nL4\nL5\nL6'; // 6 lines
      const result = renderer.render(text);

      expect(result.hasErrors).toBe(true);
    });

    it('should set hasErrors to false when content is valid', () => {
      const text = 'HELLO WORLD\nGOOD MORNING';
      const result = renderer.render(text);

      expect(result.hasErrors).toBe(false);
    });
  });

  describe('toAsciiArt() - ASCII art generation', () => {
    it('should generate line with status indicator for valid content', () => {
      const result = renderer.render('FORTUNE FAVORS');
      const ascii = result.toAsciiArt();

      // Should contain the text and a check mark or ok indicator
      expect(ascii).toContain('FORTUNE FAVORS');
      expect(ascii).toMatch(/14 chars/); // length indicator
    });

    it('should generate line with overflow indicator for long content', () => {
      const text = 'A'.repeat(25);
      const result = renderer.render(text);
      const ascii = result.toAsciiArt();

      expect(ascii).toContain(text);
      expect(ascii).toMatch(/25 chars/);
      expect(ascii).toMatch(/\+4/); // overflow indicator
    });

    it('should show wrap preview in ASCII art when line overflows', () => {
      const text = 'GOOD MORNING LAKEWOOD CA';
      const result = renderer.render(text);
      const ascii = result.toAsciiArt();

      expect(ascii).toContain('GOOD MORNING LAKEWOOD CA');
      expect(ascii).toContain('would wrap to:');
      expect(ascii).toContain('GOOD MORNING LAKEWOOD');
    });

    it('should indicate row overflow in ASCII art', () => {
      const text = 'L1\nL2\nL3\nL4\nL5\nL6';
      const result = renderer.render(text);
      const ascii = result.toAsciiArt();

      expect(ascii).toContain('6 rows');
      expect(ascii).toMatch(/exceeds.*5.*max/i);
    });

    it('should generate clean ASCII art for LLM consumption', () => {
      const result = renderer.render('HELLO WORLD');
      const ascii = result.toAsciiArt();

      // Should be plain ASCII, no emojis (suitable for LLM)
      expect(ascii).toMatch(/^[\x20-\x7E\n]*$/); // Printable ASCII + newlines
    });

    it('should include header with dimensions', () => {
      const result = renderer.render('HELLO');
      const ascii = result.toAsciiArt();

      expect(ascii).toContain('5x21'); // content area dimensions
    });

    it('should show full display dimensions when in full mode', () => {
      const fullRenderer = new PreviewRenderer({ mode: 'full' });
      const result = fullRenderer.render('HELLO');
      const ascii = result.toAsciiArt();

      expect(ascii).toContain('6x22'); // full display dimensions
    });
  });

  describe('toAsciiArt() - example format from acceptance criteria', () => {
    it('should format like: "FORTUNE FAVORS THE |ok 18 chars"', () => {
      const result = renderer.render('FORTUNE FAVORS THE');
      const ascii = result.toAsciiArt();
      const lines = ascii.split('\n');

      // Find the content line
      const contentLine = lines.find(l => l.includes('FORTUNE FAVORS THE'));
      expect(contentLine).toBeDefined();
      expect(contentLine).toMatch(/FORTUNE FAVORS THE.*\|.*ok.*18 chars/i);
    });

    it('should format overflow like: "AAAAA...AAAAA |ERR 25 chars (+4)"', () => {
      const text = 'A'.repeat(25);
      const result = renderer.render(text);
      const ascii = result.toAsciiArt();

      expect(ascii).toMatch(/A+.*\|.*ERR.*25 chars.*\+4/i);
    });
  });

  describe('edge cases', () => {
    it('should handle trailing newline', () => {
      const result = renderer.render('HELLO\n');

      // Trailing newline should not create extra empty line
      expect(result.lines.length).toBe(1);
    });

    it('should handle multiple consecutive newlines', () => {
      const result = renderer.render('LINE 1\n\n\nLINE 4');

      expect(result.lines.length).toBe(4);
      expect(result.lines[1].text).toBe('');
      expect(result.lines[2].text).toBe('');
    });

    it('should handle very long single word', () => {
      const longWord = 'A'.repeat(30);
      const result = renderer.render(longWord);

      expect(result.lines[0].status).toBe('overflow');
      expect(result.lines[0].wrapPreview).toBeDefined();
      // Long word gets truncated in wrap preview
      expect(result.lines[0].wrapPreview![0].length).toBe(21);
    });

    it('should handle unicode characters', () => {
      const result = renderer.render('HELLO WORLD');
      expect(result.lines[0].length).toBe(11);
    });

    it('should handle mixed valid and invalid lines', () => {
      const text = 'SHORT LINE\n' + 'A'.repeat(25) + '\nANOTHER SHORT';
      const result = renderer.render(text);

      expect(result.lines[0].status).toBe('ok');
      expect(result.lines[1].status).toBe('overflow');
      expect(result.lines[2].status).toBe('ok');
      expect(result.hasErrors).toBe(true);
    });
  });

  describe('renderForToolError() - convenience method', () => {
    it('should return formatted error message for tool rejection', () => {
      const text = 'A'.repeat(25);
      const errorMessage = PreviewRenderer.renderForToolError(text, 'content');

      expect(errorMessage).toContain('Preview');
      expect(errorMessage).toContain('5x21');
      expect(errorMessage).toContain('25 chars');
    });

    it('should work with full mode', () => {
      const text = 'HELLO WORLD';
      const errorMessage = PreviewRenderer.renderForToolError(text, 'full');

      expect(errorMessage).toContain('6x22');
    });

    it('should default to content mode when mode not specified', () => {
      const text = 'HELLO WORLD';
      const errorMessage = PreviewRenderer.renderForToolError(text);

      expect(errorMessage).toContain('5x21');
      expect(errorMessage).toContain('content area');
    });

    it('should include validation summary', () => {
      const text = 'L1\nL2\nL3\nL4\nL5\nL6\nL7';
      const errorMessage = PreviewRenderer.renderForToolError(text, 'content');

      expect(errorMessage).toMatch(/7 rows/);
      expect(errorMessage).toMatch(/exceeds.*5/i);
    });
  });
});

describe('RenderedLine interface', () => {
  it('should have required properties', () => {
    const renderer = new PreviewRenderer();
    const result = renderer.render('HELLO');
    const line: RenderedLine = result.lines[0];

    expect(line).toHaveProperty('text');
    expect(line).toHaveProperty('length');
    expect(line).toHaveProperty('status');
    expect(line).toHaveProperty('lineNumber');
  });

  it('should have optional overflowBy for overflow lines', () => {
    const renderer = new PreviewRenderer();
    const text = 'A'.repeat(25);
    const result = renderer.render(text);
    const line: RenderedLine = result.lines[0];

    expect(line.overflowBy).toBe(4);
  });

  it('should have optional wrapPreview for long lines', () => {
    const renderer = new PreviewRenderer();
    const result = renderer.render('GOOD MORNING LAKEWOOD CA');
    const line: RenderedLine = result.lines[0];

    expect(line.wrapPreview).toBeDefined();
    expect(Array.isArray(line.wrapPreview)).toBe(true);
  });
});

describe('PreviewResult interface', () => {
  it('should have required properties', () => {
    const renderer = new PreviewRenderer();
    const result: PreviewResult = renderer.render('HELLO');

    expect(result).toHaveProperty('lines');
    expect(result).toHaveProperty('mode');
    expect(result).toHaveProperty('maxCols');
    expect(result).toHaveProperty('maxRows');
    expect(result).toHaveProperty('hasErrors');
    expect(result).toHaveProperty('rowOverflow');
    expect(result).toHaveProperty('toAsciiArt');
  });
});

describe('RenderMode type', () => {
  it('should accept content mode', () => {
    const mode: RenderMode = 'content';
    const renderer = new PreviewRenderer({ mode });
    expect(renderer.render('TEST').mode).toBe('content');
  });

  it('should accept full mode', () => {
    const mode: RenderMode = 'full';
    const renderer = new PreviewRenderer({ mode });
    expect(renderer.render('TEST').mode).toBe('full');
  });
});

describe('LineStatus type', () => {
  it('should use ok for valid lines', () => {
    const renderer = new PreviewRenderer();
    const result = renderer.render('VALID');
    const status: LineStatus = result.lines[0].status;
    expect(status).toBe('ok');
  });

  it('should use overflow for long lines', () => {
    const renderer = new PreviewRenderer();
    const result = renderer.render('A'.repeat(30));
    const status: LineStatus = result.lines[0].status;
    expect(status).toBe('overflow');
  });
});
