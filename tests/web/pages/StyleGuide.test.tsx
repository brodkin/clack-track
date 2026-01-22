/**
 * StyleGuide Page Tests
 *
 * Tests for the StyleGuide page with all design system sections:
 * Typography, Colors, Buttons, Cards & Badges, Forms, Feature Components
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, jest } from '@jest/globals';
import { StyleGuide } from '@/web/frontend/pages/StyleGuide';
import { toast } from 'sonner';

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  }),
}));

// Cast toast to mocked type for test assertions
const mockedToast = toast as jest.MockedFunction<typeof toast> & {
  success: jest.MockedFunction<typeof toast.success>;
  error: jest.MockedFunction<typeof toast.error>;
  info: jest.MockedFunction<typeof toast.info>;
  warning: jest.MockedFunction<typeof toast.warning>;
};

describe('StyleGuide Page', () => {
  const renderStyleGuide = () => {
    return render(
      <MemoryRouter>
        <StyleGuide />
      </MemoryRouter>
    );
  };

  describe('Page Layout', () => {
    it('should render with PageLayout wrapper', () => {
      renderStyleGuide();

      // PageLayout includes Navigation with hamburger button (labeled "Open menu")
      const hamburgerButton = screen.getByRole('button', { name: /open menu/i });
      // @ts-expect-error - jest-dom matchers
      expect(hamburgerButton).toBeInTheDocument();
    });

    it('should display the page title', () => {
      renderStyleGuide();

      const title = screen.getByRole('heading', { level: 1, name: /style guide/i });
      // @ts-expect-error - jest-dom matchers
      expect(title).toBeInTheDocument();
    });
  });

  describe('Typography Section', () => {
    it('should display the typography section heading', () => {
      renderStyleGuide();

      const sectionHeading = screen.getByRole('heading', { name: /typography/i });
      // @ts-expect-error - jest-dom matchers
      expect(sectionHeading).toBeInTheDocument();
    });

    it('should display all heading levels (h1-h6)', () => {
      renderStyleGuide();

      // Check for heading level labels/demos - use getAllByText since there may be multiple matches
      expect(screen.getAllByText(/heading 1/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/heading 2/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/heading 3/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/heading 4/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/heading 5/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/heading 6/i).length).toBeGreaterThan(0);
    });

    it('should display font family examples', () => {
      renderStyleGuide();

      // Check for font family section - use getAllByText for multiple matches
      expect(screen.getAllByText(/font families/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/inter/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/system-ui/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/monospace/i).length).toBeGreaterThan(0);
    });

    it('should display body text examples', () => {
      renderStyleGuide();

      // Check for body text section - use getAllByText for multiple matches
      expect(screen.getAllByText(/body text/i).length).toBeGreaterThan(0);
    });

    it('should display code/monospace examples', () => {
      renderStyleGuide();

      // Check for code examples
      const codeElements = screen.getAllByText(/const|function|code/i);
      expect(codeElements.length).toBeGreaterThan(0);
    });
  });

  describe('Heading Scale', () => {
    it('should demonstrate text-3xl scale', () => {
      renderStyleGuide();

      // The component should have text demonstrating 3xl scale
      const container = document.querySelector('.text-3xl');
      expect(container).toBeTruthy();
    });

    it('should demonstrate text-2xl scale', () => {
      renderStyleGuide();

      const container = document.querySelector('.text-2xl');
      expect(container).toBeTruthy();
    });

    it('should demonstrate text-lg scale', () => {
      renderStyleGuide();

      const container = document.querySelector('.text-lg');
      expect(container).toBeTruthy();
    });

    it('should demonstrate text-sm scale', () => {
      renderStyleGuide();

      const container = document.querySelector('.text-sm');
      expect(container).toBeTruthy();
    });
  });

  describe('Dark Mode Support', () => {
    it('should have dark mode classes for text colors', () => {
      renderStyleGuide();

      // Check for dark mode variants in the component
      const darkModeElements = document.querySelectorAll('[class*="dark:"]');
      expect(darkModeElements.length).toBeGreaterThan(0);
    });
  });

  describe('Colors Section', () => {
    it('should display the colors section heading', () => {
      renderStyleGuide();

      const sectionHeading = screen.getByRole('heading', { name: /^colors$/i });
      // @ts-expect-error - jest-dom matchers
      expect(sectionHeading).toBeInTheDocument();
    });

    it('should display core theme colors', () => {
      renderStyleGuide();

      // Use getAllByText since terms like "Background" appear multiple times
      expect(screen.getAllByText(/background/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/foreground/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/primary/i).length).toBeGreaterThan(0);
    });

    it('should display chart colors', () => {
      renderStyleGuide();

      expect(screen.getByText(/chart 1/i)).toBeTruthy();
      expect(screen.getByText(/chart 2/i)).toBeTruthy();
    });

    it('should display light/dark mode comparison', () => {
      renderStyleGuide();

      // Use getAllByText since "Light Mode" and "Dark Mode" appear multiple times
      expect(screen.getAllByText(/light mode/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/dark mode/i).length).toBeGreaterThan(0);
    });
  });

  describe('Buttons Section', () => {
    it('should display the buttons section heading', () => {
      renderStyleGuide();

      const sectionHeading = screen.getByRole('heading', { name: /^buttons$/i });
      // @ts-expect-error - jest-dom matchers
      expect(sectionHeading).toBeInTheDocument();
    });

    it('should display all button variants', () => {
      renderStyleGuide();

      // Check for variant labels
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(10); // Many button examples
    });

    it('should display disabled button states', () => {
      renderStyleGuide();

      const disabledButtons = document.querySelectorAll('button[disabled]');
      expect(disabledButtons.length).toBeGreaterThan(0);
    });

    it('should display buttons with icons', () => {
      renderStyleGuide();

      // Check for icon buttons - they use SVG elements inside
      const buttonsWithSvg = document.querySelectorAll('button svg');
      expect(buttonsWithSvg.length).toBeGreaterThan(0);
    });
  });

  describe('Cards & Badges Section', () => {
    it('should display the cards and badges section heading', () => {
      renderStyleGuide();

      const sectionHeading = screen.getByRole('heading', {
        name: /cards & badges/i,
      });
      // @ts-expect-error - jest-dom matchers
      expect(sectionHeading).toBeInTheDocument();
    });

    it('should display badge variants', () => {
      renderStyleGuide();

      // Check for badge examples
      expect(screen.getAllByText(/default/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/secondary/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/destructive/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/outline/i).length).toBeGreaterThan(0);
    });

    it('should display card examples', () => {
      renderStyleGuide();

      // Check for card structure elements
      expect(screen.getAllByText(/card title/i).length).toBeGreaterThan(0);
    });
  });

  describe('Forms & Interactive Section', () => {
    it('should display the forms section heading', () => {
      renderStyleGuide();

      const sectionHeading = screen.getByRole('heading', {
        name: /forms & interactive/i,
      });
      // @ts-expect-error - jest-dom matchers
      expect(sectionHeading).toBeInTheDocument();
    });

    it('should display input examples', () => {
      renderStyleGuide();

      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('should display disabled input state', () => {
      renderStyleGuide();

      const disabledInputs = document.querySelectorAll('input[disabled]');
      expect(disabledInputs.length).toBeGreaterThan(0);
    });

    it('should display separator examples', () => {
      renderStyleGuide();

      // Separators are rendered as div elements with role="none" or specific classes
      const separators = document.querySelectorAll('[data-orientation]');
      expect(separators.length).toBeGreaterThan(0);
    });

    it('should have toast trigger buttons', () => {
      renderStyleGuide();

      const successToastButton = screen.getByRole('button', {
        name: /success toast/i,
      });
      // @ts-expect-error - jest-dom matchers
      expect(successToastButton).toBeInTheDocument();

      const errorToastButton = screen.getByRole('button', {
        name: /error toast/i,
      });
      // @ts-expect-error - jest-dom matchers
      expect(errorToastButton).toBeInTheDocument();
    });

    it('should trigger toast on button click', async () => {
      renderStyleGuide();

      const successButton = screen.getByRole('button', {
        name: /success toast/i,
      });
      fireEvent.click(successButton);

      expect(mockedToast.success).toHaveBeenCalledWith(
        'Success! Operation completed.'
      );
    });
  });

  describe('Feature Components Section', () => {
    it('should display the feature components section heading', () => {
      renderStyleGuide();

      const sectionHeading = screen.getByRole('heading', {
        name: /feature components/i,
      });
      // @ts-expect-error - jest-dom matchers
      expect(sectionHeading).toBeInTheDocument();
    });

    it('should render VestaboardPreview component', () => {
      renderStyleGuide();

      const vestaboard = screen.getByTestId('vestaboard');
      // @ts-expect-error - jest-dom matchers
      expect(vestaboard).toBeInTheDocument();
    });

    it('should render VotingButtons component', () => {
      renderStyleGuide();

      // VotingButtons renders two buttons: Good and Bad
      const goodButton = screen.getAllByRole('button', { name: /good/i });
      const badButton = screen.getAllByRole('button', { name: /bad/i });

      expect(goodButton.length).toBeGreaterThan(0);
      expect(badButton.length).toBeGreaterThan(0);
    });

    it('should handle voting interaction', async () => {
      renderStyleGuide();

      // Find interactive voting buttons (not the disabled loading state ones)
      const goodButtons = screen.getAllByRole('button', { name: /good/i });
      const interactiveGoodButton = goodButtons.find(
        btn => !(btn as HTMLButtonElement).disabled
      );

      if (interactiveGoodButton) {
        fireEvent.click(interactiveGoodButton);
        expect(mockedToast.success).toHaveBeenCalledWith('Voted: good');
      }
    });

    it('should render ContentCard component', () => {
      renderStyleGuide();

      // ContentCard shows generator ID and metadata
      expect(screen.getAllByText(/haiku-generator/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/openai/i).length).toBeGreaterThan(0);
    });
  });

  describe('Route Accessibility', () => {
    it('should be accessible at /style-guide route', () => {
      render(
        <MemoryRouter initialEntries={['/style-guide']}>
          <StyleGuide />
        </MemoryRouter>
      );

      // Should render the page title
      const title = screen.getByRole('heading', {
        level: 1,
        name: /style guide/i,
      });
      // @ts-expect-error - jest-dom matchers
      expect(title).toBeInTheDocument();
    });
  });
});
