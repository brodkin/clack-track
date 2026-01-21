/**
 * SLEEP_MODE Circuit Breaker Blocking Tests
 *
 * Tests that SLEEP_MODE circuit blocks ALL content updates (major and minor)
 * when active, similar to MASTER circuit but for quiet hours functionality.
 *
 * Coverage:
 * - ContentOrchestrator.generateAndSend() checks SLEEP_MODE at Step 0.5 (after MASTER)
 * - CronScheduler.runMinorUpdate() checks SLEEP_MODE before generating
 * - EventHandler.handleRefreshTrigger() checks SLEEP_MODE (parallel to MASTER)
 * - EventHandler.handleStateChange() checks SLEEP_MODE (parallel to MASTER)
 */

import { ContentOrchestrator } from '../../../src/content/orchestrator.js';
import { CronScheduler } from '../../../src/scheduler/cron.js';
import { EventHandler } from '../../../src/scheduler/event-handler.js';
import type { ContentSelector } from '../../../src/content/registry/content-selector.js';
import type { FrameDecorator } from '../../../src/content/frame/frame-decorator.js';
import type { StaticFallbackGenerator } from '../../../src/content/generators/static-fallback-generator.js';
import type { VestaboardClient } from '../../../src/api/vestaboard/types.js';
import type { AIProvider } from '../../../src/types/ai.js';
import type { GeneratedContent } from '../../../src/types/content-generator.js';
import type { CircuitBreakerService } from '../../../src/services/circuit-breaker-service.js';
import type { MinorUpdateGenerator } from '../../../src/content/generators/index.js';
import type { HomeAssistantClient } from '../../../src/api/data-sources/index.js';
import type { HomeAssistantEvent } from '../../../src/types/home-assistant.js';
import { TriggerMatcher } from '../../../src/scheduler/trigger-matcher.js';

