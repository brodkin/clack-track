/**
 * E2E Test: Registration Flow via Magic Link
 *
 * Tests the complete registration flow against the running dev server.
 * Requires the dev server to be running on localhost:4000.
 *
 * Tests:
 * 1. Token validation API
 * 2. Registration options API
 * 3. Error handling for invalid/missing tokens
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { execSync } from 'child_process';

// Base URL for the API server
const API_BASE = 'http://localhost:4000';

// Extract token from CLI output
function generateMagicLink(email: string): string {
  // Force development mode to use MySQL instead of test SQLite
  const output = execSync(`NODE_ENV=development npm run auth:invite -- --email ${email}`, {
    encoding: 'utf-8',
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'development' },
  });

  const match = output.match(/token=([a-f0-9]{64})/);
  if (!match) {
    throw new Error(`Failed to extract token from CLI output: ${output}`);
  }
  return match[1];
}

// Check if dev server is running
async function isServerRunning(): Promise<boolean> {
  try {
    // Use auth/session endpoint - it returns 401 when not authenticated but proves server is running
    const response = await fetch(`${API_BASE}/api/auth/session`);
    return response.status === 401 || response.ok;
  } catch {
    return false;
  }
}

describe('Registration Flow', () => {
  const testEmail = `e2e-test-${Date.now()}@playwright.local`;
  let token: string;
  let serverRunning = false;

  beforeAll(async () => {
    // Check if dev server is running
    serverRunning = await isServerRunning();
    if (!serverRunning) {
      console.warn('Dev server not running at localhost:4000 - skipping e2e tests');
      return;
    }

    // Generate a fresh magic link for testing
    token = generateMagicLink(testEmail);
  });

  it('should validate magic link token via API', async () => {
    if (!serverRunning || !token) {
      console.warn('Skipping - server not running or no token generated');
      return;
    }

    const response = await fetch(`${API_BASE}/api/auth/register/validate?token=${token}`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.valid).toBe(true);
    expect(data.email).toBe(testEmail);
  });

  it('should return error for invalid token', async () => {
    if (!serverRunning) {
      console.warn('Skipping - server not running');
      return;
    }

    const invalidToken = 'a'.repeat(64);
    const response = await fetch(`${API_BASE}/api/auth/register/validate?token=${invalidToken}`);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Invalid or expired magic link');
  });

  it('should return error for missing token', async () => {
    if (!serverRunning) {
      console.warn('Skipping - server not running');
      return;
    }

    const response = await fetch(`${API_BASE}/api/auth/register/validate`);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Token is required');
  });

  it('should get registration options for valid token', async () => {
    if (!token) {
      console.warn('Skipping - no token generated');
      return;
    }

    const response = await fetch(`${API_BASE}/api/auth/register/options?token=${token}`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.challenge).toBeDefined();
    expect(data.rp).toBeDefined();
    expect(data.rp.name).toBe('Clack Track');
    expect(data.user).toBeDefined();
    expect(data.user.name).toBe(testEmail);
  });
});
