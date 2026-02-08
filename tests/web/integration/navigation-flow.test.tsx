/**
 * Navigation Flow Integration Tests
 *
 * Tests the complete navigation architecture:
 * - FloatingLogo at top with gradient blur
 * - BottomTabBar handles all navigation
 * - PageLayout wraps pages with proper spacing
 * - No Navigation component (deleted)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../../src/web/frontend/context/AuthContext';
import { PageLayout } from '../../../src/web/frontend/components/PageLayout';
import * as apiClient from '../../../src/web/frontend/services/apiClient';

// Mock API client
jest.mock('../../../src/web/frontend/services/apiClient');

// Mock @simplewebauthn/browser
jest.mock('@simplewebauthn/browser', () => ({
  startAuthentication: jest.fn(),
}));

// Mock haptic feedback
jest.mock('../../../src/web/frontend/lib/animations', () => ({
  triggerHaptic: jest.fn(),
}));

const mockApiClient = apiClient.apiClient as jest.Mocked<typeof apiClient.apiClient>;

/**
 * Test wrapper with routing and auth
 */
function NavigationTestWrapper({
  children,
  initialRoute = '/',
}: {
  children: React.ReactNode;
  initialRoute?: string;
}) {
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<PageLayout>{children}</PageLayout>} />
          <Route path="/flipside" element={<PageLayout>{children}</PageLayout>} />
          <Route path="/account" element={<PageLayout>{children}</PageLayout>} />
          <Route path="/admin" element={<PageLayout>{children}</PageLayout>} />
          <Route path="/login" element={<PageLayout>{children}</PageLayout>} />
          <Route path="/style-guide" element={<PageLayout>{children}</PageLayout>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Navigation Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiClient.checkSession.mockResolvedValue({
      authenticated: false,
      user: null,
    });
  });

  describe('Layout Architecture', () => {
    it('renders complete layout with FloatingLogo and BottomTabBar', async () => {
      render(
        <NavigationTestWrapper>
          <div data-testid="page-content">Test Page</div>
        </NavigationTestWrapper>
      );

      // Wait for auth check
      await waitFor(() => screen.getByRole('navigation'));

      // FloatingLogo should be present
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByText('Clack Track')).toBeInTheDocument();
      expect(screen.getByText('BY HOUSEBOY')).toBeInTheDocument();

      // BottomTabBar should be present
      expect(screen.getByRole('navigation')).toBeInTheDocument();

      // Page content should be wrapped properly
      expect(screen.getByTestId('page-content')).toBeInTheDocument();
    });

    it('does NOT render Navigation component (deleted)', async () => {
      const { container } = render(
        <NavigationTestWrapper>
          <div>Test Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      // Navigation component would have had a hamburger menu icon
      // BottomTabBar does NOT have a hamburger
      const nav = screen.getByRole('navigation');
      expect(nav).not.toHaveTextContent('☰');
      expect(nav).not.toHaveTextContent('≡');

      // Navigation component would have had a Sheet component
      // Check that no Sheet trigger exists
      const sheetTriggers = container.querySelectorAll('[role="button"][aria-haspopup="dialog"]');
      expect(sheetTriggers).toHaveLength(0);
    });

    it('has proper spacing for FloatingLogo and BottomTabBar', async () => {
      render(
        <NavigationTestWrapper>
          <div>Test Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      // Main content should have breathing room below sticky header
      const main = screen.getByRole('main');
      expect(main).toHaveClass('pt-6');

      // Main content should have bottom padding for BottomTabBar on mobile
      expect(main).toHaveClass('pb-20');

      // Bottom padding removed on desktop
      expect(main).toHaveClass('md:pb-0');
    });
  });

  describe('Navigation Routes - Unauthenticated', () => {
    it('shows public navigation tabs (Home, History, Login, Style Guide)', async () => {
      render(
        <NavigationTestWrapper>
          <div>Test Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      // Public tabs visible
      expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /history/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /style guide/i })).toBeInTheDocument();

      // Auth-protected tabs not visible
      expect(screen.queryByRole('link', { name: /account/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
    });

    it('navigates to Home route via BottomTabBar', async () => {
      render(
        <NavigationTestWrapper initialRoute="/flipside">
          <div data-testid="page-content">Current Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      const homeLink = screen.getByRole('link', { name: /home/i });
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('navigates to History route via BottomTabBar', async () => {
      render(
        <NavigationTestWrapper>
          <div data-testid="page-content">Current Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      const historyLink = screen.getByRole('link', { name: /history/i });
      expect(historyLink).toHaveAttribute('href', '/flipside');
    });

    it('navigates to Login route via BottomTabBar', async () => {
      render(
        <NavigationTestWrapper>
          <div data-testid="page-content">Current Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      const loginLink = screen.getByRole('link', { name: /login/i });
      expect(loginLink).toHaveAttribute('href', '/login');
    });
  });

  describe('Navigation Routes - Authenticated', () => {
    beforeEach(() => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });
    });

    it('shows auth-protected navigation tabs (Home, History, Account, Admin, Style Guide)', async () => {
      render(
        <NavigationTestWrapper>
          <div>Test Page</div>
        </NavigationTestWrapper>
      );

      // Wait for auth state to load
      await waitFor(() => screen.getByText('Admin'));

      // All authenticated tabs visible
      expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /history/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /account/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /style guide/i })).toBeInTheDocument();

      // Login tab hidden when authenticated
      expect(screen.queryByRole('link', { name: /^login$/i })).not.toBeInTheDocument();

      // Logout button visible
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    });

    it('navigates to Account route via BottomTabBar', async () => {
      render(
        <NavigationTestWrapper>
          <div data-testid="page-content">Current Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByText('Admin'));

      const accountLink = screen.getByRole('link', { name: /account/i });
      expect(accountLink).toHaveAttribute('href', '/account');
    });

    it('navigates to Admin route via BottomTabBar', async () => {
      render(
        <NavigationTestWrapper>
          <div data-testid="page-content">Current Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByText('Admin'));

      const adminLink = screen.getByRole('link', { name: /admin/i });
      expect(adminLink).toHaveAttribute('href', '/admin');
    });

    it('handles logout via BottomTabBar', async () => {
      mockApiClient.logout.mockResolvedValue(undefined);

      render(
        <NavigationTestWrapper>
          <div data-testid="page-content">Current Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByText('Admin'));

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      expect(mockApiClient.logout).toHaveBeenCalled();
    });
  });

  describe('FloatingLogo Integration', () => {
    it('displays FloatingLogo with proper branding', async () => {
      render(
        <NavigationTestWrapper>
          <div>Test Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      // Check logo content
      const banner = screen.getByRole('banner');
      expect(banner).toBeInTheDocument();

      // Main branding text with brush script font
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Clack Track');
      expect(heading).toHaveClass('font-brush');

      // Byline with display font
      expect(screen.getByText('BY HOUSEBOY')).toBeInTheDocument();
    });

    it('FloatingLogo has gradient blur effect', async () => {
      render(
        <NavigationTestWrapper>
          <div>Test Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      const banner = screen.getByRole('banner');
      expect(banner).toHaveClass('backdrop-blur-2xl');
      expect(banner).toHaveClass('bg-white/60');
    });

    it('FloatingLogo is sticky at top of viewport', async () => {
      render(
        <NavigationTestWrapper>
          <div>Test Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      const banner = screen.getByRole('banner');
      expect(banner).toHaveClass('sticky');
      expect(banner).toHaveClass('top-0');
      expect(banner).toHaveClass('w-full');
    });
  });

  describe('BottomTabBar Integration', () => {
    it('BottomTabBar has iOS-style floating pill design', async () => {
      render(
        <NavigationTestWrapper>
          <div>Test Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('rounded-full');
      expect(nav).toHaveClass('backdrop-blur-2xl');
      expect(nav).toHaveClass('shadow-lg');
    });

    it('BottomTabBar is fixed at bottom center', async () => {
      render(
        <NavigationTestWrapper>
          <div>Test Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('fixed');
      expect(nav).toHaveClass('bottom-4');
      expect(nav).toHaveClass('left-1/2');
      expect(nav).toHaveClass('-translate-x-1/2');
    });

    it('BottomTabBar is visible on all screen sizes', async () => {
      render(
        <NavigationTestWrapper>
          <div>Test Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      const nav = screen.getByRole('navigation');
      // Should NOT have md:hidden class (was in old Navigation)
      expect(nav).not.toHaveClass('md:hidden');
    });
  });

  describe('Active Route Highlighting', () => {
    beforeEach(() => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });
    });

    it('highlights Home tab when on home route', async () => {
      render(
        <NavigationTestWrapper initialRoute="/">
          <div>Home Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByText('Admin'));

      const homeLink = screen.getByRole('link', { name: /home/i });
      expect(homeLink).toHaveClass('text-red-600');
    });

    it('highlights History tab when on flipside route', async () => {
      render(
        <NavigationTestWrapper initialRoute="/flipside">
          <div>History Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByText('Admin'));

      const historyLink = screen.getByRole('link', { name: /history/i });
      expect(historyLink).toHaveClass('text-red-600');
    });

    it('highlights Account tab when on account route', async () => {
      render(
        <NavigationTestWrapper initialRoute="/account">
          <div>Account Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByText('Admin'));

      const accountLink = screen.getByRole('link', { name: /account/i });
      expect(accountLink).toHaveClass('text-red-600');
    });

    it('highlights Admin tab when on admin route', async () => {
      render(
        <NavigationTestWrapper initialRoute="/admin">
          <div>Admin Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByText('Admin'));

      const adminLink = screen.getByRole('link', { name: /admin/i });
      expect(adminLink).toHaveClass('text-red-600');
    });

    it('shows inactive tabs with muted color', async () => {
      render(
        <NavigationTestWrapper initialRoute="/">
          <div>Home Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByText('Admin'));

      // History and Account should be inactive
      const historyLink = screen.getByRole('link', { name: /history/i });
      const accountLink = screen.getByRole('link', { name: /account/i });

      expect(historyLink).toHaveClass('text-gray-500');
      expect(accountLink).toHaveClass('text-gray-500');
    });
  });

  describe('Complete Navigation Flow', () => {
    beforeEach(() => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });
    });

    it('provides complete navigation flow through all routes', async () => {
      render(
        <NavigationTestWrapper>
          <div data-testid="page-content">Page Content</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByText('Admin'));

      // All routes accessible
      expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: /history/i })).toHaveAttribute('href', '/flipside');
      expect(screen.getByRole('link', { name: /account/i })).toHaveAttribute('href', '/account');
      expect(screen.getByRole('link', { name: /admin/i })).toHaveAttribute('href', '/admin');

      // Logout available
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();

      // FloatingLogo always visible
      expect(screen.getByText('Clack Track')).toBeInTheDocument();

      // Page content properly wrapped
      expect(screen.getByTestId('page-content')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper landmark roles', async () => {
      render(
        <NavigationTestWrapper>
          <div>Test Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      // Banner for FloatingLogo
      expect(screen.getByRole('banner')).toBeInTheDocument();

      // Navigation for BottomTabBar
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Main navigation');

      // Main content area
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('has proper heading hierarchy', async () => {
      render(
        <NavigationTestWrapper>
          <div>Test Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      // FloatingLogo should have h1
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Clack Track');
    });

    it('navigation tabs meet minimum touch target size', async () => {
      render(
        <NavigationTestWrapper>
          <div>Test Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveClass('min-h-11');
        expect(link).toHaveClass('min-w-11');
      });
    });

    it('navigation tabs have focus-visible styles', async () => {
      render(
        <NavigationTestWrapper>
          <div>Test Page</div>
        </NavigationTestWrapper>
      );

      await waitFor(() => screen.getByRole('navigation'));

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveClass('focus-visible:ring-2');
      });
    });
  });
});
