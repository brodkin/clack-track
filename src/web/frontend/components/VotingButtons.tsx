/**
 * VotingButtons Component
 *
 * Touch-friendly voting interface for content rating (good/bad)
 * Includes visual animations, confetti celebration, and haptic feedback.
 * Buttons are icon-only with aria-labels for accessibility.
 *
 * - Thumbs up: floats upward with confetti + success haptic
 * - Thumbs down: sinks downward with medium haptic
 * - Animations reset via onAnimationEnd for re-voting
 */

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { Confetti } from './Confetti';
import { triggerHaptic, triggerSuccessHaptic } from '../lib/animations';

interface VotingButtonsProps {
  onVote: (vote: 'good' | 'bad') => void;
  isLoading?: boolean;
  className?: string;
}

type VotedState = 'none' | 'good' | 'bad';

/**
 * VotingButtons provides large, touch-friendly icon-only buttons for content voting
 * with animated visual feedback, confetti celebration, and haptic feedback.
 * All visual feedback is self-contained -- consuming pages need only wire up onVote and isLoading.
 */
export function VotingButtons({ onVote, isLoading = false, className }: VotingButtonsProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [voted, setVoted] = useState<VotedState>('none');

  /**
   * Handle vote with appropriate feedback animation
   */
  const handleVote = (vote: 'good' | 'bad') => {
    if (vote === 'good') {
      setShowConfetti(true);
      triggerSuccessHaptic();
    } else {
      triggerHaptic('medium');
    }
    setVoted(vote);
    onVote(vote);
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
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      <Button
        onClick={() => handleVote('good')}
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

      <Button
        onClick={() => handleVote('bad')}
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
    </div>
  );
}
