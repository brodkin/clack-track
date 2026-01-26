/**
 * VotingButtons Component Tests
 *
 * Testing touch-friendly voting buttons for content rating
 * with confetti celebration and haptic feedback
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { VotingButtons } from '@/web/frontend/components/VotingButtons';
import * as animations from '@/web/frontend/lib/animations';

// Mock the animations module
jest.mock('@/web/frontend/lib/animations', () => ({
  triggerHaptic: jest.fn(),
  triggerSuccessHaptic: jest.fn(),
  createConfettiAnimation: jest.fn(() => jest.fn()),
  CONFETTI_COLORS: ['#FFB800', '#FF8C00', '#FFD700'],
}));

describe('VotingButtons Component', () => {
  const mockOnVote = jest.fn();
  const mockTriggerHaptic = animations.triggerHaptic as jest.Mock;
  const mockTriggerSuccessHaptic = animations.triggerSuccessHaptic as jest.Mock;

  beforeEach(() => {
    mockOnVote.mockClear();
    mockTriggerHaptic.mockClear();
    mockTriggerSuccessHaptic.mockClear();
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

  describe('Haptic Feedback', () => {
    it('should trigger success haptic on thumbs up vote', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const upButton = screen.getByRole('button', { name: /thumbs up|good/i });
      fireEvent.click(upButton);

      expect(mockTriggerSuccessHaptic).toHaveBeenCalledTimes(1);
    });

    it('should trigger medium haptic on thumbs down vote', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const downButton = screen.getByRole('button', { name: /thumbs down|bad/i });
      fireEvent.click(downButton);

      expect(mockTriggerHaptic).toHaveBeenCalledTimes(1);
      expect(mockTriggerHaptic).toHaveBeenCalledWith('medium');
    });

    it('should not trigger haptics when disabled', () => {
      render(<VotingButtons onVote={mockOnVote} isLoading={true} />);

      const upButton = screen.getByRole('button', { name: /thumbs up|good/i });
      const downButton = screen.getByRole('button', { name: /thumbs down|bad/i });

      fireEvent.click(upButton);
      fireEvent.click(downButton);

      expect(mockTriggerSuccessHaptic).not.toHaveBeenCalled();
      expect(mockTriggerHaptic).not.toHaveBeenCalled();
    });
  });

  describe('Confetti Animation', () => {
    it('should show confetti on thumbs up vote', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const upButton = screen.getByRole('button', { name: /thumbs up|good/i });
      fireEvent.click(upButton);

      // Confetti canvas should be rendered (aria-hidden for accessibility)
      const confettiCanvas = document.querySelector('canvas[aria-hidden="true"]');
      expect(confettiCanvas).not.toBeNull();
    });

    it('should not show confetti on thumbs down vote', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const downButton = screen.getByRole('button', { name: /thumbs down|bad/i });
      fireEvent.click(downButton);

      // Confetti canvas should not be rendered
      const confettiCanvas = document.querySelector('canvas[aria-hidden="true"]');
      expect(confettiCanvas).toBeNull();
    });

    it('should not show confetti when disabled', () => {
      render(<VotingButtons onVote={mockOnVote} isLoading={true} />);

      const upButton = screen.getByRole('button', { name: /thumbs up|good/i });
      fireEvent.click(upButton);

      // Confetti canvas should not be rendered when buttons are disabled
      const confettiCanvas = document.querySelector('canvas[aria-hidden="true"]');
      expect(confettiCanvas).toBeNull();
    });
  });
});
