/**
 * Mock implementation of chokidar for testing
 * Chokidar is ESM-only and causes issues with Jest's CommonJS transform
 */

import { EventEmitter } from 'events';

export class FSWatcher extends EventEmitter {
  constructor() {
    super();
  }

  async close(): Promise<void> {
    this.removeAllListeners();
  }
}

// Store the last created watcher for test access
let lastWatcher: FSWatcher | null = null;

export function watch(_path: string | ReadonlyArray<string>, _options?: unknown): FSWatcher {
  lastWatcher = new FSWatcher();
  return lastWatcher;
}

// Helper for tests to get the current watcher
export function getLastWatcher(): FSWatcher | null {
  return lastWatcher;
}

// Helper for tests to reset
export function resetMocks(): void {
  lastWatcher = null;
}
