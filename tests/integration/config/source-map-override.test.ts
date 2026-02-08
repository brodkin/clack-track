/**
 * Integration test: Verify npm override replaces source-map with source-map-js
 *
 * The source-map v0.6.1 package (transitive dependency via Jest/source-map-support)
 * uses a recursive quicksort in its SourceMapConsumer that can exceed the default
 * Node.js stack size during coverage collection on large TypeScript projects.
 * This causes intermittent "RangeError: Maximum call stack size exceeded" failures.
 *
 * Fix: npm overrides in package.json replace source-map with source-map-js,
 * which adds an optimized sortGenerated() function that uses insertion sort for
 * small partitions and sorts per-line groups incrementally, preventing deep
 * recursion on large source maps.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('source-map npm override for stack overflow prevention', () => {
  describe('package.json overrides configuration', () => {
    let packageJson: Record<string, unknown>;
    let overrides: Record<string, string>;

    beforeAll(() => {
      const raw = readFileSync(resolve(ROOT, 'package.json'), 'utf-8');
      packageJson = JSON.parse(raw);
      overrides = packageJson.overrides as Record<string, string>;
    });

    it('has an overrides section in package.json', () => {
      expect(overrides).toBeDefined();
      expect(typeof overrides).toBe('object');
    });

    it('overrides source-map with source-map-js', () => {
      expect(overrides['source-map']).toBe('npm:source-map-js@^1.2.1');
    });
  });

  describe('resolved source-map in source-map-support dependency', () => {
    // The critical dependency chain is:
    // jest -> source-map-support -> source-map (this is where the stack overflow occurs)
    // npm overrides replace this nested source-map with source-map-js.
    const nestedSourceMapDir = resolve(
      ROOT,
      'node_modules',
      'source-map-support',
      'node_modules',
      'source-map'
    );

    it('source-map-support has a nested source-map directory', () => {
      expect(existsSync(nestedSourceMapDir)).toBe(true);
    });

    it('nested source-map resolves to source-map-js implementation', () => {
      const pkgPath = resolve(nestedSourceMapDir, 'package.json');
      const modulePkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

      // The npm override replaces source-map with source-map-js.
      // source-map-js identifies itself in its package.json name field.
      expect(modulePkg.name).toBe('source-map-js');
    });

    it('has optimized sortGenerated that prevents deep recursion', () => {
      // source-map-js adds a sortGenerated() function in source-map-consumer.js
      // that uses insertion sort for small partitions (< 20 elements) and sorts
      // per-line groups incrementally. This prevents the deep recursion that
      // caused stack overflows in source-map 0.6.1 when sorting large arrays.
      const consumerPath = resolve(nestedSourceMapDir, 'lib', 'source-map-consumer.js');
      const consumerSource = readFileSync(consumerPath, 'utf-8');

      // source-map-js defines sortGenerated with insertion sort for small arrays
      expect(consumerSource).toContain('function sortGenerated');
    });

    it('nested source-map is not the problematic v0.6.1', () => {
      const pkgPath = resolve(nestedSourceMapDir, 'package.json');
      const modulePkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

      // Must NOT be the problematic 0.6.1 version
      expect(modulePkg.version).not.toBe('0.6.1');
    });
  });
});
