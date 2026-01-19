/// <reference types="@testing-library/jest-dom" />
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import App from '@/web/frontend/App';
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

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful session check by default
    mockApiClient.checkSession.mockResolvedValue({
      authenticated: false,
      user: null,
    });

    // Mock content endpoints
    // Backend sends ContentRecord directly in data (not wrapped in { content: ... })
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
  });
  it('renders Welcome page on default route', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    const heading = await screen.findByRole('heading', { name: /latest content/i });
    // @ts-expect-error - jest-dom matchers
    expect(heading).toBeInTheDocument();
  });

  it('renders navigation with Clack Track branding', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    const brand = await screen.findByText(/clack track/i);
    // @ts-expect-error - jest-dom matchers
    expect(brand).toBeInTheDocument();
  });

  it('renders History page on /flipside route', async () => {
    render(
      <MemoryRouter initialEntries={['/flipside']}>
        <App />
      </MemoryRouter>
    );

    const heading = await screen.findByRole('heading', { name: /the flip side/i });
    // @ts-expect-error - jest-dom matchers
    expect(heading).toBeInTheDocument();
  });

  it('redirects unauthenticated user from /account to /login', async () => {
    // Mock session check returns unauthenticated (default)
    render(
      <MemoryRouter initialEntries={['/account']}>
        <App />
      </MemoryRouter>
    );

    // Account page redirects to login when not authenticated
    const button = await screen.findByRole('button', { name: /sign in with passkey/i });
    // @ts-expect-error - jest-dom matchers
    expect(button).toBeInTheDocument();
  });

  it('renders Account page when authenticated', async () => {
    // Mock authenticated session
    mockApiClient.checkSession.mockResolvedValue({
      authenticated: true,
      user: { name: 'Test User' },
    });

    // Mock account data (returns data directly, not wrapped)
    mockApiClient.getProfile.mockResolvedValue({
      username: 'testuser',
      email: 'test@example.com',
      createdAt: new Date().toISOString(),
    });

    mockApiClient.getPasskeys.mockResolvedValue({
      passkeys: [],
    });

    render(
      <MemoryRouter initialEntries={['/account']}>
        <App />
      </MemoryRouter>
    );

    const heading = await screen.findByRole('heading', { name: /account/i });
    // @ts-expect-error - jest-dom matchers
    expect(heading).toBeInTheDocument();
  });

  it('renders Login page on /login route', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    );

    const button = await screen.findByRole('button', { name: /sign in with passkey/i });
    // @ts-expect-error - jest-dom matchers
    expect(button).toBeInTheDocument();
  });
});
