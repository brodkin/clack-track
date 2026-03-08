/**
 * Welcome Page (/)
 *
 * Displays latest Vestaboard content with voting functionality.
 * Fetches content from API and allows users to vote on quality.
 *
 * Character codes handling:
 * - Uses pre-framed characterCodes from API when available
 * - Falls back to textToCharacterCodes() for legacy data without characterCodes
 */

import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../components/PageLayout';
import { VestaboardPreview } from '../components/VestaboardPreview';
import { VotingButtons } from '../components/VotingButtons';
import { MoreInfoButton } from '../components/MoreInfoButton';
import { apiClient } from '../services/apiClient';
import { textToCharacterCodes, emptyGrid } from '../lib/textToCharCodes';
import type { ContentWithCharacterCodes } from '../services/types.js';

type VestaboardModel = 'black' | 'white';

/**
 * Validate that characterCodes is a valid 2D array
 * @param codes - The characterCodes to validate
 * @returns true if codes is a valid number[][] array
 */
function isValidCharacterCodes(codes: unknown): codes is number[][] {
  if (!Array.isArray(codes)) return false;
  if (codes.length === 0) return false;
  // Check that all elements are arrays (2D structure)
  return codes.every(row => Array.isArray(row));
}

/**
 * Get character codes for display, with fallback logic
 *
 * Priority:
 * 1. Use API-provided characterCodes if valid (pre-framed by server)
 * 2. Fall back to textToCharacterCodes() for legacy data
 * 3. Use emptyGrid() if no content
 */
function getDisplayCharacterCodes(content: ContentWithCharacterCodes | null): number[][] {
  if (!content) {
    return emptyGrid();
  }

  // Use API's characterCodes if valid
  if (isValidCharacterCodes(content.characterCodes)) {
    return content.characterCodes;
  }

  // Fall back to text conversion for legacy data
  if (content.text) {
    return textToCharacterCodes(content.text);
  }

  // Empty content
  return emptyGrid();
}

export function Welcome() {
  const [content, setContent] = useState<ContentWithCharacterCodes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [vestaboardModel, setVestaboardModel] = useState<VestaboardModel>('black');

  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.getLatestContent();
      // Backend sends ContentRecord directly in data (not wrapped in { content: ... })
      if (response.data) {
        setContent(response.data);
      } else {
        setContent(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Fetch Vestaboard config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await apiClient.getVestaboardConfig();
        setVestaboardModel(config.model);
      } catch {
        // Default to 'black' if config fetch fails
        setVestaboardModel('black');
      }
    };
    fetchConfig();
  }, []);

  const handleVote = async (vote: 'good' | 'bad', reason?: string) => {
    if (!content) return;

    setIsVoting(true);
    try {
      await apiClient.submitVote({
        contentId: String(content.id),
        vote,
        ...(reason && { reason }),
      });
    } catch {
      // Visual feedback is self-contained in VotingButtons (animations + haptics)
    } finally {
      setIsVoting(false);
    }
  };

  // Get character codes for display (API-provided or fallback conversion)
  const characterCodes = getDisplayCharacterCodes(content);

  // Loading state
  if (isLoading) {
    return (
      <PageLayout>
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
            Latest Content
          </h1>
          <div className="flex justify-center items-center py-16">
            <div className="text-gray-600 dark:text-gray-400">Loading content...</div>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <PageLayout>
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
            Latest Content
          </h1>
          <div className="text-center py-16">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchContent}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Empty state
  if (!content) {
    return (
      <PageLayout>
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
            Latest Content
          </h1>
          <div className="text-center py-16">
            <VestaboardPreview
              content={emptyGrid()}
              className="mb-8 opacity-50"
              model={vestaboardModel}
            />
            <p className="text-gray-600 dark:text-gray-400">
              No content available yet. Generate some content to see it here!
            </p>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Extract moreInfoUrl from metadata
  const moreInfoUrl =
    content.metadata && typeof content.metadata.moreInfoUrl === 'string'
      ? content.metadata.moreInfoUrl
      : null;

  return (
    <PageLayout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          Latest Content
        </h1>

        <VestaboardPreview content={characterCodes} className="mb-8" model={vestaboardModel} />

        {/* More Info Button - renders below VestaboardPreview when moreInfoUrl is present */}
        {moreInfoUrl && (
          <div className="flex justify-center mb-6">
            <MoreInfoButton url={moreInfoUrl} />
          </div>
        )}

        <div className="text-center mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Generated by: <span className="font-semibold">{content.generatorId}</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {new Date(content.generatedAt).toLocaleString()}
          </p>
        </div>

        <VotingButtons onVote={handleVote} isLoading={isVoting} />

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Help us improve! Vote on the quality of this content.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}

export default Welcome;
