/// <reference types="@testing-library/jest-dom" />
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import App from '@/web/frontend/App';
import { Navigation } from '@/web/frontend/components/Navigation';
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

const mockApiClient = apiClient.apiClient as jest.Mocked<typeof apiClient.apiClient>;

// Mock PublicKeyCredential for browser support detection
Object.defineProperty(globalThis, 'PublicKeyCredential', {
  value: {
    isConditionalMediationAvailable: (() => Promise.resolve(true)) as unknown,
  },
  writable: true,
  configurable: true,
});

describe('Navigation Component', () => {
  describe('Desktop Navigation', () => {
    it('renders navigation links on desktop', () => {
      render(
        <MemoryRouter>
          <Navigation />
        </MemoryRouter>
      );

      // Core navigation links should be present
      expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /flipside/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /account/i })).toBeInTheDocument();
    });

    it('renders brand link to home', () => {
      render(
        <MemoryRouter>
          <Navigation />
        </MemoryRouter>
      );

      const brandLink = screen.getByRole('link', { name: /clack track/i });
      expect(brandLink).toHaveAttribute('href', '/');
    });

    it('does not include Admin link (moved to Account page)', () => {
      render(
        <MemoryRouter>
          <Navigation />
        </MemoryRouter>
      );

      // Admin link should NOT be in Navigation anymore
      const adminLinks = screen.queryAllByRole('link', { name: /admin/i });
      expect(adminLinks.length).toBe(0);
    });

    it('includes Style Guide link in development mode', () => {
      render(
        <MemoryRouter>
          <Navigation />
        </MemoryRouter>
      );

      // Style Guide should be present in test/dev mode
      expect(screen.getByRole('link', { name: /style guide/i })).toBeInTheDocument();
    });

    it('navigation links have correct href attributes', () => {
      render(
        <MemoryRouter>
          <Navigation />
        </MemoryRouter>
      );

      expect(screen.getByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: /flipside/i })).toHaveAttribute('href', '/flipside');
      expect(screen.getByRole('link', { name: /account/i })).toHaveAttribute('href', '/account');
    });
  });
});

describe('Admin Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful session check
    mockApiClient.checkSession.mockResolvedValue({
      authenticated: false,
      user: null,
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
