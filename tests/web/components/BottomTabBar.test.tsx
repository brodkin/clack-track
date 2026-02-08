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
    it('renders public navigation tabs when not authenticated (no Admin, no Account)', async () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      // Wait for auth check to complete
      await screen.findByRole('navigation');

      // Check for public tabs (Home, History, Login, Style Guide - no Admin, no Account)
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(4); // Home, History, Login, Style Guide (test env)

      // Check tab labels exist
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Login')).toBeInTheDocument();
      expect(screen.getByText('Style Guide')).toBeInTheDocument();

      // Auth-required tabs should not be visible
      expect(screen.queryByText('Account')).not.toBeInTheDocument();
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

    it('renders Login tab with correct route when unauthenticated', () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      const loginLink = screen.getByRole('link', { name: /login/i });
      expect(loginLink).toHaveAttribute('href', '/login');
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

    it('renders auth-protected navigation tabs when authenticated', async () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      // Wait for auth check to complete
      await screen.findByText('Admin');

      // Check for authenticated tabs (Home, History, Account, Admin, Style Guide - no Login)
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(5); // Home, History, Account, Admin, Style Guide

      // Check all tab labels exist
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Account')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Style Guide')).toBeInTheDocument();

      // Login should be hidden when authenticated
      expect(screen.queryByText('Login')).not.toBeInTheDocument();
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
      expect(adminLink).toHaveClass('text-red-600');
    });
  });

  describe('active state', () => {
    beforeEach(() => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });
    });

    it('shows Home tab as active when on home route', async () => {
      render(
        <AuthWrapper initialEntries={['/']}>
          <BottomTabBar />
        </AuthWrapper>
      );

      await screen.findByText('Admin');

      // Home tab should have active styling (brand-red color)
      const homeLink = screen.getByRole('link', { name: /home/i });
      expect(homeLink).toHaveClass('text-red-600');
    });

    it('shows History tab as active when on flipside route', async () => {
      render(
        <AuthWrapper initialEntries={['/flipside']}>
          <BottomTabBar />
        </AuthWrapper>
      );

      await screen.findByText('Admin');

      const historyLink = screen.getByRole('link', { name: /history/i });
      expect(historyLink).toHaveClass('text-red-600');
    });

    it('shows Account tab as active when on account route', async () => {
      render(
        <AuthWrapper initialEntries={['/account']}>
          <BottomTabBar />
        </AuthWrapper>
      );

      await screen.findByText('Admin');

      const accountLink = screen.getByRole('link', { name: /account/i });
      expect(accountLink).toHaveClass('text-red-600');
    });

    it('applies brand-red background to active tab', async () => {
      render(
        <AuthWrapper initialEntries={['/']}>
          <BottomTabBar />
        </AuthWrapper>
      );

      await screen.findByText('Admin');

      const homeLink = screen.getByRole('link', { name: /home/i });
      expect(homeLink).toHaveClass('bg-red-50');
    });

    it('shows inactive tabs with muted color', async () => {
      render(
        <AuthWrapper initialEntries={['/']}>
          <BottomTabBar />
        </AuthWrapper>
      );

      await screen.findByText('Admin');

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
      const historyLink = screen.getByRole('link', { name: /history/i });

      fireEvent.click(homeLink);
      fireEvent.click(historyLink);

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

    it('tabs have focus-visible ring styles with brand-red color', () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveClass('focus-visible:ring-2');
        expect(link).toHaveClass('focus-visible:ring-red-500');
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
      expect(nav).toHaveClass('backdrop-blur-2xl');
      expect(nav).toHaveClass('backdrop-saturate-150');
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

    it('is visible on all screen sizes (no md:hidden)', () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).not.toHaveClass('md:hidden');
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

  describe('logout functionality', () => {
    beforeEach(() => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });
    });

    it('shows logout button when authenticated', async () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      // Wait for auth state to load
      await screen.findByText('Admin');

      // Logout button should be visible
      const logoutButton = screen.getByRole('button', { name: /logout/i });
      expect(logoutButton).toBeInTheDocument();
    });

    it('does not show logout button when not authenticated', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: false,
        user: null,
      });

      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      // Wait for component to render
      await screen.findByRole('navigation');

      // Logout button should not exist
      expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
    });

    it('calls logout handler when logout button is clicked', async () => {
      mockApiClient.logout.mockResolvedValue(undefined);

      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      await screen.findByText('Admin');

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      expect(mockApiClient.logout).toHaveBeenCalled();
    });

    it('triggers haptic feedback when logout button is clicked', async () => {
      mockApiClient.logout.mockResolvedValue(undefined);

      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      await screen.findByText('Admin');

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      expect(mockedTriggerHaptic).toHaveBeenCalledWith('light');
    });
  });

  describe('complete navigation links', () => {
    it('shows Login link when not authenticated', async () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      await screen.findByRole('navigation');

      const loginLink = screen.getByRole('link', { name: /login/i });
      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute('href', '/login');
    });

    it('hides Login link when authenticated', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      await screen.findByText('Admin');

      expect(screen.queryByRole('link', { name: /^login$/i })).not.toBeInTheDocument();
    });

    it('shows Style Guide link in development environment', async () => {
      // Set NODE_ENV to development (Jest sets it to 'test' by default, which should also show Style Guide)
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      await screen.findByRole('navigation');

      const styleGuideLink = screen.getByRole('link', { name: /style guide/i });
      expect(styleGuideLink).toBeInTheDocument();
      expect(styleGuideLink).toHaveAttribute('href', '/style-guide');

      process.env.NODE_ENV = originalEnv;
    });

    it('hides Style Guide link in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      await screen.findByRole('navigation');

      expect(screen.queryByRole('link', { name: /style guide/i })).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('all navigation routes accessible', () => {
    beforeEach(() => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });
    });

    it('provides access to all main routes when authenticated', async () => {
      render(
        <AuthWrapper>
          <BottomTabBar />
        </AuthWrapper>
      );

      await screen.findByText('Admin');

      // Check all routes are accessible
      expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: /history/i })).toHaveAttribute('href', '/flipside');
      expect(screen.getByRole('link', { name: /account/i })).toHaveAttribute('href', '/account');
      expect(screen.getByRole('link', { name: /admin/i })).toHaveAttribute('href', '/admin');
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    });
  });
});
