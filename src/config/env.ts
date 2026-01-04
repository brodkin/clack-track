import dotenv from 'dotenv';
import { getSecretOrEnv } from '../utils/secrets.js';

/**
 * Build DATABASE_URL from components + secret password (for Swarm mode)
 * or use DATABASE_URL directly if provided
 */
function getDatabaseUrl(): string {
  // If DATABASE_URL is provided directly, use it
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Build from components (Swarm mode)
  const host = process.env.DATABASE_HOST || 'localhost';
  const port = process.env.DATABASE_PORT || '3306';
  const name = process.env.DATABASE_NAME || 'clack_track';
  const user = process.env.DATABASE_USER || 'root';
  const password = getSecretOrEnv('database_password', 'DATABASE_PASSWORD', '');

  if (!password) {
    return `mysql://${user}@${host}:${port}/${name}`;
  }
  return `mysql://${user}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
}

export interface EnvironmentConfig {
  // Application
  nodeEnv: string;
  port: number;

  // Web Server
  web: {
    enabled: boolean;
    port: number;
    host: string;
    corsEnabled: boolean;
    staticPath: string;
  };

  // Vestaboard
  vestaboard?: {
    apiKey: string;
    apiUrl: string;
  };

  // AI Providers
  ai: {
    provider: 'openai' | 'anthropic';
    openai?: {
      apiKey: string;
      model: string;
    };
    anthropic?: {
      apiKey: string;
      model: string;
    };
  };

  // Data Sources
  dataSources: {
    rss?: {
      feeds: string[];
    };
    rapidApi?: {
      apiKey: string;
      host: string;
    };
    homeAssistant?: {
      url: string;
      token: string;
      websocketUrl?: string;
      reconnectDelayMs?: number;
      maxReconnectAttempts?: number;
      triggerConfigPath?: string;
    };
  };

  // Database
  database: {
    url?: string;
    type: 'sqlite' | 'mysql' | 'postgres' | 'mongodb';
  };
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

export function loadConfig(): EnvironmentConfig {
  // Preserve NODE_ENV if already set (e.g., by Jest test runner)
  const preserveNodeEnv = process.env.NODE_ENV;
  dotenv.config({ override: true });
  if (preserveNodeEnv) {
    process.env.NODE_ENV = preserveNodeEnv;
  }

  const aiProvider = getOptionalEnv('AI_PROVIDER', 'openai') as 'openai' | 'anthropic';
  const nodeEnv = getOptionalEnv('NODE_ENV', 'development');

  return {
    nodeEnv,
    port: parseInt(getOptionalEnv('PORT', '3000'), 10),

    web: {
      enabled: getOptionalEnv('WEB_SERVER_ENABLED', 'true') !== 'false',
      port: parseInt(getOptionalEnv('WEB_PORT', '4000'), 10),
      host: getOptionalEnv('WEB_HOST', '0.0.0.0'),
      corsEnabled:
        getOptionalEnv('CORS_ENABLED', nodeEnv === 'development' ? 'true' : 'false') === 'true',
      staticPath: getOptionalEnv('WEB_STATIC_PATH', './src/web/frontend/dist'),
    },

    vestaboard: (() => {
      const apiKey = getSecretOrEnv('vestaboard_api_key', 'VESTABOARD_LOCAL_API_KEY');
      const apiUrl = getSecretOrEnv(
        'vestaboard_api_url',
        'VESTABOARD_LOCAL_API_URL',
        'http://localhost:7000'
      );
      return apiKey ? { apiKey, apiUrl } : undefined;
    })(),

    ai: {
      provider: aiProvider,
      openai:
        aiProvider === 'openai'
          ? {
              apiKey: getSecretOrEnv('openai_api_key', 'OPENAI_API_KEY'),
              model: getOptionalEnv('OPENAI_MODEL', 'gpt-4'),
            }
          : undefined,
      anthropic:
        aiProvider === 'anthropic'
          ? {
              apiKey: getSecretOrEnv('anthropic_api_key', 'ANTHROPIC_API_KEY'),
              model: getOptionalEnv('ANTHROPIC_MODEL', 'claude-sonnet-4-5-20250929'),
            }
          : undefined,
    },

    dataSources: {
      rss: {
        feeds: getOptionalEnv('RSS_FEEDS', '').split(',').filter(Boolean),
      },
      rapidApi: process.env.RAPIDAPI_KEY
        ? {
            apiKey: getRequiredEnv('RAPIDAPI_KEY'),
            host: getRequiredEnv('RAPIDAPI_HOST'),
          }
        : undefined,
      homeAssistant: (() => {
        const url = getSecretOrEnv('home_assistant_url', 'HOME_ASSISTANT_URL');
        const token = getSecretOrEnv('home_assistant_token', 'HOME_ASSISTANT_TOKEN');

        if (!url || !token) return undefined;

        const reconnectDelayMs = parseInt(
          getOptionalEnv('HOME_ASSISTANT_RECONNECT_DELAY', '5000'),
          10
        );
        const maxReconnectAttempts = parseInt(
          getOptionalEnv('HOME_ASSISTANT_MAX_RECONNECT_ATTEMPTS', '10'),
          10
        );

        // Construct WebSocket URL from HTTP/HTTPS URL
        const websocketUrl = url
          .replace(/^http:/, 'ws:')
          .replace(/^https:/, 'wss:')
          .concat('/api/websocket');

        return {
          url,
          token,
          websocketUrl,
          reconnectDelayMs,
          maxReconnectAttempts,
          triggerConfigPath: getOptionalEnv('TRIGGER_CONFIG_PATH'),
        };
      })(),
    },

    database: {
      url: getDatabaseUrl(),
      type: getOptionalEnv('DATABASE_TYPE', 'sqlite') as
        | 'sqlite'
        | 'mysql'
        | 'postgres'
        | 'mongodb',
    },
  };
}

export const config = loadConfig();
