/**
 * FloatingLogo Component Tests
 *
 * Tests for the sticky glassmorphism header with gradient brand text.
 * Verifies the new design: sticky positioning, heavy blur, saturation boost,
 * crisp border, gradient logo text, and absence of old broken patterns.
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

  describe('sticky positioning (replaces fixed)', () => {
    it('uses sticky positioning instead of fixed', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('sticky');
      expect(container).not.toHaveClass('fixed');
    });

    it('is positioned at top of viewport', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('top-0');
    });

    it('spans full width', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('w-full');
    });

    it('does not use left-0 (not needed for sticky)', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).not.toHaveClass('left-0');
    });
  });

  describe('z-index layering', () => {
    it('has z-40 for stacking above content but below modals', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('z-40');
    });
  });

  describe('glassmorphism effect', () => {
    it('has uniform white background with opacity', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container.className).toContain('bg-white/60');
    });

    it('has dark mode uniform background with opacity', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container.className).toContain('dark:bg-gray-950/50');
    });

    it('applies heavy backdrop blur', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('backdrop-blur-2xl');
    });

    it('applies backdrop saturation boost', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('backdrop-saturate-150');
    });

    it('does not use gradient-to-transparent background', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container.className).not.toContain('bg-gradient-to-b');
      expect(container.className).not.toContain('to-transparent');
      expect(container.className).not.toContain('from-gray-50');
    });

    it('does not use old backdrop-blur-md', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).not.toHaveClass('backdrop-blur-md');
    });
  });

  describe('crisp border and shadow', () => {
    it('has bottom border for crisp boundary', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('border-b');
    });

    it('has red-tinted border color', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container.className).toContain('border-red-200/30');
    });

    it('has dark mode border color', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container.className).toContain('dark:border-red-500/20');
    });

    it('has red-tinted shadow', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container.className).toContain('shadow-');
    });
  });

  describe('pointer events removed', () => {
    it('does not have pointer-events-none on container', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).not.toHaveClass('pointer-events-none');
    });

    it('does not have pointer-events-auto on any child', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      const textContainer = mainText.parentElement;
      if (textContainer) {
        expect(textContainer).not.toHaveClass('pointer-events-auto');
      }
    });
  });

  describe('gradient logo text', () => {
    it('applies transparent text color for gradient effect', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      expect(mainText).toHaveClass('text-transparent');
    });

    it('applies background clip text for gradient', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      expect(mainText).toHaveClass('bg-clip-text');
    });

    it('applies red-yellow-red gradient to logo', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      expect(mainText.className).toContain('bg-gradient-to-r');
      expect(mainText.className).toContain('from-red-500');
      expect(mainText.className).toContain('via-yellow-400');
      expect(mainText.className).toContain('to-red-500');
    });

    it('does not use old solid text colors on logo', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      expect(mainText).not.toHaveClass('text-gray-900');
      expect(mainText).not.toHaveClass('dark:text-white');
    });
  });

  describe('byline styling', () => {
    it('has red-tinted color in light mode', () => {
      render(<FloatingLogo />);
      const byline = screen.getByText('BY HOUSEBOY');
      expect(byline.className).toContain('text-red-800/60');
    });

    it('has red-tinted color in dark mode', () => {
      render(<FloatingLogo />);
      const byline = screen.getByText('BY HOUSEBOY');
      expect(byline.className).toContain('dark:text-red-300/50');
    });

    it('has wide letter spacing', () => {
      render(<FloatingLogo />);
      const byline = screen.getByText('BY HOUSEBOY');
      expect(byline.className).toContain('tracking-[0.3em]');
    });

    it('does not use old gray text colors', () => {
      render(<FloatingLogo />);
      const byline = screen.getByText('BY HOUSEBOY');
      expect(byline).not.toHaveClass('text-gray-600');
      expect(byline).not.toHaveClass('dark:text-gray-400');
    });
  });

  describe('typography styling', () => {
    it('applies brush script font to main text', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      expect(mainText).toHaveClass('font-brush');
    });

    it('applies large size to main text', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      expect(mainText).toHaveClass('text-4xl');
    });

    it('applies display font to byline', () => {
      render(<FloatingLogo />);
      const byline = screen.getByText('BY HOUSEBOY');
      expect(byline).toHaveClass('font-display');
    });

    it('applies smaller size to byline', () => {
      render(<FloatingLogo />);
      const byline = screen.getByText('BY HOUSEBOY');
      expect(byline).toHaveClass('text-sm');
    });
  });

  describe('layout structure', () => {
    it('uses flexbox centered layout', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('flex');
      expect(container).toHaveClass('justify-center');
      expect(container).toHaveClass('items-center');
    });

    it('has reduced bottom padding (pb-4 not pb-12)', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('pb-4');
      expect(container).not.toHaveClass('pb-12');
    });

    it('has top padding', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('pt-6');
    });

    it('has horizontal padding', () => {
      render(<FloatingLogo />);
      const container = screen.getByTestId('floating-logo');
      expect(container).toHaveClass('px-4');
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
      expect(container).toHaveClass('sticky');
      expect(container).toHaveClass('custom-margin');
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
      expect(mainText.closest('h1')).toBeInTheDocument();
    });
  });

  describe('responsive design', () => {
    it('has mobile-first text sizing', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      expect(mainText).toHaveClass('text-4xl');
    });

    it('increases text size on larger screens', () => {
      render(<FloatingLogo />);
      const mainText = screen.getByText('Clack Track');
      expect(mainText.className).toMatch(/md:text-/);
    });
  });

  describe('accessibility', () => {
    it('has banner role via header element', () => {
      render(<FloatingLogo />);
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('main text is readable by screen readers', () => {
      render(<FloatingLogo />);
      expect(screen.getByText('Clack Track')).toBeVisible();
    });

    it('byline is readable by screen readers', () => {
      render(<FloatingLogo />);
      expect(screen.getByText('BY HOUSEBOY')).toBeVisible();
    });
  });
});
