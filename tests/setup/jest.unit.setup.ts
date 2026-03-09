/**
 * Minimal Jest Setup for Unit Tests
 *
 * Unit tests cover pure functions only (text-layout, character-encoder, etc.)
 * and do not need database teardown or jest-dom matchers.
 */

process.env.NODE_ENV = 'test';

export {};
