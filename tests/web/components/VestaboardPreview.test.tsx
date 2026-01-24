/**
 * VestaboardPreview Component Tests
 *
 * Testing the 6x22 character grid display with split-flap aesthetic
 * Covers both black and white Vestaboard hardware model rendering
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import { VestaboardPreview } from '@/web/frontend/components/VestaboardPreview';

describe('VestaboardPreview Component', () => {
  const mockFormattedContent = [
    [0, 0, 0, 8, 5, 12, 12, 15, 0, 23, 15, 18, 12, 4, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ];

  describe('Grid Structure', () => {
    it('should render a 6x22 character grid', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      // Should have 6 rows
      for (let i = 0; i < 6; i++) {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId(`vestaboard-row-${i}`)).toBeInTheDocument();
      }

      // Each row should have 22 cells
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 22; col++) {
          // @ts-expect-error - jest-dom matchers
          expect(screen.getByTestId(`vestaboard-cell-${row}-${col}`)).toBeInTheDocument();
        }
      }
    });

    it('should render cells with correct character codes', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      // Check first row, first non-zero character (H = 8)
      const cell = screen.getByTestId('vestaboard-cell-0-3');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveAttribute('data-char-code', '8');
    });

    it('should handle blank cells (character code 0)', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      // Check a blank cell
      const cell = screen.getByTestId('vestaboard-cell-0-0');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveAttribute('data-char-code', '0');
    });
  });

  describe('Model Prop and Color Schemes', () => {
    describe('Default (Black) Model', () => {
      it('should use black model styling when no model prop is provided', () => {
        render(<VestaboardPreview content={mockFormattedContent} />);

        const board = screen.getByTestId('vestaboard');
        // Default should be black model with off-black background
        // @ts-expect-error - jest-dom matchers
        expect(board).toHaveClass('bg-[#0a0a0a]');
      });

      it('should render cells with dark flap background and white text for default model', () => {
        render(<VestaboardPreview content={mockFormattedContent} />);

        const cell = screen.getByTestId('vestaboard-cell-0-3');
        // Black model: near-black flaps with white text
        // @ts-expect-error - jest-dom matchers
        expect(cell).toHaveClass('bg-[#1a1a1a]');
        // @ts-expect-error - jest-dom matchers
        expect(cell).toHaveClass('text-[#ffffff]');
      });
    });

    describe('Explicit Black Model', () => {
      it('should use black model styling when model="black"', () => {
        render(<VestaboardPreview content={mockFormattedContent} model="black" />);

        const board = screen.getByTestId('vestaboard');
        // @ts-expect-error - jest-dom matchers
        expect(board).toHaveClass('bg-[#0a0a0a]');
      });

      it('should render cells with dark flap background and white text for black model', () => {
        render(<VestaboardPreview content={mockFormattedContent} model="black" />);

        const cell = screen.getByTestId('vestaboard-cell-0-3');
        // @ts-expect-error - jest-dom matchers
        expect(cell).toHaveClass('bg-[#1a1a1a]');
        // @ts-expect-error - jest-dom matchers
        expect(cell).toHaveClass('text-[#ffffff]');
      });
    });

    describe('White Model', () => {
      it('should use white model styling when model="white"', () => {
        render(<VestaboardPreview content={mockFormattedContent} model="white" />);

        const board = screen.getByTestId('vestaboard');
        // White model: off-white background
        // @ts-expect-error - jest-dom matchers
        expect(board).toHaveClass('bg-[#f5f5f5]');
      });

      it('should render cells with light flap background and dark text for white model', () => {
        render(<VestaboardPreview content={mockFormattedContent} model="white" />);

        const cell = screen.getByTestId('vestaboard-cell-0-3');
        // White model: near-white flaps with dark text
        // @ts-expect-error - jest-dom matchers
        expect(cell).toHaveClass('bg-[#e8e8e8]');
        // @ts-expect-error - jest-dom matchers
        expect(cell).toHaveClass('text-[#1a1a1a]');
      });

      it('should not have black model classes when white model is specified', () => {
        render(<VestaboardPreview content={mockFormattedContent} model="white" />);

        const board = screen.getByTestId('vestaboard');
        const cell = screen.getByTestId('vestaboard-cell-0-3');
        // Ensure black model classes are NOT present
        // @ts-expect-error - jest-dom matchers
        expect(board).not.toHaveClass('bg-[#0a0a0a]');
        // @ts-expect-error - jest-dom matchers
        expect(cell).not.toHaveClass('bg-[#1a1a1a]');
        // @ts-expect-error - jest-dom matchers
        expect(cell).not.toHaveClass('text-[#ffffff]');
      });
    });

    describe('Model Color Contrast', () => {
      it('should have opposite color schemes between black and white models', () => {
        const { rerender } = render(
          <VestaboardPreview content={mockFormattedContent} model="black" />
        );
        const boardBlack = screen.getByTestId('vestaboard');
        const cellBlack = screen.getByTestId('vestaboard-cell-0-0');

        // Capture black model classes
        const blackBoardClass = 'bg-[#0a0a0a]';
        const blackCellBg = 'bg-[#1a1a1a]';
        const blackCellText = 'text-[#ffffff]';

        // @ts-expect-error - jest-dom matchers
        expect(boardBlack).toHaveClass(blackBoardClass);
        // @ts-expect-error - jest-dom matchers
        expect(cellBlack).toHaveClass(blackCellBg);
        // @ts-expect-error - jest-dom matchers
        expect(cellBlack).toHaveClass(blackCellText);

        // Rerender with white model
        rerender(<VestaboardPreview content={mockFormattedContent} model="white" />);
        const boardWhite = screen.getByTestId('vestaboard');
        const cellWhite = screen.getByTestId('vestaboard-cell-0-0');

        // White model should have different classes
        const whiteBoardClass = 'bg-[#f5f5f5]';
        const whiteCellBg = 'bg-[#e8e8e8]';
        const whiteCellText = 'text-[#1a1a1a]';

        // @ts-expect-error - jest-dom matchers
        expect(boardWhite).toHaveClass(whiteBoardClass);
        // @ts-expect-error - jest-dom matchers
        expect(cellWhite).toHaveClass(whiteCellBg);
        // @ts-expect-error - jest-dom matchers
        expect(cellWhite).toHaveClass(whiteCellText);
      });
    });
  });

  describe('Styling and Aesthetics', () => {
    it('should apply monospace font for character display', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const cell = screen.getByTestId('vestaboard-cell-0-3');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('font-mono');
    });

    it('should apply bold font weight to cells', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const cell = screen.getByTestId('vestaboard-cell-0-3');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('font-bold');
    });

    it('should apply rounded corners to cells', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const cell = screen.getByTestId('vestaboard-cell-0-3');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('rounded');
    });

    it('should apply shadow styling to cells', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const cell = screen.getByTestId('vestaboard-cell-0-3');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('shadow-inner');
    });

    it('should apply transition animation to cells', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const cell = screen.getByTestId('vestaboard-cell-0-3');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('transition-all');
    });

    it('should apply rounded corners to the board', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const board = screen.getByTestId('vestaboard');
      // @ts-expect-error - jest-dom matchers
      expect(board).toHaveClass('rounded-lg');
    });

    it('should apply shadow to the board', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const board = screen.getByTestId('vestaboard');
      // @ts-expect-error - jest-dom matchers
      expect(board).toHaveClass('shadow-2xl');
    });
  });

  describe('Responsive Design', () => {
    it('should be responsive and scale for mobile viewports', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const board = screen.getByTestId('vestaboard');
      // @ts-expect-error - jest-dom matchers
      expect(board).toHaveClass('w-full'); // Full width for responsiveness
    });

    it('should have responsive cell sizing', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const cell = screen.getByTestId('vestaboard-cell-0-0');
      // Base size for mobile
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('w-6');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('h-8');
      // Larger on small screens
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('sm:w-8');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('sm:h-10');
      // Larger on medium screens
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('md:w-10');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('md:h-12');
    });

    it('should have responsive text sizing', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const cell = screen.getByTestId('vestaboard-cell-0-0');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('text-xs');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('sm:text-sm');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('md:text-base');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible name for screen readers', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const board = screen.getByRole('region', { name: /vestaboard display/i });
      // @ts-expect-error - jest-dom matchers
      expect(board).toBeInTheDocument();
    });

    it('should include aria-label describing the content type', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const board = screen.getByTestId('vestaboard');
      // @ts-expect-error - jest-dom matchers
      expect(board).toHaveAttribute('aria-label');
    });
  });

  describe('Custom ClassName', () => {
    it('should merge custom className with default classes', () => {
      render(<VestaboardPreview content={mockFormattedContent} className="my-custom-class" />);

      const board = screen.getByTestId('vestaboard');
      // @ts-expect-error - jest-dom matchers
      expect(board).toHaveClass('my-custom-class');
      // Should still have default classes
      // @ts-expect-error - jest-dom matchers
      expect(board).toHaveClass('w-full');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content array gracefully', () => {
      const emptyContent: number[][] = [];
      render(<VestaboardPreview content={emptyContent} />);

      const board = screen.getByTestId('vestaboard');
      // @ts-expect-error - jest-dom matchers
      expect(board).toBeInTheDocument();
      // Should still render 6 rows with default 0 values
      for (let i = 0; i < 6; i++) {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId(`vestaboard-row-${i}`)).toBeInTheDocument();
      }
    });

    it('should handle incomplete rows (less than 22 characters)', () => {
      const incompleteContent = [[1, 2, 3]]; // Only 3 chars instead of 22
      render(<VestaboardPreview content={incompleteContent} />);

      const row = screen.getByTestId('vestaboard-row-0');
      // @ts-expect-error - jest-dom matchers
      expect(row).toBeInTheDocument();
      // Should still have 22 cells per row (padded with 0s)
      for (let col = 0; col < 22; col++) {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId(`vestaboard-cell-0-${col}`)).toBeInTheDocument();
      }
    });

    it('should handle fewer than 6 rows', () => {
      const partialContent = [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ]; // Only 2 rows
      render(<VestaboardPreview content={partialContent} />);

      // Should still render all 6 rows
      for (let i = 0; i < 6; i++) {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId(`vestaboard-row-${i}`)).toBeInTheDocument();
      }
    });
  });

  describe('Character Rendering', () => {
    it('should display correct characters for letter codes', () => {
      // Content with H (8), E (5), L (12), L (12), O (15)
      render(<VestaboardPreview content={mockFormattedContent} />);

      // H is at position 0,3 with code 8
      const cellH = screen.getByTestId('vestaboard-cell-0-3');
      expect(cellH.textContent).toBe('H');

      // E is at position 0,4 with code 5
      const cellE = screen.getByTestId('vestaboard-cell-0-4');
      expect(cellE.textContent).toBe('E');

      // L is at position 0,5 with code 12
      const cellL = screen.getByTestId('vestaboard-cell-0-5');
      expect(cellL.textContent).toBe('L');
    });

    it('should display space for blank character code 0', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const blankCell = screen.getByTestId('vestaboard-cell-0-0');
      // Blank cells should have space character (or be empty)
      expect(blankCell.textContent).toBe(' ');
    });

    it('should display space for unknown character codes not in CHAR_MAP', () => {
      // Use a character code that is not defined in CHAR_MAP (e.g., 999)
      const contentWithUnknownCode = [
        [999, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ];
      render(<VestaboardPreview content={contentWithUnknownCode} />);

      const unknownCell = screen.getByTestId('vestaboard-cell-0-0');
      // Unknown character codes should fall back to space
      expect(unknownCell.textContent).toBe(' ');
    });
  });

  describe('Color Tile Rendering (codes 63-69)', () => {
    // Color codes: 63=red, 64=orange, 65=yellow, 66=green, 67=blue, 68=violet, 69=white/black
    const colorCodesContent = [
      [63, 64, 65, 66, 67, 68, 69, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    it('should render red background for code 63', () => {
      render(<VestaboardPreview content={colorCodesContent} />);

      const cell = screen.getByTestId('vestaboard-cell-0-0');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('bg-[#c23a3a]');
      // Color tiles should NOT display text
      expect(cell.textContent?.trim()).toBe('');
    });

    it('should render orange background for code 64', () => {
      render(<VestaboardPreview content={colorCodesContent} />);

      const cell = screen.getByTestId('vestaboard-cell-0-1');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('bg-[#d4804a]');
      expect(cell.textContent?.trim()).toBe('');
    });

    it('should render yellow background for code 65', () => {
      render(<VestaboardPreview content={colorCodesContent} />);

      const cell = screen.getByTestId('vestaboard-cell-0-2');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('bg-[#d4c94a]');
      expect(cell.textContent?.trim()).toBe('');
    });

    it('should render green background for code 66', () => {
      render(<VestaboardPreview content={colorCodesContent} />);

      const cell = screen.getByTestId('vestaboard-cell-0-3');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('bg-[#4aad4a]');
      expect(cell.textContent?.trim()).toBe('');
    });

    it('should render blue background for code 67', () => {
      render(<VestaboardPreview content={colorCodesContent} />);

      const cell = screen.getByTestId('vestaboard-cell-0-4');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('bg-[#4a6aad]');
      expect(cell.textContent?.trim()).toBe('');
    });

    it('should render violet background for code 68', () => {
      render(<VestaboardPreview content={colorCodesContent} />);

      const cell = screen.getByTestId('vestaboard-cell-0-5');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('bg-[#8a4aad]');
      expect(cell.textContent?.trim()).toBe('');
    });

    describe('Code 69 (white/black model-dependent)', () => {
      it('should render white background for code 69 on black model', () => {
        render(<VestaboardPreview content={colorCodesContent} model="black" />);

        const cell = screen.getByTestId('vestaboard-cell-0-6');
        // @ts-expect-error - jest-dom matchers
        expect(cell).toHaveClass('bg-[#ffffff]');
        expect(cell.textContent?.trim()).toBe('');
      });

      it('should render black background for code 69 on white model', () => {
        render(<VestaboardPreview content={colorCodesContent} model="white" />);

        const cell = screen.getByTestId('vestaboard-cell-0-6');
        // @ts-expect-error - jest-dom matchers
        expect(cell).toHaveClass('bg-[#000000]');
        expect(cell.textContent?.trim()).toBe('');
      });

      it('should default to white background for code 69 when no model specified', () => {
        render(<VestaboardPreview content={colorCodesContent} />);

        const cell = screen.getByTestId('vestaboard-cell-0-6');
        // Default model is 'black', so code 69 should be white
        // @ts-expect-error - jest-dom matchers
        expect(cell).toHaveClass('bg-[#ffffff]');
      });
    });

    it('should render all color tiles in a row correctly', () => {
      render(<VestaboardPreview content={colorCodesContent} />);

      // Verify each color tile has the expected background color class
      const expectedColors = [
        'bg-[#c23a3a]', // 63 = red
        'bg-[#d4804a]', // 64 = orange
        'bg-[#d4c94a]', // 65 = yellow
        'bg-[#4aad4a]', // 66 = green
        'bg-[#4a6aad]', // 67 = blue
        'bg-[#8a4aad]', // 68 = violet
        'bg-[#ffffff]', // 69 = white (on default black model)
      ];

      for (let col = 0; col < 7; col++) {
        const cell = screen.getByTestId(`vestaboard-cell-0-${col}`);
        // @ts-expect-error - jest-dom matchers
        expect(cell).toHaveClass(expectedColors[col]);
        // Color tiles should not display any text character
        expect(cell.textContent?.trim()).toBe('');
      }
    });

    it('should not apply default cell background when color tile is rendered', () => {
      render(<VestaboardPreview content={colorCodesContent} />);

      // For a color tile, the default cell background should be overridden
      const redCell = screen.getByTestId('vestaboard-cell-0-0');
      // Should NOT have the default cell background
      // @ts-expect-error - jest-dom matchers
      expect(redCell).not.toHaveClass('bg-[#1a1a1a]');
    });
  });

  describe('Split-Flap Animation', () => {
    const initialContent = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    const updatedContent = [
      [0, 0, 0, 8, 5, 12, 12, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should NOT animate on initial mount', () => {
      render(<VestaboardPreview content={updatedContent} />);

      // No cells should have animation class on initial render
      const cell = screen.getByTestId('vestaboard-cell-0-3');
      // @ts-expect-error - jest-dom matchers
      expect(cell).not.toHaveClass('animate-split-flap');
    });

    it('should trigger animation when content changes', async () => {
      const { rerender } = render(<VestaboardPreview content={initialContent} />);

      // Rerender with new content
      rerender(<VestaboardPreview content={updatedContent} />);

      // The cell that changed (0,3 changed from 0 to 8='H') should be animating
      const changedCell = screen.getByTestId('vestaboard-cell-0-3');
      // @ts-expect-error - jest-dom matchers
      expect(changedCell).toHaveClass('animate-split-flap');
    });

    it('should show staggered animation delays based on position', async () => {
      const { rerender } = render(<VestaboardPreview content={initialContent} />);
      rerender(<VestaboardPreview content={updatedContent} />);

      // Cell at position 0,3 should have a delay
      const cell03 = screen.getByTestId('vestaboard-cell-0-3');
      const delay03 = cell03.style.animationDelay;

      // Cell at position 0,4 should have a slightly longer delay
      const cell04 = screen.getByTestId('vestaboard-cell-0-4');
      const delay04 = cell04.style.animationDelay;

      // Both cells should have animation delays
      expect(delay03).toBeTruthy();
      expect(delay04).toBeTruthy();

      // Position (0,4) should have longer delay than (0,3)
      const delay03ms = parseInt(delay03.replace('ms', ''), 10);
      const delay04ms = parseInt(delay04.replace('ms', ''), 10);
      expect(delay04ms).toBeGreaterThan(delay03ms);
    });

    it('should show random characters during flip animation', async () => {
      const { rerender } = render(<VestaboardPreview content={initialContent} />);
      rerender(<VestaboardPreview content={updatedContent} />);

      // During animation, cells may show intermediate characters
      const changedCell = screen.getByTestId('vestaboard-cell-0-3');
      // The cell should have content during animation
      // @ts-expect-error - jest-dom matchers
      expect(changedCell).toBeInTheDocument();
    });

    it('should show final character after animation completes', async () => {
      const { rerender } = render(<VestaboardPreview content={initialContent} />);
      rerender(<VestaboardPreview content={updatedContent} />);

      // Fast-forward all timers to complete animations
      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // After animation, cell should show final character 'H' (code 8)
      const cell = screen.getByTestId('vestaboard-cell-0-3');
      expect(cell.textContent).toBe('H');
      // @ts-expect-error - jest-dom matchers
      expect(cell).not.toHaveClass('animate-split-flap');
    });

    it('should NOT animate cells that did not change', async () => {
      const { rerender } = render(<VestaboardPreview content={initialContent} />);
      rerender(<VestaboardPreview content={updatedContent} />);

      // Cell at 1,0 did not change (both are 0)
      const unchangedCell = screen.getByTestId('vestaboard-cell-1-0');
      // @ts-expect-error - jest-dom matchers
      expect(unchangedCell).not.toHaveClass('animate-split-flap');
    });

    it('should handle multiple content changes correctly', async () => {
      const { rerender } = render(<VestaboardPreview content={initialContent} />);

      // First change
      rerender(<VestaboardPreview content={updatedContent} />);
      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Second change - back to initial
      rerender(<VestaboardPreview content={initialContent} />);

      // Cells that changed should animate again
      const cell = screen.getByTestId('vestaboard-cell-0-3');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('animate-split-flap');
    });

    it('should flip through 2-3 random characters before settling', async () => {
      const { rerender } = render(<VestaboardPreview content={initialContent} />);
      rerender(<VestaboardPreview content={updatedContent} />);

      const changedCell = screen.getByTestId('vestaboard-cell-0-3');
      const seenCharacters = new Set<string>();

      // Record initial character
      seenCharacters.add(changedCell.textContent || '');

      // Advance time in small increments to capture intermediate states
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          await jest.advanceTimersByTimeAsync(100);
        });
        seenCharacters.add(changedCell.textContent || '');
      }

      // Should have seen at least 2 different characters during animation
      // (intermediate random chars + final 'H')
      expect(seenCharacters.size).toBeGreaterThanOrEqual(2);
    });

    it('should complete animation within reasonable time (500-800ms depending on position)', async () => {
      const { rerender } = render(<VestaboardPreview content={initialContent} />);
      rerender(<VestaboardPreview content={updatedContent} />);

      // After 1000ms, all animations should be complete
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1000);
      });

      const cell = screen.getByTestId('vestaboard-cell-0-3');
      // @ts-expect-error - jest-dom matchers
      expect(cell).not.toHaveClass('animate-split-flap');
      expect(cell.textContent).toBe('H');
    });
  });
});
