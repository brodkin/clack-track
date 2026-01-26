/**
 * MoreInfoButton Component
 *
 * Reusable button for external links with "More Info" text and icon.
 * Conditionally renders only when url is provided (non-empty string).
 */

import { ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/web/frontend/lib/utils.js';

interface MoreInfoButtonProps {
  /** URL to link to. If null/undefined/empty, button is not rendered */
  url: string | null | undefined;
  /** Size variant of the button. Defaults to 'default' (medium) */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Additional CSS classes to apply to the button */
  className?: string;
}

/**
 * MoreInfoButton - External link button with icon
 *
 * Features:
 * - Opens in new tab with security attributes
 * - Accessible with descriptive aria-label
 * - Only renders when url is provided
 * - Supports size variants (default, sm, lg)
 *
 * @example
 * ```tsx
 * // Renders button linking to external article
 * <MoreInfoButton url="https://example.com/article" />
 *
 * // Small variant
 * <MoreInfoButton url="https://example.com/article" size="sm" />
 *
 * // With custom className for flex alignment
 * <MoreInfoButton url="https://example.com/article" className="ml-auto" />
 *
 * // Does not render when url is missing
 * <MoreInfoButton url={null} />
 * ```
 */
export function MoreInfoButton({ url, size = 'default', className }: MoreInfoButtonProps) {
  // Don't render if url is missing or empty
  if (!url || url.trim() === '') {
    return null;
  }

  return (
    <Button
      variant="outline"
      size={size}
      asChild
      className={cn('gap-2', className)}
      aria-label="More Info (opens in new tab)"
    >
      <a href={url} target="_blank" rel="noopener noreferrer">
        More Info
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    </Button>
  );
}
