/**
 * Docker Swarm Secrets Utility
 *
 * Reads secrets from Docker Swarm secret files (/run/secrets/<name>)
 * with fallback to environment variables for local development.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SECRETS_PATH = process.env.SECRETS_PATH || '/run/secrets';

/**
 * Read a value from Docker secret file or fall back to environment variable.
 * Docker Swarm secrets are mounted as files in /run/secrets/<name>
 *
 * @param secretName - Name of the secret file (e.g., 'openai_api_key')
 * @param envName - Environment variable name to fall back to (e.g., 'OPENAI_API_KEY')
 * @param defaultValue - Default value if neither secret nor env var exists
 * @returns The secret value, env var value, or default
 */
export function getSecretOrEnv(
  secretName: string,
  envName: string,
  defaultValue: string = ''
): string {
  const secretFile = join(SECRETS_PATH, secretName);

  try {
    if (existsSync(secretFile)) {
      return readFileSync(secretFile, 'utf8').trim();
    }
  } catch {
    // File doesn't exist or can't be read, fall back to env
  }

  return process.env[envName] || defaultValue;
}

/**
 * Check if running in Docker Swarm mode (secrets directory exists)
 */
export function isSwarmMode(): boolean {
  return existsSync(SECRETS_PATH);
}
