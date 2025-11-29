/**
 * ContentCard Component
 *
 * Reusable card for displaying content items with metadata
 */

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import type { ContentRecord } from '../../../storage/models/content.js';
import { cn } from '../lib/utils';

interface ContentCardProps {
  content: ContentRecord;
  onClick?: () => void;
  className?: string;
}

/**
 * ContentCard displays a content record with metadata badges
 */
export function ContentCard({ content, onClick, className }: ContentCardProps) {
  const formattedDate = new Date(content.generatedAt).toLocaleString();
  const truncatedContent =
    content.text.length > 100 ? content.text.substring(0, 100) + '...' : content.text;

  return (
    <Card
      className={cn('cursor-pointer hover:shadow-lg transition-shadow duration-200', className)}
      onClick={onClick}
    >
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{content.generatorId || 'Unknown'}</span>
          <div className="flex gap-2">
            <Badge variant={content.type === 'major' ? 'default' : 'secondary'}>
              {content.type}
            </Badge>
            <Badge variant="outline">{content.aiProvider}</Badge>
          </div>
        </CardTitle>
        <CardDescription>{formattedDate}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
          {truncatedContent}
        </p>
        <div className="mt-4 flex gap-2 flex-wrap">
          {content.aiModel && (
            <Badge variant="outline" className="text-xs">
              Model: {content.aiModel}
            </Badge>
          )}
          {content.tokensUsed && (
            <Badge variant="outline" className="text-xs">
              Tokens: {content.tokensUsed}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
