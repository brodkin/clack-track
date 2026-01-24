/**
 * VotingButtons Component
 *
 * Touch-friendly voting interface for content rating (good/bad)
 * Includes confetti celebration and haptic feedback for enhanced UX
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

/**
 * VotingButtons provides large, touch-friendly buttons for content voting
 * with celebratory confetti and haptic feedback
 */
export function VotingButtons({ onVote, isLoading = false, className }: VotingButtonsProps) {
  const [showConfetti, setShowConfetti] = useState(false);

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
    onVote(vote);
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
        <ThumbsUp className="mr-2 h-5 w-5" />
        Good
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
        <ThumbsDown className="mr-2 h-5 w-5" />
        Bad
      </Button>
    </div>
  );
}
