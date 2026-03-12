/**
 * History Page (/flipside)
 *
 * Displays list of historical content records ("The Flip Side")
 * with filtering, search, sort, infinite scroll, and voting capability.
 *
 * Architecture:
 * - FilterBar drives filter/search/sort state
 * - IntersectionObserver triggers lazy loading (replaces "Load More" button)
 * - Filter pills show active filters with clear buttons
 * - API params are passed through to backend for server-side filtering
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PageLayout } from '../components/PageLayout';
import { ContentCard } from '../components/ContentCard';
import { VotingButtons } from '../components/VotingButtons';
import { LoginToVote } from '../components/LoginToVote';
import { Button } from '../components/ui/button';
import { FilterBar, type SortOrder } from '../components/FilterBar';
import { useAuth } from '../context/AuthContext.js';
import { apiClient } from '../services/apiClient';
import type { ContentRecord } from '../../../storage/models/content.js';
import type { ContentHistoryParams } from '../services/types.js';

const PAGE_SIZE = 20;

type VotingState = Record<number, boolean>;
type VestaboardModel = 'black' | 'white';

/** Filter state managed by the History page */
interface FilterState {
  provider: string;
  model: string;
  generator: string;
  search: string;
  sort: SortOrder;
}

const INITIAL_FILTERS: FilterState = {
  provider: '',
  model: '',
  generator: '',
  search: '',
  sort: 'newest',
};

