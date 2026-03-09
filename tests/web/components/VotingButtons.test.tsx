/**
 * VotingButtons Component Tests
 *
 * Testing touch-friendly voting buttons for content rating
 * with visual animations, confetti celebration, and haptic feedback.
 * Buttons are icon-only (no text labels) with aria-labels for accessibility.
 *
 * Thumbs-up: immediate vote with confetti + success haptic
 * Thumbs-down: opens reason popover, then votes with selected reason
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';
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

    it('should render icon-only buttons without text labels', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const upButton = screen.getByRole('button', { name: /thumbs up/i });
      const downButton = screen.getByRole('button', { name: /thumbs down/i });

      // Buttons should NOT contain visible "Good" or "Bad" text
      expect(upButton.textContent).not.toMatch(/good/i);
      expect(downButton.textContent).not.toMatch(/bad/i);
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

  describe('Thumbs Up (Immediate Vote)', () => {
    it('should call onVote with "good" immediately when thumbs up is clicked', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const upButton = screen.getByRole('button', { name: /thumbs up|good/i });
      fireEvent.click(upButton);

      expect(mockOnVote).toHaveBeenCalledTimes(1);
      expect(mockOnVote).toHaveBeenCalledWith('good');
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

  describe('Thumbs Down (Popover Reason Selection)', () => {
    it('should not immediately call onVote when thumbs down is clicked', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const downButton = screen.getByRole('button', { name: /thumbs down|bad/i });
      fireEvent.click(downButton);

      // onVote should NOT be called yet - popover should open first
      expect(mockOnVote).not.toHaveBeenCalled();
    });

    it('should show reason options after clicking thumbs down', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const downButton = screen.getByRole('button', { name: /thumbs down|bad/i });
      fireEvent.click(downButton);

      // Reason popover should display reason options
      expect(screen.getByText('Not funny')).not.toBeNull();
      expect(screen.getByText('Boring')).not.toBeNull();
      expect(screen.getByText('Other')).not.toBeNull();
    });

    it('should call onVote with "bad" and reason when a reason is selected', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      // Open popover
      const downButton = screen.getByRole('button', { name: /thumbs down|bad/i });
      fireEvent.click(downButton);

      // Select a reason
      const boringOption = screen.getByText('Boring');
      fireEvent.click(boringOption);

      expect(mockOnVote).toHaveBeenCalledTimes(1);
      expect(mockOnVote).toHaveBeenCalledWith('bad', 'boring');
    });

    it('should call onVote with correct reason key for each option', () => {
      const reasonMap = [
        { label: 'Not funny', key: 'not_funny' },
        { label: "Doesn't make sense", key: 'doesnt_make_sense' },
        { label: 'Factually wrong', key: 'factually_wrong' },
        { label: 'Too negative', key: 'too_negative' },
        { label: 'Badly formatted', key: 'badly_formatted' },
        { label: 'Almost there', key: 'almost_there' },
        { label: 'Other', key: 'other' },
      ];

      for (const { label, key } of reasonMap) {
        mockOnVote.mockClear();

        const { unmount } = render(<VotingButtons onVote={mockOnVote} />);

        const downButton = screen.getByRole('button', { name: /thumbs down|bad/i });
        fireEvent.click(downButton);

        const option = screen.getByText(label);
        fireEvent.click(option);

        expect(mockOnVote).toHaveBeenCalledWith('bad', key);

        unmount();
      }
    });

    it('should trigger haptic feedback after selecting a reason', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      // Open popover (should not trigger haptic yet)
      const downButton = screen.getByRole('button', { name: /thumbs down|bad/i });
      fireEvent.click(downButton);
      expect(mockTriggerHaptic).not.toHaveBeenCalled();

      // Select reason (should trigger haptic)
      const option = screen.getByText('Boring');
      fireEvent.click(option);

      expect(mockTriggerHaptic).toHaveBeenCalledTimes(1);
      expect(mockTriggerHaptic).toHaveBeenCalledWith('medium');
    });

    it('should play sink animation after selecting a reason', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const downButton = screen.getByRole('button', { name: /thumbs down/i });

      // Before any interaction: no animation
      expect(downButton.querySelector('.animate-vote-sink-down')).toBeNull();

      // Open popover
      fireEvent.click(downButton);

      // Select reason
      const option = screen.getByText('Other');
      fireEvent.click(option);

      // After reason selection, sink animation should be applied
      const animatedElement = downButton.querySelector('.animate-vote-sink-down');
      expect(animatedElement).not.toBeNull();
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

  describe('Vote Animation', () => {
    it('should apply upward float animation class on thumbs up vote', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const upButton = screen.getByRole('button', { name: /thumbs up/i });
      fireEvent.click(upButton);

      // The icon wrapper should get the animate-vote-float-up class
      const animatedElement = upButton.querySelector('.animate-vote-float-up');
      expect(animatedElement).not.toBeNull();
    });

    it('should not apply animation classes before any vote', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const upButton = screen.getByRole('button', { name: /thumbs up/i });
      const downButton = screen.getByRole('button', { name: /thumbs down/i });

      expect(upButton.querySelector('.animate-vote-float-up')).toBeNull();
      expect(downButton.querySelector('.animate-vote-sink-down')).toBeNull();
    });

    it('should reset animation after onAnimationEnd fires on thumbs up', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const upButton = screen.getByRole('button', { name: /thumbs up/i });
      fireEvent.click(upButton);

      // Animation class should be present after click
      const animatedElement = upButton.querySelector('.animate-vote-float-up');
      expect(animatedElement).not.toBeNull();

      // Fire animationend event to simulate animation completion
      fireEvent.animationEnd(animatedElement!);

      // Animation class should be removed after completion
      expect(upButton.querySelector('.animate-vote-float-up')).toBeNull();
    });

    it('should allow re-voting after animation completes', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const upButton = screen.getByRole('button', { name: /thumbs up/i });

      // First vote
      fireEvent.click(upButton);
      const firstAnimated = upButton.querySelector('.animate-vote-float-up');
      expect(firstAnimated).not.toBeNull();
      fireEvent.animationEnd(firstAnimated!);

      // Second vote should work and re-apply animation
      fireEvent.click(upButton);
      const secondAnimated = upButton.querySelector('.animate-vote-float-up');
      expect(secondAnimated).not.toBeNull();

      expect(mockOnVote).toHaveBeenCalledTimes(2);
    });
  });

  describe('Haptic Feedback', () => {
    it('should trigger success haptic on thumbs up vote', () => {
      render(<VotingButtons onVote={mockOnVote} />);

      const upButton = screen.getByRole('button', { name: /thumbs up|good/i });
      fireEvent.click(upButton);

      expect(mockTriggerSuccessHaptic).toHaveBeenCalledTimes(1);
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

    it('should not show confetti on thumbs down button click', () => {
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
