/**
 * Admin Page (/admin)
 *
 * Circuit breaker management interface.
 * Displays all circuits grouped by type with toggle controls.
 *
 * Architecture:
 * - Single Responsibility: Manages circuit breaker UI and state
 * - Dependency Inversion: Uses apiClient abstraction for API calls
 * - Open/Closed: Extensible via additional admin features
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PageLayout } from '../components/PageLayout.js';
import { CircuitBreakerCard, type Circuit } from '../components/CircuitBreakerCard.js';
import { Button } from '../components/ui/button.js';
import { AlertCircle, LogIn } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';

export function Admin() {
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [loadingCircuitId, setLoadingCircuitId] = useState<string | null>(null);

  /**
   * Fetch circuits from API
   */
  const fetchCircuits = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsUnauthorized(false);

    try {
      const response = await apiClient.getCircuits();
      if (response.data) {
        setCircuits(response.data as Circuit[]);
      }
    } catch (err) {
      const error = err as Error;
      // Check for 401 Unauthorized
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        setIsUnauthorized(true);
      } else {
        setError(error.message || 'Failed to load circuits');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load circuits on mount
   */
  useEffect(() => {
    fetchCircuits();
  }, [fetchCircuits]);

  /**
   * Handle toggle action
   */
  const handleToggle = async (id: string, enable: boolean): Promise<void> => {
    setLoadingCircuitId(id);
    setError(null);

    try {
      if (enable) {
        await apiClient.enableCircuit(id);
      } else {
        await apiClient.disableCircuit(id);
      }
      // Refetch circuits to get updated state
      await fetchCircuits();
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to toggle circuit');
    } finally {
      setLoadingCircuitId(null);
    }
  };

  /**
   * Handle reset action for provider circuits
   */
  const handleReset = async (id: string): Promise<void> => {
    setLoadingCircuitId(id);
    setError(null);

    try {
      await apiClient.resetCircuit(id);
      // Refetch circuits to get updated state
      await fetchCircuits();
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to reset circuit');
    } finally {
      setLoadingCircuitId(null);
    }
  };

  // Group circuits by type
  const systemControls = circuits.filter(c => c.type === 'manual');
  const providerCircuits = circuits.filter(c => c.type === 'provider');

  // Loading state
  if (isLoading && circuits.length === 0) {
    return (
      <PageLayout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Admin</h1>
          <div className="flex justify-center items-center py-16">
            <div className="text-gray-600 dark:text-gray-400">Loading circuits...</div>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Unauthorized state - prompt to log in
  if (isUnauthorized) {
    return (
      <PageLayout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Admin</h1>
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-6">
              <LogIn className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Authentication Required
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Please log in to access admin features.
            </p>
            <Link to="/login">
              <Button>
                <LogIn className="h-4 w-4 mr-2" />
                Log In
              </Button>
            </Link>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Error state (only if no circuits loaded)
  if (error && circuits.length === 0) {
    return (
      <PageLayout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Admin</h1>
          <div className="text-center py-16">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <Button onClick={fetchCircuits}>Try Again</Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Admin</h1>

        {/* Error Message (for toggle/reset errors when circuits are loaded) */}
        {error && circuits.length > 0 && (
          <div
            className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 mb-6"
            role="alert"
          >
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* System Controls Section */}
        <section data-testid="system-controls-section" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            System Controls
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {systemControls.map(circuit => (
              <CircuitBreakerCard
                key={circuit.id}
                circuit={circuit}
                onToggle={handleToggle}
                isLoading={loadingCircuitId === circuit.id}
              />
            ))}
          </div>
          {systemControls.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No system controls configured.
            </p>
          )}
        </section>

        {/* Provider Circuits Section */}
        <section data-testid="provider-circuits-section">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Provider Circuits
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {providerCircuits.map(circuit => (
              <CircuitBreakerCard
                key={circuit.id}
                circuit={circuit}
                onToggle={handleToggle}
                onReset={handleReset}
                isLoading={loadingCircuitId === circuit.id}
              />
            ))}
          </div>
          {providerCircuits.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No provider circuits configured.
            </p>
          )}
        </section>
      </div>
    </PageLayout>
  );
}

export default Admin;
