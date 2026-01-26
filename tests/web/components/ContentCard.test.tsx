/**
 * ContentCard Component Tests
 *
 * Tests for the ContentCard component which displays content records
 * with metadata badges and optional MoreInfoButton.
 */

import { render, screen } from '@testing-library/react';
import { ContentCard } from '../../../src/web/frontend/components/ContentCard';
import type { ContentRecord } from '../../../src/storage/models/content';
import '@testing-library/jest-dom';

describe('ContentCard', () => {
  const baseContent: ContentRecord = {
    id: 1,
    text: 'Test content for Vestaboard display',
    type: 'major',
    generatedAt: new Date('2025-01-26T10:00:00Z'),
    sentAt: new Date('2025-01-26T10:01:00Z'),
    aiProvider: 'openai',
    generatorId: 'test-generator',
    aiModel: 'gpt-4o',
    tokensUsed: 150,
    metadata: {},
  };

  describe('Basic Rendering', () => {
    it('renders content card with all basic metadata', () => {
      render(<ContentCard content={baseContent} />);

      expect(screen.getByText('test-generator')).toBeInTheDocument();
      expect(screen.getByText('major')).toBeInTheDocument();
      expect(screen.getByText('openai')).toBeInTheDocument();
      expect(screen.getByText(/Test content for Vestaboard/)).toBeInTheDocument();
      expect(screen.getByText('Model: gpt-4o')).toBeInTheDocument();
      expect(screen.getByText('Tokens: 150')).toBeInTheDocument();
    });

    it('truncates long content text with ellipsis', () => {
      const longContent: ContentRecord = {
        ...baseContent,
        text: 'A'.repeat(150),
      };

      render(<ContentCard content={longContent} />);

      const truncatedText = screen.getByText(/A{100}\.\.\./);
      expect(truncatedText).toBeInTheDocument();
      expect(truncatedText.textContent?.length).toBe(103); // 100 chars + '...'
    });

    it('applies onClick handler when provided', () => {
      const handleClick = jest.fn();
      const { container } = render(<ContentCard content={baseContent} onClick={handleClick} />);

      // Click the card itself (has cursor-pointer class)
      const card = container.querySelector('[class*="cursor-pointer"]');
      expect(card).toBeInTheDocument();
      card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('applies custom className when provided', () => {
      const { container } = render(<ContentCard content={baseContent} className="custom-class" />);

      const card = container.querySelector('.custom-class');
      expect(card).toBeInTheDocument();
    });
  });

  describe('MoreInfoButton Integration', () => {
    it('renders MoreInfoButton when moreInfoUrl is present in metadata', () => {
      const contentWithUrl: ContentRecord = {
        ...baseContent,
        metadata: {
          moreInfoUrl: 'https://example.com/article',
        },
      };

      render(<ContentCard content={contentWithUrl} />);

      const moreInfoButton = screen.getByRole('link', { name: /more info/i });
      expect(moreInfoButton).toBeInTheDocument();
      expect(moreInfoButton).toHaveAttribute('href', 'https://example.com/article');
    });

    it('does not render MoreInfoButton when moreInfoUrl is missing', () => {
      render(<ContentCard content={baseContent} />);

      const moreInfoButton = screen.queryByRole('link', { name: /more info/i });
      expect(moreInfoButton).not.toBeInTheDocument();
    });

    it('does not render MoreInfoButton when moreInfoUrl is null', () => {
      const contentWithNullUrl: ContentRecord = {
        ...baseContent,
        metadata: {
          moreInfoUrl: null,
        },
      };

      render(<ContentCard content={contentWithNullUrl} />);

      const moreInfoButton = screen.queryByRole('link', { name: /more info/i });
      expect(moreInfoButton).not.toBeInTheDocument();
    });

    it('does not render MoreInfoButton when moreInfoUrl is undefined', () => {
      const contentWithUndefinedUrl: ContentRecord = {
        ...baseContent,
        metadata: {
          moreInfoUrl: undefined,
        },
      };

      render(<ContentCard content={contentWithUndefinedUrl} />);

      const moreInfoButton = screen.queryByRole('link', { name: /more info/i });
      expect(moreInfoButton).not.toBeInTheDocument();
    });

    it('does not render MoreInfoButton when metadata is undefined', () => {
      const contentWithNoMetadata: ContentRecord = {
        ...baseContent,
        metadata: undefined,
      };

      render(<ContentCard content={contentWithNoMetadata} />);

      const moreInfoButton = screen.queryByRole('link', { name: /more info/i });
      expect(moreInfoButton).not.toBeInTheDocument();
    });

    it('uses small button size variant', () => {
      const contentWithUrl: ContentRecord = {
        ...baseContent,
        metadata: {
          moreInfoUrl: 'https://example.com/article',
        },
      };

      render(<ContentCard content={contentWithUrl} />);

      const moreInfoButton = screen.getByRole('link', { name: /more info/i });
      // Check for size="sm" through class name (shadcn/ui Button applies size classes)
      expect(moreInfoButton.className).toMatch(/h-8|text-xs|py-1/); // Small button indicators
    });
  });

  describe('Edge Cases', () => {
    it('handles missing optional fields gracefully', () => {
      const minimalContent: ContentRecord = {
        id: 2,
        text: 'Minimal content',
        type: 'minor',
        generatedAt: new Date('2025-01-26T10:00:00Z'),
        sentAt: null,
        aiProvider: 'anthropic',
      };

      render(<ContentCard content={minimalContent} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument(); // generatorId fallback
      expect(screen.getByText('minor')).toBeInTheDocument();
      expect(screen.getByText('anthropic')).toBeInTheDocument();
    });

    it('formats date correctly', () => {
      render(<ContentCard content={baseContent} />);

      // Date should be formatted as locale string
      const dateText = screen.getByText(/1\/26\/2025/); // Partial match for date
      expect(dateText).toBeInTheDocument();
    });
  });
});
