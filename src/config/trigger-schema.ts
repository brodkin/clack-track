/**
 * Trigger Configuration Schema
 *
 * Defines TypeScript types for Home Assistant trigger configuration.
 * Triggers allow content updates based on entity state changes.
 */

/**
 * Individual trigger configuration
 */
export interface TriggerConfig {
  /**
   * Human-readable name for the trigger
   */
  name: string;

  /**
   * Entity pattern to match against
   * Can be:
   * - Exact match: "binary_sensor.front_door"
   * - Glob pattern: "person.*" or "sensor.temperature_*"
   * - Regex pattern: "/^person\.(john|jane)$/"
   */
  entity_pattern: string;

  /**
   * Optional state filter
   * Only trigger when entity changes TO this state (or one of these states)
   * Examples: "home", "on", ["on", "open"]
   */
  state_filter?: string | string[];

  /**
   * Optional debounce period in seconds
   * Prevents rapid re-triggering within this time window
   * Default: 0 (no debouncing)
   */
  debounce_seconds?: number;
}

/**
 * Root configuration structure
 */
export interface TriggersConfig {
  /**
   * Array of trigger configurations
   */
  triggers: TriggerConfig[];
}

/**
 * Validates that a value is a valid TriggerConfig
 */
export function validateTriggerConfig(trigger: unknown, index: number): trigger is TriggerConfig {
  if (!trigger || typeof trigger !== 'object') {
    throw new Error(`Trigger at index ${index} must be an object`);
  }

  const t = trigger as Record<string, unknown>;

  // Validate required fields
  if (!t.name || typeof t.name !== 'string') {
    throw new Error(`Trigger at index ${index} is missing required field: name (string)`);
  }

  if (!t.entity_pattern || typeof t.entity_pattern !== 'string') {
    throw new Error(`Trigger at index ${index} is missing required field: entity_pattern (string)`);
  }

  // Validate regex pattern if it looks like a regex
  if (t.entity_pattern.startsWith('/') && t.entity_pattern.endsWith('/')) {
    const regexBody = t.entity_pattern.slice(1, -1);
    try {
      new RegExp(regexBody);
    } catch (error) {
      throw new Error(
        `Trigger "${t.name}" has invalid regex pattern: ${t.entity_pattern}. ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Validate optional state_filter
  if (t.state_filter !== undefined) {
    if (
      typeof t.state_filter !== 'string' &&
      (!Array.isArray(t.state_filter) || !t.state_filter.every(s => typeof s === 'string'))
    ) {
      throw new Error(
        `Trigger "${t.name}" has invalid state_filter: must be string or array of strings`
      );
    }
  }

  // Validate optional debounce_seconds
  if (t.debounce_seconds !== undefined) {
    if (typeof t.debounce_seconds !== 'number') {
      throw new Error(`Trigger "${t.name}" has invalid debounce_seconds: must be a number`);
    }
    if (t.debounce_seconds < 0) {
      throw new Error(
        `Trigger "${t.name}" has invalid debounce_seconds: must be non-negative (got ${t.debounce_seconds})`
      );
    }
  }

  return true;
}

/**
 * Validates that a value is a valid TriggersConfig
 */
export function validateTriggersConfig(config: unknown): config is TriggersConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration must be an object');
  }

  const c = config as Record<string, unknown>;

  if (!c.triggers || !Array.isArray(c.triggers)) {
    throw new Error('Configuration must contain a "triggers" array');
  }

  // Validate each trigger
  c.triggers.forEach((trigger, index) => {
    validateTriggerConfig(trigger, index);
  });

  return true;
}
