import dotenv from 'dotenv';

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

    vestaboard: process.env.VESTABOARD_LOCAL_API_KEY
      ? {
          apiKey: getRequiredEnv('VESTABOARD_LOCAL_API_KEY'),
          apiUrl: getOptionalEnv('VESTABOARD_LOCAL_API_URL', 'http://localhost:7000'),
        }
      : undefined,

    ai: {
      provider: aiProvider,
      openai:
        aiProvider === 'openai'
          ? {
              apiKey: getRequiredEnv('OPENAI_API_KEY'),
              model: getOptionalEnv('OPENAI_MODEL', 'gpt-4'),
            }
          : undefined,
      anthropic:
        aiProvider === 'anthropic'
          ? {
              apiKey: getRequiredEnv('ANTHROPIC_API_KEY'),
              model: getOptionalEnv('ANTHROPIC_MODEL', 'claude-sonnet-4'),
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
      homeAssistant: process.env.HOME_ASSISTANT_URL
        ? (() => {
            const url = getRequiredEnv('HOME_ASSISTANT_URL');
            const token = getRequiredEnv('HOME_ASSISTANT_TOKEN');
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
            };
          })()
        : undefined,
    },

    database: {
      url: getOptionalEnv('DATABASE_URL'),
      type: getOptionalEnv('DATABASE_TYPE', 'sqlite') as
        | 'sqlite'
        | 'mysql'
        | 'postgres'
        | 'mongodb',
    },
  };
}

export const config = loadConfig();
