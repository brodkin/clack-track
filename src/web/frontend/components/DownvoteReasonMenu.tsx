/**
 * DownvoteReasonMenu Component
 *
 * Popover menu that displays predefined reasons for downvoting content.
 * Wraps children as the popover trigger (typically the thumbs-down button).
 *
 * Uses Radix UI Popover for accessible, dismissable overlay behavior
 * that works on both mobile (touch) and desktop (click).
 */

import { type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

/**
 * A single downvote reason with display label and stored key
 */
interface DownvoteReason {
  label: string;
  key: string;
}

/**
 * The 9 predefined downvote reasons.
 * Keys must match the values accepted by POST /api/vote.
 */
const DOWNVOTE_REASONS: DownvoteReason[] = [
  { label: 'Not funny', key: 'not_funny' },
  { label: "Doesn't make sense", key: 'doesnt_make_sense' },
  { label: 'Factually wrong', key: 'factually_wrong' },
  { label: 'Too negative', key: 'too_negative' },
  { label: 'Boring', key: 'boring' },
  { label: 'Badly formatted', key: 'badly_formatted' },
  { label: 'Almost there', key: 'almost_there' },
  { label: 'Repeated content', key: 'repeated_content' },
  { label: 'Other', key: 'other' },
];

interface DownvoteReasonMenuProps {
  /** Whether the popover is open */
  open: boolean;
  /** Callback when open state changes (e.g., outside click to dismiss) */
  onOpenChange: (open: boolean) => void;
  /** Callback when a reason is selected */
  onSelect: (reasonKey: string) => void;
  /** The trigger element (typically a thumbs-down button) */
  children: ReactNode;
}

/**
 * DownvoteReasonMenu renders a popover with 9 reason options.
 * Each option is a touch-friendly button (min 44px height).
 * Selecting a reason calls onSelect with the reason key and closes the popover.
 */
export function DownvoteReasonMenu({
  open,
  onOpenChange,
  onSelect,
  children,
}: DownvoteReasonMenuProps) {
  const handleReasonClick = (reasonKey: string) => {
    onSelect(reasonKey);
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="center" sideOffset={8} className="w-56">
        <div className="flex flex-col gap-0.5">
          <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            What went wrong?
          </p>
          {DOWNVOTE_REASONS.map(reason => (
            <button
              key={reason.key}
              onClick={() => handleReasonClick(reason.key)}
              className="min-h-[44px] w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none transition-colors"
            >
              {reason.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
