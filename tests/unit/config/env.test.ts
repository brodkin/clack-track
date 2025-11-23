/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock dotenv before importing env module
jest.mock('dotenv/config', () => ({}));

describe('Environment Configuration', () => {
  // Clear module cache and reset environment before each test
  beforeEach(() => {
    // Clear all environment variables
    Object.keys(process.env).forEach(key => {
      if (
        key.startsWith('VESTABOARD_') ||
        key.startsWith('OPENAI_') ||
        key.startsWith('ANTHROPIC_') ||
        key.startsWith('AI_') ||
        key.startsWith('WEB_') ||
        key.startsWith('CORS_') ||
        key.startsWith('DATABASE_') ||
        key.startsWith('RSS_') ||
        key.startsWith('RAPIDAPI_') ||
        key.startsWith('HOME_ASSISTANT_') ||
        key === 'NODE_ENV' ||
        key === 'PORT'
      ) {
        delete process.env[key];
      }
    });

    // Set base test environment
    process.env.NODE_ENV = 'test';

    // Clear module cache to force re-import
    jest.resetModules();
  });

  describe('loadConfig function', () => {
    describe('Required environment variables', () => {
      it('should throw error when VESTABOARD_LOCAL_API_KEY is missing', () => {
        process.env.OPENAI_API_KEY = 'sk-test-key';

        // Importing the module will throw because config is exported (line 133: export const config = loadConfig())
        expect(() => {
          require('@/config/env');
        }).toThrow('Missing required environment variable: VESTABOARD_LOCAL_API_KEY');
      });

      it('should throw error when OpenAI provider is selected but OPENAI_API_KEY is missing', () => {
        process.env.VESTABOARD_LOCAL_API_KEY = 'test-key';
        process.env.AI_PROVIDER = 'openai';
        delete process.env.OPENAI_API_KEY;

        expect(() => {
          require('@/config/env');
        }).toThrow('Missing required environment variable: OPENAI_API_KEY');
      });

      it('should throw error when Anthropic provider is selected but ANTHROPIC_API_KEY is missing', () => {
        process.env.VESTABOARD_LOCAL_API_KEY = 'test-key';
        process.env.AI_PROVIDER = 'anthropic';
        delete process.env.ANTHROPIC_API_KEY;

        expect(() => {
          require('@/config/env');
        }).toThrow('Missing required environment variable: ANTHROPIC_API_KEY');
      });

      it('should throw error when RAPIDAPI_KEY is provided but RAPIDAPI_HOST is missing', () => {
        process.env.VESTABOARD_LOCAL_API_KEY = 'test-key';
        process.env.OPENAI_API_KEY = 'sk-test';
        process.env.RAPIDAPI_KEY = 'test-rapidapi-key';
        delete process.env.RAPIDAPI_HOST;

        expect(() => {
          require('@/config/env');
        }).toThrow('Missing required environment variable: RAPIDAPI_HOST');
      });

      it('should throw error when HOME_ASSISTANT_URL is provided but HOME_ASSISTANT_TOKEN is missing', () => {
        process.env.VESTABOARD_LOCAL_API_KEY = 'test-key';
        process.env.OPENAI_API_KEY = 'sk-test';
        process.env.HOME_ASSISTANT_URL = 'http://homeassistant.local:8123';
        delete process.env.HOME_ASSISTANT_TOKEN;

        expect(() => {
          require('@/config/env');
        }).toThrow('Missing required environment variable: HOME_ASSISTANT_TOKEN');
      });
    });

    describe('Default values', () => {
      beforeEach(() => {
        // Set minimal required vars
        process.env.VESTABOARD_LOCAL_API_KEY = 'test-vestaboard-key';
        process.env.OPENAI_API_KEY = 'sk-test-openai-key';
      });

      it('should use default AI_PROVIDER as openai', () => {
        delete process.env.AI_PROVIDER;

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.ai.provider).toBe('openai');
      });

      it('should use default NODE_ENV as development', () => {
        delete process.env.NODE_ENV;

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.nodeEnv).toBe('development');
      });

      it('should use default PORT as 3000', () => {
        delete process.env.PORT;

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.port).toBe(3000);
      });

      it('should use default WEB_PORT as 3000', () => {
        delete process.env.WEB_PORT;

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.web.port).toBe(3000);
      });

      it('should use default WEB_HOST as 0.0.0.0', () => {
        delete process.env.WEB_HOST;

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.web.host).toBe('0.0.0.0');
      });

      it('should use default CORS_ENABLED as true in development', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.CORS_ENABLED;

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.web.corsEnabled).toBe(true);
      });

      it('should use default CORS_ENABLED as false in production', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.CORS_ENABLED;

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.web.corsEnabled).toBe(false);
      });

      it('should use default WEB_STATIC_PATH', () => {
        delete process.env.WEB_STATIC_PATH;

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.web.staticPath).toBe('./src/web/frontend/dist');
      });

      it('should use default VESTABOARD_LOCAL_API_URL as http://localhost:7000', () => {
        delete process.env.VESTABOARD_LOCAL_API_URL;

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.vestaboard.apiUrl).toBe('http://localhost:7000');
      });

      it('should use default OPENAI_MODEL as gpt-4', () => {
        delete process.env.OPENAI_MODEL;
        process.env.AI_PROVIDER = 'openai';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.ai.openai?.model).toBe('gpt-4');
      });

      it('should use default ANTHROPIC_MODEL as claude-sonnet-4', () => {
        process.env.AI_PROVIDER = 'anthropic';
        process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
        delete process.env.ANTHROPIC_MODEL;

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.ai.anthropic?.model).toBe('claude-sonnet-4');
      });

      it('should use default DATABASE_TYPE as sqlite', () => {
        delete process.env.DATABASE_TYPE;

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.database.type).toBe('sqlite');
      });
    });

    describe('OpenAI provider configuration', () => {
      beforeEach(() => {
        process.env.VESTABOARD_LOCAL_API_KEY = 'test-vestaboard-key';
        process.env.AI_PROVIDER = 'openai';
        process.env.OPENAI_API_KEY = 'sk-test-openai-key';
      });

      it('should load OpenAI configuration when provider is openai', () => {
        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.ai.provider).toBe('openai');
        expect(config.ai.openai).toBeDefined();
        expect(config.ai.openai?.apiKey).toBe('sk-test-openai-key');
        expect(config.ai.anthropic).toBeUndefined();
      });

      it('should load custom OpenAI model', () => {
        process.env.OPENAI_MODEL = 'gpt-4-turbo';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.ai.openai?.model).toBe('gpt-4-turbo');
      });

      it('should not load Anthropic config when provider is openai', () => {
        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.ai.anthropic).toBeUndefined();
      });
    });

    describe('Anthropic provider configuration', () => {
      beforeEach(() => {
        process.env.VESTABOARD_LOCAL_API_KEY = 'test-vestaboard-key';
        process.env.AI_PROVIDER = 'anthropic';
        process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      });

      it('should load Anthropic configuration when provider is anthropic', () => {
        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.ai.provider).toBe('anthropic');
        expect(config.ai.anthropic).toBeDefined();
        expect(config.ai.anthropic?.apiKey).toBe('sk-ant-test-key');
        expect(config.ai.openai).toBeUndefined();
      });

      it('should load custom Anthropic model', () => {
        process.env.ANTHROPIC_MODEL = 'claude-3-opus';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.ai.anthropic?.model).toBe('claude-3-opus');
      });

      it('should not load OpenAI config when provider is anthropic', () => {
        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.ai.openai).toBeUndefined();
      });
    });

    describe('Vestaboard configuration', () => {
      beforeEach(() => {
        process.env.OPENAI_API_KEY = 'sk-test';
      });

      it('should load Vestaboard API key', () => {
        process.env.VESTABOARD_LOCAL_API_KEY = 'test-local-key-123';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.vestaboard.apiKey).toBe('test-local-key-123');
      });

      it('should load custom Vestaboard API URL', () => {
        process.env.VESTABOARD_LOCAL_API_KEY = 'test-key';
        process.env.VESTABOARD_LOCAL_API_URL = 'http://192.168.1.100:7000';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.vestaboard.apiUrl).toBe('http://192.168.1.100:7000');
      });
    });

    describe('Web server configuration', () => {
      beforeEach(() => {
        process.env.VESTABOARD_LOCAL_API_KEY = 'test-key';
        process.env.OPENAI_API_KEY = 'sk-test';
      });

      it('should load custom web port', () => {
        process.env.WEB_PORT = '8080';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.web.port).toBe(8080);
      });

      it('should load custom web host', () => {
        process.env.WEB_HOST = 'localhost';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.web.host).toBe('localhost');
      });

      it('should enable CORS when explicitly set to true', () => {
        process.env.NODE_ENV = 'production';
        process.env.CORS_ENABLED = 'true';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.web.corsEnabled).toBe(true);
      });

      it('should disable CORS when explicitly set to false', () => {
        process.env.NODE_ENV = 'development';
        process.env.CORS_ENABLED = 'false';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.web.corsEnabled).toBe(false);
      });

      it('should load custom static path', () => {
        process.env.WEB_STATIC_PATH = './custom/dist';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.web.staticPath).toBe('./custom/dist');
      });
    });

    describe('Data sources configuration', () => {
      beforeEach(() => {
        process.env.VESTABOARD_LOCAL_API_KEY = 'test-key';
        process.env.OPENAI_API_KEY = 'sk-test';
      });

      it('should load RSS feeds from comma-separated list', () => {
        process.env.RSS_FEEDS = 'https://feed1.com/rss,https://feed2.com/rss,https://feed3.com/rss';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.dataSources.rss?.feeds).toEqual([
          'https://feed1.com/rss',
          'https://feed2.com/rss',
          'https://feed3.com/rss',
        ]);
      });

      it('should return empty array when RSS_FEEDS is empty', () => {
        process.env.RSS_FEEDS = '';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.dataSources.rss?.feeds).toEqual([]);
      });

      it('should load RapidAPI configuration when both key and host are provided', () => {
        process.env.RAPIDAPI_KEY = 'test-rapidapi-key';
        process.env.RAPIDAPI_HOST = 'api.rapidapi.com';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.dataSources.rapidApi).toBeDefined();
        expect(config.dataSources.rapidApi?.apiKey).toBe('test-rapidapi-key');
        expect(config.dataSources.rapidApi?.host).toBe('api.rapidapi.com');
      });

      it('should not load RapidAPI configuration when key is missing', () => {
        delete process.env.RAPIDAPI_KEY;

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.dataSources.rapidApi).toBeUndefined();
      });

      it('should load Home Assistant configuration when both URL and token are provided', () => {
        process.env.HOME_ASSISTANT_URL = 'http://homeassistant.local:8123';
        process.env.HOME_ASSISTANT_TOKEN = 'test-ha-token';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.dataSources.homeAssistant).toBeDefined();
        expect(config.dataSources.homeAssistant?.url).toBe('http://homeassistant.local:8123');
        expect(config.dataSources.homeAssistant?.token).toBe('test-ha-token');
      });

      it('should not load Home Assistant configuration when URL is missing', () => {
        delete process.env.HOME_ASSISTANT_URL;

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.dataSources.homeAssistant).toBeUndefined();
      });
    });

    describe('Database configuration', () => {
      beforeEach(() => {
        process.env.VESTABOARD_LOCAL_API_KEY = 'test-key';
        process.env.OPENAI_API_KEY = 'sk-test';
      });

      it('should load custom database URL', () => {
        process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.database.url).toBe('postgresql://user:pass@localhost:5432/db');
      });

      it('should load custom database type', () => {
        process.env.DATABASE_TYPE = 'postgres';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.database.type).toBe('postgres');
      });

      it('should support mongodb database type', () => {
        process.env.DATABASE_TYPE = 'mongodb';

        const envModule = require('@/config/env');
        const config = envModule.loadConfig();

        expect(config.database.type).toBe('mongodb');
      });
    });
  });

  describe('config export', () => {
    beforeEach(() => {
      // Set minimal required environment
      process.env.VESTABOARD_LOCAL_API_KEY = 'test-vestaboard-key';
      process.env.OPENAI_API_KEY = 'sk-test-openai-key';
    });

    it('should export pre-loaded config object', () => {
      const envModule = require('@/config/env');

      expect(envModule.config).toBeDefined();
      expect(envModule.config.vestaboard).toBeDefined();
      expect(envModule.config.ai).toBeDefined();
      expect(envModule.config.web).toBeDefined();
      expect(envModule.config.dataSources).toBeDefined();
      expect(envModule.config.database).toBeDefined();
    });

    it('should have correct structure in exported config', () => {
      const envModule = require('@/config/env');
      const config = envModule.config;

      // Vestaboard
      expect(config.vestaboard.apiKey).toBe('test-vestaboard-key');
      expect(config.vestaboard.apiUrl).toBe('http://localhost:7000');

      // AI
      expect(config.ai.provider).toBe('openai');
      expect(config.ai.openai?.apiKey).toBe('sk-test-openai-key');

      // Web
      expect(config.web.port).toBe(3000);
      expect(config.web.host).toBe('0.0.0.0');
    });
  });

  describe('EnvironmentConfig interface', () => {
    it('should define correct structure for complete config', () => {
      process.env.VESTABOARD_LOCAL_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'sk-test';

      const envModule = require('@/config/env');
      const config = envModule.loadConfig();

      // Application level
      expect(config).toHaveProperty('nodeEnv');
      expect(config).toHaveProperty('port');

      // Web server
      expect(config.web).toHaveProperty('port');
      expect(config.web).toHaveProperty('host');
      expect(config.web).toHaveProperty('corsEnabled');
      expect(config.web).toHaveProperty('staticPath');

      // Vestaboard
      expect(config.vestaboard).toHaveProperty('apiKey');
      expect(config.vestaboard).toHaveProperty('apiUrl');

      // AI
      expect(config.ai).toHaveProperty('provider');

      // Data sources
      expect(config.dataSources).toHaveProperty('rss');

      // Database
      expect(config.database).toHaveProperty('type');
    });
  });
});
