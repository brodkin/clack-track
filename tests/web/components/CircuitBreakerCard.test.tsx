/**
 * CircuitBreakerCard Component Tests (TDD - RED Phase)
 *
 * Testing circuit breaker card display with state badges and toggle controls
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CircuitBreakerCard } from '@/web/frontend/components/CircuitBreakerCard';

describe('CircuitBreakerCard Component', () => {
  // Mock callbacks
  const mockOnToggle = jest.fn<(id: string, enable: boolean) => Promise<void>>();
  const mockOnReset = jest.fn<(id: string) => Promise<void>>();

  // Test fixtures for different circuit types
  const manualCircuit = {
    id: 'SLEEP_MODE',
    name: 'Sleep Mode',
    description: 'Blocks all updates during sleep',
    type: 'manual' as const,
    state: 'on' as const,
  };

  const providerCircuitOn = {
    id: 'openai',
    name: 'OpenAI Provider',
    description: 'OpenAI API circuit breaker',
    type: 'provider' as const,
    state: 'on' as const,
    failureCount: 0,
    failureThreshold: 3,
  };

  const providerCircuitOff = {
    id: 'anthropic',
    name: 'Anthropic Provider',
    description: 'Anthropic API circuit breaker',
    type: 'provider' as const,
    state: 'off' as const,
    failureCount: 3,
    failureThreshold: 3,
  };

  const providerCircuitHalfOpen = {
    id: 'weather-api',
    name: 'Weather API',
    description: 'Weather data provider',
    type: 'provider' as const,
    state: 'half_open' as const,
    failureCount: 2,
    failureThreshold: 3,
  };

  beforeEach(() => {
    mockOnToggle.mockClear();
    mockOnReset.mockClear();
    mockOnToggle.mockResolvedValue(undefined);
    mockOnReset.mockResolvedValue(undefined);
  });

  describe('Basic Rendering', () => {
    it('should render circuit name', () => {
      render(<CircuitBreakerCard circuit={manualCircuit} onToggle={mockOnToggle} />);

      // Query by heading role to avoid matching sr-only label
      expect(screen.getByRole('heading', { name: 'Sleep Mode' })).toBeInTheDocument();
    });

    it('should render circuit description when provided', () => {
      render(<CircuitBreakerCard circuit={manualCircuit} onToggle={mockOnToggle} />);

      expect(screen.getByText('Blocks all updates during sleep')).toBeInTheDocument();
    });

    it('should render without description when not provided', () => {
      const circuitWithoutDescription = {
        id: 'TEST',
        name: 'Test Circuit',
        type: 'manual' as const,
        state: 'on' as const,
      };

      render(<CircuitBreakerCard circuit={circuitWithoutDescription} onToggle={mockOnToggle} />);

      // Query by heading role to avoid matching sr-only label
      expect(screen.getByRole('heading', { name: 'Test Circuit' })).toBeInTheDocument();
    });

    it('should render a toggle switch', () => {
      render(<CircuitBreakerCard circuit={manualCircuit} onToggle={mockOnToggle} />);

      const switchElement = screen.getByRole('switch');

      expect(switchElement).toBeInTheDocument();
    });
  });

  describe('State Badge Display', () => {
    it('should display green badge for "on" state', () => {
      render(<CircuitBreakerCard circuit={manualCircuit} onToggle={mockOnToggle} />);

      const badge = screen.getByText('on');

      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-green-500');
    });

    it('should display red badge for "off" state', () => {
      const offCircuit = { ...manualCircuit, state: 'off' as const };
      render(<CircuitBreakerCard circuit={offCircuit} onToggle={mockOnToggle} />);

      const badge = screen.getByText('off');

      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-red-500');
    });

    it('should display yellow badge for "half_open" state', () => {
      render(<CircuitBreakerCard circuit={providerCircuitHalfOpen} onToggle={mockOnToggle} />);

      const badge = screen.getByText('half_open');

      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-yellow-500');
    });
  });

  describe('Manual Circuit Display', () => {
    it('should not show failure count for manual circuits', () => {
      render(<CircuitBreakerCard circuit={manualCircuit} onToggle={mockOnToggle} />);

      expect(screen.queryByText(/failures/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+\s*\/\s*\d+/)).not.toBeInTheDocument();
    });

    it('should render switch in checked state when circuit is on', () => {
      render(<CircuitBreakerCard circuit={manualCircuit} onToggle={mockOnToggle} />);

      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('should render switch in unchecked state when circuit is off', () => {
      const offCircuit = { ...manualCircuit, state: 'off' as const };
      render(<CircuitBreakerCard circuit={offCircuit} onToggle={mockOnToggle} />);

      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('Provider Circuit Display', () => {
    it('should show failure count / threshold for provider circuits', () => {
      render(<CircuitBreakerCard circuit={providerCircuitOn} onToggle={mockOnToggle} />);

      // Should display "0 / 3" format
      expect(screen.getByText(/0\s*\/\s*3/)).toBeInTheDocument();
    });

    it('should show failure count at threshold when off', () => {
      render(<CircuitBreakerCard circuit={providerCircuitOff} onToggle={mockOnToggle} />);

      // Should display "3 / 3" format
      expect(screen.getByText(/3\s*\/\s*3/)).toBeInTheDocument();
    });

    it('should show partial failure count when half_open', () => {
      render(<CircuitBreakerCard circuit={providerCircuitHalfOpen} onToggle={mockOnToggle} />);

      // Should display "2 / 3" format
      expect(screen.getByText(/2\s*\/\s*3/)).toBeInTheDocument();
    });

    it('should label the failure count appropriately', () => {
      render(<CircuitBreakerCard circuit={providerCircuitOn} onToggle={mockOnToggle} />);

      expect(screen.getByText(/failures/i)).toBeInTheDocument();
    });
  });

  describe('Toggle Interactions', () => {
    it('should call onToggle with circuit id and false when switching off', async () => {
      render(<CircuitBreakerCard circuit={manualCircuit} onToggle={mockOnToggle} />);

      const switchElement = screen.getByRole('switch');
      fireEvent.click(switchElement);

      await waitFor(() => {
        expect(mockOnToggle).toHaveBeenCalledTimes(1);
        expect(mockOnToggle).toHaveBeenCalledWith('SLEEP_MODE', false);
      });
    });

    it('should call onToggle with circuit id and true when switching on', async () => {
      const offCircuit = { ...manualCircuit, state: 'off' as const };
      render(<CircuitBreakerCard circuit={offCircuit} onToggle={mockOnToggle} />);

      const switchElement = screen.getByRole('switch');
      fireEvent.click(switchElement);

      await waitFor(() => {
        expect(mockOnToggle).toHaveBeenCalledTimes(1);
        expect(mockOnToggle).toHaveBeenCalledWith('SLEEP_MODE', true);
      });
    });

    it('should call onToggle for provider circuits', async () => {
      render(<CircuitBreakerCard circuit={providerCircuitOn} onToggle={mockOnToggle} />);

      const switchElement = screen.getByRole('switch');
      fireEvent.click(switchElement);

      await waitFor(() => {
        expect(mockOnToggle).toHaveBeenCalledWith('openai', false);
      });
    });
  });

  describe('Reset Functionality', () => {
    it('should render reset button when onReset is provided', () => {
      render(
        <CircuitBreakerCard
          circuit={providerCircuitOff}
          onToggle={mockOnToggle}
          onReset={mockOnReset}
        />
      );

      const resetButton = screen.getByRole('button', { name: /reset/i });

      expect(resetButton).toBeInTheDocument();
    });

    it('should not render reset button when onReset is not provided', () => {
      render(<CircuitBreakerCard circuit={providerCircuitOff} onToggle={mockOnToggle} />);

      const resetButton = screen.queryByRole('button', { name: /reset/i });

      expect(resetButton).not.toBeInTheDocument();
    });

    it('should call onReset with circuit id when reset button is clicked', async () => {
      render(
        <CircuitBreakerCard
          circuit={providerCircuitOff}
          onToggle={mockOnToggle}
          onReset={mockOnReset}
        />
      );

      const resetButton = screen.getByRole('button', { name: /reset/i });
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(mockOnReset).toHaveBeenCalledTimes(1);
        expect(mockOnReset).toHaveBeenCalledWith('anthropic');
      });
    });
  });

  describe('Loading State', () => {
    it('should disable switch when isLoading is true', () => {
      render(
        <CircuitBreakerCard circuit={manualCircuit} onToggle={mockOnToggle} isLoading={true} />
      );

      const switchElement = screen.getByRole('switch');

      expect(switchElement).toBeDisabled();
    });

    it('should not call onToggle when loading', () => {
      render(
        <CircuitBreakerCard circuit={manualCircuit} onToggle={mockOnToggle} isLoading={true} />
      );

      const switchElement = screen.getByRole('switch');
      fireEvent.click(switchElement);

      expect(mockOnToggle).not.toHaveBeenCalled();
    });

    it('should disable reset button when isLoading is true', () => {
      render(
        <CircuitBreakerCard
          circuit={providerCircuitOff}
          onToggle={mockOnToggle}
          onReset={mockOnReset}
          isLoading={true}
        />
      );

      const resetButton = screen.getByRole('button', { name: /reset/i });

      expect(resetButton).toBeDisabled();
    });

    it('should show loading indicator when isLoading is true', () => {
      render(
        <CircuitBreakerCard circuit={manualCircuit} onToggle={mockOnToggle} isLoading={true} />
      );

      // Should have some visual indication of loading
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle toggle errors gracefully', async () => {
      mockOnToggle.mockRejectedValue(new Error('API error'));

      render(<CircuitBreakerCard circuit={manualCircuit} onToggle={mockOnToggle} />);

      const switchElement = screen.getByRole('switch');
      fireEvent.click(switchElement);

      await waitFor(() => {
        expect(mockOnToggle).toHaveBeenCalled();
      });

      // Component should not crash - use heading query to avoid matching sr-only label
      expect(screen.getByRole('heading', { name: 'Sleep Mode' })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible switch with proper label', () => {
      render(<CircuitBreakerCard circuit={manualCircuit} onToggle={mockOnToggle} />);

      // Switch should be labelled by circuit name or have aria-label
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAccessibleName(/sleep mode/i);
    });

    it('should have proper heading structure for circuit name', () => {
      render(<CircuitBreakerCard circuit={manualCircuit} onToggle={mockOnToggle} />);

      // Should use appropriate heading or title element
      const heading = screen.getByRole('heading', { name: 'Sleep Mode' });

      expect(heading).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should be contained within a Card component', () => {
      const { container } = render(
        <CircuitBreakerCard circuit={manualCircuit} onToggle={mockOnToggle} />
      );

      const card = container.querySelector('.rounded-xl');

      expect(card).toBeInTheDocument();
    });

    it('should have consistent spacing between elements', () => {
      render(<CircuitBreakerCard circuit={providerCircuitOn} onToggle={mockOnToggle} />);

      // Verify all key elements are rendered - use heading query to avoid matching sr-only label
      expect(screen.getByRole('heading', { name: 'OpenAI Provider' })).toBeInTheDocument();
      expect(screen.getByText('on')).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });
  });
});
