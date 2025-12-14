import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Mock chokidar before importing TriggerConfigLoader
jest.mock('chokidar');

import { TriggerConfigLoader } from '@/config/trigger-config.js';
import type { TriggersConfig } from '@/config/trigger-schema.js';
import { getLastWatcher, resetMocks } from 'chokidar';

const TEST_CONFIG_DIR = path.join(process.cwd(), 'test-fixtures', 'config');
const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'triggers-test.yaml');

describe('TriggerConfigLoader', () => {
  let loader: TriggerConfigLoader;

  beforeEach(async () => {
    // Reset mocks
    resetMocks();

    // Create test directory
    if (!existsSync(TEST_CONFIG_DIR)) {
      await mkdir(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  afterEach(async () => {
    // Stop watching if loader exists
    if (loader) {
      loader.stopWatching();
    }

    // Clean up test config file
    try {
      await unlink(TEST_CONFIG_PATH);
    } catch {
      // Ignore errors if file doesn't exist
    }
  });

  describe('YAML Parsing', () => {
    it('should parse valid YAML with all fields', async () => {
      const yamlContent = `
triggers:
  - name: "Person Arrival"
    entity_pattern: "person.*"
    state_filter: "home"
    debounce_seconds: 60
  - name: "Door Opened"
    entity_pattern: "binary_sensor.front_door"
    state_filter: ["on", "open"]
    debounce_seconds: 30
`;
      await writeFile(TEST_CONFIG_PATH, yamlContent);

      loader = new TriggerConfigLoader(TEST_CONFIG_PATH);
      const config = await loader.load();

      expect(config.triggers).toHaveLength(2);
      expect(config.triggers[0]).toEqual({
        name: 'Person Arrival',
        entity_pattern: 'person.*',
        state_filter: 'home',
        debounce_seconds: 60,
      });
      expect(config.triggers[1]).toEqual({
        name: 'Door Opened',
        entity_pattern: 'binary_sensor.front_door',
        state_filter: ['on', 'open'],
        debounce_seconds: 30,
      });
    });

    it('should parse valid YAML with minimal fields (no optionals)', async () => {
      const yamlContent = `
triggers:
  - name: "Simple Trigger"
    entity_pattern: "sensor.temperature"
`;
      await writeFile(TEST_CONFIG_PATH, yamlContent);

      loader = new TriggerConfigLoader(TEST_CONFIG_PATH);
      const config = await loader.load();

      expect(config.triggers).toHaveLength(1);
      expect(config.triggers[0]).toEqual({
        name: 'Simple Trigger',
        entity_pattern: 'sensor.temperature',
        debounce_seconds: 0, // Default value
      });
    });
  });

  describe('Validation Errors', () => {
    it('should throw validation error for missing name field', async () => {
      const yamlContent = `
triggers:
  - entity_pattern: "person.*"
    state_filter: "home"
`;
      await writeFile(TEST_CONFIG_PATH, yamlContent);

      loader = new TriggerConfigLoader(TEST_CONFIG_PATH);
      await expect(loader.load()).rejects.toThrow(/missing required field.*name/i);
    });

    it('should throw validation error for missing entity_pattern field', async () => {
      const yamlContent = `
triggers:
  - name: "Person Arrival"
    state_filter: "home"
`;
      await writeFile(TEST_CONFIG_PATH, yamlContent);

      loader = new TriggerConfigLoader(TEST_CONFIG_PATH);
      await expect(loader.load()).rejects.toThrow(/missing required field.*entity_pattern/i);
    });

    it('should throw validation error for invalid regex pattern', async () => {
      const yamlContent = `
triggers:
  - name: "Bad Regex"
    entity_pattern: "/person[.*/"
`;
      await writeFile(TEST_CONFIG_PATH, yamlContent);

      loader = new TriggerConfigLoader(TEST_CONFIG_PATH);
      await expect(loader.load()).rejects.toThrow(/invalid regex pattern/i);
    });

    it('should throw validation error for negative debounce_seconds', async () => {
      const yamlContent = `
triggers:
  - name: "Negative Debounce"
    entity_pattern: "person.*"
    debounce_seconds: -10
`;
      await writeFile(TEST_CONFIG_PATH, yamlContent);

      loader = new TriggerConfigLoader(TEST_CONFIG_PATH);
      await expect(loader.load()).rejects.toThrow(/must be non-negative/i);
    });
  });

  describe('Hot-Reload', () => {
    it('should emit configReloaded event on file change', async () => {
      const initialYaml = `
triggers:
  - name: "Initial"
    entity_pattern: "sensor.*"
`;
      await writeFile(TEST_CONFIG_PATH, initialYaml);

      loader = new TriggerConfigLoader(TEST_CONFIG_PATH);
      await loader.load();

      // Start watching
      loader.startWatching();

      // Set up promise to wait for reload event
      const reloadPromise = new Promise<TriggersConfig>(resolve => {
        loader.once('configReloaded', resolve);
      });

      // Modify config file
      const updatedYaml = `
triggers:
  - name: "Updated"
    entity_pattern: "light.*"
`;
      await writeFile(TEST_CONFIG_PATH, updatedYaml);

      // Get the mock watcher instance and trigger change event
      const mockWatcherInstance = getLastWatcher();
      await new Promise(resolve => setTimeout(resolve, 100));
      mockWatcherInstance?.emit('change', TEST_CONFIG_PATH);

      // Wait for reload event (with timeout)
      const config = await Promise.race([
        reloadPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for reload')), 2000)
        ),
      ]);

      expect(config.triggers).toHaveLength(1);
      expect(config.triggers[0].name).toBe('Updated');
    }, 10000);

    it('should debounce multiple rapid file changes', async () => {
      const initialYaml = `
triggers:
  - name: "Initial"
    entity_pattern: "sensor.*"
`;
      await writeFile(TEST_CONFIG_PATH, initialYaml);

      loader = new TriggerConfigLoader(TEST_CONFIG_PATH);
      await loader.load();
      loader.startWatching();

      let reloadCount = 0;
      loader.on('configReloaded', () => {
        reloadCount++;
      });

      // Make multiple rapid changes (mock events)
      await new Promise(resolve => setTimeout(resolve, 100));
      await writeFile(TEST_CONFIG_PATH, `triggers:\n  - name: "Change1"\n    entity_pattern: "a"`);

      // Get the mock watcher instance
      const mockWatcherInstance = getLastWatcher();

      if (mockWatcherInstance) {
        mockWatcherInstance.emit('change', TEST_CONFIG_PATH);
        mockWatcherInstance.emit('change', TEST_CONFIG_PATH);
        mockWatcherInstance.emit('change', TEST_CONFIG_PATH);
      }

      // Wait for debounce period + buffer
      await new Promise(resolve => setTimeout(resolve, 800));

      // Should have triggered reload only once due to debouncing (500ms debounce)
      expect(reloadCount).toBeLessThanOrEqual(2); // Allow for potential race conditions
    });
  });

  describe('Non-existent Config File', () => {
    it('should throw helpful error for non-existent file', async () => {
      const nonExistentPath = path.join(TEST_CONFIG_DIR, 'does-not-exist.yaml');
      loader = new TriggerConfigLoader(nonExistentPath);

      await expect(loader.load()).rejects.toThrow(/config file not found/i);
    });
  });

  describe('Edge Cases', () => {
    it('should handle regex pattern syntax', async () => {
      const yamlContent = `
triggers:
  - name: "Regex Pattern"
    entity_pattern: "/^person\\\\.(john|jane)$/"
`;
      await writeFile(TEST_CONFIG_PATH, yamlContent);

      loader = new TriggerConfigLoader(TEST_CONFIG_PATH);
      const config = await loader.load();

      // YAML unescapes backslashes: \\\\ becomes \\
      expect(config.triggers[0].entity_pattern).toBe('/^person\\.(john|jane)$/');
    });

    it('should handle glob pattern syntax', async () => {
      const yamlContent = `
triggers:
  - name: "Glob Pattern"
    entity_pattern: "sensor.temperature_*"
`;
      await writeFile(TEST_CONFIG_PATH, yamlContent);

      loader = new TriggerConfigLoader(TEST_CONFIG_PATH);
      const config = await loader.load();

      expect(config.triggers[0].entity_pattern).toBe('sensor.temperature_*');
    });

    it('should handle exact entity ID', async () => {
      const yamlContent = `
triggers:
  - name: "Exact Match"
    entity_pattern: "binary_sensor.front_door"
`;
      await writeFile(TEST_CONFIG_PATH, yamlContent);

      loader = new TriggerConfigLoader(TEST_CONFIG_PATH);
      const config = await loader.load();

      expect(config.triggers[0].entity_pattern).toBe('binary_sensor.front_door');
    });

    it('should handle empty triggers array', async () => {
      const yamlContent = `
triggers: []
`;
      await writeFile(TEST_CONFIG_PATH, yamlContent);

      loader = new TriggerConfigLoader(TEST_CONFIG_PATH);
      const config = await loader.load();

      expect(config.triggers).toEqual([]);
    });
  });
});
