/**
 * PageLayout Component Tests
 *
 * Tests for the page layout wrapper with FloatingLogo and BottomTabBar navigation.
 * Verifies sticky header spacing (pt-6 breathing room) and dark mode background (gray-950).
 */

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PageLayout } from '../../../src/web/frontend/components/PageLayout';

// Mock the FloatingLogo component
jest.mock('../../../src/web/frontend/components/FloatingLogo', () => ({
  FloatingLogo: () => <header data-testid="floating-logo">Floating Logo</header>,
}));

// Mock the BottomTabBar component
jest.mock('../../../src/web/frontend/components/BottomTabBar', () => ({
  BottomTabBar: () => <nav data-testid="bottom-tab-bar">Bottom Tab Bar</nav>,
}));

describe('PageLayout', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div data-testid="child-content">Test Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders FloatingLogo component at top', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div>Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      expect(screen.getByTestId('floating-logo')).toBeInTheDocument();
    });

    it('renders BottomTabBar component for navigation', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div>Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      expect(screen.getByTestId('bottom-tab-bar')).toBeInTheDocument();
    });

    it('does NOT render Navigation component (deleted)', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div>Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      // Navigation component should NOT exist
      expect(screen.queryByTestId('desktop-navigation')).not.toBeInTheDocument();
    });
  });

  describe('layout structure', () => {
    it('has correct container structure', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div data-testid="child">Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      // Root div with min-h-screen
      const rootDiv = screen.getByTestId('child').closest('main')?.parentElement;
      expect(rootDiv).toHaveClass('min-h-screen');
    });

    it('wraps children in main element', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div data-testid="child">Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      const mainElement = screen.getByRole('main');
      expect(mainElement).toBeInTheDocument();
      expect(mainElement).toContainElement(screen.getByTestId('child'));
    });

    it('applies container styles to main element', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div>Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      const mainElement = screen.getByRole('main');
      expect(mainElement).toHaveClass('container');
      expect(mainElement).toHaveClass('mx-auto');
    });
  });

  describe('spacing adjustments', () => {
    it('has minimal top padding for breathing room below sticky header', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div>Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      const mainElement = screen.getByRole('main');
      // pt-6 breathing room - sticky header no longer needs large spacer
      expect(mainElement).toHaveClass('pt-6');
    });

    it('does not use pt-32 spacer hack (removed for sticky header)', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div>Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      const mainElement = screen.getByRole('main');
      expect(mainElement).not.toHaveClass('pt-32');
    });

    it('has bottom padding on main content for BottomTabBar overlap prevention', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div>Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      const mainElement = screen.getByRole('main');
      // pb-20 = 5rem (80px) padding-bottom on mobile
      expect(mainElement).toHaveClass('pb-20');
    });

    it('removes bottom padding on desktop (md breakpoint)', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div>Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      const mainElement = screen.getByRole('main');
      // md:pb-0 removes padding on desktop since BottomTabBar is hidden
      expect(mainElement).toHaveClass('md:pb-0');
    });
  });

  describe('custom className', () => {
    it('applies custom className to main element', () => {
      render(
        <BrowserRouter>
          <PageLayout className="custom-class">
            <div>Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      const mainElement = screen.getByRole('main');
      expect(mainElement).toHaveClass('custom-class');
    });

    it('merges custom className with default styles', () => {
      render(
        <BrowserRouter>
          <PageLayout className="custom-padding">
            <div>Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      const mainElement = screen.getByRole('main');
      // Should have both default and custom classes
      expect(mainElement).toHaveClass('container');
      expect(mainElement).toHaveClass('custom-padding');
    });
  });

  describe('background styling', () => {
    it('has background color on root container', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div data-testid="child">Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      const rootDiv = screen.getByTestId('child').closest('main')?.parentElement;
      expect(rootDiv).toHaveClass('bg-gray-50');
    });

    it('has darker dark mode background surface', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div data-testid="child">Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      const rootDiv = screen.getByTestId('child').closest('main')?.parentElement;
      expect(rootDiv).toHaveClass('dark:bg-gray-950');
    });

    it('does not use dark:bg-gray-900 (replaced with darker surface)', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div data-testid="child">Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      const rootDiv = screen.getByTestId('child').closest('main')?.parentElement;
      expect(rootDiv).not.toHaveClass('dark:bg-gray-900');
    });
  });
});
