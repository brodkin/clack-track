/// <reference types="@testing-library/jest-dom" />
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import App from '@/web/frontend/App';
import { Navigation } from '@/web/frontend/components/Navigation';
import { AuthProvider } from '@/web/frontend/context/AuthContext';
import * as apiClient from '@/web/frontend/services/apiClient';

// Mock the apiClient module
jest.mock('@/web/frontend/services/apiClient', () => ({
  apiClient: {
    checkSession: jest.fn(),
    getLatestContent: jest.fn(),
    getContentHistory: jest.fn(),
    submitVote: jest.fn(),
    startLogin: jest.fn(),
    verifyLogin: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    getPasskeys: jest.fn(),
    registerPasskeyStart: jest.fn(),
    registerPasskeyVerify: jest.fn(),
    removePasskey: jest.fn(),
    renamePasskey: jest.fn(),
    getVestaboardConfig: jest.fn(),
    getCircuits: jest.fn(),
    enableCircuit: jest.fn(),
    disableCircuit: jest.fn(),
    resetCircuit: jest.fn(),
  },
}));

// Mock @simplewebauthn/browser
jest.mock('@simplewebauthn/browser', () => ({
  startAuthentication: jest.fn(),
}));

const mockApiClient = apiClient.apiClient as jest.Mocked<typeof apiClient.apiClient>;

// Mock PublicKeyCredential for browser support detection
Object.defineProperty(globalThis, 'PublicKeyCredential', {
  value: {
    isConditionalMediationAvailable: (() => Promise.resolve(true)) as unknown,
  },
  writable: true,
  configurable: true,
});

/**
 * Test wrapper that provides AuthProvider and Router
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
}

describe('Navigation Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock authenticated state for these tests
    mockApiClient.checkSession.mockResolvedValue({
      authenticated: true,
      user: { name: 'Test User' },
    });
  });

  describe('Desktop Navigation (hidden on mobile, BottomTabBar handles mobile)', () => {
    it('renders navigation links on desktop when authenticated', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      // Wait for auth state to resolve
      await waitFor(() => {
        // Core navigation links should be present
        expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /flipside/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /account/i })).toBeInTheDocument();
      });
    });

    it('renders brand link to home', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        const brandLink = screen.getByRole('link', { name: /clack track/i });
        expect(brandLink).toHaveAttribute('href', '/');
      });
    });

    it('hides login link when authenticated', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        // Login link should NOT be visible when authenticated
        const loginLinks = screen.queryAllByRole('link', { name: /^login$/i });
        expect(loginLinks.length).toBe(0);
      });
    });

    it('shows login link when not authenticated', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: false,
        user: null,
      });

      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /^login$/i })).toBeInTheDocument();
      });
    });

    it('hides account link when not authenticated', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: false,
        user: null,
      });

      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        // Account link should NOT be visible when not authenticated
        const accountLinks = screen.queryAllByRole('link', { name: /account/i });
        expect(accountLinks.length).toBe(0);
      });
    });

    it('includes Style Guide link in development mode', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        // Style Guide should be present in test/dev mode
        expect(screen.getByRole('link', { name: /style guide/i })).toBeInTheDocument();
      });
    });

    it('navigation links have correct href attributes when authenticated', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/');
        expect(screen.getByRole('link', { name: /flipside/i })).toHaveAttribute(
          'href',
          '/flipside'
        );
        expect(screen.getByRole('link', { name: /account/i })).toHaveAttribute('href', '/account');
      });
    });

    it('shows logout button when authenticated', async () => {
      render(
        <TestWrapper>
          <Navigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });
    });
  });
});

describe('Admin Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authenticated session for Admin page access
    mockApiClient.checkSession.mockResolvedValue({
      authenticated: true,
      user: { name: 'Test User' },
    });

    // Mock content endpoints
    mockApiClient.getLatestContent.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        text: 'TEST CONTENT',
        type: 'major',
        generatorId: 'test',
        generatedAt: new Date(),
        sentAt: new Date(),
        aiProvider: 'openai',
      },
    });

    mockApiClient.getContentHistory.mockResolvedValue({
      success: true,
      data: [],
      pagination: { count: 0 },
    });

    // Mock Vestaboard config
    mockApiClient.getVestaboardConfig.mockResolvedValue({ model: 'black' });

    // Mock circuits endpoint for Admin page
    mockApiClient.getCircuits.mockResolvedValue({
      data: [
        {
          id: 'SLEEP_MODE',
          name: 'Sleep Mode',
          type: 'manual',
          state: 'on',
          enabled: true,
        },
      ],
    });
  });

  it('renders Admin page on /admin route', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>
    );

    // Admin page should render with its heading
    const heading = await screen.findByRole('heading', { name: /admin/i });
    // @ts-expect-error - jest-dom matchers
    expect(heading).toBeInTheDocument();
  });

  it('Admin page loads circuit breaker content', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>
    );

    // Wait for API call and circuit content to render
    await screen.findByRole('heading', { name: /admin/i });

    // Should have called the circuits API
    expect(mockApiClient.getCircuits).toHaveBeenCalled();
  });
});
