/**
 * PageLayout Component Tests
 *
 * Tests for the page layout wrapper with navigation integration
 */

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PageLayout } from '../../../src/web/frontend/components/PageLayout';

// Mock the Navigation component
jest.mock('../../../src/web/frontend/components/Navigation', () => ({
  Navigation: () => <nav data-testid="desktop-navigation">Desktop Navigation</nav>,
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

    it('renders Navigation component for desktop', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div>Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      expect(screen.getByTestId('desktop-navigation')).toBeInTheDocument();
    });

    it('renders BottomTabBar component for mobile', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div>Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      expect(screen.getByTestId('bottom-tab-bar')).toBeInTheDocument();
    });

    it('renders both navigation components (responsive behavior handled by CSS)', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div>Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      // Both are rendered; CSS handles visibility based on breakpoint
      expect(screen.getByTestId('desktop-navigation')).toBeInTheDocument();
      expect(screen.getByTestId('bottom-tab-bar')).toBeInTheDocument();
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

  describe('mobile bottom padding', () => {
    it('has bottom padding on main content for mobile nav overlap prevention', () => {
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

    it('has dark mode background', () => {
      render(
        <BrowserRouter>
          <PageLayout>
            <div data-testid="child">Content</div>
          </PageLayout>
        </BrowserRouter>
      );

      const rootDiv = screen.getByTestId('child').closest('main')?.parentElement;
      expect(rootDiv).toHaveClass('dark:bg-gray-900');
    });
  });
});
