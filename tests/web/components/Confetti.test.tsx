/**
 * Confetti Component Tests
 *
 * Testing canvas-based confetti animation overlay for celebration effects.
 * Uses mocked canvas context since jsdom doesn't support canvas natively.
 */

/// <reference types="@testing-library/jest-dom" />
import { render, cleanup, act } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Confetti } from '@/web/frontend/components/Confetti';

// Mock canvas context
const mockCtx = {
  clearRect: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  rotate: jest.fn(),
  fill: jest.fn(),
  beginPath: jest.fn(),
  roundRect: jest.fn(),
  globalAlpha: 1,
  fillStyle: '',
};

// Track requestAnimationFrame calls
let rafIdCounter = 0;

const mockRAF = jest.fn(() => {
  rafIdCounter++;
  return rafIdCounter;
});

const mockCAF = jest.fn();

describe('Confetti Component', () => {
  let originalRAF: typeof requestAnimationFrame;
  let originalCAF: typeof cancelAnimationFrame;
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    jest.useFakeTimers();

    // Store originals
    originalRAF = global.requestAnimationFrame;
    originalCAF = global.cancelAnimationFrame;
    originalGetContext = HTMLCanvasElement.prototype.getContext;

    // Mock RAF/CAF
    global.requestAnimationFrame = mockRAF as unknown as typeof requestAnimationFrame;
    global.cancelAnimationFrame = mockCAF as unknown as typeof cancelAnimationFrame;

    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = jest.fn(
      () => mockCtx
    ) as typeof HTMLCanvasElement.prototype.getContext;

    // Reset mocks
    mockRAF.mockClear();
    mockCAF.mockClear();
    rafIdCounter = 0;
    Object.values(mockCtx).forEach(fn => {
      if (typeof fn === 'function') {
        (fn as jest.Mock).mockClear();
      }
    });

    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 768,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    global.requestAnimationFrame = originalRAF;
    global.cancelAnimationFrame = originalCAF;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    cleanup();
  });

  describe('Canvas Rendering', () => {
    it('should render a canvas element when active', () => {
      render(<Confetti active={true} />);

      const canvas = document.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });

    it('should not render canvas when not active', () => {
      render(<Confetti active={false} />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeNull();
    });

    it('should set canvas to full viewport size', () => {
      render(<Confetti active={true} />);

      const canvas = document.querySelector('canvas');
      expect(canvas).not.toBeNull();
      expect(canvas?.width).toBe(1024);
      expect(canvas?.height).toBe(768);
    });
  });

  describe('Accessibility', () => {
    it('should have aria-hidden="true" for screen readers', () => {
      render(<Confetti active={true} />);

      const canvas = document.querySelector('canvas');
      expect(canvas).not.toBeNull();
      expect(canvas?.getAttribute('aria-hidden')).toBe('true');
    });

    it('should have pointer-events-none to allow click-through', () => {
      render(<Confetti active={true} />);

      const canvas = document.querySelector('canvas');
      expect(canvas).not.toBeNull();
      expect(canvas?.style.pointerEvents).toBe('none');
    });
  });

  describe('Full-Screen Overlay', () => {
    it('should position canvas as fixed overlay', () => {
      render(<Confetti active={true} />);

      const canvas = document.querySelector('canvas');
      expect(canvas).not.toBeNull();
      expect(canvas?.style.position).toBe('fixed');
      expect(canvas?.style.top).toBe('0px');
      expect(canvas?.style.left).toBe('0px');
    });

    it('should have high z-index to appear above other content', () => {
      render(<Confetti active={true} />);

      const canvas = document.querySelector('canvas');
      expect(canvas).not.toBeNull();
      const zIndex = parseInt(canvas?.style.zIndex || '0', 10);
      expect(zIndex).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Animation Lifecycle', () => {
    it('should start animation when active becomes true', () => {
      render(<Confetti active={true} />);

      // Animation should start (requestAnimationFrame called by createConfettiAnimation)
      expect(mockRAF).toHaveBeenCalled();
    });

    it('should call onComplete callback after animation finishes', async () => {
      const onComplete = jest.fn();

      render(<Confetti active={true} onComplete={onComplete} />);

      // Verify animation started
      expect(document.querySelector('canvas')).not.toBeNull();
      expect(onComplete).not.toHaveBeenCalled();

      // Fast-forward past animation duration (~2500ms)
      await act(async () => {
        jest.advanceTimersByTime(2600);
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('should allow parent to remove canvas via onComplete callback', async () => {
      // Simulate how the component should be used:
      // Parent controls active state and sets it to false in onComplete
      const React = await import('react');

      function TestWrapper() {
        const [active, setActiveState] = React.useState(true);
        return <Confetti active={active} onComplete={() => setActiveState(false)} />;
      }

      await act(async () => {
        render(<TestWrapper />);
      });

      // Canvas should be present initially
      expect(document.querySelector('canvas')).not.toBeNull();

      // Fast-forward past animation duration
      // onComplete fires and sets active=false
      await act(async () => {
        jest.advanceTimersByTime(2600);
      });

      // Canvas should be removed because active became false
      expect(document.querySelector('canvas')).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should cancel animation frame on unmount', () => {
      const { unmount } = render(<Confetti active={true} />);

      // Animation started
      expect(mockRAF).toHaveBeenCalled();

      // Unmount component
      unmount();

      // Should have called cancelAnimationFrame (from createConfettiAnimation cleanup)
      expect(mockCAF).toHaveBeenCalled();
    });

    it('should cancel animation when active becomes false', async () => {
      const { rerender } = render(<Confetti active={true} />);

      expect(mockRAF).toHaveBeenCalled();
      expect(document.querySelector('canvas')).not.toBeNull();

      // Set active to false
      await act(async () => {
        rerender(<Confetti active={false} />);
      });

      // Should have cancelled animation
      expect(mockCAF).toHaveBeenCalled();

      // Canvas should be removed
      expect(document.querySelector('canvas')).toBeNull();
    });
  });

  describe('Window Resize', () => {
    it('should resize canvas when window is resized', async () => {
      render(<Confetti active={true} />);

      const canvas = document.querySelector('canvas');
      expect(canvas?.width).toBe(1024);
      expect(canvas?.height).toBe(768);

      // Simulate window resize
      Object.defineProperty(window, 'innerWidth', {
        value: 1280,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 800,
        writable: true,
        configurable: true,
      });

      await act(async () => {
        window.dispatchEvent(new Event('resize'));
      });

      // Canvas should update to new size
      expect(canvas?.width).toBe(1280);
      expect(canvas?.height).toBe(800);
    });

    it('should clean up resize listener on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = render(<Confetti active={true} />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Re-activation', () => {
    it('should start new animation when active changes from false to true', async () => {
      const { rerender } = render(<Confetti active={false} />);

      expect(document.querySelector('canvas')).toBeNull();

      await act(async () => {
        rerender(<Confetti active={true} />);
      });

      expect(document.querySelector('canvas')).not.toBeNull();
      expect(mockRAF).toHaveBeenCalled();
    });
  });

  describe('Animation Configuration', () => {
    it('should use createConfettiAnimation with canvas element', () => {
      render(<Confetti active={true} />);

      // Verify getContext was called (animation setup)
      expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d');
    });
  });

  describe('Double-fire Protection', () => {
    it('should not call onComplete multiple times when timers overlap', async () => {
      const onComplete = jest.fn();

      render(<Confetti active={true} onComplete={onComplete} />);

      // Advance time past duration
      await act(async () => {
        jest.advanceTimersByTime(2600);
      });

      // Advance more time to ensure no double-firing
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });
});
