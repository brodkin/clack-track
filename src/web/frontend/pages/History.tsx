/**
 * History Page (/flipside)
 *
 * Displays list of historical content records ("The Flip Side")
 * with pagination and voting capability.
 */

import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../components/PageLayout';
import { ContentCard } from '../components/ContentCard';
import { VotingButtons } from '../components/VotingButtons';
import { Button } from '../components/ui/button';
import { apiClient } from '../services/apiClient';
import type { ContentRecord } from '../../../storage/models/content.js';

const PAGE_SIZE = 20;

type VoteStatus = Record<number, 'idle' | 'loading' | 'success' | 'error'>;

export function History() {
  const [contents, setContents] = useState<ContentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voteStatus, setVoteStatus] = useState<VoteStatus>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchHistory = useCallback(
    async (append = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const currentCount = append ? contents.length : 0;
        const response = await apiClient.getContentHistory({ limit: PAGE_SIZE + currentCount });

        // Backend sends ContentRecord[] directly in data (not wrapped in { contents: ..., total: ... })
        // Total count comes from response.pagination.count
        if (response.data) {
          const dataArray = response.data;
          if (append) {
            // For "load more", we get all items up to new limit, then slice to get new ones
            const newContents = dataArray.slice(currentCount);
            setContents(prev => [...prev, ...newContents]);
          } else {
            setContents(dataArray);
          }
          setTotal(response.pagination?.count ?? dataArray.length);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [contents.length]
  );

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVote = async (contentId: number, vote: 'good' | 'bad') => {
    setVoteStatus(prev => ({ ...prev, [contentId]: 'loading' }));

    try {
      await apiClient.submitVote({
        contentId: String(contentId),
        vote,
      });
      setVoteStatus(prev => ({ ...prev, [contentId]: 'success' }));
      // Reset success state after 3 seconds
      setTimeout(() => {
        setVoteStatus(prev => ({ ...prev, [contentId]: 'idle' }));
      }, 3000);
    } catch {
      setVoteStatus(prev => ({ ...prev, [contentId]: 'error' }));
    }
  };

  const handleLoadMore = () => {
    fetchHistory(true);
  };

  const toggleExpanded = (id: number) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const hasMore = contents.length < total;

  // Loading state
  if (isLoading) {
    return (
      <PageLayout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">The Flip Side</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Browse historical content generated for your Vestaboard
          </p>
          <div className="space-y-4">
            {/* Loading skeleton */}
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <PageLayout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">The Flip Side</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Browse historical content generated for your Vestaboard
          </p>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <Button onClick={() => fetchHistory()}>Try Again</Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Empty state
  if (contents.length === 0) {
    return (
      <PageLayout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">The Flip Side</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Browse historical content generated for your Vestaboard
          </p>
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>No content history available yet.</p>
            <p className="text-sm mt-2">Generate some content to see it here!</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">The Flip Side</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Browse historical content generated for your Vestaboard
        </p>

        <div className="space-y-4">
          {contents.map(content => (
            <div key={content.id} className="space-y-2">
              <ContentCard
                content={content}
                onClick={() => toggleExpanded(content.id)}
                className={expandedId === content.id ? 'ring-2 ring-blue-500' : ''}
              />

              {/* Voting section */}
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-b-lg -mt-2">
                <div className="flex items-center gap-4">
                  <VotingButtons
                    onVote={vote => handleVote(content.id, vote)}
                    isLoading={voteStatus[content.id] === 'loading'}
                    className="scale-75 origin-left"
                  />
                  {voteStatus[content.id] === 'success' && (
                    <span className="text-sm text-green-600 dark:text-green-400">
                      Thanks for voting!
                    </span>
                  )}
                  {voteStatus[content.id] === 'error' && (
                    <span className="text-sm text-red-600 dark:text-red-400">Vote failed</span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {formatRelativeTime(new Date(content.generatedAt))}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Load More button */}
        {hasMore && (
          <div className="mt-8 text-center">
            <Button onClick={handleLoadMore} disabled={isLoadingMore} variant="outline" size="lg">
              {isLoadingMore ? 'Loading...' : `Load More (${contents.length} of ${total})`}
            </Button>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

/**
 * Format a date as a relative time string
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return date.toLocaleDateString();
  }
}
