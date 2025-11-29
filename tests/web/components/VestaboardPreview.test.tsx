/**
 * VestaboardPreview Component Tests (TDD - RED Phase)
 *
 * Testing the 6x22 character grid display with split-flap aesthetic
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen } from '@testing-library/react';
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

  describe('Styling and Aesthetics', () => {
    it('should have split-flap board styling with dark background', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const board = screen.getByTestId('vestaboard');
      // @ts-expect-error - jest-dom matchers
      expect(board).toHaveClass('bg-gray-900'); // Dark background
    });

    it('should render cells with amber/black split-flap aesthetic', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const cell = screen.getByTestId('vestaboard-cell-0-3');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('bg-black'); // Black cell background
    });

    it('should apply monospace font for character display', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const cell = screen.getByTestId('vestaboard-cell-0-3');
      // @ts-expect-error - jest-dom matchers
      expect(cell).toHaveClass('font-mono');
    });
  });

  describe('Responsive Design', () => {
    it('should be responsive and scale for mobile viewports', () => {
      render(<VestaboardPreview content={mockFormattedContent} />);

      const board = screen.getByTestId('vestaboard');
      // @ts-expect-error - jest-dom matchers
      expect(board).toHaveClass('w-full'); // Full width for responsiveness
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

  describe('Edge Cases', () => {
    it('should handle empty content array gracefully', () => {
      const emptyContent: number[][] = [];
      render(<VestaboardPreview content={emptyContent} />);

      const board = screen.getByTestId('vestaboard');
      // @ts-expect-error - jest-dom matchers
      expect(board).toBeInTheDocument();
    });

    it('should handle incomplete rows (less than 22 characters)', () => {
      const incompleteContent = [[1, 2, 3]]; // Only 3 chars instead of 22
      render(<VestaboardPreview content={incompleteContent} />);

      const row = screen.getByTestId('vestaboard-row-0');
      // @ts-expect-error - jest-dom matchers
      expect(row).toBeInTheDocument();
    });
  });
});
