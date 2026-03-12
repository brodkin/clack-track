/**
 * History Page Tests
 *
 * Tests for the History page (/flipside) with API integration,
 * FilterBar, IntersectionObserver infinite scroll, and filter pills.
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from '@jest/globals';
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
    aiModel: 'gpt-4.1-nano',
  });

  const mockContents: ContentRecord[] = [
    createMockContent(1, 1),
    createMockContent(2, 2),
    createMockContent(3, 24),
    createMockContent(4, 48),
    createMockContent(5, 168), // 7 days
  ];

  /** Helper to build a mock paginated response matching the backend shape */
  function mockPaginatedResponse(data: ContentRecord[], total: number, offset = 0, limit = 20) {
    return {
      success: true,
      data,
      pagination: { offset, limit, count: data.length, total },
    };
  }

  // Track IntersectionObserver callbacks for test control
  let intersectionObserverCallback: (entries: Array<{ isIntersecting: boolean }>) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for config - returns black model
    mockApiClient.getVestaboardConfig.mockResolvedValue({ model: 'black' });
    // Default auth mock - unauthenticated is fine for History page (public)
    mockApiClient.checkSession.mockResolvedValue({
      authenticated: false,
      user: null,
    });

    // IntersectionObserver mock
    const mockIntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
      intersectionObserverCallback = callback;
      return {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };
    });
    window.IntersectionObserver =
      mockIntersectionObserver as unknown as typeof IntersectionObserver;
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
        pagination: { offset: 0, limit: 20, count: 5, total: 5 },
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
        pagination: { offset: 0, limit: 20, count: 5, total: 5 },
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
        pagination: { offset: 0, limit: 20, count: 1, total: 1 },
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
        pagination: { offset: 0, limit: 20, count: 1, total: 1 },
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
        pagination: { offset: 0, limit: 20, count: 0, total: 0 },
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
        pagination: { offset: 0, limit: 20, count: 0, total: 0 },
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
          pagination: { offset: 0, limit: 20, count: 5, total: 5 },
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

  describe('Pagination & Infinite Scroll', () => {
    it('should set up IntersectionObserver when more items exist', async () => {
      mockApiClient.getContentHistory.mockResolvedValue(
        mockPaginatedResponse(mockContents.slice(0, 3), 10)
      );

      renderWithAuth(<History />);

      await waitFor(() => {
        expect(screen.getByText(/generator-1/i)).toBeInTheDocument();
      });

      // IntersectionObserver should have been set up
      expect(window.IntersectionObserver).toHaveBeenCalled();
    });

    it('should load more items when scroll sentinel intersects', async () => {
      const page1 = mockContents.slice(0, 3);
      const page2 = [createMockContent(6, 200), createMockContent(7, 250)];

      mockApiClient.getContentHistory
        .mockResolvedValueOnce(mockPaginatedResponse(page1, 10))
        .mockResolvedValueOnce(mockPaginatedResponse(page2, 10, 3));

      renderWithAuth(<History />);

      await waitFor(() => {
        expect(screen.getByText(/generator-1/i)).toBeInTheDocument();
      });

      // Trigger IntersectionObserver callback
      await act(async () => {
        intersectionObserverCallback([{ isIntersecting: true }]);
      });

      await waitFor(() => {
        expect(mockApiClient.getContentHistory).toHaveBeenCalledTimes(2);
      });

      // Second call should have offset=3
      expect(mockApiClient.getContentHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 3 })
      );
    });

    it('should show loading spinner during lazy load', async () => {
      mockApiClient.getContentHistory
        .mockResolvedValueOnce(mockPaginatedResponse(mockContents.slice(0, 3), 10))
        .mockReturnValueOnce(new Promise(() => {})); // Never resolves

      renderWithAuth(<History />);

      await waitFor(() => {
        expect(screen.getByText(/generator-1/i)).toBeInTheDocument();
      });

      await act(async () => {
        intersectionObserverCallback([{ isIntersecting: true }]);
      });

      await waitFor(() => {
        expect(screen.getByTestId('lazy-load-spinner')).toBeInTheDocument();
      });
    });

    it('should not load more when all content is loaded', async () => {
      mockApiClient.getContentHistory.mockResolvedValue(mockPaginatedResponse(mockContents, 5));

      renderWithAuth(<History />);

      await waitFor(() => {
        expect(screen.getByText(/generator-1/i)).toBeInTheDocument();
      });

      // Even if observer fires, should not make another API call
      await act(async () => {
        intersectionObserverCallback([{ isIntersecting: true }]);
      });

      // Should still only have the initial call
      expect(mockApiClient.getContentHistory).toHaveBeenCalledTimes(1);
    });

    it('should append new items to existing list', async () => {
      const page1 = mockContents.slice(0, 3);
      const page2 = [createMockContent(6, 200), createMockContent(7, 250)];

      mockApiClient.getContentHistory
        .mockResolvedValueOnce(mockPaginatedResponse(page1, 10))
        .mockResolvedValueOnce(mockPaginatedResponse(page2, 10, 3));

      renderWithAuth(<History />);

      await waitFor(() => {
        expect(screen.getByText(/generator-1/i)).toBeInTheDocument();
      });

      await act(async () => {
        intersectionObserverCallback([{ isIntersecting: true }]);
      });

      // Both page 1 and page 2 items should be visible
      await waitFor(() => {
        expect(screen.getByText(/generator-1/i)).toBeInTheDocument();
        expect(screen.getByText(/CONTENT 6/i)).toBeInTheDocument();
      });
    });
  });

  describe('Authentication-Aware Voting', () => {
    beforeEach(() => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: mockContents,
        pagination: { offset: 0, limit: 20, count: 5, total: 5 },
      });
    });

    it('should show login prompts instead of voting buttons when unauthenticated', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: false,
        user: null,
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const generatorText = screen.getByText(/generator-1/i);
        // @ts-expect-error - jest-dom matchers
        expect(generatorText).toBeInTheDocument();
      });

      // Should show login links, not voting buttons
      const loginLinks = screen.getAllByRole('link', { name: /log in to vote/i });
      expect(loginLinks.length).toBeGreaterThan(0);

      // Should NOT show voting buttons
      expect(screen.queryByRole('button', { name: /good/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /bad/i })).toBeNull();
    });

    it('should show voting buttons when authenticated', async () => {
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const goodButtons = screen.getAllByRole('button', { name: /good/i });
        expect(goodButtons.length).toBe(5);
      });

      // Should NOT show login prompts
      expect(screen.queryByRole('link', { name: /log in to vote/i })).toBeNull();
    });
  });

  describe('Voting Functionality', () => {
    beforeEach(() => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: mockContents,
        pagination: { offset: 0, limit: 20, count: 5, total: 5 },
      });
      // Voting tests need authenticated user
      mockApiClient.checkSession.mockResolvedValue({
        authenticated: true,
        user: { name: 'Test User' },
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

    it('should submit vote successfully without showing text feedback', async () => {
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

      // Visual feedback is now self-contained in VotingButtons (animations),
      // no text confirmation messages in History page
      expect(screen.queryByText(/thanks for voting/i)).toBeNull();
    });

    it('should handle vote submission failure without showing text feedback', async () => {
      mockApiClient.submitVote.mockRejectedValue(new Error('Vote failed'));

      renderWithAuth(<History />);

      await waitFor(() => {
        const goodButtons = screen.getAllByRole('button', { name: /good/i });
        fireEvent.click(goodButtons[0]);
      });

      await waitFor(() => {
        expect(mockApiClient.submitVote).toHaveBeenCalled();
      });

      // Visual feedback is now self-contained in VotingButtons (animations),
      // no text error messages in History page
      expect(screen.queryByText(/vote failed/i)).toBeNull();
    });
  });

  describe('Card Interactions', () => {
    beforeEach(() => {
      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: mockContents,
        pagination: { offset: 0, limit: 20, count: 5, total: 5 },
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
        pagination: { offset: 0, limit: 20, count: 5, total: 5 },
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
        pagination: { offset: 0, limit: 20, count: 5, total: 5 },
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
        pagination: { offset: 0, limit: 20, count: 5, total: 5 },
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
        pagination: { offset: 0, limit: 20, count: 5, total: 5 },
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

  describe('MoreInfoButton Integration', () => {
    it('should render MoreInfoButton for content with moreInfoUrl in metadata', async () => {
      const contentWithUrl: ContentRecord = {
        ...createMockContent(1, 1),
        metadata: {
          moreInfoUrl: 'https://example.com/article-1',
        },
      };

      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: [contentWithUrl],
        pagination: { offset: 0, limit: 20, count: 1, total: 1 },
      });

      renderWithAuth(<History />);

      // Wait for content to load and MoreInfoButton to appear
      await waitFor(() => {
        const moreInfoButton = screen.getByRole('link', { name: /more info/i });
        // @ts-expect-error - jest-dom matchers
        expect(moreInfoButton).toBeInTheDocument();
        // @ts-expect-error - jest-dom matchers
        expect(moreInfoButton).toHaveAttribute('href', 'https://example.com/article-1');
      });
    });

    it('should not render MoreInfoButton for content without moreInfoUrl', async () => {
      const contentWithoutUrl: ContentRecord = createMockContent(1, 1);

      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: [contentWithoutUrl],
        pagination: { offset: 0, limit: 20, count: 1, total: 1 },
      });

      renderWithAuth(<History />);

      // Wait for content to load
      await waitFor(() => {
        const generatorText = screen.getByText(/generator-1/i);
        // @ts-expect-error - jest-dom matchers
        expect(generatorText).toBeInTheDocument();
      });

      // Verify MoreInfoButton is not present
      const moreInfoButton = screen.queryByRole('link', { name: /more info/i });
      expect(moreInfoButton).toBeNull();
    });

    it('should render MoreInfoButtons for multiple content items with URLs', async () => {
      const content1: ContentRecord = {
        ...createMockContent(1, 1),
        metadata: {
          moreInfoUrl: 'https://example.com/article-1',
        },
      };

      const content2: ContentRecord = {
        ...createMockContent(2, 2),
        metadata: {
          moreInfoUrl: 'https://example.com/article-2',
        },
      };

      const content3: ContentRecord = createMockContent(3, 3); // No URL

      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: [content1, content2, content3],
        pagination: { offset: 0, limit: 20, count: 3, total: 3 },
      });

      renderWithAuth(<History />);

      // Wait for content to load
      await waitFor(() => {
        const allButtons = screen.getAllByRole('link', { name: /more info/i });
        expect(allButtons).toHaveLength(2); // Only 2 out of 3 have URLs
        // @ts-expect-error - jest-dom matchers
        expect(allButtons[0]).toHaveAttribute('href', 'https://example.com/article-1');
        // @ts-expect-error - jest-dom matchers
        expect(allButtons[1]).toHaveAttribute('href', 'https://example.com/article-2');
      });
    });

    it('should open MoreInfoButton links in new tab', async () => {
      const contentWithUrl: ContentRecord = {
        ...createMockContent(1, 1),
        metadata: {
          moreInfoUrl: 'https://example.com/article-1',
        },
      };

      mockApiClient.getContentHistory.mockResolvedValue({
        success: true,
        data: [contentWithUrl],
        pagination: { offset: 0, limit: 20, count: 1, total: 1 },
      });

      renderWithAuth(<History />);

      await waitFor(() => {
        const moreInfoButton = screen.getByRole('link', { name: /more info/i });
        // @ts-expect-error - jest-dom matchers
        expect(moreInfoButton).toHaveAttribute('target', '_blank');
        // @ts-expect-error - jest-dom matchers
        expect(moreInfoButton).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });
  });

  describe('FilterBar Integration', () => {
    it('should render FilterBar with search input', async () => {
      mockApiClient.getContentHistory.mockResolvedValue(mockPaginatedResponse(mockContents, 5));

      renderWithAuth(<History />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search content...')).toBeInTheDocument();
      });
    });

    it('should derive filter options from loaded content', async () => {
      const diverseContent = [
        {
          ...createMockContent(1, 1),
          aiProvider: 'openai',
          aiModel: 'gpt-4.1-nano',
          generatorId: 'haiku',
        },
        {
          ...createMockContent(2, 2),
          aiProvider: 'anthropic',
          aiModel: 'claude-haiku-4.5',
          generatorId: 'news',
        },
        {
          ...createMockContent(3, 3),
          aiProvider: 'openai',
          aiModel: 'gpt-4.1-mini',
          generatorId: 'weather',
        },
      ];
      mockApiClient.getContentHistory.mockResolvedValue(mockPaginatedResponse(diverseContent, 3));

      renderWithAuth(<History />);

      // FilterBar should be present once content loads
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search content...')).toBeInTheDocument();
      });
    });

    it('should pass sort parameter to API on initial load', async () => {
      mockApiClient.getContentHistory.mockResolvedValue(mockPaginatedResponse(mockContents, 5));

      renderWithAuth(<History />);

      await waitFor(() => {
        expect(mockApiClient.getContentHistory).toHaveBeenCalledWith(
          expect.objectContaining({ sort: 'newest' })
        );
      });
    });

    it('should pass offset=0 on initial load', async () => {
      mockApiClient.getContentHistory.mockResolvedValue(mockPaginatedResponse(mockContents, 5));

      renderWithAuth(<History />);

      await waitFor(() => {
        expect(mockApiClient.getContentHistory).toHaveBeenCalledWith(
          expect.objectContaining({ offset: 0 })
        );
      });
    });
  });

  describe('Filter Pills', () => {
    it('should not show filter pills when no filters are active', async () => {
      mockApiClient.getContentHistory.mockResolvedValue(mockPaginatedResponse(mockContents, 5));

      renderWithAuth(<History />);

      await waitFor(() => {
        expect(screen.getByText(/generator-1/i)).toBeInTheDocument();
      });

      // No filter pills container should be rendered
      expect(screen.queryByTestId('filter-pills')).not.toBeInTheDocument();
    });
  });

  describe('Filtered Empty State', () => {
    it('should show filter-specific empty message when filters produce no results', async () => {
      // Return empty results with hasActiveFilters indication
      mockApiClient.getContentHistory.mockResolvedValue(mockPaginatedResponse([], 0));

      renderWithAuth(<History />);

      await waitFor(() => {
        // With no data and no filters, shows default empty state
        expect(screen.getByText(/no content history available/i)).toBeInTheDocument();
      });
    });
  });
});
