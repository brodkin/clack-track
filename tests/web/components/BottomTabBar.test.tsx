/**
 * BottomTabBar Component Tests
 *
 * Tests for the iOS 26-style floating bottom tab bar with glass effect
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomTabBar } from '../../../src/web/frontend/components/BottomTabBar';
import { AuthProvider } from '../../../src/web/frontend/context/AuthContext';
import { triggerHaptic } from '../../../src/web/frontend/lib/animations';
import * as apiClient from '../../../src/web/frontend/services/apiClient';

// Mock haptic feedback
jest.mock('../../../src/web/frontend/lib/animations', () => ({
  triggerHaptic: jest.fn(),
}));

// Mock API client
jest.mock('../../../src/web/frontend/services/apiClient');

// Mock @simplewebauthn/browser
jest.mock('@simplewebauthn/browser', () => ({
  startAuthentication: jest.fn(),
}));

const mockApiClient = apiClient.apiClient as jest.Mocked<typeof apiClient.apiClient>;
const mockedTriggerHaptic = triggerHaptic as jest.MockedFunction<typeof triggerHaptic>;

/**
 * Wrapper with auth context
 */
function AuthWrapper({
  children,
  initialEntries = ['/'],
}: {
  children: React.ReactNode;
  initialEntries?: string[];
}) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
}

describe('BottomTabBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to unauthenticated state
    mockApiClient.checkSession.mockResolvedValue({
      authenticated: false,
      user: null,
    });
  });

  describe('rendering - unauthenticated', () => {
    it('renders three navigation tabs when not authenticated (no Admin)', async () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      // Wait for auth check to complete
      await screen.findByRole('navigation');

      // Check for three tabs (Home, History, Account - no Admin)
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(3);

      // Check tab labels exist
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Account')).toBeInTheDocument();
      expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    });

    it('renders Home tab with correct route', () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      const homeLink = screen.getByRole('link', { name: /home/i });
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('renders History tab with correct route', () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      const historyLink = screen.getByRole('link', { name: /history/i });
      expect(historyLink).toHaveAttribute('href', '/flipside');
    });

    it('renders Account tab with correct route', () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      const accountLink = screen.getByRole('link', { name: /account/i });
      expect(accountLink).toHaveAttribute('href', '/account');
    });

    it('applies custom className when provided', () => {
      render(
        <AuthWrapper>
          <BottomTabBar className="custom-class" />
        </AuthWrapper>
      );

      // The nav element should contain the custom class
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('custom-class');
    });
  });

  describe('rendering - authenticated', () => {
    beforeEach(() => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });
    });

    it('renders four navigation tabs when authenticated (includes Admin)', async () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      // Wait for auth check to complete
      await screen.findByText('Admin');

      // Check for four tabs (Home, History, Admin, Account)
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(4);

      // Check all tab labels exist
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Account')).toBeInTheDocument();
    });

    it('renders Admin tab with correct route when authenticated', async () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      await screen.findByText('Admin');

      const adminLink = screen.getByRole('link', { name: /admin/i });
      expect(adminLink).toHaveAttribute('href', '/admin');
    });

    it('shows Admin tab as active when on admin route', async () => {
      render(
        <AuthWrapper initialEntries={['/admin']}>
          <BottomTabBar />
        </AuthWrapper>
      );

      await screen.findByText('Admin');

      const adminLink = screen.getByRole('link', { name: /admin/i });
      expect(adminLink).toHaveClass('text-amber-600');
    });
  });

  describe('active state', () => {
    it('shows Home tab as active when on home route', () => {
      render(
        <AuthWrapper initialEntries={['/']}>
          <BottomTabBar />
        </AuthWrapper>
      );

      // Home tab should have active styling (amber color)
      const homeLink = screen.getByRole('link', { name: /home/i });
      expect(homeLink).toHaveClass('text-amber-600');
    });

    it('shows History tab as active when on flipside route', () => {
      render(
        <AuthWrapper initialEntries={['/flipside']}>
          <BottomTabBar />
        </AuthWrapper>
      );

      const historyLink = screen.getByRole('link', { name: /history/i });
      expect(historyLink).toHaveClass('text-amber-600');
    });

    it('shows Account tab as active when on account route', () => {
      render(
        <AuthWrapper initialEntries={['/account']}>
          <BottomTabBar />
        </AuthWrapper>
      );

      const accountLink = screen.getByRole('link', { name: /account/i });
      expect(accountLink).toHaveClass('text-amber-600');
    });

    it('shows inactive tabs with muted color', () => {
      render(
        <AuthWrapper initialEntries={['/']}>
          <BottomTabBar />
        </AuthWrapper>
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
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      const historyLink = screen.getByRole('link', { name: /history/i });
      fireEvent.click(historyLink);

      expect(mockedTriggerHaptic).toHaveBeenCalledWith('light');
    });

    it('triggers haptic feedback on each tab click', () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
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
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('has aria-label for navigation', () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'Main navigation');
    });

    it('tabs have focus-visible ring styles', () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveClass('focus-visible:ring-2');
      });
    });

    it('tabs meet minimum touch target size (44px)', () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
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
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('rounded-full');
      expect(nav).toHaveClass('backdrop-blur-xl');
    });

    it('has fixed positioning at bottom center', () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('fixed');
      expect(nav).toHaveClass('bottom-4');
      expect(nav).toHaveClass('left-1/2');
      expect(nav).toHaveClass('-translate-x-1/2');
    });

    it('is hidden on desktop (md breakpoint)', () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('md:hidden');
    });

    it('has safe area padding for notched devices', () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('safe-area-bottom');
    });

    it('has shadow and border for depth', () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('shadow-lg');
      expect(nav).toHaveClass('border');
    });

    it('has smooth transition on state changes', () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveClass('transition-all');
        expect(link).toHaveClass('duration-200');
      });
    });
  });
});
