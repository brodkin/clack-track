/**
 * Welcome Page Tests
 *
 * Tests for the Welcome page with API integration
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Welcome } from '@/web/frontend/pages/Welcome';
import { apiClient } from '@/web/frontend/services/apiClient';
import type { ContentRecord } from '@/storage/models/content';

// Mock the apiClient module
jest.mock('@/web/frontend/services/apiClient', () => ({
  apiClient: {
    getLatestContent: jest.fn(),
    submitVote: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('Welcome Page', () => {
  const mockContent: ContentRecord = {
    id: 123,
    text: 'HELLO WORLD',
    type: 'major',
    generatorId: 'motivational',
    generatedAt: new Date('2024-01-15T10:30:00Z'),
    sentAt: new Date('2024-01-15T10:30:01Z'),
    aiProvider: 'openai',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading message while fetching content', async () => {
      // Create a promise that never resolves to keep loading state
      mockApiClient.getLatestContent.mockReturnValue(new Promise(() => {}));

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      const loading = screen.getByText(/loading content/i);
      // @ts-expect-error - jest-dom matchers
      expect(loading).toBeInTheDocument();
    });
  });

  describe('Content Display', () => {
    it('should display content when loaded successfully', async () => {
      // Backend sends ContentRecord directly in data (not wrapped)
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: mockContent,
      });

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      await waitFor(() => {
        const generatorText = screen.getByText(/motivational/i);
        // @ts-expect-error - jest-dom matchers
        expect(generatorText).toBeInTheDocument();
      });
    });

    it('should display the generator ID', async () => {
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: mockContent,
      });

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      await waitFor(() => {
        const generatorId = screen.getByText(/motivational/);
        // @ts-expect-error - jest-dom matchers
        expect(generatorId).toBeInTheDocument();
      });
    });

    it('should display the generated timestamp', async () => {
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: mockContent,
      });

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      await waitFor(() => {
        // The date should be displayed in locale format
        const dateElement = screen.getByText(/2024/);
        // @ts-expect-error - jest-dom matchers
        expect(dateElement).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no content is available', async () => {
      // Backend sends null directly in data
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: null,
      });

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      await waitFor(() => {
        const emptyMessage = screen.getByText(/no content available/i);
        // @ts-expect-error - jest-dom matchers
        expect(emptyMessage).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('should show error message when API call fails', async () => {
      mockApiClient.getLatestContent.mockRejectedValue(new Error('Network error'));

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      await waitFor(() => {
        const errorMessage = screen.getByText(/network error/i);
        // @ts-expect-error - jest-dom matchers
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      mockApiClient.getLatestContent.mockRejectedValue(new Error('Failed'));

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /try again/i });
        // @ts-expect-error - jest-dom matchers
        expect(retryButton).toBeInTheDocument();
      });
    });

    it('should retry fetching content when retry button is clicked', async () => {
      mockApiClient.getLatestContent
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          success: true,
          data: mockContent,
        });

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /try again/i });
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(mockApiClient.getLatestContent).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Voting Functionality', () => {
    beforeEach(() => {
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: mockContent,
      });
    });

    it('should render voting buttons when content is displayed', async () => {
      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      await waitFor(() => {
        const goodButton = screen.getByRole('button', { name: /good/i });
        const badButton = screen.getByRole('button', { name: /bad/i });
        // @ts-expect-error - jest-dom matchers
        expect(goodButton).toBeInTheDocument();
        // @ts-expect-error - jest-dom matchers
        expect(badButton).toBeInTheDocument();
      });
    });

    it('should submit vote when Good button is clicked', async () => {
      mockApiClient.submitVote.mockResolvedValue({
        success: true,
        data: {
          vote: {
            id: 1,
            content_id: mockContent.id,
            vote_type: 'good',
            created_at: new Date(),
          },
        },
      });

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      await waitFor(() => {
        const goodButton = screen.getByRole('button', { name: /good/i });
        fireEvent.click(goodButton);
      });

      await waitFor(() => {
        expect(mockApiClient.submitVote).toHaveBeenCalledWith({
          contentId: String(mockContent.id),
          vote: 'good',
        });
      });
    });

    it('should submit vote when Bad button is clicked', async () => {
      mockApiClient.submitVote.mockResolvedValue({
        success: true,
        data: {
          vote: {
            id: 1,
            content_id: mockContent.id,
            vote_type: 'bad',
            created_at: new Date(),
          },
        },
      });

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      await waitFor(() => {
        const badButton = screen.getByRole('button', { name: /bad/i });
        fireEvent.click(badButton);
      });

      await waitFor(() => {
        expect(mockApiClient.submitVote).toHaveBeenCalledWith({
          contentId: String(mockContent.id),
          vote: 'bad',
        });
      });
    });

    it('should show success message after vote submission', async () => {
      mockApiClient.submitVote.mockResolvedValue({
        success: true,
        data: {
          vote: {
            id: 1,
            content_id: mockContent.id,
            vote_type: 'good',
            created_at: new Date(),
          },
        },
      });

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      await waitFor(() => {
        const goodButton = screen.getByRole('button', { name: /good/i });
        fireEvent.click(goodButton);
      });

      await waitFor(() => {
        const successMessage = screen.getByText(/thank you/i);
        // @ts-expect-error - jest-dom matchers
        expect(successMessage).toBeInTheDocument();
      });
    });

    it('should show error message when vote submission fails', async () => {
      mockApiClient.submitVote.mockRejectedValue(new Error('Vote failed'));

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      await waitFor(() => {
        const goodButton = screen.getByRole('button', { name: /good/i });
        fireEvent.click(goodButton);
      });

      await waitFor(() => {
        const errorMessage = screen.getByText(/vote failed/i);
        // @ts-expect-error - jest-dom matchers
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('should show loading state during vote submission', async () => {
      // Create a slow-resolving promise
      let resolveVote: (value: unknown) => void;
      const votePromise = new Promise(resolve => {
        resolveVote = resolve;
      });
      mockApiClient.submitVote.mockReturnValue(
        votePromise as ReturnType<typeof mockApiClient.submitVote>
      );

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      await waitFor(() => {
        const goodButton = screen.getByRole('button', { name: /good/i });
        fireEvent.click(goodButton);
      });

      await waitFor(() => {
        const loadingMessage = screen.getByText(/submitting vote/i);
        // @ts-expect-error - jest-dom matchers
        expect(loadingMessage).toBeInTheDocument();
      });

      // Clean up
      resolveVote!({ success: true, data: { vote: { id: 'test' } } });
    });
  });

  describe('Vestaboard Preview', () => {
    it('should render VestaboardPreview component', async () => {
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: mockContent,
      });

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      await waitFor(() => {
        // The VestaboardPreview should be rendered (check for the grid container)
        const preview = screen.getByRole('heading', { name: /latest content/i });
        // @ts-expect-error - jest-dom matchers
        expect(preview).toBeInTheDocument();
      });
    });
  });

  describe('Help Text', () => {
    it('should display voting help text', async () => {
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: mockContent,
      });

      render(
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      );

      await waitFor(() => {
        const helpText = screen.getByText(/help us improve/i);
        // @ts-expect-error - jest-dom matchers
        expect(helpText).toBeInTheDocument();
      });
    });
  });
});
