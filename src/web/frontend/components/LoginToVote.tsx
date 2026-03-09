/**
 * LoginToVote Component
 *
 * Displays a login prompt linking to /login for unauthenticated users
 * who want to vote on content quality. Replaces VotingButtons when
 * the user is not authenticated.
 */

import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface LoginToVoteProps {
  className?: string;
}

export function LoginToVote({ className }: LoginToVoteProps) {
  return (
    <div className={cn('flex justify-center', className)}>
      <Button asChild variant="outline" size="lg">
        <Link to="/login">
          <LogIn className="mr-2 h-4 w-4" />
          Log in to vote
        </Link>
      </Button>
    </div>
  );
}
