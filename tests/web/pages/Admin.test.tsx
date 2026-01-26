/**
 * Admin Page Tests
 *
 * Tests for the Admin page component focusing on:
 * - Loading state while fetching circuits
 * - Error state when fetch fails (including API errors)
 * - Grouping circuits by type (System Controls vs Provider Circuits)
 * - Toggle actions calling appropriate API endpoints
 *
 * Note: Authentication is handled by ProtectedRoute wrapper in App.tsx.
 * See tests/web/components/ProtectedRoute.test.tsx for auth tests.
 * Admin component only renders for authenticated users.
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Admin } from '@/web/frontend/pages/Admin';
import { AuthProvider } from '@/web/frontend/context/AuthContext';
import * as apiClientModule from '@/web/frontend/services/apiClient';
import type { Circuit } from '@/web/frontend/components/CircuitBreakerCard';

// Mock the apiClient module
jest.mock('@/web/frontend/services/apiClient', () => ({
  apiClient: {
    getCircuits: jest.fn(),
    enableCircuit: jest.fn(),
    disableCircuit: jest.fn(),
    resetCircuit: jest.fn(),
    checkSession: jest.fn(),
    startLogin: jest.fn(),
    verifyLogin: jest.fn(),
    logout: jest.fn(),
  },
}));

// Get typed mocks
const mockApiClient = apiClientModule.apiClient as jest.Mocked<typeof apiClientModule.apiClient>;

// Test fixtures for circuits
const mockCircuits: Circuit[] = [
  {
    id: 'MASTER',
    name: 'Master Switch',
    description: 'Enables or disables all content generation',
    type: 'manual',
    state: 'on',
  },
  {
    id: 'SLEEP_MODE',
    name: 'Sleep Mode',
    description: 'Blocks all updates during sleep',
    type: 'manual',
    state: 'off',
  },
  {
    id: 'OPENAI',
    name: 'OpenAI Provider',
    description: 'OpenAI API circuit breaker',
    type: 'provider',
    state: 'on',
    failureCount: 0,
    failureThreshold: 3,
  },
  {
    id: 'ANTHROPIC',
    name: 'Anthropic Provider',
    description: 'Anthropic API circuit breaker',
    type: 'provider',
    state: 'off',
    failureCount: 3,
    failureThreshold: 3,
  },
];

/**
 * Helper to render Admin with required providers
 * Since Admin is protected by ProtectedRoute in the actual app,
 * these tests assume the user is authenticated (as Admin only renders for auth users)
 */
