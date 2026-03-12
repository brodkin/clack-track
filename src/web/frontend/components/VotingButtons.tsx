/**
 * VotingButtons Component
 *
 * Touch-friendly voting interface for content rating (good/bad)
 * Includes visual animations, confetti celebration, and haptic feedback.
 * Buttons are icon-only with aria-labels for accessibility.
 *
 * - Thumbs up: floats upward with confetti + success haptic (immediate)
 * - Thumbs down: opens reason popover, then sinks downward with medium haptic
 * - Animations reset via onAnimationEnd for re-voting
 */

import { useState, useRef } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { Confetti } from './Confetti';
import { DownvoteReasonMenu } from './DownvoteReasonMenu';
import { triggerHaptic, triggerSuccessHaptic } from '../lib/animations';

interface VotingButtonsProps {
  onVote: (vote: 'good' | 'bad', reason?: string) => void;
  isLoading?: boolean;
  className?: string;
}

type VotedState = 'none' | 'good' | 'bad';

/**
 * VotingButtons provides large, touch-friendly icon-only buttons for content voting
 * with animated visual feedback, confetti celebration, and haptic feedback.
 *
 * Thumbs-up triggers an immediate vote. Thumbs-down opens a reason picker popover;
 * the vote is recorded only after a reason is selected.
 */
export function VotingButtons({ onVote, isLoading = false, className }: VotingButtonsProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [voted, setVoted] = useState<VotedState>('none');
  const [reasonMenuOpen, setReasonMenuOpen] = useState(false);
  const thumbsUpRef = useRef<HTMLButtonElement>(null);

  /**
   * Handle thumbs-up vote with immediate feedback
   */
  const handleThumbsUp = () => {
    setShowConfetti(true);
    triggerSuccessHaptic();
    setVoted('good');
    onVote('good');
  };

  /**
   * Handle thumbs-down click: open the reason popover
   */
  const handleThumbsDownClick = () => {
    setReasonMenuOpen(true);
  };

  /**
   * Handle reason selection from the popover
   */
  const handleReasonSelect = (reasonKey: string) => {
    triggerHaptic('medium');
    setVoted('bad');
    setReasonMenuOpen(false);
    onVote('bad', reasonKey);
    toast('Thanks for the feedback');
  };

  /**
   * Reset animation state when CSS animation completes,
   * allowing the button to be re-voted.
   */
  const handleAnimationEnd = () => {
    setVoted('none');
  };

  return (
    <div className={cn('flex gap-4 justify-center', className)}>
      <Confetti
        active={showConfetti}
        onComplete={() => setShowConfetti(false)}
        originRef={thumbsUpRef}
      />
      <Button
        ref={thumbsUpRef}
        onClick={handleThumbsUp}
        disabled={isLoading}
        size="lg"
        variant="outline"
        className={cn(
          'h-14 px-8',
          'text-green-600 hover:text-green-700',
          'hover:bg-green-50 hover:border-green-600',
          'focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2',
          'transition-all duration-200',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        aria-label="Thumbs up - Good content"
      >
        <span
          className={cn(voted === 'good' && 'animate-vote-float-up')}
          onAnimationEnd={handleAnimationEnd}
        >
          <ThumbsUp className="h-5 w-5" />
        </span>
      </Button>

      <DownvoteReasonMenu
        open={reasonMenuOpen}
        onOpenChange={setReasonMenuOpen}
        onSelect={handleReasonSelect}
      >
        <Button
          onClick={handleThumbsDownClick}
          disabled={isLoading}
          size="lg"
          variant="outline"
          className={cn(
            'h-14 px-8',
            'text-red-600 hover:text-red-700',
            'hover:bg-red-50 hover:border-red-600',
            'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
            'transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label="Thumbs down - Bad content"
        >
          <span
            className={cn(voted === 'bad' && 'animate-vote-sink-down')}
            onAnimationEnd={handleAnimationEnd}
          >
            <ThumbsDown className="h-5 w-5" />
          </span>
        </Button>
      </DownvoteReasonMenu>
    </div>
  );
}
