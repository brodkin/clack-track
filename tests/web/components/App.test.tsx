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
    mockApiClient.getLatestContent.mockResolvedValue({
      success: true,
      data: {
        content: {
          id: 1,
          text: 'TEST CONTENT',
          type: 'major',
          generatorId: 'test',
          generatedAt: new Date(),
          sentAt: new Date(),
          aiProvider: 'openai',
        },
      },
    });

    mockApiClient.getContentHistory.mockResolvedValue({
      success: true,
      data: { contents: [], total: 0 },
    });
  });
  it('renders Welcome page on default route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    const heading = screen.getByRole('heading', { name: /latest content/i });
    // @ts-expect-error - jest-dom matchers
    expect(heading).toBeInTheDocument();
  });

  it('renders navigation with Clack Track branding', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    const brand = screen.getByText(/clack track/i);
    // @ts-expect-error - jest-dom matchers
    expect(brand).toBeInTheDocument();
  });

  it('renders History page on /flipside route', () => {
    render(
      <MemoryRouter initialEntries={['/flipside']}>
        <App />
      </MemoryRouter>
    );

    const heading = screen.getByRole('heading', { name: /the flip side/i });
    // @ts-expect-error - jest-dom matchers
    expect(heading).toBeInTheDocument();
  });

  it('renders Account page on /account route', () => {
    render(
      <MemoryRouter initialEntries={['/account']}>
        <App />
      </MemoryRouter>
    );

    const heading = screen.getByRole('heading', { name: /account/i });
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