describe('SLEEP_MODE Circuit Breaker Blocking', () => {
  // ============================================
  // ContentOrchestrator SLEEP_MODE Tests
  // ============================================
  describe('ContentOrchestrator.generateAndSend() SLEEP_MODE blocking', () => {
    let mockSelector: jest.Mocked<ContentSelector>;
    let mockDecorator: jest.Mocked<FrameDecorator>;
    let mockVestaboardClient: jest.Mocked<VestaboardClient>;
    let mockFallbackGenerator: jest.Mocked<StaticFallbackGenerator>;
    let mockPreferredProvider: jest.Mocked<AIProvider>;
    let mockAlternateProvider: jest.Mocked<AIProvider>;
    let mockCircuitBreaker: jest.Mocked<CircuitBreakerService>;
    let orchestrator: ContentOrchestrator;

    const mockContent: GeneratedContent = {
      text: 'Test Content',
      outputMode: 'text',
      metadata: {},
    };

    beforeEach(() => {
      mockSelector = {
        select: jest.fn().mockReturnValue({
          generator: { generate: jest.fn().mockResolvedValue(mockContent) },
          registration: { id: 'test-gen', name: 'Test Generator', priority: 2 },
        }),
      } as unknown as jest.Mocked<ContentSelector>;

      mockDecorator = {
        decorate: jest.fn().mockResolvedValue({
          layout: Array(6).fill(Array(22).fill(0)),
        }),
      } as unknown as jest.Mocked<FrameDecorator>;

      mockVestaboardClient = {
        sendLayout: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<VestaboardClient>;

      mockFallbackGenerator = {
        generate: jest.fn().mockResolvedValue(mockContent),
      } as unknown as jest.Mocked<StaticFallbackGenerator>;

      mockPreferredProvider = {
        getName: jest.fn().mockReturnValue('openai'),
      } as unknown as jest.Mocked<AIProvider>;

      mockAlternateProvider = {
        getName: jest.fn().mockReturnValue('anthropic'),
      } as unknown as jest.Mocked<AIProvider>;

      mockCircuitBreaker = {
        isCircuitOpen: jest.fn().mockResolvedValue(false),
        isProviderAvailable: jest.fn().mockResolvedValue(true),
      } as unknown as jest.Mocked<CircuitBreakerService>;

      orchestrator = new ContentOrchestrator({
        selector: mockSelector,
        decorator: mockDecorator,
        vestaboardClient: mockVestaboardClient,
        fallbackGenerator: mockFallbackGenerator,
        preferredProvider: mockPreferredProvider,
        alternateProvider: mockAlternateProvider,
        circuitBreaker: mockCircuitBreaker,
      });
    });

    it('should block generation when SLEEP_MODE circuit is open', async () => {
      // SLEEP_MODE is open (blocking), MASTER is closed (allowing)
      mockCircuitBreaker.isCircuitOpen.mockImplementation(async (circuitId: string) => {
        if (circuitId === 'MASTER') return false;
        if (circuitId === 'SLEEP_MODE') return true;
        return false;
      });

      const result = await orchestrator.generateAndSend({
        updateType: 'major',
        timestamp: new Date(),
      });

      expect(result.blocked).toBe(true);
      expect(result.blockReason).toBe('sleep_mode_active');
      expect(mockSelector.select).not.toHaveBeenCalled();
      expect(mockVestaboardClient.sendLayout).not.toHaveBeenCalled();
    });

    it('should proceed with generation when SLEEP_MODE circuit is closed', async () => {
      // Both MASTER and SLEEP_MODE are closed (allowing)
      mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);

      const result = await orchestrator.generateAndSend({
        updateType: 'major',
        timestamp: new Date(),
      });

      expect(result.blocked).toBeUndefined();
      expect(result.success).toBe(true);
      expect(mockSelector.select).toHaveBeenCalled();
    });

    it('should check MASTER before SLEEP_MODE (MASTER takes priority)', async () => {
      // MASTER is open (blocking) - should never check SLEEP_MODE
      mockCircuitBreaker.isCircuitOpen.mockImplementation(async (circuitId: string) => {
        if (circuitId === 'MASTER') return true;
        // SLEEP_MODE check should not happen
        throw new Error('Should not check SLEEP_MODE when MASTER is off');
      });

      const result = await orchestrator.generateAndSend({
        updateType: 'major',
        timestamp: new Date(),
      });

      expect(result.blocked).toBe(true);
      expect(result.blockReason).toBe('master_circuit_off');
    });

    it('should check SLEEP_MODE after MASTER passes', async () => {
      const checkOrder: string[] = [];
      mockCircuitBreaker.isCircuitOpen.mockImplementation(async (circuitId: string) => {
        checkOrder.push(circuitId);
        if (circuitId === 'MASTER') return false;
        if (circuitId === 'SLEEP_MODE') return true;
        return false;
      });

      await orchestrator.generateAndSend({
        updateType: 'major',
        timestamp: new Date(),
      });

      expect(checkOrder).toEqual(['MASTER', 'SLEEP_MODE']);
    });

    it('should include sleepMode in circuitState when blocked', async () => {
      mockCircuitBreaker.isCircuitOpen.mockImplementation(async (circuitId: string) => {
        if (circuitId === 'MASTER') return false;
        if (circuitId === 'SLEEP_MODE') return true;
        return false;
      });

      const result = await orchestrator.generateAndSend({
        updateType: 'major',
        timestamp: new Date(),
      });

      expect(result.circuitState).toEqual({
        master: true,
        sleepMode: false,
      });
    });

    it('should proceed when circuitBreaker is not provided', async () => {
      const orchestratorWithoutCircuitBreaker = new ContentOrchestrator({
        selector: mockSelector,
        decorator: mockDecorator,
        vestaboardClient: mockVestaboardClient,
        fallbackGenerator: mockFallbackGenerator,
        preferredProvider: mockPreferredProvider,
        alternateProvider: mockAlternateProvider,
      });

      const result = await orchestratorWithoutCircuitBreaker.generateAndSend({
        updateType: 'major',
        timestamp: new Date(),
      });

      expect(result.success).toBe(true);
      expect(result.blocked).toBeUndefined();
    });
  });

  // ============================================
  // CronScheduler SLEEP_MODE Tests
  // ============================================
  describe('CronScheduler.runMinorUpdate() SLEEP_MODE blocking', () => {
    let mockMinorUpdateGenerator: jest.Mocked<MinorUpdateGenerator>;
    let mockVestaboardClient: jest.Mocked<VestaboardClient>;
    let mockOrchestrator: jest.Mocked<Pick<ContentOrchestrator, 'getCachedContent'>>;
    let mockCircuitBreaker: jest.Mocked<Pick<CircuitBreakerService, 'isCircuitOpen'>>;
    let scheduler: CronScheduler;

    const mockContent: GeneratedContent = {
      text: 'Test Content',
      outputMode: 'layout',
      layout: {
        rows: [],
        characterCodes: Array(6).fill(Array(22).fill(0)),
      },
      metadata: { minorUpdate: true },
    };

    beforeEach(() => {
      jest.useFakeTimers();

      mockMinorUpdateGenerator = {
        generate: jest.fn().mockResolvedValue(mockContent),
        shouldSkip: jest.fn().mockReturnValue(false),
        validate: jest.fn().mockResolvedValue({ valid: true }),
      } as unknown as jest.Mocked<MinorUpdateGenerator>;

      mockVestaboardClient = {
        sendLayout: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<VestaboardClient>;

      mockOrchestrator = {
        getCachedContent: jest.fn().mockReturnValue({ text: 'cached content' }),
      } as jest.Mocked<Pick<ContentOrchestrator, 'getCachedContent'>>;

      mockCircuitBreaker = {
        isCircuitOpen: jest.fn().mockResolvedValue(false),
      } as jest.Mocked<Pick<CircuitBreakerService, 'isCircuitOpen'>>;

      scheduler = new CronScheduler(
        mockMinorUpdateGenerator,
        mockVestaboardClient,
        mockOrchestrator as unknown as ContentOrchestrator,
        mockCircuitBreaker as unknown as CircuitBreakerService
      );
    });

    afterEach(() => {
      scheduler.stop();
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('should block minor update when SLEEP_MODE circuit is open', async () => {
      mockCircuitBreaker.isCircuitOpen.mockResolvedValue(true);
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      scheduler.start();

      await jest.advanceTimersByTimeAsync(5000);

      expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('SLEEP_MODE');
      expect(mockMinorUpdateGenerator.generate).not.toHaveBeenCalled();
      expect(mockVestaboardClient.sendLayout).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('SLEEP_MODE circuit is active'));

      logSpy.mockRestore();
    });

    it('should proceed with minor update when SLEEP_MODE circuit is closed', async () => {
      mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      scheduler.start();

      await jest.advanceTimersByTimeAsync(5000);

      expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('SLEEP_MODE');
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalled();
      expect(mockVestaboardClient.sendLayout).toHaveBeenCalled();
    });

    it('should check cache before checking SLEEP_MODE circuit', async () => {
      // No cache - should skip before circuit check
      mockOrchestrator.getCachedContent.mockReturnValue(null);

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      scheduler.start();

      await jest.advanceTimersByTimeAsync(5000);

      expect(mockOrchestrator.getCachedContent).toHaveBeenCalled();
      expect(mockCircuitBreaker.isCircuitOpen).not.toHaveBeenCalled();
    });

    it('should proceed (fail-open) when circuit check throws error', async () => {
      mockCircuitBreaker.isCircuitOpen.mockRejectedValue(new Error('Database error'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      scheduler.start();

      await jest.advanceTimersByTimeAsync(5000);

      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circuit check failed'),
        expect.any(Error)
      );

      warnSpy.mockRestore();
    });

    it('should continue scheduling after SLEEP_MODE block', async () => {
      // First check: blocked
      // Second check: allowed
      mockCircuitBreaker.isCircuitOpen.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      scheduler.start();

      // First execution - blocked
      await jest.advanceTimersByTimeAsync(5000);
      expect(mockMinorUpdateGenerator.generate).not.toHaveBeenCalled();

      // Second execution - allowed
      await jest.advanceTimersByTimeAsync(60000);
      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalledTimes(1);
    });

    it('should work when circuitBreaker is not provided', async () => {
      // Create scheduler without circuit breaker
      const schedulerWithoutCB = new CronScheduler(
        mockMinorUpdateGenerator,
        mockVestaboardClient,
        mockOrchestrator as unknown as ContentOrchestrator
      );

      jest.setSystemTime(new Date('2025-11-30T12:00:55.000Z'));
      schedulerWithoutCB.start();

      await jest.advanceTimersByTimeAsync(5000);

      expect(mockMinorUpdateGenerator.generate).toHaveBeenCalled();

      schedulerWithoutCB.stop();
    });
  });

  // ============================================
  // EventHandler SLEEP_MODE Tests
  // ============================================
  describe('EventHandler SLEEP_MODE blocking', () => {
    let mockHomeAssistant: jest.Mocked<HomeAssistantClient>;
    let mockOrchestrator: jest.Mocked<ContentOrchestrator>;
    let mockCircuitBreaker: jest.Mocked<{
      setCircuitState: (circuitId: string, state: 'on' | 'off' | 'half_open') => Promise<void>;
      resetProviderCircuit: (circuitId: string) => Promise<void>;
      isCircuitOpen: (circuitId: string) => Promise<boolean>;
    }>;

    beforeEach(() => {
      mockHomeAssistant = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        subscribeToEvents: jest.fn().mockResolvedValue(() => {}),
        getState: jest.fn(),
        callService: jest.fn(),
        validateConnection: jest.fn(),
      } as unknown as jest.Mocked<HomeAssistantClient>;

      mockOrchestrator = {
        generateAndSend: jest.fn().mockResolvedValue(undefined),
        getCachedContent: jest.fn().mockReturnValue(null),
        clearCache: jest.fn(),
      } as unknown as jest.Mocked<ContentOrchestrator>;

      mockCircuitBreaker = {
        setCircuitState: jest.fn().mockResolvedValue(undefined),
        resetProviderCircuit: jest.fn().mockResolvedValue(undefined),
        isCircuitOpen: jest.fn().mockResolvedValue(false),
      };
    });

    describe('handleRefreshTrigger SLEEP_MODE blocking', () => {
      let refreshCallback: (event: HomeAssistantEvent) => void;

      beforeEach(async () => {
        const handler = new EventHandler(
          mockHomeAssistant,
          mockOrchestrator,
          undefined,
          mockCircuitBreaker
        );
        await handler.initialize();

        const refreshCall = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls.find(
          call => call[0] === 'vestaboard_refresh'
        );
        refreshCallback = refreshCall[1];
      });

      it('should block generation when SLEEP_MODE circuit is open', async () => {
        mockCircuitBreaker.isCircuitOpen.mockImplementation(async (circuitId: string) => {
          if (circuitId === 'MASTER') return false;
          if (circuitId === 'SLEEP_MODE') return true;
          return false;
        });

        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_refresh',
          data: { trigger: 'manual' },
        };

        refreshCallback(event);
        // Wait for async operation to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('SLEEP_MODE');
        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('SLEEP_MODE circuit is active')
        );

        logSpy.mockRestore();
      });

      it('should proceed when both MASTER and SLEEP_MODE are closed', async () => {
        mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);

        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_refresh',
          data: { trigger: 'manual' },
        };

        refreshCallback(event);
        // Wait for async operation to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('MASTER');
        expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('SLEEP_MODE');
        expect(mockOrchestrator.generateAndSend).toHaveBeenCalled();
      });

      it('should check MASTER before SLEEP_MODE (MASTER blocks first)', async () => {
        mockCircuitBreaker.isCircuitOpen.mockImplementation(async (circuitId: string) => {
          if (circuitId === 'MASTER') return true;
          throw new Error('Should not check SLEEP_MODE when MASTER is off');
        });

        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_refresh',
          data: { trigger: 'manual' },
        };

        await refreshCallback(event);

        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
      });

      it('should proceed (fail-open) when SLEEP_MODE circuit check throws', async () => {
        mockCircuitBreaker.isCircuitOpen.mockImplementation(async (circuitId: string) => {
          if (circuitId === 'MASTER') return false;
          if (circuitId === 'SLEEP_MODE') throw new Error('Database error');
          return false;
        });

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_refresh',
          data: { trigger: 'manual' },
        };

        refreshCallback(event);
        // Wait for async operation to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockOrchestrator.generateAndSend).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
      });
    });

    describe('handleStateChange SLEEP_MODE blocking', () => {
      let stateChangedCallback: (event: HomeAssistantEvent) => void;
      let triggerMatcher: TriggerMatcher;

      beforeEach(async () => {
        triggerMatcher = new TriggerMatcher([
          { name: 'Person Arrival', entity_pattern: 'person.*', state_filter: 'home' },
        ]);

        const handler = new EventHandler(
          mockHomeAssistant,
          mockOrchestrator,
          triggerMatcher,
          mockCircuitBreaker
        );
        await handler.initialize();

        const stateChangedCall = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls.find(
          call => call[0] === 'state_changed'
        );
        stateChangedCallback = stateChangedCall[1];
      });

      it('should block generation when SLEEP_MODE circuit is open', async () => {
        mockCircuitBreaker.isCircuitOpen.mockImplementation(async (circuitId: string) => {
          if (circuitId === 'MASTER') return false;
          if (circuitId === 'SLEEP_MODE') return true;
          return false;
        });

        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            entity_id: 'person.john',
            new_state: { state: 'home' },
            old_state: { state: 'away' },
          },
        };

        stateChangedCallback(event);
        // Wait for async operation to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('SLEEP_MODE');
        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('SLEEP_MODE circuit is active')
        );

        logSpy.mockRestore();
      });

      it('should proceed when both MASTER and SLEEP_MODE are closed', async () => {
        mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);

        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            entity_id: 'person.john',
            new_state: { state: 'home' },
            old_state: { state: 'away' },
          },
        };

        stateChangedCallback(event);
        // Wait for async operation to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('MASTER');
        expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('SLEEP_MODE');
        expect(mockOrchestrator.generateAndSend).toHaveBeenCalled();
      });

      it('should check MASTER before SLEEP_MODE (MASTER blocks first)', async () => {
        mockCircuitBreaker.isCircuitOpen.mockImplementation(async (circuitId: string) => {
          if (circuitId === 'MASTER') return true;
          throw new Error('Should not check SLEEP_MODE when MASTER is off');
        });

        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            entity_id: 'person.john',
            new_state: { state: 'home' },
            old_state: { state: 'away' },
          },
        };

        await stateChangedCallback(event);

        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
      });

      it('should proceed (fail-open) when SLEEP_MODE circuit check throws', async () => {
        mockCircuitBreaker.isCircuitOpen.mockImplementation(async (circuitId: string) => {
          if (circuitId === 'MASTER') return false;
          if (circuitId === 'SLEEP_MODE') throw new Error('Database error');
          return false;
        });

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            entity_id: 'person.john',
            new_state: { state: 'home' },
            old_state: { state: 'away' },
          },
        };

        stateChangedCallback(event);
        // Wait for async operation to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockOrchestrator.generateAndSend).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
      });

      it('should NOT check circuits for non-matching events', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            entity_id: 'sensor.temperature',
            new_state: { state: '72' },
            old_state: { state: '71' },
          },
        };

        await stateChangedCallback(event);

        // Circuits should not be checked for non-matching entities
        expect(mockCircuitBreaker.isCircuitOpen).not.toHaveBeenCalled();
        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
      });
    });
  });
});
