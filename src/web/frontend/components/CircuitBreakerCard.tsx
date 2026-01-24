/**
 * CircuitBreakerCard Component
 *
 * Displays a single circuit breaker with its state and control toggle.
 * Supports both manual circuits (simple on/off) and provider circuits
 * (with failure tracking).
 */

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

/**
 * Circuit data structure
 */
export interface Circuit {
  id: string;
  name: string;
  description?: string;
  type: 'manual' | 'provider';
  state: 'on' | 'off' | 'half_open';
  failureCount?: number;
  failureThreshold?: number;
}

/**
 * Props for the CircuitBreakerCard component
 */
export interface CircuitBreakerCardProps {
  /** Circuit data to display */
  circuit: Circuit;
  /** Callback when toggle is changed - receives circuit id and new enable state */
  onToggle: (id: string, enable: boolean) => Promise<void>;
  /** Optional callback for resetting a circuit */
  onReset?: (id: string) => Promise<void>;
  /** Whether the card is in a loading state */
  isLoading?: boolean;
}

/**
 * Returns the appropriate badge classes based on circuit state
 */
function getStateBadgeClasses(state: Circuit['state']): string {
  switch (state) {
    case 'on':
      return 'bg-green-500 text-white hover:bg-green-500';
    case 'off':
      return 'bg-red-500 text-white hover:bg-red-500';
    case 'half_open':
      return 'bg-yellow-500 text-white hover:bg-yellow-500';
    default:
      return '';
  }
}

/**
 * CircuitBreakerCard displays a circuit breaker with state badge and toggle control
 */
export function CircuitBreakerCard({
  circuit,
  onToggle,
  onReset,
  isLoading = false,
}: CircuitBreakerCardProps) {
  const isOn = circuit.state === 'on';
  const isProviderCircuit = circuit.type === 'provider';
  const showFailureCount =
    isProviderCircuit &&
    circuit.failureCount !== undefined &&
    circuit.failureThreshold !== undefined;

  const handleToggle = async (checked: boolean) => {
    if (isLoading) return;
    try {
      await onToggle(circuit.id, checked);
    } catch {
      // Error handling is managed by parent component
      // Component remains functional after error
    }
  };

  const handleReset = async () => {
    if (isLoading || !onReset) return;
    try {
      await onReset(circuit.id);
    } catch {
      // Error handling is managed by parent component
    }
  };

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg" role="heading" aria-level={3}>
            {circuit.name}
          </CardTitle>
          <Badge className={cn('capitalize', getStateBadgeClasses(circuit.state))}>
            {circuit.state}
          </Badge>
        </div>
        {circuit.description && <CardDescription>{circuit.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            {showFailureCount && (
              <div className="text-sm text-muted-foreground">
                <span>Failures: </span>
                <span className="font-mono">
                  {circuit.failureCount} / {circuit.failureThreshold}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onReset && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isLoading}
                aria-label="Reset circuit"
              >
                Reset
              </Button>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="sr-only">{circuit.name}</span>
              <Switch
                checked={isOn}
                onCheckedChange={handleToggle}
                disabled={isLoading}
                aria-label={`Toggle ${circuit.name}`}
              />
            </label>
          </div>
        </div>
        {isLoading && (
          <div
            data-testid="loading-indicator"
            className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-xl"
          >
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
