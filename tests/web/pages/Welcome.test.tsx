/**
 * Welcome Page Tests
 *
 * Tests for the Welcome page component focusing on:
 * - Using pre-framed characterCodes from API when available
 * - Falling back to textToCharacterCodes() for legacy data
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Welcome } from '@/web/frontend/pages/Welcome';
import { AuthProvider } from '@/web/frontend/context/AuthContext';
import { apiClient } from '@/web/frontend/services/apiClient';
import { textToCharacterCodes, emptyGrid } from '@/web/frontend/lib/textToCharCodes';

// Mock the apiClient
jest.mock('@/web/frontend/services/apiClient', () => ({
  apiClient: {
    getLatestContent: jest.fn(),
    submitVote: jest.fn(),
    getVestaboardConfig: jest.fn(),
    checkSession: jest.fn(),
  },
}));

// Mock @simplewebauthn/browser (required by AuthProvider)
jest.mock('@simplewebauthn/browser', () => ({
  startAuthentication: jest.fn(),
}));

// Mock textToCharacterCodes to track when it's called
jest.mock('@/web/frontend/lib/textToCharCodes', () => ({
  textToCharacterCodes: jest.fn((text: string) => {
    // Simple mock implementation that returns a basic grid
    const rows: number[][] = [];
    const lines = text.split('\n');
    for (let i = 0; i < 6; i++) {
      const row: number[] = [];
      const line = lines[i] || '';
      for (let j = 0; j < 22; j++) {
        // Simple char to code mapping for testing (A=1, B=2, etc.)
        const char = line[j]?.toUpperCase() || ' ';
        row.push(char === ' ' ? 0 : char.charCodeAt(0) - 64);
      }
      rows.push(row);
    }
    return rows;
  }),
  emptyGrid: jest.fn(() => Array.from({ length: 6 }, () => Array(22).fill(0))),
}));

// Get typed mocks
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockTextToCharacterCodes = textToCharacterCodes as jest.MockedFunction<
  typeof textToCharacterCodes
>;
const mockEmptyGrid = emptyGrid as jest.MockedFunction<typeof emptyGrid>;

describe('Welcome Page', () => {
  // Sample character codes grid (6x22)
  const sampleCharacterCodes: number[][] = [
    [8, 5, 12, 12, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // HELLO
    [23, 15, 18, 12, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // WORLD
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Default config response
    mockApiClient.getVestaboardConfig.mockResolvedValue({ model: 'black' });
    // Default auth mock - unauthenticated is fine for Welcome page (public)
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

  describe('when API returns characterCodes', () => {
    it('should use characterCodes from API response directly', async () => {
      // Arrange: API returns content WITH characterCodes
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          text: 'HELLO\nWORLD',
          type: 'major',
          generatedAt: new Date(),
          sentAt: new Date(),
          aiProvider: 'openai',
          generatorId: 'test-generator',
          characterCodes: sampleCharacterCodes,
        },
      });

      // Act
      renderWithAuth(<Welcome />);

      // Assert: Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading content...')).not.toBeInTheDocument();
      });

      // textToCharacterCodes should NOT be called when characterCodes is provided
      expect(mockTextToCharacterCodes).not.toHaveBeenCalled();

      // The VestaboardPreview should be rendered with the API's characterCodes
      const vestaboard = screen.getByTestId('vestaboard');
      // @ts-expect-error - jest-dom matchers
      expect(vestaboard).toBeInTheDocument();

      // Verify the first cell has the correct character code (H = 8)
      const firstCell = screen.getByTestId('vestaboard-cell-0-0');
      expect(firstCell).toHaveAttribute('data-char-code', '8');
    });

    it('should pass characterCodes to VestaboardPreview component', async () => {
      // Arrange
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          text: 'TEST',
          type: 'major',
          generatedAt: new Date(),
          sentAt: new Date(),
          aiProvider: 'openai',
          generatorId: 'test-generator',
          characterCodes: sampleCharacterCodes,
        },
      });

      // Act
      renderWithAuth(<Welcome />);

      // Assert
      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId('vestaboard')).toBeInTheDocument();
      });

      // Verify the grid matches the API's characterCodes
      // Row 0, Col 0 should be H (8)
      expect(screen.getByTestId('vestaboard-cell-0-0')).toHaveAttribute('data-char-code', '8');
      // Row 0, Col 1 should be E (5)
      expect(screen.getByTestId('vestaboard-cell-0-1')).toHaveAttribute('data-char-code', '5');
      // Row 1, Col 0 should be W (23)
      expect(screen.getByTestId('vestaboard-cell-1-0')).toHaveAttribute('data-char-code', '23');
    });
  });

  describe('when API returns content without characterCodes (legacy data)', () => {
    it('should fall back to textToCharacterCodes() conversion', async () => {
      // Arrange: API returns content WITHOUT characterCodes (legacy format)
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: {
          id: 2,
          text: 'LEGACY TEXT',
          type: 'major',
          generatedAt: new Date(),
          sentAt: new Date(),
          aiProvider: 'openai',
          generatorId: 'legacy-generator',
          // No characterCodes field - simulating legacy data
        },
      });

      // Act
      renderWithAuth(<Welcome />);

      // Assert: Wait for content to load
      await waitFor(() => {
        expect(screen.queryByText('Loading content...')).not.toBeInTheDocument();
      });

      // textToCharacterCodes SHOULD be called for legacy data
      expect(mockTextToCharacterCodes).toHaveBeenCalledWith('LEGACY TEXT');

      // The VestaboardPreview should still be rendered
      // @ts-expect-error - jest-dom matchers
      expect(screen.getByTestId('vestaboard')).toBeInTheDocument();
    });

    it('should handle content with text but undefined characterCodes', async () => {
      // Arrange
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: {
          id: 3,
          text: 'UNDEFINED CODES',
          type: 'major',
          generatedAt: new Date(),
          sentAt: new Date(),
          aiProvider: 'anthropic',
          generatorId: 'test-gen',
          characterCodes: undefined,
        },
      });

      // Act
      renderWithAuth(<Welcome />);

      // Assert
      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId('vestaboard')).toBeInTheDocument();
      });

      // Should fall back to text conversion
      expect(mockTextToCharacterCodes).toHaveBeenCalledWith('UNDEFINED CODES');
    });
  });

  describe('when content has empty or null text', () => {
    it('should use emptyGrid when content.text is empty string', async () => {
      // Arrange
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: {
          id: 4,
          text: '',
          type: 'major',
          generatedAt: new Date(),
          sentAt: new Date(),
          aiProvider: 'openai',
          generatorId: 'empty-gen',
          // No characterCodes
        },
      });

      // Act
      renderWithAuth(<Welcome />);

      // Assert
      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId('vestaboard')).toBeInTheDocument();
      });

      // With empty text and no characterCodes, should use emptyGrid
      expect(mockEmptyGrid).toHaveBeenCalled();
    });

    it('should still use characterCodes if provided even with empty text', async () => {
      // Arrange: Content has empty text but valid characterCodes (edge case)
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: {
          id: 5,
          text: '',
          type: 'major',
          generatedAt: new Date(),
          sentAt: new Date(),
          aiProvider: 'openai',
          generatorId: 'codes-only-gen',
          characterCodes: sampleCharacterCodes,
        },
      });

      // Act
      renderWithAuth(<Welcome />);

      // Assert
      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId('vestaboard')).toBeInTheDocument();
      });

      // Should use provided characterCodes, NOT fall back to emptyGrid
      expect(mockTextToCharacterCodes).not.toHaveBeenCalled();
      // Verify the characterCodes are used
      expect(screen.getByTestId('vestaboard-cell-0-0')).toHaveAttribute('data-char-code', '8');
    });
  });

  describe('when no content is available', () => {
    it('should show empty state with emptyGrid', async () => {
      // Arrange: API returns null content
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: null,
      });

      // Act
      renderWithAuth(<Welcome />);

      // Assert - use regex for partial match since component has longer text
      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText(/no content available yet/i)).toBeInTheDocument();
      });

      // Empty state should use emptyGrid
      expect(mockEmptyGrid).toHaveBeenCalled();
    });
  });

  describe('loading and error states', () => {
    it('should show loading state initially', async () => {
      // Arrange: API takes time to respond
      mockApiClient.getLatestContent.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      // Act
      renderWithAuth(<Welcome />);

      // Assert: Loading state shown initially
      // @ts-expect-error - jest-dom matchers
      expect(screen.getByText('Loading content...')).toBeInTheDocument();
    });

    it('should show error state on API failure', async () => {
      // Arrange
      mockApiClient.getLatestContent.mockRejectedValue(new Error('Network error'));

      // Act
      renderWithAuth(<Welcome />);

      // Assert
      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // @ts-expect-error - jest-dom matchers
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('characterCodes validation', () => {
    it('should handle malformed characterCodes array gracefully', async () => {
      // Arrange: characterCodes is present but malformed (not a 2D array)
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: {
          id: 6,
          text: 'FALLBACK TEXT',
          type: 'major',
          generatedAt: new Date(),
          sentAt: new Date(),
          aiProvider: 'openai',
          generatorId: 'malformed-gen',
          // Malformed: should be number[][] but is number[]
          characterCodes: [1, 2, 3] as unknown as number[][],
        },
      });

      // Act
      renderWithAuth(<Welcome />);

      // Assert
      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId('vestaboard')).toBeInTheDocument();
      });

      // Should fall back to text conversion when characterCodes is invalid
      expect(mockTextToCharacterCodes).toHaveBeenCalledWith('FALLBACK TEXT');
    });

    it('should handle characterCodes with wrong dimensions gracefully', async () => {
      // Arrange: characterCodes has wrong number of rows
      mockApiClient.getLatestContent.mockResolvedValue({
        success: true,
        data: {
          id: 7,
          text: 'DIMENSION TEXT',
          type: 'major',
          generatedAt: new Date(),
          sentAt: new Date(),
          aiProvider: 'openai',
          generatorId: 'wrong-dim-gen',
          // Only 3 rows instead of 6
          characterCodes: [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
          ],
        },
      });

      // Act
      renderWithAuth(<Welcome />);

      // Assert: Should still render (VestaboardPreview handles padding)
      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(screen.getByTestId('vestaboard')).toBeInTheDocument();
      });

      // VestaboardPreview normalizes the grid, so it should still work
      // The characterCodes are technically valid (2D array) so they should be used
      // VestaboardPreview will pad to 6x22
    });
  });
});
