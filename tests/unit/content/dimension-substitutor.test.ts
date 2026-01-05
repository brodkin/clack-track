/**
 * Tests for DimensionSubstitutor
 *
 * Verifies that dimension constraints (maxChars, maxLines) are correctly
 * substituted into system prompt template variables.
 */
import { DimensionSubstitutor } from '../../../src/content/dimension-substitutor.js';

describe('DimensionSubstitutor', () => {
  let substitutor: DimensionSubstitutor;

  beforeEach(() => {
    substitutor = new DimensionSubstitutor();
  });

  describe('substitute()', () => {
    describe('default values', () => {
      it('should substitute {{maxChars}} with default value 21', () => {
        const template = 'Limit: {{maxChars}} CHARACTERS';
        const result = substitutor.substitute(template);
        expect(result).toBe('Limit: 21 CHARACTERS');
      });

      it('should substitute {{maxLines}} with default value 5', () => {
        const template = 'Use {{maxLines}} lines or fewer';
        const result = substitutor.substitute(template);
        expect(result).toBe('Use 5 lines or fewer');
      });

      it('should substitute both variables with defaults', () => {
        const template = '{{maxChars}} chars per line, {{maxLines}} lines max';
        const result = substitutor.substitute(template);
        expect(result).toBe('21 chars per line, 5 lines max');
      });
    });

    describe('custom values', () => {
      it('should substitute {{maxChars}} with custom value', () => {
        const template = 'Limit: {{maxChars}} CHARACTERS';
        const result = substitutor.substitute(template, { maxChars: 15 });
        expect(result).toBe('Limit: 15 CHARACTERS');
      });

      it('should substitute {{maxLines}} with custom value', () => {
        const template = 'Use {{maxLines}} lines or fewer';
        const result = substitutor.substitute(template, { maxLines: 3 });
        expect(result).toBe('Use 3 lines or fewer');
      });

      it('should substitute both variables with custom values', () => {
        const template = '{{maxChars}} chars per line, {{maxLines}} lines max';
        const result = substitutor.substitute(template, { maxChars: 18, maxLines: 4 });
        expect(result).toBe('18 chars per line, 4 lines max');
      });

      it('should allow partial custom values (maxChars only)', () => {
        const template = '{{maxChars}} chars, {{maxLines}} lines';
        const result = substitutor.substitute(template, { maxChars: 10 });
        expect(result).toBe('10 chars, 5 lines');
      });

      it('should allow partial custom values (maxLines only)', () => {
        const template = '{{maxChars}} chars, {{maxLines}} lines';
        const result = substitutor.substitute(template, { maxLines: 2 });
        expect(result).toBe('21 chars, 2 lines');
      });
    });

    describe('multiple occurrences', () => {
      it('should substitute all occurrences of {{maxChars}}', () => {
        const template = '{{maxChars}} is the limit. Remember: {{maxChars}} max!';
        const result = substitutor.substitute(template);
        expect(result).toBe('21 is the limit. Remember: 21 max!');
      });

      it('should substitute all occurrences of {{maxLines}}', () => {
        const template = '{{maxLines}} lines total. Up to {{maxLines}} allowed.';
        const result = substitutor.substitute(template);
        expect(result).toBe('5 lines total. Up to 5 allowed.');
      });
    });

    describe('edge cases', () => {
      it('should handle template with no dimension variables', () => {
        const template = 'No variables here!';
        const result = substitutor.substitute(template);
        expect(result).toBe('No variables here!');
      });

      it('should handle empty template', () => {
        const result = substitutor.substitute('');
        expect(result).toBe('');
      });

      it('should preserve other template variables', () => {
        const template = '{{mood}} vibes, {{maxChars}} chars, {{date}} today';
        const result = substitutor.substitute(template);
        expect(result).toBe('{{mood}} vibes, 21 chars, {{date}} today');
      });

      it('should handle multiline templates', () => {
        const template = `Line limit: {{maxChars}} characters
Total lines: {{maxLines}} maximum
Content goes here`;
        const result = substitutor.substitute(template);
        expect(result).toBe(`Line limit: 21 characters
Total lines: 5 maximum
Content goes here`);
      });
    });

    describe('real-world prompt template', () => {
      it('should substitute dimension variables in a realistic system prompt', () => {
        const template = `CRITICAL: {{maxChars}} CHARACTER LIMIT

Each line you output MUST be {{maxChars}} characters or fewer.

DISPLAY CONSTRAINTS:

1. MAXIMUM {{maxChars}} CHARACTERS PER LINE
   - This is physical hardware. NO EXCEPTIONS.

2. EXACTLY 1-{{maxLines}} LINES TOTAL
   - Blank lines count toward this limit`;

        const result = substitutor.substitute(template);

        expect(result).toContain('CRITICAL: 21 CHARACTER LIMIT');
        expect(result).toContain('MUST be 21 characters or fewer');
        expect(result).toContain('MAXIMUM 21 CHARACTERS PER LINE');
        expect(result).toContain('EXACTLY 1-5 LINES TOTAL');
      });

      it('should work with custom dimensions for smaller displays', () => {
        const template = `Max {{maxChars}} chars per line, {{maxLines}} lines total`;
        const result = substitutor.substitute(template, { maxChars: 15, maxLines: 3 });
        expect(result).toBe('Max 15 chars per line, 3 lines total');
      });
    });
  });

  describe('getDefaults()', () => {
    it('should return default maxChars value', () => {
      const defaults = substitutor.getDefaults();
      expect(defaults.maxChars).toBe(21);
    });

    it('should return default maxLines value', () => {
      const defaults = substitutor.getDefaults();
      expect(defaults.maxLines).toBe(5);
    });

    it('should return both defaults as an object', () => {
      const defaults = substitutor.getDefaults();
      expect(defaults).toEqual({ maxChars: 21, maxLines: 5 });
    });
  });

  describe('constructor with custom defaults', () => {
    it('should allow overriding default maxChars', () => {
      const customSubstitutor = new DimensionSubstitutor({ maxChars: 18 });
      const result = customSubstitutor.substitute('{{maxChars}} chars');
      expect(result).toBe('18 chars');
    });

    it('should allow overriding default maxLines', () => {
      const customSubstitutor = new DimensionSubstitutor({ maxLines: 4 });
      const result = customSubstitutor.substitute('{{maxLines}} lines');
      expect(result).toBe('4 lines');
    });

    it('should allow overriding both defaults', () => {
      const customSubstitutor = new DimensionSubstitutor({ maxChars: 16, maxLines: 3 });
      const defaults = customSubstitutor.getDefaults();
      expect(defaults).toEqual({ maxChars: 16, maxLines: 3 });
    });

    it('should still allow per-call overrides with custom defaults', () => {
      const customSubstitutor = new DimensionSubstitutor({ maxChars: 18 });
      const result = customSubstitutor.substitute('{{maxChars}} chars', { maxChars: 10 });
      expect(result).toBe('10 chars');
    });
  });
});
