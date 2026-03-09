/**
 * DownvoteReasonMenu Component Tests
 *
 * Tests for the popover menu that displays downvote reason options.
 * Users select a reason before their thumbs-down vote is recorded.
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { DownvoteReasonMenu } from '@/web/frontend/components/DownvoteReasonMenu';

/**
 * The 8 predefined downvote reason options.
 * These must match the stored keys accepted by the API.
 */
const EXPECTED_REASONS = [
  { label: 'Not funny', key: 'not_funny' },
  { label: "Doesn't make sense", key: 'doesnt_make_sense' },
  { label: 'Factually wrong', key: 'factually_wrong' },
  { label: 'Too negative', key: 'too_negative' },
  { label: 'Boring', key: 'boring' },
  { label: 'Badly formatted', key: 'badly_formatted' },
  { label: 'Almost there', key: 'almost_there' },
  { label: 'Other', key: 'other' },
];

describe('DownvoteReasonMenu Component', () => {
  const mockOnSelect = jest.fn();
  const mockOnOpenChange = jest.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
    mockOnOpenChange.mockClear();
  });

  describe('Rendering', () => {
    it('should render all 8 reason options when open', () => {
      render(
        <DownvoteReasonMenu open={true} onOpenChange={mockOnOpenChange} onSelect={mockOnSelect}>
          <button>Trigger</button>
        </DownvoteReasonMenu>
      );

      for (const reason of EXPECTED_REASONS) {
        const option = screen.getByText(reason.label);
        // @ts-expect-error - jest-dom matchers
        expect(option).toBeInTheDocument();
      }
    });

    it('should not render reason options when closed', () => {
      render(
        <DownvoteReasonMenu open={false} onOpenChange={mockOnOpenChange} onSelect={mockOnSelect}>
          <button>Trigger</button>
        </DownvoteReasonMenu>
      );

      for (const reason of EXPECTED_REASONS) {
        expect(screen.queryByText(reason.label)).toBeNull();
      }
    });

    it('should render reason items with touch-friendly sizing', () => {
      render(
        <DownvoteReasonMenu open={true} onOpenChange={mockOnOpenChange} onSelect={mockOnSelect}>
          <button>Trigger</button>
        </DownvoteReasonMenu>
      );

      // Each reason option should have min-h-[44px] for touch accessibility
      const firstOption = screen.getByText(EXPECTED_REASONS[0].label);
      const button = firstOption.closest('button');
      expect(button).not.toBeNull();
      // @ts-expect-error - jest-dom matchers
      expect(button).toHaveClass('min-h-[44px]');
    });
  });

  describe('Selection', () => {
    it('should call onSelect with the correct reason key when a reason is clicked', () => {
      render(
        <DownvoteReasonMenu open={true} onOpenChange={mockOnOpenChange} onSelect={mockOnSelect}>
          <button>Trigger</button>
        </DownvoteReasonMenu>
      );

      const boringOption = screen.getByText('Boring');
      fireEvent.click(boringOption);

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).toHaveBeenCalledWith('boring');
    });

    it('should call onSelect with "other" when Other is clicked', () => {
      render(
        <DownvoteReasonMenu open={true} onOpenChange={mockOnOpenChange} onSelect={mockOnSelect}>
          <button>Trigger</button>
        </DownvoteReasonMenu>
      );

      const otherOption = screen.getByText('Other');
      fireEvent.click(otherOption);

      expect(mockOnSelect).toHaveBeenCalledWith('other');
    });

    it('should call onSelect with "factually_wrong" when Factually wrong is clicked', () => {
      render(
        <DownvoteReasonMenu open={true} onOpenChange={mockOnOpenChange} onSelect={mockOnSelect}>
          <button>Trigger</button>
        </DownvoteReasonMenu>
      );

      const option = screen.getByText('Factually wrong');
      fireEvent.click(option);

      expect(mockOnSelect).toHaveBeenCalledWith('factually_wrong');
    });
  });

  describe('Accessibility', () => {
    it('should render reason options as buttons for keyboard accessibility', () => {
      render(
        <DownvoteReasonMenu open={true} onOpenChange={mockOnOpenChange} onSelect={mockOnSelect}>
          <button>Trigger</button>
        </DownvoteReasonMenu>
      );

      // Each reason should be wrapped in a clickable button
      for (const reason of EXPECTED_REASONS) {
        const text = screen.getByText(reason.label);
        const button = text.closest('button');
        expect(button).not.toBeNull();
      }
    });
  });
});
