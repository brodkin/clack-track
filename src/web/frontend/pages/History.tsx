/**
 * History Page (/flipside)
 *
 * Displays list of historical content records ("The Flip Side")
 */

import { PageLayout } from '../components/PageLayout';
import { ContentCard } from '../components/ContentCard';
import { getMockContentHistory } from '../lib/mockData';

export function History() {
  const contentHistory = getMockContentHistory(5);

  return (
    <PageLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">The Flip Side</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Browse historical content generated for your Vestaboard
        </p>

        <div className="space-y-4">
          {contentHistory.map(content => (
            <ContentCard
              key={content.id}
              content={content}
              onClick={() => console.log('Content clicked:', content.id)}
            />
          ))}
        </div>

        {contentHistory.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>No content history available yet.</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