function renderAdmin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Admin />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Admin Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authenticated session for AuthProvider
    // Admin component only renders for authenticated users (protected by ProtectedRoute)
    mockApiClient.checkSession.mockResolvedValue({
      authenticated: true,
      user: { name: 'Test Admin' },
    });

    // Default successful response for circuits
    mockApiClient.getCircuits.mockResolvedValue({
      success: true,
      data: mockCircuits,
    });
    mockApiClient.enableCircuit.mockResolvedValue({ success: true });
    mockApiClient.disableCircuit.mockResolvedValue({ success: true });
    mockApiClient.resetCircuit.mockResolvedValue({ success: true });
  });

  describe('Loading State', () => {
    it('should show loading state initially while fetching circuits', async () => {
      // Arrange: API takes time to respond
      mockApiClient.getCircuits.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(() => resolve({ success: true, data: mockCircuits }), 100)
          )
      );

      // Act
      renderAdmin();

      // Assert: Loading state shown initially
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should hide loading state after circuits are fetched', async () => {
      // Act
      renderAdmin();

      // Assert: Loading state disappears
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('should show error message when fetch fails', async () => {
      // Arrange
      mockApiClient.getCircuits.mockRejectedValue(new Error('Network error'));

      // Act
      renderAdmin();

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should show try again button on error', async () => {
      // Arrange
      mockApiClient.getCircuits.mockRejectedValue(new Error('Failed to load'));

      // Act
      renderAdmin();

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });

    it('should retry fetching when try again is clicked', async () => {
      // Arrange
      mockApiClient.getCircuits
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce({ success: true, data: mockCircuits });

      // Act
      renderAdmin();

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });

      // Click retry
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      // Assert: Circuits loaded after retry
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Master Switch' })).toBeInTheDocument();
      });

      expect(mockApiClient.getCircuits).toHaveBeenCalledTimes(2);
    });
  });

  describe('Circuit Grouping', () => {
    it('should display "System Controls" section', async () => {
      // Act
      renderAdmin();

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /system controls/i })).toBeInTheDocument();
      });
    });

    it('should display "Provider Circuits" section', async () => {
      // Act
      renderAdmin();

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /provider circuits/i })).toBeInTheDocument();
      });
    });

    it('should group MASTER and SLEEP_MODE under System Controls', async () => {
      // Act
      renderAdmin();

      // Assert
      await waitFor(() => {
        // Find the System Controls section
        const systemSection = screen.getByTestId('system-controls-section');

        // Both manual circuits should be within this section
        expect(
          within(systemSection).getByRole('heading', { name: 'Master Switch' })
        ).toBeInTheDocument();
        expect(
          within(systemSection).getByRole('heading', { name: 'Sleep Mode' })
        ).toBeInTheDocument();
      });
    });

    it('should group OPENAI and ANTHROPIC under Provider Circuits', async () => {
      // Act
      renderAdmin();

      // Assert
      await waitFor(() => {
        // Find the Provider Circuits section
        const providerSection = screen.getByTestId('provider-circuits-section');

        // Both provider circuits should be within this section
        expect(
          within(providerSection).getByRole('heading', { name: 'OpenAI Provider' })
        ).toBeInTheDocument();
        expect(
          within(providerSection).getByRole('heading', { name: 'Anthropic Provider' })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Circuit Card Rendering', () => {
    it('should render a CircuitBreakerCard for each circuit', async () => {
      // Act
      renderAdmin();

      // Assert: All four circuits are rendered
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Master Switch' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Sleep Mode' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'OpenAI Provider' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Anthropic Provider' })).toBeInTheDocument();
      });
    });

    it('should display correct state badges', async () => {
      // Act
      renderAdmin();

      // Assert: Check for state badges
      await waitFor(() => {
        // MASTER and OPENAI are 'on'
        const onBadges = screen.getAllByText('on');
        expect(onBadges.length).toBe(2);

        // SLEEP_MODE and ANTHROPIC are 'off'
        const offBadges = screen.getAllByText('off');
        expect(offBadges.length).toBe(2);
      });
    });

    it('should show failure count for provider circuits', async () => {
      // Act
      renderAdmin();

      // Assert
      await waitFor(() => {
        // OpenAI has 0/3 failures
        expect(screen.getByText(/0\s*\/\s*3/)).toBeInTheDocument();
        // Anthropic has 3/3 failures
        expect(screen.getByText(/3\s*\/\s*3/)).toBeInTheDocument();
      });
    });
  });

  describe('Toggle Actions', () => {
    it('should call enableCircuit when toggling off circuit to on', async () => {
      // Act
      renderAdmin();

      // Wait for circuits to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Sleep Mode' })).toBeInTheDocument();
      });

      // Find Sleep Mode's toggle (it's off, so toggling will enable it)
      const sleepModeCard = screen
        .getByRole('heading', { name: 'Sleep Mode' })
        .closest('[class*="rounded"]')!;
      const toggle = within(sleepModeCard as HTMLElement).getByRole('switch');

      fireEvent.click(toggle);

      // Assert
      await waitFor(() => {
        expect(mockApiClient.enableCircuit).toHaveBeenCalledWith('SLEEP_MODE');
      });
    });

    it('should call disableCircuit when toggling on circuit to off', async () => {
      // Act
      renderAdmin();

      // Wait for circuits to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Master Switch' })).toBeInTheDocument();
      });

      // Find Master Switch's toggle (it's on, so toggling will disable it)
      const masterCard = screen
        .getByRole('heading', { name: 'Master Switch' })
        .closest('[class*="rounded"]')!;
      const toggle = within(masterCard as HTMLElement).getByRole('switch');

      fireEvent.click(toggle);

      // Assert
      await waitFor(() => {
        expect(mockApiClient.disableCircuit).toHaveBeenCalledWith('MASTER');
      });
    });

    it('should refetch circuits after successful toggle', async () => {
      // Act
      renderAdmin();

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Master Switch' })).toBeInTheDocument();
      });

      // Clear call count from initial fetch
      mockApiClient.getCircuits.mockClear();

      // Toggle Master Switch
      const masterCard = screen
        .getByRole('heading', { name: 'Master Switch' })
        .closest('[class*="rounded"]')!;
      const toggle = within(masterCard as HTMLElement).getByRole('switch');
      fireEvent.click(toggle);

      // Assert: Circuits refetched after toggle
      await waitFor(() => {
        expect(mockApiClient.getCircuits).toHaveBeenCalledTimes(1);
      });
    });

    it('should show error on toggle failure', async () => {
      // Arrange
      mockApiClient.disableCircuit.mockRejectedValue(new Error('Toggle failed'));

      // Act
      renderAdmin();

      // Wait for circuits to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Master Switch' })).toBeInTheDocument();
      });

      // Toggle Master Switch
      const masterCard = screen
        .getByRole('heading', { name: 'Master Switch' })
        .closest('[class*="rounded"]')!;
      const toggle = within(masterCard as HTMLElement).getByRole('switch');
      fireEvent.click(toggle);

      // Assert: Error message shown
      await waitFor(() => {
        expect(screen.getByText(/toggle failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Reset Actions for Provider Circuits', () => {
    it('should render reset button for provider circuits', async () => {
      // Act
      renderAdmin();

      // Assert
      await waitFor(() => {
        // Provider section should have reset buttons
        const providerSection = screen.getByTestId('provider-circuits-section');
        const resetButtons = within(providerSection).getAllByRole('button', { name: /reset/i });
        expect(resetButtons.length).toBe(2); // One for each provider
      });
    });

    it('should not render reset button for system control circuits', async () => {
      // Act
      renderAdmin();

      // Assert
      await waitFor(() => {
        const systemSection = screen.getByTestId('system-controls-section');
        const resetButtons = within(systemSection).queryAllByRole('button', { name: /reset/i });
        expect(resetButtons.length).toBe(0);
      });
    });

    it('should call resetCircuit when reset button is clicked', async () => {
      // Act
      renderAdmin();

      // Wait for circuits to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Anthropic Provider' })).toBeInTheDocument();
      });

      // Find Anthropic's reset button
      const anthropicCard = screen
        .getByRole('heading', { name: 'Anthropic Provider' })
        .closest('[class*="rounded"]')!;
      const resetButton = within(anthropicCard as HTMLElement).getByRole('button', {
        name: /reset/i,
      });

      fireEvent.click(resetButton);

      // Assert
      await waitFor(() => {
        expect(mockApiClient.resetCircuit).toHaveBeenCalledWith('ANTHROPIC');
      });
    });

    it('should refetch circuits after successful reset', async () => {
      // Act
      renderAdmin();

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Anthropic Provider' })).toBeInTheDocument();
      });

      // Clear call count from initial fetch
      mockApiClient.getCircuits.mockClear();

      // Reset Anthropic
      const anthropicCard = screen
        .getByRole('heading', { name: 'Anthropic Provider' })
        .closest('[class*="rounded"]')!;
      const resetButton = within(anthropicCard as HTMLElement).getByRole('button', {
        name: /reset/i,
      });
      fireEvent.click(resetButton);

      // Assert: Circuits refetched after reset
      await waitFor(() => {
        expect(mockApiClient.getCircuits).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Page Header', () => {
    it('should display page title "Admin"', async () => {
      // Act
      renderAdmin();

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Admin', level: 1 })).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should handle empty circuits list gracefully', async () => {
      // Arrange
      mockApiClient.getCircuits.mockResolvedValue({
        success: true,
        data: [],
      });

      // Act
      renderAdmin();

      // Assert: Should still render sections, just empty
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      // Page title should still be visible
      expect(screen.getByRole('heading', { name: 'Admin', level: 1 })).toBeInTheDocument();
    });
  });
});
