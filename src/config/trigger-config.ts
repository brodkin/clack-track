/**
 * Trigger Configuration Loader
 *
 * Loads and validates Home Assistant trigger configuration from YAML files.
 * Supports hot-reload via file watching.
 */

import { EventEmitter } from 'events';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { load as parseYaml } from 'js-yaml';
import { watch, FSWatcher } from 'chokidar';
import type { TriggersConfig } from './trigger-schema.js';
import { validateTriggersConfig } from './trigger-schema.js';

/**
 * Debounce period for file watching (milliseconds)
 * Prevents rapid reload events when file is modified multiple times
 */
const FILE_WATCH_DEBOUNCE_MS = 500;

/**
 * TriggerConfigLoader - Loads and watches trigger configuration
 *
 * Events:
 * - 'configReloaded': Emitted when configuration is successfully reloaded (passes new config)
 * - 'error': Emitted when reload fails (passes error)
 */
export class TriggerConfigLoader extends EventEmitter {
  private configPath: string;
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private currentConfig: TriggersConfig | null = null;

  constructor(configPath: string) {
    super();
    this.configPath = configPath;
  }

  /**
   * Load configuration from YAML file
   * @throws Error if file doesn't exist, parsing fails, or validation fails
   */
  async load(): Promise<TriggersConfig> {
    // Check if file exists
    try {
      await access(this.configPath, constants.R_OK);
    } catch {
      throw new Error(
        `Config file not found or not readable: ${this.configPath}. Please create a triggers configuration file.`
      );
    }

    // Read file
    const fileContent = await readFile(this.configPath, 'utf-8');

    // Parse YAML
    let parsed: unknown;
    try {
      parsed = parseYaml(fileContent);
    } catch (error) {
      throw new Error(
        `Failed to parse YAML in ${this.configPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Validate structure
    if (!validateTriggersConfig(parsed)) {
      throw new Error('Configuration validation failed');
    }

    // Apply defaults
    const config = this.applyDefaults(parsed);

    // Cache current config
    this.currentConfig = config;

    return config;
  }

  /**
   * Apply default values to trigger configurations
   */
  private applyDefaults(config: TriggersConfig): TriggersConfig {
    return {
      triggers: config.triggers.map(trigger => ({
        ...trigger,
        debounce_seconds: trigger.debounce_seconds ?? 0,
      })),
    };
  }

  /**
   * Start watching configuration file for changes
   * Emits 'configReloaded' event when file changes and reload succeeds
   * Emits 'error' event when reload fails
   */
  startWatching(): void {
    if (this.watcher) {
      // Already watching
      return;
    }

    this.watcher = watch(this.configPath, {
      persistent: true,
      ignoreInitial: true, // Don't trigger on initial add
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    this.watcher.on('change', () => {
      this.handleFileChange();
    });

    this.watcher.on('error', error => {
      const message = error instanceof Error ? error.message : String(error);
      this.emit('error', new Error(`File watcher error: ${message}`));
    });
  }

  /**
   * Stop watching configuration file
   */
  stopWatching(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Handle file change with debouncing
   */
  private handleFileChange(): void {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new timer
    this.debounceTimer = setTimeout(() => {
      this.reloadConfig();
    }, FILE_WATCH_DEBOUNCE_MS);
  }

  /**
   * Reload configuration and emit event
   */
  private async reloadConfig(): Promise<void> {
    try {
      const config = await this.load();
      this.emit('configReloaded', config);
    } catch (error) {
      this.emit(
        'error',
        new Error(
          `Failed to reload config: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
    }
  }

  /**
   * Get the currently loaded configuration
   * Returns null if load() hasn't been called yet
   */
  getCurrentConfig(): TriggersConfig | null {
    return this.currentConfig;
  }

  /**
   * Get path to configuration file
   */
  getConfigPath(): string {
    return this.configPath;
  }
}
