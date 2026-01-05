/**
 * RouteLoading Component
 *
 * Loading spinner displayed during React Suspense route transitions
 */

/**
 * RouteLoading displays a centered loading indicator for lazy-loaded routes
 */
export function RouteLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-8 h-8 border-4 border-gray-300 dark:border-gray-700 border-t-amber-400 rounded-full animate-spin"
          role="status"
          aria-label="Loading"
        />
        <span className="text-gray-500 dark:text-gray-400 text-sm">Loading...</span>
      </div>
    </div>
  );
}
