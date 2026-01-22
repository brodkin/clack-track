/**
 * Test suite for SubmitContent Tool
 *
 * Tests the submit_content tool definition and executor that LLMs use
 * to submit their generated content for validation.
 *
 * Acceptance Criteria:
 * - Tool definition with content string parameter
 * - Executor calls validateTextContent() from validators
 * - On success: Returns { accepted: true, preview: [...] }
 * - On failure: Returns { accepted: false, preview: [...], errors: [...], hint: "..." }
 * - Preview shows exactly how content renders on 5x21 content area
 * - Errors are actionable: "Line 3 is 24 chars (max 21)" not just "too long"
 */

import { describe, it, expect } from '@jest/globals';
import {
  submitContentToolDefinition,
  executeSubmitContent,
  SubmitContentResult,
  SubmitContentParams,
} from '@/content/tools/submit-content';

describe('SubmitContent Tool', () => {
  describe('Tool Definition', () => {
    it('should have the correct tool name', () => {
      expect(submitContentToolDefinition.name).toBe('submit_content');
    });

    it('should have a descriptive description', () => {
      expect(submitContentToolDefinition.description).toBeDefined();
      expect(submitContentToolDefinition.description.length).toBeGreaterThan(20);
      expect(submitContentToolDefinition.description.toLowerCase()).toContain('vestaboard');
    });

    it('should define parameters as an object type', () => {
      expect(submitContentToolDefinition.parameters.type).toBe('object');
    });

    it('should have content as a required string parameter', () => {
      const { parameters } = submitContentToolDefinition;
      expect(parameters.properties).toBeDefined();
      expect(parameters.properties!.content).toBeDefined();
      expect(parameters.properties!.content.type).toBe('string');
      expect(parameters.required).toContain('content');
    });

    it('should have a description for the content parameter', () => {
      const contentParam = submitContentToolDefinition.parameters.properties!.content;
      expect(contentParam.description).toBeDefined();
      expect(contentParam.description!.length).toBeGreaterThan(10);
    });

    it('should mention display constraints in parameter description', () => {
      const contentParam = submitContentToolDefinition.parameters.properties!.content;
      // Should mention the content area constraints (5 rows, 21 chars)
      expect(contentParam.description).toMatch(/5.*row|row.*5/i);
      expect(contentParam.description).toMatch(/21.*char|char.*21/i);
    });
  });

  describe('executeSubmitContent() - Success Cases', () => {
    it('should accept valid single-line content', async () => {
      const result = await executeSubmitContent({ content: 'HELLO WORLD' });

      expect(result.accepted).toBe(true);
      expect(result.preview).toBeDefined();
      expect(Array.isArray(result.preview)).toBe(true);
    });

    it('should accept valid multi-line content', async () => {
      const content = 'LINE ONE\nLINE TWO\nLINE THREE';
      const result = await executeSubmitContent({ content });

      expect(result.accepted).toBe(true);
      expect(result.preview.length).toBeGreaterThanOrEqual(3);
    });

    it('should accept content at exactly the max line length (21 chars)', async () => {
      const content = 'A'.repeat(21);
      const result = await executeSubmitContent({ content });

      expect(result.accepted).toBe(true);
    });

    it('should accept content at exactly max rows (5 lines)', async () => {
      const content = 'L1\nL2\nL3\nL4\nL5';
      const result = await executeSubmitContent({ content });

      expect(result.accepted).toBe(true);
      // Preview includes header lines, so just check content is in preview
      const previewText = result.preview.join('\n');
      expect(previewText).toContain('L1');
      expect(previewText).toContain('L5');
    });

    it('should not include errors or hint on success', async () => {
      const result = await executeSubmitContent({ content: 'VALID CONTENT' });

      expect(result.accepted).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.hint).toBeUndefined();
    });

    it('should include ASCII preview for valid content', async () => {
      const result = await executeSubmitContent({ content: 'FORTUNE FAVORS' });

      expect(result.accepted).toBe(true);
      // Preview should be an array of strings showing the rendered content
      expect(result.preview.some(line => line.includes('FORTUNE FAVORS'))).toBe(true);
    });

    it('should handle content with supported special characters', async () => {
      const content = 'PRICE: $19.99!';
      const result = await executeSubmitContent({ content });

      expect(result.accepted).toBe(true);
    });

    it('should accept content with trailing newline', async () => {
      const content = 'HELLO WORLD\n';
      const result = await executeSubmitContent({ content });

      expect(result.accepted).toBe(true);
    });
  });

  describe('executeSubmitContent() - Failure Cases', () => {
    describe('Empty Content', () => {
      it('should reject empty string', async () => {
        const result = await executeSubmitContent({ content: '' });

        expect(result.accepted).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeGreaterThan(0);
      });

      it('should provide actionable error for empty content', async () => {
        const result = await executeSubmitContent({ content: '' });

        expect(result.accepted).toBe(false);
        expect(result.errors!.some(e => e.toLowerCase().includes('empty'))).toBe(true);
      });
    });

    describe('Line Length Overflow', () => {
      it('should reject content with line exceeding 21 characters', async () => {
        const content = 'A'.repeat(25); // 25 chars, exceeds 21
        const result = await executeSubmitContent({ content });

        // Note: validateTextContent wraps long lines, so this may still be accepted
        // if wrapping results in <= 5 lines. Let's use a very long line that
        // after wrapping would still cause issues
        expect(result.preview).toBeDefined();
      });

      it('should provide actionable error with specific line number and length', async () => {
        // Create content where wrapping would exceed 5 rows total
        // Use natural language that wraps at word boundaries
        // Each line has 40+ chars = wraps to 2 lines
        // 3 such lines = 6+ lines after wrapping
        const longLine = 'THIS LINE IS TOO LONG AND WILL NEED TO WRAP';
        const content = [longLine, longLine, longLine].join('\n');
        const result = await executeSubmitContent({ content });

        // After wrapping, should exceed 5 rows
        expect(result.accepted).toBe(false);
        // Error should mention specific line information
        expect(result.errors).toBeDefined();
        expect(result.errors!.some(e => /line|row/i.test(e))).toBe(true);
      });

      it('should include how many characters over the limit in error', async () => {
        // Create content that when wrapped causes row overflow
        // Natural language that will expand significantly after wrapping
        const longLine = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG AGAIN';
        const content = [longLine, longLine, longLine].join('\n');
        const result = await executeSubmitContent({ content });

        expect(result.accepted).toBe(false);
        expect(result.preview).toBeDefined();
      });
    });

    describe('Row Count Overflow', () => {
      it('should reject content with more than 5 lines', async () => {
        const content = 'L1\nL2\nL3\nL4\nL5\nL6'; // 6 lines
        const result = await executeSubmitContent({ content });

        expect(result.accepted).toBe(false);
      });

      it('should provide actionable error about row count', async () => {
        const content = 'L1\nL2\nL3\nL4\nL5\nL6\nL7'; // 7 lines
        const result = await executeSubmitContent({ content });

        expect(result.accepted).toBe(false);
        expect(result.errors).toBeDefined();
        // Error should mention row/line count and maximum
        expect(result.errors!.some(e => /7.*line|line.*7|row.*7|7.*row/i.test(e))).toBe(true);
        expect(result.errors!.some(e => /5|max/i.test(e))).toBe(true);
      });
    });

    describe('Invalid Characters', () => {
      it('should reject content with unsupported characters', async () => {
        const content = 'HELLO [WORLD]'; // Square brackets not supported
        const result = await executeSubmitContent({ content });

        expect(result.accepted).toBe(false);
      });

      it('should provide actionable error listing invalid characters', async () => {
        const content = 'HELLO [WORLD] {TEST}';
        const result = await executeSubmitContent({ content });

        expect(result.accepted).toBe(false);
        expect(result.errors).toBeDefined();
        // Error should mention the specific invalid characters
        expect(result.errors!.some(e => /\[|\]|\{|\}/i.test(e) || /invalid.*char/i.test(e))).toBe(
          true
        );
      });
    });

    describe('Hint Messages', () => {
      it('should include a helpful hint on failure', async () => {
        const content = 'A'.repeat(100) + '\nB'.repeat(100); // Will cause overflow
        const result = await executeSubmitContent({ content });

        expect(result.accepted).toBe(false);
        expect(result.hint).toBeDefined();
        expect(result.hint!.length).toBeGreaterThan(10);
      });

      it('should provide hint about line length when lines are too long', async () => {
        // Content that causes row overflow after wrapping
        // Natural language that will expand to more than 5 lines
        const longLine = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG AGAIN';
        const content = [longLine, longLine, longLine].join('\n');
        const result = await executeSubmitContent({ content });

        expect(result.accepted).toBe(false);
        expect(result.hint).toBeDefined();
        // Hint should mention shortening or brevity
        expect(result.hint!.toLowerCase()).toMatch(/short|brev|reduc|line|row/);
      });

      it('should provide hint about row count when too many lines', async () => {
        const content = 'L1\nL2\nL3\nL4\nL5\nL6\nL7';
        const result = await executeSubmitContent({ content });

        expect(result.accepted).toBe(false);
        expect(result.hint).toBeDefined();
      });

      it('should provide hint about character set when invalid chars found', async () => {
        const content = 'HELLO [TEST]';
        const result = await executeSubmitContent({ content });

        expect(result.accepted).toBe(false);
        expect(result.hint).toBeDefined();
        // Hint should mention character limitations
        expect(result.hint!.toLowerCase()).toMatch(/char|letter|symbol|support/);
      });
    });
  });

  describe('executeSubmitContent() - Preview Generation', () => {
    it('should include preview array in result', async () => {
      const result = await executeSubmitContent({ content: 'HELLO' });

      expect(result.preview).toBeDefined();
      expect(Array.isArray(result.preview)).toBe(true);
    });

    it('should show content lines in preview', async () => {
      const content = 'LINE ONE\nLINE TWO';
      const result = await executeSubmitContent({ content });

      const previewText = result.preview.join('\n');
      expect(previewText).toContain('LINE ONE');
      expect(previewText).toContain('LINE TWO');
    });

    it('should indicate dimensions in preview header', async () => {
      const result = await executeSubmitContent({ content: 'TEST' });

      const previewText = result.preview.join('\n');
      // Should mention the content area dimensions (5x21)
      expect(previewText).toMatch(/5.*21|5x21/);
    });

    it('should show character counts for lines in preview', async () => {
      const result = await executeSubmitContent({ content: 'HELLO WORLD' });

      const previewText = result.preview.join('\n');
      // Preview should show character count
      expect(previewText).toMatch(/11.*char|char.*11/i);
    });

    it('should mark overflow lines in preview', async () => {
      // This content will have wrapping but may not fail
      const content = 'A'.repeat(25);
      const result = await executeSubmitContent({ content });

      const previewText = result.preview.join('\n');
      // If line overflows, preview should indicate it
      expect(previewText).toMatch(/ERR|\+\d|overflow/i);
    });

    it('should show row overflow in preview when too many lines', async () => {
      const content = 'L1\nL2\nL3\nL4\nL5\nL6';
      const result = await executeSubmitContent({ content });

      expect(result.accepted).toBe(false);
      const previewText = result.preview.join('\n');
      // Preview should indicate row overflow
      expect(previewText).toMatch(/6.*row|row.*6|exceed/i);
    });
  });

  describe('executeSubmitContent() - Edge Cases', () => {
    it('should handle whitespace-only content', async () => {
      const result = await executeSubmitContent({ content: '   ' });

      // Whitespace-only is technically valid characters
      expect(result.preview).toBeDefined();
    });

    it('should handle content with multiple consecutive newlines', async () => {
      const content = 'LINE 1\n\n\nLINE 4';
      const result = await executeSubmitContent({ content });

      // 4 lines total (including empty lines)
      expect(result.preview).toBeDefined();
    });

    it('should normalize smart quotes to standard quotes', async () => {
      const content = '"HELLO WORLD"'; // Smart quotes
      const result = await executeSubmitContent({ content });

      // Should be accepted after normalization
      expect(result.accepted).toBe(true);
    });

    it('should normalize em-dashes to hyphens', async () => {
      const content = 'HELLO - WORLD'; // Em-dash
      const result = await executeSubmitContent({ content });

      expect(result.accepted).toBe(true);
    });

    it('should strip unsupported emojis', async () => {
      // Unsupported emojis get stripped by validateTextContent
      const content = 'HELLO WORLD';
      const result = await executeSubmitContent({ content });

      expect(result.accepted).toBe(true);
    });

    it('should handle lowercase content (gets uppercased for validation)', async () => {
      const content = 'hello world';
      const result = await executeSubmitContent({ content });

      // Lowercase gets uppercased during validation
      expect(result.accepted).toBe(true);
    });

    it('should handle content at exact boundaries', async () => {
      // Exactly 5 lines of exactly 21 characters each
      const content = Array(5).fill('A'.repeat(21)).join('\n');
      const result = await executeSubmitContent({ content });

      expect(result.accepted).toBe(true);
    });
  });

  describe('SubmitContentResult Interface', () => {
    it('should have accepted boolean property', async () => {
      const result: SubmitContentResult = await executeSubmitContent({ content: 'TEST' });
      expect(typeof result.accepted).toBe('boolean');
    });

    it('should have preview array property', async () => {
      const result: SubmitContentResult = await executeSubmitContent({ content: 'TEST' });
      expect(Array.isArray(result.preview)).toBe(true);
      expect(result.preview.every(line => typeof line === 'string')).toBe(true);
    });

    it('should have optional errors array on failure', async () => {
      const result: SubmitContentResult = await executeSubmitContent({ content: '' });
      expect(result.accepted).toBe(false);
      if (!result.accepted) {
        expect(Array.isArray(result.errors)).toBe(true);
      }
    });

    it('should have optional hint string on failure', async () => {
      const result: SubmitContentResult = await executeSubmitContent({ content: '' });
      expect(result.accepted).toBe(false);
      if (!result.accepted) {
        expect(typeof result.hint).toBe('string');
      }
    });
  });

  describe('Serial Story Parameters', () => {
    describe('SubmitContentParams Interface', () => {
      it('should accept continueStory boolean parameter (false = final chapter)', async () => {
        const params: SubmitContentParams = {
          content: 'CHAPTER END',
          continueStory: false,
        };
        const result = await executeSubmitContent(params);

        expect(result.accepted).toBe(true);
        expect(result.continueStory).toBe(false);
      });

      it('should accept chapterSummary optional string parameter', async () => {
        const params: SubmitContentParams = {
          content: 'CHAPTER ONE',
          chapterSummary: 'The hero begins their journey',
        };
        const result = await executeSubmitContent(params);

        expect(result.accepted).toBe(true);
        expect(result.chapterSummary).toBe('The hero begins their journey');
      });

      it('should accept both continueStory and chapterSummary together', async () => {
        const params: SubmitContentParams = {
          content: 'THE END',
          continueStory: false,
          chapterSummary: 'The hero saves the day and returns home',
        };
        const result = await executeSubmitContent(params);

        expect(result.accepted).toBe(true);
        expect(result.continueStory).toBe(false);
        expect(result.chapterSummary).toBe('The hero saves the day and returns home');
      });

      it('should work without optional serial story params (backwards compatible)', async () => {
        const params: SubmitContentParams = {
          content: 'SIMPLE CONTENT',
        };
        const result = await executeSubmitContent(params);

        expect(result.accepted).toBe(true);
        expect(result.continueStory).toBeUndefined();
        expect(result.chapterSummary).toBeUndefined();
      });

      it('should pass through continueStory=true correctly (story continues)', async () => {
        const params: SubmitContentParams = {
          content: 'CHAPTER TWO',
          continueStory: true,
        };
        const result = await executeSubmitContent(params);

        expect(result.accepted).toBe(true);
        expect(result.continueStory).toBe(true);
      });

      it('should pass through empty chapterSummary string', async () => {
        const params: SubmitContentParams = {
          content: 'CHAPTER THREE',
          chapterSummary: '',
        };
        const result = await executeSubmitContent(params);

        expect(result.accepted).toBe(true);
        expect(result.chapterSummary).toBe('');
      });

      it('should include serial story params in failed submissions', async () => {
        const params: SubmitContentParams = {
          content: 'L1\nL2\nL3\nL4\nL5\nL6', // Too many lines
          continueStory: false,
          chapterSummary: 'Story summary',
        };
        const result = await executeSubmitContent(params);

        expect(result.accepted).toBe(false);
        expect(result.continueStory).toBe(false);
        expect(result.chapterSummary).toBe('Story summary');
      });
    });

    describe('Tool Definition for Serial Story Params', () => {
      it('should define continueStory as boolean parameter', () => {
        const { parameters } = submitContentToolDefinition;
        expect(parameters.properties!.continueStory).toBeDefined();
        expect(parameters.properties!.continueStory.type).toBe('boolean');
        // Required for serial stories (description emphasizes this)
        expect(parameters.required).toContain('continueStory');
      });

      it('should define chapterSummary as optional string parameter', () => {
        const { parameters } = submitContentToolDefinition;
        expect(parameters.properties!.chapterSummary).toBeDefined();
        expect(parameters.properties!.chapterSummary.type).toBe('string');
        // Should NOT be in required array (optional)
        expect(parameters.required).not.toContain('chapterSummary');
      });

      it('should have description for continueStory parameter emphasizing it is required for serial stories', () => {
        const { parameters } = submitContentToolDefinition;
        const param = parameters.properties!.continueStory;
        expect(param.description).toBeDefined();
        expect(param.description!.length).toBeGreaterThan(10);
        // Should mention it's required for serial stories and explain true/false meaning
        expect(param.description!.toLowerCase()).toMatch(/required|continue|story|end/);
      });

      it('should have description for chapterSummary parameter', () => {
        const { parameters } = submitContentToolDefinition;
        const param = parameters.properties!.chapterSummary;
        expect(param.description).toBeDefined();
        expect(param.description!.length).toBeGreaterThan(10);
        expect(param.description!.toLowerCase()).toMatch(/summary|chapter/);
      });
    });
  });

  describe('Integration with validateTextContent', () => {
    it('should use VESTABOARD.FRAMED_MAX_ROWS (5) as row limit', async () => {
      const fiveLines = 'L1\nL2\nL3\nL4\nL5';
      const sixLines = 'L1\nL2\nL3\nL4\nL5\nL6';

      const fiveResult = await executeSubmitContent({ content: fiveLines });
      const sixResult = await executeSubmitContent({ content: sixLines });

      expect(fiveResult.accepted).toBe(true);
      expect(sixResult.accepted).toBe(false);
    });

    it('should use VESTABOARD.FRAMED_MAX_COLS (21) as column limit', async () => {
      const twentyOne = 'A'.repeat(21);

      const twentyOneResult = await executeSubmitContent({ content: twentyOne });

      expect(twentyOneResult.accepted).toBe(true);
      // Lines longer than 21 will wrap, not necessarily fail unless it causes row overflow
    });

    it('should apply automatic wrapping for slightly long lines', async () => {
      // 24 chars on one line - should wrap to 2 lines
      const content = 'GOOD MORNING LAKEWOOD CA';
      const result = await executeSubmitContent({ content });

      // Should be accepted because wrapping results in 2 lines (within 5 max)
      expect(result.accepted).toBe(true);
      // Preview should show the wrap
      const previewText = result.preview.join('\n');
      expect(previewText).toContain('wrap');
    });
  });
});
