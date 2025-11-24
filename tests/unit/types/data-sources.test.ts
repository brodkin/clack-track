import { describe, it, expect } from '@jest/globals';
import type {
  HomeAssistantConfig,
  HomeAssistantEvent,
  HomeAssistantEntityState,
  StateChangedEvent,
  UnsubscribeFunc,
  ServiceCallResponse,
  HomeAssistantConnectionError,
  HomeAssistantAuthenticationError,
  HomeAssistantTimeoutError,
} from '@/types/data-sources.js';

describe('Home Assistant Type Definitions', () => {
  describe('HomeAssistantConfig', () => {
    it('should allow valid configuration with required fields', () => {
      const config: HomeAssistantConfig = {
        url: 'http://homeassistant.local:8123',
        token: 'test-token-123',
      };

      expect(config.url).toBe('http://homeassistant.local:8123');
      expect(config.token).toBe('test-token-123');
    });

    it('should allow optional websocketUrl field', () => {
      const config: HomeAssistantConfig = {
        url: 'http://homeassistant.local:8123',
        token: 'test-token-123',
        websocketUrl: 'ws://homeassistant.local:8123/api/websocket',
      };

      expect(config.websocketUrl).toBe('ws://homeassistant.local:8123/api/websocket');
    });

    it('should allow optional reconnection settings', () => {
      const config: HomeAssistantConfig = {
        url: 'http://homeassistant.local:8123',
        token: 'test-token-123',
        reconnectDelayMs: 3000,
        maxReconnectAttempts: 5,
      };

      expect(config.reconnectDelayMs).toBe(3000);
      expect(config.maxReconnectAttempts).toBe(5);
    });
  });

  describe('HomeAssistantEvent', () => {
    it('should structure event data correctly', () => {
      const event: HomeAssistantEvent = {
        event_type: 'state_changed',
        data: { entity_id: 'light.living_room', new_state: 'on' },
        time_fired: new Date('2025-01-15T10:30:00Z'),
        origin: 'LOCAL',
      };

      expect(event.event_type).toBe('state_changed');
      expect(event.data.entity_id).toBe('light.living_room');
      expect(event.origin).toBe('LOCAL');
    });

    it('should allow optional context field', () => {
      const event: HomeAssistantEvent = {
        event_type: 'automation_triggered',
        data: { name: 'Morning Routine' },
        time_fired: new Date(),
        origin: 'LOCAL',
        context: { id: 'ctx-123', user_id: 'user-456' },
      };

      expect(event.context?.id).toBe('ctx-123');
    });
  });

  describe('StateChangedEvent', () => {
    it('should structure state change events', () => {
      const event: StateChangedEvent = {
        event_type: 'state_changed',
        data: {
          entity_id: 'sensor.temperature',
          old_state: {
            entity_id: 'sensor.temperature',
            state: '20',
            attributes: { unit: '°C' },
            last_changed: new Date('2025-01-15T10:00:00Z'),
            last_updated: new Date('2025-01-15T10:00:00Z'),
          },
          new_state: {
            entity_id: 'sensor.temperature',
            state: '22',
            attributes: { unit: '°C' },
            last_changed: new Date('2025-01-15T10:30:00Z'),
            last_updated: new Date('2025-01-15T10:30:00Z'),
          },
        },
        time_fired: new Date(),
        origin: 'LOCAL',
      };

      expect(event.data.entity_id).toBe('sensor.temperature');
      expect(event.data.old_state.state).toBe('20');
      expect(event.data.new_state.state).toBe('22');
    });
  });

  describe('HomeAssistantEntityState', () => {
    it('should structure entity state with required fields', () => {
      const state: HomeAssistantEntityState = {
        entity_id: 'light.bedroom',
        state: 'on',
        attributes: { brightness: 255 },
        last_changed: new Date('2025-01-15T10:00:00Z'),
        last_updated: new Date('2025-01-15T10:00:00Z'),
      };

      expect(state.entity_id).toBe('light.bedroom');
      expect(state.state).toBe('on');
      expect(state.attributes.brightness).toBe(255);
    });

    it('should allow optional context field', () => {
      const state: HomeAssistantEntityState = {
        entity_id: 'switch.kitchen',
        state: 'off',
        attributes: {},
        last_changed: new Date(),
        last_updated: new Date(),
        context: { id: 'ctx-789', parent_id: 'parent-123' },
      };

      expect(state.context?.id).toBe('ctx-789');
    });
  });

  describe('UnsubscribeFunc', () => {
    it('should be a function type that returns void or Promise<void>', () => {
      const unsubscribe: UnsubscribeFunc = () => {
        // Cleanup logic
      };

      expect(typeof unsubscribe).toBe('function');
    });

    it('should support async unsubscribe functions', async () => {
      const asyncUnsubscribe: UnsubscribeFunc = async () => {
        await Promise.resolve();
      };

      await expect(asyncUnsubscribe()).resolves.toBeUndefined();
    });
  });

  describe('ServiceCallResponse', () => {
    it('should structure service call response', () => {
      const response: ServiceCallResponse = {
        context: {
          id: 'ctx-abc',
          parent_id: null,
          user_id: 'user-123',
        },
      };

      expect(response.context.id).toBe('ctx-abc');
      expect(response.context.user_id).toBe('user-123');
    });
  });

  describe('Home Assistant Error Types', () => {
    it('should structure connection errors', () => {
      const error = new Error('WebSocket connection failed') as HomeAssistantConnectionError;
      error.name = 'HomeAssistantConnectionError';
      error.code = 'CONNECTION_FAILED';

      expect(error.name).toBe('HomeAssistantConnectionError');
      expect(error.code).toBe('CONNECTION_FAILED');
      expect(error.message).toBe('WebSocket connection failed');
    });

    it('should structure authentication errors', () => {
      const error = new Error('Invalid token') as HomeAssistantAuthenticationError;
      error.name = 'HomeAssistantAuthenticationError';
      error.code = 'INVALID_AUTH';

      expect(error.name).toBe('HomeAssistantAuthenticationError');
      expect(error.code).toBe('INVALID_AUTH');
    });

    it('should structure timeout errors', () => {
      const error = new Error('Request timeout') as HomeAssistantTimeoutError;
      error.name = 'HomeAssistantTimeoutError';
      error.code = 'TIMEOUT';
      error.timeoutMs = 30000;

      expect(error.name).toBe('HomeAssistantTimeoutError');
      expect(error.code).toBe('TIMEOUT');
      expect(error.timeoutMs).toBe(30000);
    });
  });
});
