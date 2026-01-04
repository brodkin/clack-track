/**
 * Unit tests for TriggerMatcher
 */

import { TriggerMatcher } from '../../../src/scheduler/trigger-matcher.js';
import type { TriggerConfig } from '../../../src/config/trigger-schema.js';

describe('TriggerMatcher', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Exact Match Pattern', () => {
    it('should match exact entity ID', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'Front Door',
          entity_pattern: 'binary_sensor.front_door',
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      const result = matcher.match('binary_sensor.front_door', 'on');

      expect(result.matched).toBe(true);
      expect(result.trigger).toEqual(triggers[0]);
      expect(result.debounced).toBe(false);
    });

    it('should not match different entity', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'Front Door',
          entity_pattern: 'binary_sensor.front_door',
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      const result = matcher.match('binary_sensor.back_door', 'on');

      expect(result.matched).toBe(false);
      expect(result.trigger).toBe(null);
      expect(result.debounced).toBe(false);
    });
  });

  describe('Glob Pattern Matching', () => {
    it('should match person.* pattern', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'Person Tracker',
          entity_pattern: 'person.*',
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      const result = matcher.match('person.john', 'home');

      expect(result.matched).toBe(true);
      expect(result.trigger).toEqual(triggers[0]);
    });

    it('should not match different domain with glob pattern', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'Person Tracker',
          entity_pattern: 'person.*',
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      const result = matcher.match('binary_sensor.motion', 'on');

      expect(result.matched).toBe(false);
      expect(result.trigger).toBe(null);
    });

    it('should match sensor.*_temperature glob pattern', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'Temperature Tracker',
          entity_pattern: 'sensor.*_temperature',
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      const result = matcher.match('sensor.living_room_temperature', 'on');

      expect(result.matched).toBe(true);
      expect(result.trigger).toEqual(triggers[0]);
    });
  });

  describe('Regex Pattern Matching', () => {
    it('should match regex pattern /^person\\..*$/', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'Person Regex',
          entity_pattern: '/^person\\..*$/',
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      const result = matcher.match('person.jane', 'home');

      expect(result.matched).toBe(true);
      expect(result.trigger).toEqual(triggers[0]);
    });

    it('should handle case-insensitive regex /garage/i', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'Garage Matcher',
          entity_pattern: '/garage/i',
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      const resultUpper = matcher.match('binary_sensor.GARAGE_door', 'open');
      const resultLower = matcher.match('binary_sensor.garage_door', 'open');

      expect(resultUpper.matched).toBe(true);
      expect(resultLower.matched).toBe(true);
    });

    it('should throw error for invalid regex pattern', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'Invalid Regex',
          entity_pattern: '/[invalid(/',
        },
      ];

      expect(() => new TriggerMatcher(triggers)).toThrow(/Invalid regex pattern/i);
    });
  });

  describe('State Filtering', () => {
    it('should match any state when no filter is defined', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'Any State',
          entity_pattern: 'binary_sensor.door',
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      const result1 = matcher.match('binary_sensor.door', 'on');
      const result2 = matcher.match('binary_sensor.door', 'off');

      expect(result1.matched).toBe(true);
      expect(result2.matched).toBe(true);
    });

    it('should match only specified single state', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'Home Only',
          entity_pattern: 'person.john',
          state_filter: 'home',
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      const matchHome = matcher.match('person.john', 'home');
      const matchAway = matcher.match('person.john', 'away');

      expect(matchHome.matched).toBe(true);
      expect(matchAway.matched).toBe(false);
    });

    it('should match any state in array filter', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'Multi-State',
          entity_pattern: 'person.john',
          state_filter: ['home', 'just_arrived'],
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      const matchHome = matcher.match('person.john', 'home');
      const matchArrived = matcher.match('person.john', 'just_arrived');
      const matchAway = matcher.match('person.john', 'away');

      expect(matchHome.matched).toBe(true);
      expect(matchArrived.matched).toBe(true);
      expect(matchAway.matched).toBe(false);
    });
  });

  describe('Debouncing Logic', () => {
    it('should trigger immediately when debounce is 0', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'No Debounce',
          entity_pattern: 'binary_sensor.door',
          debounce_seconds: 0,
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      const result1 = matcher.match('binary_sensor.door', 'on');
      const result2 = matcher.match('binary_sensor.door', 'off');

      expect(result1.matched).toBe(true);
      expect(result1.debounced).toBe(false);
      expect(result2.matched).toBe(true);
      expect(result2.debounced).toBe(false);
    });

    it('should trigger immediately when debounce is undefined', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'No Debounce',
          entity_pattern: 'binary_sensor.door',
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      const result1 = matcher.match('binary_sensor.door', 'on');
      const result2 = matcher.match('binary_sensor.door', 'off');

      expect(result1.matched).toBe(true);
      expect(result1.debounced).toBe(false);
      expect(result2.matched).toBe(true);
      expect(result2.debounced).toBe(false);
    });

    it('should return debounced=true within debounce window', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'With Debounce',
          entity_pattern: 'binary_sensor.door',
          debounce_seconds: 60,
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      const result1 = matcher.match('binary_sensor.door', 'on');
      expect(result1.matched).toBe(true);
      expect(result1.debounced).toBe(false);

      // Advance time by 30 seconds (within 60s window)
      jest.advanceTimersByTime(30000);

      const result2 = matcher.match('binary_sensor.door', 'off');
      expect(result2.matched).toBe(true);
      expect(result2.debounced).toBe(true);
    });

    it('should trigger again after debounce window expires', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'With Debounce',
          entity_pattern: 'binary_sensor.door',
          debounce_seconds: 60,
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      const result1 = matcher.match('binary_sensor.door', 'on');
      expect(result1.matched).toBe(true);
      expect(result1.debounced).toBe(false);

      // Advance time by 61 seconds (past 60s window)
      jest.advanceTimersByTime(61000);

      const result2 = matcher.match('binary_sensor.door', 'off');
      expect(result2.matched).toBe(true);
      expect(result2.debounced).toBe(false);
    });

    it('should have independent debounce timers per trigger', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'Door Trigger',
          entity_pattern: 'binary_sensor.door',
          debounce_seconds: 60,
        },
        {
          name: 'Window Trigger',
          entity_pattern: 'binary_sensor.window',
          debounce_seconds: 60,
        },
      ];

      const matcher = new TriggerMatcher(triggers);

      // Trigger door
      const doorResult1 = matcher.match('binary_sensor.door', 'on');
      expect(doorResult1.debounced).toBe(false);

      // Trigger window (should not be debounced by door trigger)
      const windowResult1 = matcher.match('binary_sensor.window', 'on');
      expect(windowResult1.debounced).toBe(false);

      // Advance time by 30 seconds
      jest.advanceTimersByTime(30000);

      // Door should be debounced
      const doorResult2 = matcher.match('binary_sensor.door', 'off');
      expect(doorResult2.debounced).toBe(true);

      // Window should also be debounced
      const windowResult2 = matcher.match('binary_sensor.window', 'off');
      expect(windowResult2.debounced).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty triggers array', () => {
      const matcher = new TriggerMatcher([]);
      const result = matcher.match('binary_sensor.door', 'on');

      expect(result.matched).toBe(false);
      expect(result.trigger).toBe(null);
    });

    it('should return first matching trigger when multiple match', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'First Match',
          entity_pattern: 'binary_sensor.*',
        },
        {
          name: 'Second Match',
          entity_pattern: 'binary_sensor.door',
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      const result = matcher.match('binary_sensor.door', 'on');

      expect(result.matched).toBe(true);
      expect(result.trigger?.name).toBe('First Match');
    });

    it('should update triggers and clear stale debounce timers', () => {
      const initialTriggers: TriggerConfig[] = [
        {
          name: 'Old Trigger',
          entity_pattern: 'binary_sensor.old',
          debounce_seconds: 60,
        },
      ];

      const matcher = new TriggerMatcher(initialTriggers);

      // Trigger it to create a debounce timer
      const result1 = matcher.match('binary_sensor.old', 'on');
      expect(result1.matched).toBe(true);
      expect(result1.debounced).toBe(false);

      // Advance time slightly but still within debounce window
      jest.advanceTimersByTime(30000);

      // Update triggers (remove old, add new)
      const newTriggers: TriggerConfig[] = [
        {
          name: 'New Trigger',
          entity_pattern: 'binary_sensor.new',
        },
      ];

      matcher.updateTriggers(newTriggers);

      // Old trigger should no longer match
      const oldResult = matcher.match('binary_sensor.old', 'on');
      expect(oldResult.matched).toBe(false);

      // New trigger should match
      const newResult = matcher.match('binary_sensor.new', 'on');
      expect(newResult.matched).toBe(true);
    });

    it('should cleanup all timers on cleanup()', () => {
      const triggers: TriggerConfig[] = [
        {
          name: 'Trigger 1',
          entity_pattern: 'binary_sensor.door',
          debounce_seconds: 60,
        },
        {
          name: 'Trigger 2',
          entity_pattern: 'binary_sensor.window',
          debounce_seconds: 60,
        },
      ];

      const matcher = new TriggerMatcher(triggers);
      matcher.match('binary_sensor.door', 'on');
      matcher.match('binary_sensor.window', 'on');

      // Cleanup should clear all timers without errors
      expect(() => matcher.cleanup()).not.toThrow();
    });
  });
});
