/**
 * Trigger Pattern Matcher
 *
 * Matches Home Assistant state_changed events against configured trigger patterns.
 * Supports exact matching, glob patterns, and regular expressions with per-trigger debouncing.
 */

import { minimatch } from 'minimatch';
import type { TriggerConfig } from '../config/trigger-schema.js';

export interface TriggerMatchResult {
  matched: boolean;
  trigger: TriggerConfig | null;
  debounced: boolean; // true if matched but within debounce window
}

export class TriggerMatcher {
  private triggers: TriggerConfig[];
  private lastTriggerTime: Map<string, number>;

  constructor(triggers: TriggerConfig[]) {
    this.triggers = triggers;
    this.lastTriggerTime = new Map();

    // Validate regex patterns during construction
    this.validateRegexPatterns();
  }

  /**
   * Check if an entity state change matches any trigger.
   * @param entityId - The Home Assistant entity ID (e.g., "person.john")
   * @param newState - The new state value (e.g., "home")
   * @returns TriggerMatchResult with matched trigger and debounce status
   */
  match(entityId: string, newState: string): TriggerMatchResult {
    // Find first matching trigger
    for (const trigger of this.triggers) {
      if (this.matchesEntityPattern(entityId, trigger.entity_pattern)) {
        // Check state filter if present
        if (!this.matchesStateFilter(newState, trigger.state_filter)) {
          continue;
        }

        // Check debounce window
        const debounced = this.isDebounced(trigger);

        // Update last trigger time if not debounced
        if (!debounced) {
          this.updateLastTriggerTime(trigger);
        }

        return {
          matched: true,
          trigger,
          debounced,
        };
      }
    }

    return {
      matched: false,
      trigger: null,
      debounced: false,
    };
  }

  /**
   * Update triggers (for hot-reload support).
   */
  updateTriggers(triggers: TriggerConfig[]): void {
    // Clear debounce state for triggers that are being removed
    const newTriggerNames = new Set(triggers.map(t => t.name));
    for (const name of this.lastTriggerTime.keys()) {
      if (!newTriggerNames.has(name)) {
        this.lastTriggerTime.delete(name);
      }
    }

    this.triggers = triggers;
    this.validateRegexPatterns();
  }

  /**
   * Clean up all state (for graceful shutdown).
   */
  cleanup(): void {
    this.lastTriggerTime.clear();
  }

  /**
   * Validate all regex patterns in triggers
   */
  private validateRegexPatterns(): void {
    for (const trigger of this.triggers) {
      if (this.isRegexPattern(trigger.entity_pattern)) {
        try {
          this.parseRegexPattern(trigger.entity_pattern);
        } catch (error) {
          throw new Error(
            `Invalid regex pattern in trigger "${trigger.name}": ${trigger.entity_pattern}. ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    }
  }

  /**
   * Check if entity ID matches the pattern
   */
  private matchesEntityPattern(entityId: string, pattern: string): boolean {
    // Check if it's a regex pattern
    if (this.isRegexPattern(pattern)) {
      const regex = this.parseRegexPattern(pattern);
      return regex.test(entityId);
    }

    // Check if it's a glob pattern (contains * or ?)
    if (pattern.includes('*') || pattern.includes('?')) {
      return minimatch(entityId, pattern);
    }

    // Exact match
    return entityId === pattern;
  }

  /**
   * Check if state matches the state filter
   */
  private matchesStateFilter(state: string, filter: string | string[] | undefined): boolean {
    if (filter === undefined) {
      return true; // No filter means match any state
    }

    if (typeof filter === 'string') {
      return state === filter;
    }

    return filter.includes(state);
  }

  /**
   * Check if trigger is within debounce window
   */
  private isDebounced(trigger: TriggerConfig): boolean {
    const debounceSeconds = trigger.debounce_seconds ?? 0;

    if (debounceSeconds === 0) {
      return false; // No debouncing
    }

    const lastTime = this.lastTriggerTime.get(trigger.name);
    if (lastTime === undefined) {
      return false; // First trigger
    }

    const now = Date.now();
    const elapsedSeconds = (now - lastTime) / 1000;

    return elapsedSeconds < debounceSeconds;
  }

  /**
   * Update last trigger time for a trigger
   */
  private updateLastTriggerTime(trigger: TriggerConfig): void {
    this.lastTriggerTime.set(trigger.name, Date.now());
  }

  /**
   * Check if pattern is a regex pattern (starts and ends with /)
   */
  private isRegexPattern(pattern: string): boolean {
    return pattern.startsWith('/') && pattern.length > 1 && pattern.includes('/', 1);
  }

  /**
   * Parse regex pattern from string format /pattern/flags
   */
  private parseRegexPattern(pattern: string): RegExp {
    const lastSlash = pattern.lastIndexOf('/');
    const regexBody = pattern.slice(1, lastSlash);
    const flags = pattern.slice(lastSlash + 1);

    return new RegExp(regexBody, flags);
  }
}
