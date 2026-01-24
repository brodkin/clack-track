/**
 * BottomTabBar Component Tests
 *
 * Tests for the iOS 26-style floating bottom tab bar with glass effect
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { BottomTabBar } from '../../../src/web/frontend/components/BottomTabBar';
import { triggerHaptic } from '../../../src/web/frontend/lib/animations';

// Mock haptic feedback
jest.mock('../../../src/web/frontend/lib/animations', () => ({
  triggerHaptic: jest.fn(),
}));

const mockedTriggerHaptic = triggerHaptic as jest.MockedFunction<typeof triggerHaptic>;

describe('BottomTabBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders all three navigation tabs', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      // Check for all three tabs by their accessible roles
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(3);

      // Check tab labels exist
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Account')).toBeInTheDocument();
    });

    it('renders Home tab with correct route', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      const homeLink = screen.getByRole('link', { name: /home/i });
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('renders History tab with correct route', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      const historyLink = screen.getByRole('link', { name: /history/i });
      expect(historyLink).toHaveAttribute('href', '/flipside');
    });

    it('renders Account tab with correct route', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      const accountLink = screen.getByRole('link', { name: /account/i });
      expect(accountLink).toHaveAttribute('href', '/account');
    });

    it('applies custom className when provided', () => {
      render(
        <BrowserRouter>
          <BottomTabBar className="custom-class" />
        </BrowserRouter>
      );

      // The nav element should contain the custom class
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('custom-class');
    });
  });

  describe('active state', () => {
    it('shows Home tab as active when on home route', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <BottomTabBar />
        </MemoryRouter>
      );

      // Home tab should have active styling (amber color)
      const homeLink = screen.getByRole('link', { name: /home/i });
      expect(homeLink).toHaveClass('text-amber-600');
    });

    it('shows History tab as active when on flipside route', () => {
      render(
        <MemoryRouter initialEntries={['/flipside']}>
          <BottomTabBar />
        </MemoryRouter>
      );

      const historyLink = screen.getByRole('link', { name: /history/i });
      expect(historyLink).toHaveClass('text-amber-600');
    });

    it('shows Account tab as active when on account route', () => {
      render(
        <MemoryRouter initialEntries={['/account']}>
          <BottomTabBar />
        </MemoryRouter>
      );

      const accountLink = screen.getByRole('link', { name: /account/i });
      expect(accountLink).toHaveClass('text-amber-600');
    });

    it('shows inactive tabs with muted color', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <BottomTabBar />
        </MemoryRouter>
      );

      // History and Account should be inactive (gray color)
      const historyLink = screen.getByRole('link', { name: /history/i });
      const accountLink = screen.getByRole('link', { name: /account/i });

      expect(historyLink).toHaveClass('text-gray-500');
      expect(accountLink).toHaveClass('text-gray-500');
    });
  });

  describe('haptic feedback', () => {
    it('triggers light haptic feedback on tab click', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      const historyLink = screen.getByRole('link', { name: /history/i });
      fireEvent.click(historyLink);

      expect(mockedTriggerHaptic).toHaveBeenCalledWith('light');
    });

    it('triggers haptic feedback on each tab click', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      const homeLink = screen.getByRole('link', { name: /home/i });
      const accountLink = screen.getByRole('link', { name: /account/i });

      fireEvent.click(homeLink);
      fireEvent.click(accountLink);

      expect(mockedTriggerHaptic).toHaveBeenCalledTimes(2);
      expect(mockedTriggerHaptic).toHaveBeenCalledWith('light');
    });
  });

  describe('accessibility', () => {
    it('has navigation landmark role', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('has aria-label for navigation', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'Main navigation');
    });

    it('tabs have focus-visible ring styles', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveClass('focus-visible:ring-2');
      });
    });

    it('tabs meet minimum touch target size (44px)', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveClass('min-h-11');
        expect(link).toHaveClass('min-w-11');
      });
    });
  });

  describe('styling', () => {
    it('has floating pill shape with glass effect', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('rounded-full');
      expect(nav).toHaveClass('backdrop-blur-xl');
    });

    it('has fixed positioning at bottom center', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('fixed');
      expect(nav).toHaveClass('bottom-4');
      expect(nav).toHaveClass('left-1/2');
      expect(nav).toHaveClass('-translate-x-1/2');
    });

    it('is hidden on desktop (md breakpoint)', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('md:hidden');
    });

    it('has safe area padding for notched devices', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('safe-area-bottom');
    });

    it('has shadow and border for depth', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('shadow-lg');
      expect(nav).toHaveClass('border');
    });

    it('has smooth transition on state changes', () => {
      render(
        <BrowserRouter>
          <BottomTabBar />
        </BrowserRouter>
      );

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveClass('transition-all');
        expect(link).toHaveClass('duration-200');
      });
    });
  });
});
