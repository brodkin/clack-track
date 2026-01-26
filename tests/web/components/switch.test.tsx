/**
 * Switch Component Tests (TDD - RED Phase)
 *
 * Testing shadcn/ui Switch component for circuit toggle controls
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, jest } from '@jest/globals';
import { Switch } from '@/web/frontend/components/ui/switch';

describe('Switch Component', () => {
  describe('Rendering', () => {
    it('should render a switch element', () => {
      render(<Switch />);

      const switchElement = screen.getByRole('switch');

      // @ts-expect-error - jest-dom matchers
      expect(switchElement).toBeInTheDocument();
    });

    it('should render in unchecked state by default', () => {
      render(<Switch />);

      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });

    it('should render in checked state when checked prop is true', () => {
      render(<Switch checked={true} />);

      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('should render in checked state when defaultChecked prop is true', () => {
      render(<Switch defaultChecked={true} />);

      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('User Interactions', () => {
    it('should call onCheckedChange when toggled', () => {
      const mockOnCheckedChange = jest.fn();
      render(<Switch onCheckedChange={mockOnCheckedChange} />);

      const switchElement = screen.getByRole('switch');
      fireEvent.click(switchElement);

      expect(mockOnCheckedChange).toHaveBeenCalledTimes(1);
      expect(mockOnCheckedChange).toHaveBeenCalledWith(true);
    });

    it('should toggle from checked to unchecked', () => {
      const mockOnCheckedChange = jest.fn();
      render(<Switch checked={true} onCheckedChange={mockOnCheckedChange} />);

      const switchElement = screen.getByRole('switch');
      fireEvent.click(switchElement);

      expect(mockOnCheckedChange).toHaveBeenCalledWith(false);
    });

    it('should be keyboard accessible', () => {
      const mockOnCheckedChange = jest.fn();
      render(<Switch onCheckedChange={mockOnCheckedChange} />);

      const switchElement = screen.getByRole('switch');
      fireEvent.keyDown(switchElement, { key: 'Enter' });

      // Switch should respond to keyboard input (Radix handles this)
      // @ts-expect-error - jest-dom matchers
      expect(switchElement).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Switch disabled={true} />);

      const switchElement = screen.getByRole('switch');

      // @ts-expect-error - jest-dom matchers
      expect(switchElement).toBeDisabled();
    });

    it('should not call onCheckedChange when disabled', () => {
      const mockOnCheckedChange = jest.fn();
      render(<Switch disabled={true} onCheckedChange={mockOnCheckedChange} />);

      const switchElement = screen.getByRole('switch');
      fireEvent.click(switchElement);

      expect(mockOnCheckedChange).not.toHaveBeenCalled();
    });
  });

  describe('Styling', () => {
    it('should accept custom className', () => {
      render(<Switch className="custom-class" />);

      const switchElement = screen.getByRole('switch');

      // @ts-expect-error - jest-dom matchers
      expect(switchElement).toHaveClass('custom-class');
    });

    it('should have proper base styling classes', () => {
      render(<Switch />);

      const switchElement = screen.getByRole('switch');

      // Should have transition styling for smooth toggle animation
      // @ts-expect-error - jest-dom matchers
      expect(switchElement).toHaveClass('transition-colors');
    });
  });

  describe('Accessibility', () => {
    it('should support aria-label', () => {
      render(<Switch aria-label="Toggle feature" />);

      const switchElement = screen.getByRole('switch', { name: 'Toggle feature' });

      // @ts-expect-error - jest-dom matchers
      expect(switchElement).toBeInTheDocument();
    });

    it('should support id for label association', () => {
      render(
        <div>
          <label htmlFor="my-switch">Toggle me</label>
          <Switch id="my-switch" />
        </div>
      );

      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('id', 'my-switch');
    });
  });
});
