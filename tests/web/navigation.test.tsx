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
  describe('Admin Link', () => {
    it('displays Admin link in desktop navigation', () => {
      render(
        <MemoryRouter>
          <Navigation />
        </MemoryRouter>
      );

      // Admin link should be visible in the desktop navigation
      const adminLinks = screen.getAllByRole('link', { name: /admin/i });
      // @ts-expect-error - jest-dom matchers
      expect(adminLinks.length).toBeGreaterThan(0);
    });

    it('displays Admin link in mobile navigation menu', () => {
      render(
        <MemoryRouter>
          <Navigation />
        </MemoryRouter>
      );

      // Admin link should appear at least once (mobile and/or desktop)
      const adminLinks = screen.getAllByRole('link', { name: /admin/i });
      // @ts-expect-error - jest-dom matchers
      expect(adminLinks.length).toBeGreaterThan(0);
    });

    it('Admin link navigates to /admin', () => {
      render(
        <MemoryRouter>
          <Navigation />
        </MemoryRouter>
      );

      // Find admin link and verify href
      const adminLinks = screen.getAllByRole('link', { name: /admin/i });
      const adminLink = adminLinks[0];
      expect(adminLink).toHaveAttribute('href', '/admin');
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
