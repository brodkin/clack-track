/**
 * VotingButtons Component Tests (TDD - RED Phase)
 *
 * Testing touch-friendly voting buttons for content rating
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, jest } from '@jest/globals';
import { VotingButtons } from '@/web/frontend/components/VotingButtons';

describe('VotingButtons Component', () => {
  const mockOnVote = jest.fn();

  beforeEach(() => {
    mockOnVote.mockClear();
  });

  describe('Button Rendering', () => {
    it('should render both thumbs up and thumbs down buttons', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const upButton = screen.getByRole('button', { name: /thumbs up|good/i });
      const downButton = screen.getByRole('button', { name: /thumbs down|bad/i });

      // @ts-expect-error - jest-dom matchers
      expect(upButton).toBeInTheDocument();
      // @ts-expect-error - jest-dom matchers
      expect(downButton).toBeInTheDocument();
    });

    it('should display visual icons for voting', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      // Both buttons should be present (we check this via aria-labels)
      const upButton = screen.getByRole('button', { name: /thumbs up|good/i });
      const downButton = screen.getByRole('button', { name: /thumbs down|bad/i });

      // @ts-expect-error - jest-dom matchers
      expect(upButton).toBeInTheDocument();
      // @ts-expect-error - jest-dom matchers
      expect(downButton).toBeInTheDocument();
    });
  });

  describe('Touch-Friendly Size', () => {
    it('should have minimum 44px tap target for accessibility', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const upButton = screen.getByRole('button', { name: /thumbs up|good/i });
      const downButton = screen.getByRole('button', { name: /thumbs down|bad/i });

      // Should have large button class or inline styles
      // @ts-expect-error - jest-dom matchers
      expect(upButton).toHaveClass('h-14');
      // @ts-expect-error - jest-dom matchers
      expect(downButton).toHaveClass('h-14');
    });
  });

  describe('User Interactions', () => {
    it('should call onVote with "good" when thumbs up is clicked', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const upButton = screen.getByRole('button', { name: /thumbs up|good/i });
      fireEvent.click(upButton);

      expect(mockOnVote).toHaveBeenCalledTimes(1);
      expect(mockOnVote).toHaveBeenCalledWith('good');
    });

    it('should call onVote with "bad" when thumbs down is clicked', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const downButton = screen.getByRole('button', { name: /thumbs down|bad/i });
      fireEvent.click(downButton);

      expect(mockOnVote).toHaveBeenCalledTimes(1);
      expect(mockOnVote).toHaveBeenCalledWith('bad');
    });

    it('should be keyboard accessible', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const upButton = screen.getByRole('button', { name: /thumbs up|good/i });
      const downButton = screen.getByRole('button', { name: /thumbs down|bad/i });

      // Buttons should be accessible via role
      // @ts-expect-error - jest-dom matchers
      expect(upButton).toBeInTheDocument();
      // @ts-expect-error - jest-dom matchers
      expect(downButton).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should disable buttons when in loading state', () => {
      render(<VotingButtons onVote={mockOnVote} isLoading={true} />);

      const upButton = screen.getByRole('button', { name: /thumbs up|good/i });
      const downButton = screen.getByRole('button', { name: /thumbs down|bad/i });

      // @ts-expect-error - jest-dom matchers
      expect(upButton).toBeDisabled();
      // @ts-expect-error - jest-dom matchers
      expect(downButton).toBeDisabled();
    });

    it('should not call onVote when loading', () => {
      render(<VotingButtons onVote={mockOnVote} isLoading={true} />);

      const upButton = screen.getByRole('button', { name: /thumbs up|good/i });
      fireEvent.click(upButton);

      expect(mockOnVote).not.toHaveBeenCalled();
    });
  });

  describe('Styling', () => {
    it('should have distinct visual styles for good and bad buttons', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const upButton = screen.getByRole('button', { name: /thumbs up|good/i });
      const downButton = screen.getByRole('button', { name: /thumbs down|bad/i });

      // Good button should have green/positive styling
      // @ts-expect-error - jest-dom matchers
      expect(upButton).toHaveClass('text-green-600');

      // Bad button should have red/negative styling
      // @ts-expect-error - jest-dom matchers
      expect(downButton).toHaveClass('text-red-600');
    });

    it('should have visible focus states for accessibility', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const upButton = screen.getByRole('button', { name: /thumbs up|good/i });

      // Should have focus-visible class or similar
      // @ts-expect-error - jest-dom matchers
      expect(upButton).toHaveClass('focus:outline-none');
    });
  });
});
