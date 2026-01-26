/**
 * MoreInfoButton Component Tests
 *
 * Testing reusable external link button with accessibility features
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import { MoreInfoButton } from '@/web/frontend/components/MoreInfoButton';

describe('MoreInfoButton Component', () => {
  const testUrl = 'https://example.com/article';

  describe('Rendering', () => {
    it('should render button with "More Info" text', () => {
      render(<MoreInfoButton url={testUrl} />);

      const button = screen.getByRole('link', { name: /more info/i });
      // @ts-expect-error - jest-dom matchers
      expect(button).toBeInTheDocument();
    });

    it('should render ExternalLink icon', () => {
      const { container } = render(<MoreInfoButton url={testUrl} />);

      // Check for SVG icon (lucide-react icons are SVG)
      const icon = container.querySelector('svg');
      expect(icon).not.toBeNull();
    });

    it('should not render if url is not provided', () => {
      render(<MoreInfoButton url={null} />);

      // Should not render any link
      const link = screen.queryByRole('link');
      expect(link).toBeNull();
    });

    it('should not render if url is empty string', () => {
      render(<MoreInfoButton url="" />);

      // Should not render any link
      const link = screen.queryByRole('link');
      expect(link).toBeNull();
    });
  });

  describe('Link Behavior', () => {
    it('should have correct href attribute', () => {
      render(<MoreInfoButton url={testUrl} />);

      const button = screen.getByRole('link', { name: /more info/i });
      // @ts-expect-error - jest-dom matchers
      expect(button).toHaveAttribute('href', testUrl);
    });

    it('should open in new tab', () => {
      render(<MoreInfoButton url={testUrl} />);

      const button = screen.getByRole('link', { name: /more info/i });
      // @ts-expect-error - jest-dom matchers
      expect(button).toHaveAttribute('target', '_blank');
    });

    it('should have security attributes for external links', () => {
      render(<MoreInfoButton url={testUrl} />);

      const button = screen.getByRole('link', { name: /more info/i });
      // @ts-expect-error - jest-dom matchers
      expect(button).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Accessibility', () => {
    it('should have descriptive aria-label', () => {
      render(<MoreInfoButton url={testUrl} />);

      const button = screen.getByRole('link', { name: /more info.*opens in new tab/i });
      // @ts-expect-error - jest-dom matchers
      expect(button).toBeInTheDocument();
    });

    it('should be keyboard accessible', () => {
      render(<MoreInfoButton url={testUrl} />);

      const button = screen.getByRole('link', { name: /more info/i });
      // Link elements are natively keyboard accessible
      // @ts-expect-error - jest-dom matchers
      expect(button).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('should support default size variant', () => {
      render(<MoreInfoButton url={testUrl} />);

      const button = screen.getByRole('link', { name: /more info/i });
      // @ts-expect-error - jest-dom matchers
      expect(button).toBeInTheDocument();
    });

    it('should support small size variant', () => {
      render(<MoreInfoButton url={testUrl} size="sm" />);

      const button = screen.getByRole('link', { name: /more info/i });
      // @ts-expect-error - jest-dom matchers
      expect(button).toHaveClass('h-8'); // Small button height
    });

    it('should use default size when not specified', () => {
      render(<MoreInfoButton url={testUrl} />);

      const button = screen.getByRole('link', { name: /more info/i });
      // @ts-expect-error - jest-dom matchers
      expect(button).toHaveClass('h-9'); // Default button height
    });
  });

  describe('Styling', () => {
    it('should have button styling classes', () => {
      render(<MoreInfoButton url={testUrl} />);

      const button = screen.getByRole('link', { name: /more info/i });
      // Should have outline variant styling
      // @ts-expect-error - jest-dom matchers
      expect(button).toHaveClass('border');
    });

    it('should have hover states', () => {
      render(<MoreInfoButton url={testUrl} />);

      const button = screen.getByRole('link', { name: /more info/i });
      // Should have hover styling classes
      // @ts-expect-error - jest-dom matchers
      expect(button).toHaveClass('hover:bg-accent');
    });

    it('should have focus states for accessibility', () => {
      render(<MoreInfoButton url={testUrl} />);

      const button = screen.getByRole('link', { name: /more info/i });
      // Should have focus-visible classes
      // @ts-expect-error - jest-dom matchers
      expect(button).toHaveClass('focus-visible:outline-none');
    });
  });

  describe('Icon Positioning', () => {
    it('should render icon after text', () => {
      const { container } = render(<MoreInfoButton url={testUrl} />);

      const button = screen.getByRole('link', { name: /more info/i });
      const icon = container.querySelector('svg');

      // Icon should exist
      expect(icon).not.toBeNull();
      // Button should contain "More Info" text
      expect(button.textContent).toContain('More Info');
      // Icon should have aria-hidden for accessibility
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('className Prop', () => {
    it('should forward className to button element', () => {
      render(<MoreInfoButton url={testUrl} className="ml-auto" />);

      const button = screen.getByRole('link', { name: /more info/i });
      // @ts-expect-error - jest-dom matchers
      expect(button).toHaveClass('ml-auto');
    });

    it('should merge className with default classes', () => {
      render(<MoreInfoButton url={testUrl} className="custom-class" />);

      const button = screen.getByRole('link', { name: /more info/i });
      // Should have both custom and default classes
      // @ts-expect-error - jest-dom matchers
      expect(button).toHaveClass('custom-class');
      // @ts-expect-error - jest-dom matchers
      expect(button).toHaveClass('gap-2'); // Default class from component
    });

    it('should work without className prop', () => {
      render(<MoreInfoButton url={testUrl} />);

      const button = screen.getByRole('link', { name: /more info/i });
      // Should still render with default classes
      // @ts-expect-error - jest-dom matchers
      expect(button).toHaveClass('gap-2');
    });
  });
});
