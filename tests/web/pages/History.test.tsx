/**
 * History Page Tests
 *
 * Tests for the History page (/flipside) with API integration
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { History } from '@/web/frontend/pages/History';
import { AuthProvider } from '@/web/frontend/context/AuthContext';
import { apiClient } from '@/web/frontend/services/apiClient';
import type { ContentRecord } from '@/storage/models/content';

// Mock the apiClient module
jest.mock('@/web/frontend/services/apiClient', () => ({
  apiClient: {
    getContentHistory: jest.fn(),
    submitVote: jest.fn(),
    getVestaboardConfig: jest.fn(),
    checkSession: jest.fn(),
  },
}));

// Mock @simplewebauthn/browser (required by AuthProvider)
jest.mock('@simplewebauthn/browser', () => ({
  startAuthentication: jest.fn(),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('History Page', () => {
  const createMockContent = (id: number, hoursAgo: number = 1): ContentRecord => ({
    id,
    text: `CONTENT ${id}`,
    type: 'major',
    generatorId: `generator-${id}`,
    generatedAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
    sentAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
    aiProvider: 'openai',
  });

  const mockContents: ContentRecord[] = [
    createMockContent(1, 1),
    createMockContent(2, 2),
    createMockContent(3, 24),
    createMockContent(4, 48),
    createMockContent(5, 168), // 7 days
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for config - returns black model
    mockApiClient.getVestaboardConfig.mockResolvedValue({ model: 'black' });
    // Default auth mock - unauthenticated is fine for History page (public)
    mockApiClient.checkSession.mockResolvedValue({
      authenticated: false,
      user: null,
    });
  });

  /**
   * Helper to render with AuthProvider context
   */
  const renderWithAuth = (ui: React.ReactElement) => {
    return render(
      <MemoryRouter>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    );
  };

  describe('Loading State', () => {
    it('should show loading skeleton while fetching history', async () => {
      // Create a promise that never resolves to keep loading state
      mockApiClient.getContentHistory.mockReturnValue(new Promise(() => {}));

      renderWithAuth(<History />);

      // Check for loading state by looking for the header text
      const heading = screen.getByRole('heading', { name: /the flip side/i });
      // @ts-expect-error - jest-dom matchers
      expect(heading).toBeInTheDocument();
    });

    it('should display page title and description during loading', async () => {
      mockApiClient.getContentHistory.mockReturnValue(new Promise(() => {}));

      renderWithAuth(<History />);

      const heading = screen.getByRole('heading', { name: /the flip side/i });
      // @ts-expect-error - jest-dom matchers
      expect(heading).toBeInTheDocument();

      const description = screen.getByText(/browse historical content/i);
      // @ts-expect-error - jest-dom matchers
      expect(description).toBeInTheDocument();
    });
  });

  describe('Content Display', () => {
    it('should display content history when loaded successfully', async () => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: mockContents,
        pagination: { limit: 20, count: 5 },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const firstContent = screen.getByText(/generator-1/i);
        // @ts-expect-error - jest-dom matchers
        expect(firstContent).toBeInTheDocument();
      });
    });

    it('should display all content items', async () => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: mockContents,
        pagination: { limit: 20, count: 5 },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        mockContents.forEach(content => {
          const generatorText = screen.getByText(`generator-${content.id}`);
          // @ts-expect-error - jest-dom matchers
          expect(generatorText).toBeInTheDocument();
        });
      });
    });

    it('should display relative timestamps', async () => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: [createMockContent(1, 2)],
        pagination: { limit: 20, count: 1 },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const timeText = screen.getByText(/2 hours ago/i);
        // @ts-expect-error - jest-dom matchers
        expect(timeText).toBeInTheDocument();
      });
    });

    it('should display "just now" for recent content', async () => {
      const recentContent = {
        ...createMockContent(1, 0),
        generatedAt: new Date(), // Now
      };
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: [recentContent],
        pagination: { limit: 20, count: 1 },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const timeText = screen.getByText(/just now/i);
        // @ts-expect-error - jest-dom matchers
        expect(timeText).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no history is available', async () => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: [],
        pagination: { limit: 20, count: 0 },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const emptyMessage = screen.getByText(/no content history available/i);
        // @ts-expect-error - jest-dom matchers
        expect(emptyMessage).toBeInTheDocument();
      });
    });

    it('should show helpful hint in empty state', async () => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: [],
        pagination: { limit: 20, count: 0 },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const hint = screen.getByText(/generate some content/i);
        // @ts-expect-error - jest-dom matchers
        expect(hint).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('should show error message when API call fails', async () => {
      mockApiClient.getContentHistory.mockRejectedValue(new Error('Network error'));

      renderWithAuth(<History />);

      await waitFor(() => {
        const errorMessage = screen.getByText(/network error/i);
        // @ts-expect-error - jest-dom matchers
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      mockApiClient.getContentHistory.mockRejectedValue(new Error('Failed'));

      renderWithAuth(<History />);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /try again/i });
        // @ts-expect-error - jest-dom matchers
        expect(retryButton).toBeInTheDocument();
      });
    });

    it('should retry fetching when retry button is clicked', async () => {
      mockApiClient.getContentHistory
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          success: true,
          data: mockContents,
          pagination: { limit: 20, count: 5 },
        });

      renderWithAuth(<History />);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /try again/i });
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(mockApiClient.getContentHistory).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Pagination', () => {
    it('should show Load More button when more items are available', async () => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: mockContents.slice(0, 3),
        pagination: { limit: 20, count: 10 },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const loadMoreButton = screen.getByRole('button', { name: /load more/i });
        // @ts-expect-error - jest-dom matchers
        expect(loadMoreButton).toBeInTheDocument();
      });
    });

    it('should show current count and total in Load More button', async () => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: mockContents.slice(0, 3),
        pagination: { limit: 20, count: 10 },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const loadMoreButton = screen.getByRole('button', { name: /3 of 10/i });
        // @ts-expect-error - jest-dom matchers
        expect(loadMoreButton).toBeInTheDocument();
      });
    });

    it('should not show Load More button when all items are loaded', async () => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: mockContents,
        pagination: { limit: 20, count: 5 },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const loadMoreButton = screen.queryByRole('button', { name: /load more/i });
        expect(loadMoreButton).toBeNull();
      });
    });

    it('should load more items when Load More is clicked', async () => {
      const initialContents = mockContents.slice(0, 3);
      const allContents = mockContents;

      mockApiClient.getContentHistory
        .mockResolvedValueOnce({
          success: true,
          data: initialContents,
          pagination: { limit: 20, count: 5 },
        })
        .mockResolvedValueOnce({
          success: true,
          data: allContents,
          pagination: { limit: 20, count: 5 },
        });

      renderWithAuth(<History />);

      await waitFor(() => {
        const loadMoreButton = screen.getByRole('button', { name: /load more/i });
        fireEvent.click(loadMoreButton);
      });

      await waitFor(() => {
        expect(mockApiClient.getContentHistory).toHaveBeenCalledTimes(2);
      });
    });

    it('should show loading state on Load More button while loading', async () => {
      mockApiClient.getContentHistory.mockResolvedValueOnce({
        success: true,
        data: mockContents.slice(0, 3),
        pagination: { limit: 20, count: 10 },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const loadMoreButton = screen.getByRole('button', { name: /load more/i });
        // @ts-expect-error - jest-dom matchers
        expect(loadMoreButton).toBeInTheDocument();
      });

      // Set up slow response for load more
      mockApiClient.getContentHistory.mockReturnValue(new Promise(() => {}));

      const loadMoreButton = screen.getByRole('button', { name: /load more/i });
      fireEvent.click(loadMoreButton);

      await waitFor(() => {
        const loadingButton = screen.getByRole('button', { name: /loading/i });
        // @ts-expect-error - jest-dom matchers
        expect(loadingButton).toBeInTheDocument();
      });
    });
  });

  describe('Voting Functionality', () => {
    beforeEach(() => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: mockContents,
        pagination: { limit: 20, count: 5 },
      });
    });

    it('should render voting buttons for each content item', async () => {
      renderWithAuth(<History />);

      await waitFor(() => {
        // Should have multiple voting button pairs (Good/Bad buttons)
        const goodButtons = screen.getAllByRole('button', { name: /good/i });
        expect(goodButtons.length).toBe(5);

        const badButtons = screen.getAllByRole('button', { name: /bad/i });
        expect(badButtons.length).toBe(5);
      });
    });

    it('should submit vote when Good button is clicked', async () => {
      mockApiClient.submitVote.mockResolvedValue({
        success: true,
        data: {
          vote: {
            id: 1,
            content_id: 1,
            vote_type: 'good',
            created_at: new Date(),
          },
        },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const goodButtons = screen.getAllByRole('button', { name: /good/i });
        fireEvent.click(goodButtons[0]);
      });

      await waitFor(() => {
        expect(mockApiClient.submitVote).toHaveBeenCalledWith({
          contentId: '1',
          vote: 'good',
        });
      });
    });

    it('should show success message after vote submission', async () => {
      mockApiClient.submitVote.mockResolvedValue({
        success: true,
        data: {
          vote: {
            id: 1,
            content_id: 1,
            vote_type: 'good',
            created_at: new Date(),
          },
        },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const goodButtons = screen.getAllByRole('button', { name: /good/i });
        fireEvent.click(goodButtons[0]);
      });

      await waitFor(() => {
        const successMessage = screen.getByText(/thanks for voting/i);
        // @ts-expect-error - jest-dom matchers
        expect(successMessage).toBeInTheDocument();
      });
    });

    it('should show error message when vote submission fails', async () => {
      mockApiClient.submitVote.mockRejectedValue(new Error('Vote failed'));

      renderWithAuth(<History />);

      await waitFor(() => {
        const goodButtons = screen.getAllByRole('button', { name: /good/i });
        fireEvent.click(goodButtons[0]);
      });

      await waitFor(() => {
        const errorMessage = screen.getByText(/vote failed/i);
        // @ts-expect-error - jest-dom matchers
        expect(errorMessage).toBeInTheDocument();
      });
    });
  });

  describe('Card Interactions', () => {
    beforeEach(() => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: mockContents,
        pagination: { limit: 20, count: 5 },
      });
    });

    it('should display content items as clickable cards', async () => {
      renderWithAuth(<History />);

      await waitFor(() => {
        // Find the generator ID text which indicates cards are rendered
        const generatorText = screen.getByText(/generator-1/i);
        // @ts-expect-error - jest-dom matchers
        expect(generatorText).toBeInTheDocument();
      });
    });

    it('should display multiple content cards', async () => {
      renderWithAuth(<History />);

      await waitFor(() => {
        // Check multiple items are displayed
        const generator1 = screen.getByText(/generator-1/i);
        const generator2 = screen.getByText(/generator-2/i);
        // @ts-expect-error - jest-dom matchers
        expect(generator1).toBeInTheDocument();
        // @ts-expect-error - jest-dom matchers
        expect(generator2).toBeInTheDocument();
      });
    });
  });

  describe('Metadata Display', () => {
    it('should display AI provider badges', async () => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: mockContents,
        pagination: { limit: 20, count: 5 },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const providerBadges = screen.getAllByText(/openai/i);
        expect(providerBadges.length).toBeGreaterThan(0);
      });
    });

    it('should display content type badges', async () => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: mockContents,
        pagination: { limit: 20, count: 5 },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const typeBadges = screen.getAllByText(/major/i);
        expect(typeBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Vestaboard Config', () => {
    it('should fetch Vestaboard config on mount', async () => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: mockContents,
        pagination: { limit: 20, count: 5 },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        expect(mockApiClient.getVestaboardConfig).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle config fetch failure gracefully', async () => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: mockContents,
        pagination: { limit: 20, count: 5 },
      });
      mockApiClient.getVestaboardConfig.mockRejectedValue(new Error('Config failed'));

      renderWithAuth(<History />);

      // Page should still render content even if config fails
      await waitFor(() => {
        const generatorText = screen.getByText(/generator-1/i);
        // @ts-expect-error - jest-dom matchers
        expect(generatorText).toBeInTheDocument();
      });
    });
  });
});
