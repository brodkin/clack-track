/**
 * Tests for CLI Output Validation Helpers
 *
 * Validates that output assertion helpers correctly strip ANSI codes,
 * normalize whitespace, extract sections, and capture console output.
 */

import { describe, it, expect } from '@jest/globals';
import {
  normalizeOutput,
  expectOutputContains,
  extractSection,
  captureConsoleOutput,
  captureConsoleErrors,
} from '@tests/__helpers__/outputAssertions';

describe('outputAssertions', () => {
  describe('normalizeOutput', () => {
    it('should remove ANSI color codes', () => {
      const input = '\x1b[32mGreen text\x1b[0m';
      const normalized = normalizeOutput(input);

      expect(normalized).toBe('Green text');
    });

    it('should remove multiple ANSI codes', () => {
      const input = '\x1b[32m\x1b[1mBold green\x1b[0m\x1b[0m normal';
      const normalized = normalizeOutput(input);

      expect(normalized).toBe('Bold green normal');
    });

    it('should collapse multiple spaces into single space', () => {
      const input = 'Multiple    spaces     here';
      const normalized = normalizeOutput(input);

      expect(normalized).toBe('Multiple spaces here');
    });

    it('should collapse newlines into spaces', () => {
      const input = 'Line one\nLine two\nLine three';
      const normalized = normalizeOutput(input);

      expect(normalized).toBe('Line one Line two Line three');
    });

    it('should collapse tabs into spaces', () => {
      const input = 'Tab\tseparated\tvalues';
      const normalized = normalizeOutput(input);

      expect(normalized).toBe('Tab separated values');
    });

    it('should trim leading and trailing whitespace', () => {
      const input = '   leading and trailing   ';
      const normalized = normalizeOutput(input);

      expect(normalized).toBe('leading and trailing');
    });

    it('should handle ANSI codes and whitespace together', () => {
      const input = '\x1b[32m  Success  \x1b[0m\n  message  ';
      const normalized = normalizeOutput(input);

      expect(normalized).toBe('Success message');
    });

    it('should handle empty strings', () => {
      const normalized = normalizeOutput('');
      expect(normalized).toBe('');
    });

    it('should handle strings with only whitespace', () => {
      const normalized = normalizeOutput('   \n\t   ');
      expect(normalized).toBe('');
    });

    it('should handle complex ANSI sequences', () => {
      const input = '\x1b[38;5;214mOrange\x1b[0m \x1b[48;5;21mBlue bg\x1b[0m';
      const normalized = normalizeOutput(input);

      expect(normalized).toBe('Orange Blue bg');
    });
  });

  describe('expectOutputContains', () => {
    it('should pass when output contains expected text', () => {
      const output = '\x1b[32mSUCCESS:\x1b[0m Operation completed';

      expect(() => {
        expectOutputContains(output, 'success');
      }).not.toThrow();
    });

    it('should be case-insensitive', () => {
      const output = 'SUCCESS message';

      expect(() => {
        expectOutputContains(output, 'success');
        expectOutputContains(output, 'MESSAGE');
        expectOutputContains(output, 'SuCcEsS');
      }).not.toThrow();
    });

    it('should strip ANSI codes before matching', () => {
      const output = '\x1b[32mGreen\x1b[0m text';

      expect(() => {
        expectOutputContains(output, 'green text');
      }).not.toThrow();
    });

    it('should normalize whitespace before matching', () => {
      const output = 'Multiple    spaces   here';

      expect(() => {
        expectOutputContains(output, 'multiple spaces here');
      }).not.toThrow();
    });

    it('should throw when text is not found', () => {
      const output = 'SUCCESS message';

      expect(() => {
        expectOutputContains(output, 'failure');
      }).toThrow();
    });

    it('should handle partial matches', () => {
      const output = 'This is a long message with many words';

      expect(() => {
        expectOutputContains(output, 'long message');
      }).not.toThrow();
    });
  });

  describe('extractSection', () => {
    const sampleOutput = `
P0: NOTIFICATION (2 generators)
  - arrival-notification
  - departure-notification
P2: NORMAL (5 generators)
  - motivational
  - news-summary
  - weather-focus
P3: FALLBACK (1 generator)
  - static-fallback
Total: 8 generators
`;

    it('should extract P0 section', () => {
      const section = extractSection(sampleOutput, 'P0:');

      expect(section).not.toBeNull();
      expect(section).toContain('NOTIFICATION');
      expect(section).toContain('arrival-notification');
      expect(section).not.toContain('P2:');
    });

    it('should extract P2 section', () => {
      const section = extractSection(sampleOutput, 'P2:');

      expect(section).not.toBeNull();
      expect(section).toContain('NORMAL');
      expect(section).toContain('motivational');
      expect(section).toContain('news-summary');
      expect(section).not.toContain('P0:');
      expect(section).not.toContain('P3:');
    });

    it('should extract P3 section', () => {
      const section = extractSection(sampleOutput, 'P3:');

      expect(section).not.toBeNull();
      expect(section).toContain('FALLBACK');
      expect(section).toContain('static-fallback');
      expect(section).not.toContain('P2:');
    });

    it('should extract Total section to end of output', () => {
      const section = extractSection(sampleOutput, 'Total:');

      expect(section).not.toBeNull();
      expect(section).toContain('8 generators');
      expect(section).not.toContain('P3:');
    });

    it('should return null for non-existent section', () => {
      const section = extractSection(sampleOutput, 'P1:');

      expect(section).toBeNull();
    });

    it('should handle sections with ANSI codes', () => {
      const coloredOutput = '\x1b[32mP0:\x1b[0m Success\n\x1b[31mP2:\x1b[0m Error';
      const section = extractSection(coloredOutput, 'P0:');

      expect(section).not.toBeNull();
      expect(section).toContain('Success');
      expect(section).not.toContain('Error');
    });

    it('should handle empty sections', () => {
      const emptyOutput = 'P0:\nP2: Content here';
      const section = extractSection(emptyOutput, 'P0:');

      expect(section).not.toBeNull();
      expect(section).toBe('P0:');
    });

    it('should extract last section to end of output', () => {
      const output = 'P0: First\nP2: Last section with multiple lines\nmore content here';
      const section = extractSection(output, 'P2:');

      expect(section).not.toBeNull();
      expect(section).toContain('Last section');
      expect(section).toContain('more content here');
    });

    it('should normalize whitespace in extracted sections', () => {
      const output = 'P0:   Multiple    spaces\n   here\nP2: Next';
      const section = extractSection(output, 'P0:');

      expect(section).not.toBeNull();
      // Note: extractSection preserves newlines within the section
      // but normalizeOutput collapses them
      const normalized = normalizeOutput(section!);
      expect(normalized).toContain('Multiple spaces here');
    });
  });

  describe('captureConsoleOutput', () => {
    it('should capture console.log output', async () => {
      const { result, output } = await captureConsoleOutput(() => {
        console.log('First message');
        console.log('Second message');
        return 42;
      });

      expect(result).toBe(42);
      expect(output).toEqual(['First message', 'Second message']);
    });

    it('should restore console.log after execution', async () => {
      const originalLog = console.log;

      await captureConsoleOutput(() => {
        console.log('Test');
      });

      expect(console.log).toBe(originalLog);
    });

    it('should restore console.log even if function throws', async () => {
      const originalLog = console.log;

      await expect(
        captureConsoleOutput(() => {
          console.log('Before error');
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      expect(console.log).toBe(originalLog);
    });

    it('should capture output from async functions', async () => {
      const { result, output } = await captureConsoleOutput(async () => {
        console.log('Async message 1');
        await Promise.resolve();
        console.log('Async message 2');
        return 'done';
      });

      expect(result).toBe('done');
      expect(output).toEqual(['Async message 1', 'Async message 2']);
    });

    it('should handle multiple arguments to console.log', async () => {
      const { output } = await captureConsoleOutput(() => {
        console.log('Message', 123, true, { key: 'value' });
      });

      expect(output).toHaveLength(1);
      expect(output[0]).toContain('Message');
      expect(output[0]).toContain('123');
      expect(output[0]).toContain('true');
    });

    it('should return empty array if no output', async () => {
      const { result, output } = await captureConsoleOutput(() => {
        return 'silent';
      });

      expect(result).toBe('silent');
      expect(output).toEqual([]);
    });

    it('should handle nested captures', async () => {
      const { result: outer, output: outerOutput } = await captureConsoleOutput(async () => {
        console.log('Outer 1');

        const { result: inner, output: innerOutput } = await captureConsoleOutput(() => {
          console.log('Inner 1');
          console.log('Inner 2');
          return 'inner';
        });

        console.log('Outer 2');

        return { inner, innerOutput };
      });

      expect(outerOutput).toEqual(['Outer 1', 'Outer 2']);
      expect(outer.inner).toBe('inner');
      expect(outer.innerOutput).toEqual(['Inner 1', 'Inner 2']);
    });
  });

  describe('captureConsoleErrors', () => {
    it('should capture console.error output', async () => {
      const { result, errors } = await captureConsoleErrors(() => {
        console.error('Error message 1');
        console.error('Error message 2');
        return false;
      });

      expect(result).toBe(false);
      expect(errors).toEqual(['Error message 1', 'Error message 2']);
    });

    it('should restore console.error after execution', async () => {
      const originalError = console.error;

      await captureConsoleErrors(() => {
        console.error('Test error');
      });

      expect(console.error).toBe(originalError);
    });

    it('should restore console.error even if function throws', async () => {
      const originalError = console.error;

      await expect(
        captureConsoleErrors(() => {
          console.error('Before error');
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      expect(console.error).toBe(originalError);
    });

    it('should capture output from async functions', async () => {
      const { result, errors } = await captureConsoleErrors(async () => {
        console.error('Async error 1');
        await Promise.resolve();
        console.error('Async error 2');
        return 'done';
      });

      expect(result).toBe('done');
      expect(errors).toEqual(['Async error 1', 'Async error 2']);
    });

    it('should handle multiple arguments to console.error', async () => {
      const { errors } = await captureConsoleErrors(() => {
        console.error('Error', 500, false, { code: 'ERR' });
      });

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Error');
      expect(errors[0]).toContain('500');
      expect(errors[0]).toContain('false');
    });

    it('should return empty array if no errors', async () => {
      const { result, errors } = await captureConsoleErrors(() => {
        return 'clean';
      });

      expect(result).toBe('clean');
      expect(errors).toEqual([]);
    });

    it('should not capture console.log', async () => {
      const { errors } = await captureConsoleErrors(() => {
        console.log('This is a log');
        console.error('This is an error');
      });

      expect(errors).toEqual(['This is an error']);
    });
  });

  describe('integration tests', () => {
    it('should work with all helpers together', async () => {
      const { output } = await captureConsoleOutput(() => {
        console.log('\x1b[32mP0:\x1b[0m NOTIFICATION');
        console.log('  - arrival');
        console.log('\x1b[33mP2:\x1b[0m NORMAL');
        console.log('  - motivational');
      });

      const fullOutput = output.join('\n');
      const p0Section = extractSection(fullOutput, 'P0:');
      const p2Section = extractSection(fullOutput, 'P2:');

      expect(p0Section).not.toBeNull();
      expectOutputContains(p0Section!, 'notification');

      expect(p2Section).not.toBeNull();
      expectOutputContains(p2Section!, 'motivational');
    });
  });
});
