/**
 * FloatingLogo Component Tests
 *
 * Tests for the floating logo with gradient blur effect
 */

import { render, screen } from '@testing-library/react';
import { FloatingLogo } from '../../../src/web/frontend/components/FloatingLogo';

describe('FloatingLogo', () => {
  describe('text content rendering', () => {
    it('renders "Clack Track" main text', () => {
      render(<FloatingLogo />);
      expect(screen.getByText('Clack Track')).toBeInTheDocument();
    });

    it('renders "BY HOUSEBOY" byline text', () => {
      render(<FloatingLogo />);
      expect(screen.getByText('BY HOUSEBOY')).toBeInTheDocument();
    });

    it('has logo container with testid', () => {
      render(<FloatingLogo />);
      expect(screen.getByTestId('floating-logo')).toBeInTheDocument();
    });
  });

  describe('fixed positioning', () => {
    it('has fixed position class', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('fixed');
    });

    it('is positioned at top of viewport', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('top-0');
    });

    it('is positioned at left of viewport', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('left-0');
    });

    it('spans full width', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('w-full');
    });
  });

  describe('z-index layering', () => {
    it('has high z-index for stacking above content', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      // z-40 provides stacking above most content but below modals (z-50)
      expect(container).toHaveClass('z-40');
    });
  });

  describe('gradient blur effect', () => {
    it('has gradient background', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      // Gradient from solid to transparent for fade effect
      expect(container.className).toMatch(/bg-gradient-to-b/);
    });

    it('has backdrop blur effect', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('backdrop-blur-md');
    });

    it('fades from opaque to transparent', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      // Gradient should go from solid background color to transparent
      expect(container.className).toMatch(/from-/);
      expect(container.className).toMatch(/to-transparent/);
    });
  });

  describe('typography styling', () => {
    it('applies brush script font to main text', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      // Will use font-brush class (defined in clack-0rij.4)
      expect(mainText).toHaveClass('font-brush');
    });

    it('applies large size to main text', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      expect(mainText).toHaveClass('text-4xl');
    });

    it('applies sans-serif font to byline', () => {
      render(<FloatingLogo />);
      const byline = screen.getByText('BY HOUSEBOY');
      // Will use font-display class (defined in clack-0rij.4)
      expect(byline).toHaveClass('font-display');
    });

    it('applies smaller size to byline', () => {
      render(<FloatingLogo />);
      const byline = screen.getByText('BY HOUSEBOY');
      expect(byline).toHaveClass('text-sm');
    });

    it('applies letter spacing to byline', () => {
      render(<FloatingLogo />);
      const byline = screen.getByText('BY HOUSEBOY');
      expect(byline).toHaveClass('tracking-widest');
    });

    it('applies font weight to byline', () => {
      render(<FloatingLogo />);
      const byline = screen.getByText('BY HOUSEBOY');
      expect(byline).toHaveClass('font-light');
    });
  });

  describe('dark mode support', () => {
    it('has light mode gradient colors', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      // Light mode: from white/gray
      expect(container.className).toMatch(/from-(white|gray-50|gray-100)/);
    });

    it('has dark mode gradient colors', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      // Dark mode: from dark gray
      expect(container.className).toMatch(/dark:from-gray-(800|900|950)/);
    });

    it('has light mode text color', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      expect(mainText).toHaveClass('text-gray-900');
    });

    it('has dark mode text color', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      expect(mainText).toHaveClass('dark:text-white');
    });
  });

  describe('layout structure', () => {
    it('centers content horizontally', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('flex');
      expect(container).toHaveClass('justify-center');
    });

    it('centers content vertically within padding', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('items-center');
    });

    it('has vertical padding for spacing', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container.className).toMatch(/py-/);
    });

    it('has horizontal padding', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container.className).toMatch(/px-/);
    });
  });

  describe('custom className', () => {
    it('accepts and applies custom className', () => {
      render(<FloatingLogo className="custom-test-class" />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('custom-test-class');
    });

    it('merges custom className with default styles', () => {
      render(<FloatingLogo className="custom-margin" />);
      const container = screen.getByTestId('floating-logo');
      // Should have both default and custom classes
      expect(container).toHaveClass('fixed');
      expect(container).toHaveClass('custom-margin');
    });
  });

  describe('pointer events', () => {
    it('allows pointer events to pass through container', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      // Logo should not block interactions with content below
      expect(container).toHaveClass('pointer-events-none');
    });

    it('enables pointer events on text elements', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      const textContainer = mainText.parentElement;
      // Text itself should be clickable if needed
      expect(textContainer).toHaveClass('pointer-events-auto');
    });
  });

  describe('semantic HTML', () => {
    it('uses header element for logo container', () => {
      render(<FloatingLogo />);
      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();
      expect(header).toBe(screen.getByTestId('floating-logo'));
    });

    it('has proper heading hierarchy', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      // Main text should be in an h1
      expect(mainText.closest('h1')).toBeInTheDocument();
    });
  });

  describe('responsive design', () => {
    it('adjusts text size on mobile', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      // Should have mobile-first sizing
      expect(mainText).toHaveClass('text-4xl');
    });

    it('increases text size on larger screens', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      // Should have responsive sizing
      expect(mainText.className).toMatch(/md:text-/);
    });

    it('adjusts padding on mobile', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container.className).toMatch(/py-/);
    });
  });

  describe('accessibility', () => {
    it('has descriptive role', () => {
      render(<FloatingLogo />);
      // Header element provides banner role
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('main text is readable by screen readers', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      expect(mainText).toBeVisible();
    });

    it('byline is readable by screen readers', () => {
      render(<FloatingLogo />);
      const byline = screen.getByText('BY HOUSEBOY');
      expect(byline).toBeVisible();
    });
  });
});