export function History() {
  const { isAuthenticated } = useAuth();
  const [contents, setContents] = useState<ContentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [votingState, setVotingState] = useState<VotingState>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  // Store model for future VestaboardPreview usage (e.g., expanded content view)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [vestaboardModel, setVestaboardModel] = useState<VestaboardModel>('black');

  // Ref for the scroll sentinel element (IntersectionObserver target)
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Track whether we're currently fetching to avoid duplicate requests
  const isFetchingRef = useRef(false);

  /**
   * Build API params from current filter state and offset
   */
  const buildParams = useCallback(
    (offset: number): ContentHistoryParams => {
      const params: ContentHistoryParams = {
        limit: PAGE_SIZE,
        offset,
        sort: filters.sort,
      };
      if (filters.provider) params.provider = filters.provider;
      if (filters.model) params.model = filters.model;
      if (filters.generator) params.generator = filters.generator;
      if (filters.search) params.search = filters.search;
      return params;
    },
    [filters]
  );

  /**
   * Fetch content history from the API
   * When append=true, fetches the next page and appends to existing content.
   * When append=false, resets and fetches from offset 0.
   */
  const fetchHistory = useCallback(
    async (append = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const offset = append ? contents.length : 0;
        const params = buildParams(offset);
        const response = await apiClient.getContentHistory(params);

        if (response.data) {
          if (append) {
            setContents(prev => [...prev, ...response.data!]);
          } else {
            setContents(response.data);
          }
          setTotal(response.pagination?.total ?? response.data.length);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        isFetchingRef.current = false;
      }
    },
    [contents.length, buildParams]
  );

  // Initial fetch
  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when filters change (reset to first page)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Reset content list and fetch from scratch with new filters
    setContents([]);
    setTotal(0);
    isFetchingRef.current = false;

    const doFetch = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = buildParams(0);
        const response = await apiClient.getContentHistory(params);
        if (response.data) {
          setContents(response.data);
          setTotal(response.pagination?.total ?? response.data.length);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    };
    doFetch();
  }, [filters, buildParams]);

  // Fetch Vestaboard config on mount (for future VestaboardPreview usage)
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

  // IntersectionObserver for infinite scroll
  const hasMore = contents.length < total;

  useEffect(() => {
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && hasMore && !isFetchingRef.current) {
          fetchHistory(true);
        }
      },
      { rootMargin: '200px' }
    );

    const sentinel = sentinelRef.current;
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasMore, fetchHistory]);

  const handleVote = async (contentId: number, vote: 'good' | 'bad', reason?: string) => {
    setVotingState(prev => ({ ...prev, [contentId]: true }));
    try {
      await apiClient.submitVote({
        contentId: String(contentId),
        vote,
        ...(reason && { reason }),
      });
    } catch {
      // Visual feedback is self-contained in VotingButtons (animations + haptics)
    } finally {
      setVotingState(prev => ({ ...prev, [contentId]: false }));
    }
  };

  const toggleExpanded = (id: number) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  // Derive filter dropdown options from loaded content
  const filterOptions = useMemo(() => {
    const providers = new Set<string>();
    const models = new Set<string>();
    const generators = new Set<string>();

    for (const item of contents) {
      if (item.aiProvider) providers.add(item.aiProvider);
      if (item.aiModel) models.add(item.aiModel);
      if (item.generatorId) generators.add(item.generatorId);
    }

    return {
      providers: Array.from(providers).sort(),
      models: Array.from(models).sort(),
      generators: Array.from(generators).sort(),
    };
  }, [contents]);

  // Filter change handlers
  const handleFilterChange = useCallback((key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  }, []);

  const handleSortChange = useCallback((value: SortOrder) => {
    setFilters(prev => ({ ...prev, sort: value }));
  }, []);

  const handleClearFilter = useCallback((key: keyof FilterState) => {
    setFilters(prev => ({
      ...prev,
      [key]: key === 'sort' ? 'newest' : '',
    }));
  }, []);

  // Determine which filters are active (for pills)
  const activeFilters = useMemo(() => {
    const active: Array<{ key: keyof FilterState; label: string; value: string }> = [];
    if (filters.provider)
      active.push({ key: 'provider', label: 'Provider', value: filters.provider });
    if (filters.model) active.push({ key: 'model', label: 'Model', value: filters.model });
    if (filters.generator)
      active.push({ key: 'generator', label: 'Generator', value: filters.generator });
    if (filters.search) active.push({ key: 'search', label: 'Search', value: filters.search });
    return active;
  }, [filters]);

  const hasActiveFilters = activeFilters.length > 0;

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

  // Empty state (no filters active)
  if (contents.length === 0 && !hasActiveFilters) {
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
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Browse historical content generated for your Vestaboard
        </p>

        {/* FilterBar */}
        <FilterBar
          providers={filterOptions.providers}
          models={filterOptions.models}
          generators={filterOptions.generators}
          selectedProvider={filters.provider}
          selectedModel={filters.model}
          selectedGenerator={filters.generator}
          searchQuery={filters.search}
          sortOrder={filters.sort}
          onProviderChange={value => handleFilterChange('provider', value)}
          onModelChange={value => handleFilterChange('model', value)}
          onGeneratorChange={value => handleFilterChange('generator', value)}
          onSearchChange={handleSearchChange}
          onSortChange={handleSortChange}
          className="mb-4"
        />

        {/* Active filter pills */}
        {hasActiveFilters && (
          <div data-testid="filter-pills" className="flex flex-wrap gap-2 mb-4">
            {activeFilters.map(({ key, label, value }) => (
              <button
                key={key}
                onClick={() => handleClearFilter(key)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                aria-label={`Clear ${label} filter`}
              >
                {label}: {value}
                <span aria-hidden="true" className="ml-1 text-blue-500">
                  &times;
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Filtered empty state */}
        {contents.length === 0 && hasActiveFilters && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>No content matches your filters.</p>
            <p className="text-sm mt-2">Try adjusting your search or filter criteria.</p>
          </div>
        )}

        {/* Content list */}
        {contents.length > 0 && (
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
                    {isAuthenticated ? (
                      <VotingButtons
                        onVote={(vote, reason) => handleVote(content.id, vote, reason)}
                        isLoading={votingState[content.id] === true}
                        className="scale-75 origin-left"
                      />
                    ) : (
                      <LoginToVote className="scale-75 origin-left" />
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatRelativeTime(new Date(content.generatedAt))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel + loading spinner */}
        {hasMore && (
          <div ref={sentinelRef} className="mt-8 text-center py-4">
            {isLoadingMore && (
              <div
                data-testid="lazy-load-spinner"
                className="flex justify-center items-center gap-2 text-gray-500"
              >
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
                <span className="text-sm">Loading more...</span>
              </div>
            )}
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

export default History;
