/**
 * Unit tests for bootstrap module
 *
 * Tests the bootstrap() function that wires all Epic 1-6 components together.
 * Uses TDD methodology - tests written before implementation.
 */

// Mock environment configuration before any imports
const mockConfig = {
  nodeEnv: 'test',
  port: 3000,
  web: { enabled: false, port: 3000, host: '0.0.0.0', corsEnabled: false, staticPath: './dist' },
  vestaboard: { apiKey: 'test-key', apiUrl: 'http://localhost:7000' },
  ai: {
    provider: 'openai' as const,
    openai: { apiKey: 'test-openai-key', model: 'gpt-4' },
  },
  dataSources: {},
  database: { type: 'sqlite' as const },
};

jest.mock('../../src/config/env.js', () => ({
  loadConfig: jest.fn(() => mockConfig),
  config: mockConfig,
}));

// Mock AI provider
const mockProvider = {
  generate: jest.fn(),
  validateConnection: jest.fn(),
};

jest.mock('../../src/api/ai/index.js', () => ({
  createAIProvider: jest.fn(() => mockProvider),
  AIProviderType: {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
  },
  ModelTierSelector: jest.fn().mockImplementation(() => ({
    select: jest.fn(),
    getAlternate: jest.fn(),
  })),
}));
jest.mock('../../src/content/registry/register-core.js');
jest.mock('../../src/content/registry/register-notifications.js');
jest.mock('../../src/content/orchestrator.js');
jest.mock('../../src/content/registry/content-selector.js');
jest.mock('../../src/content/frame/frame-decorator.js');
jest.mock('../../src/scheduler/cron.js');
jest.mock('../../src/scheduler/event-handler.js');
jest.mock('../../src/api/data-sources/home-assistant.js');
jest.mock('../../src/api/vestaboard/index.js');
jest.mock('../../src/content/generators/static-fallback-generator.js');
jest.mock('../../src/content/generators/ai/news-generator.js');
jest.mock('../../src/content/generators/ai/weather-generator.js');
jest.mock('../../src/content/generators/minor-update.js');
jest.mock('../../src/content/prompt-loader.js');

// Now import after all mocks are set up
import { bootstrap } from '../../src/bootstrap.js';
import * as envModule from '../../src/config/env.js';
import * as aiModule from '../../src/api/ai/index.js';
import { ContentRegistry } from '../../src/content/registry/content-registry.js';
import * as registerCore from '../../src/content/registry/register-core.js';
import * as registerNotifications from '../../src/content/registry/register-notifications.js';

describe('bootstrap', () => {
  beforeEach(() => {
    // Reset singleton between tests
    ContentRegistry.reset();
    jest.clearAllMocks();
  });

  afterEach(() => {
    ContentRegistry.reset();
  });

  it('should load configuration from env.loadConfig()', async () => {
    // Arrange
    const mockConfig = {
      nodeEnv: 'test',
      port: 3000,
      web: {
        enabled: false,
        port: 3000,
        host: '0.0.0.0',
        corsEnabled: false,
        staticPath: './dist',
      },
      vestaboard: {
        apiKey: 'test-key',
        apiUrl: 'http://localhost:7000',
      },
      ai: {
        provider: 'openai' as const,
        openai: {
          apiKey: 'test-openai-key',
          model: 'gpt-4',
        },
      },
      dataSources: {},
      database: {
        type: 'sqlite' as const,
      },
    };

    (envModule.loadConfig as jest.Mock).mockReturnValue(mockConfig);

    // Act
    await bootstrap();

    // Assert
    expect(envModule.loadConfig).toHaveBeenCalledTimes(1);
  });

  it('should create AI provider using createAIProvider factory', async () => {
    // Arrange
    const mockConfig = {
      nodeEnv: 'test',
      port: 3000,
      web: {
        enabled: false,
        port: 3000,
        host: '0.0.0.0',
        corsEnabled: false,
        staticPath: './dist',
      },
      vestaboard: { apiKey: 'test-key', apiUrl: 'http://localhost:7000' },
      ai: {
        provider: 'openai' as const,
        openai: { apiKey: 'test-openai-key', model: 'gpt-4' },
      },
      dataSources: {},
      database: { type: 'sqlite' as const },
    };

    (envModule.loadConfig as jest.Mock).mockReturnValue(mockConfig);

    const mockProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn(),
    };

    (aiModule.createAIProvider as jest.Mock).mockReturnValue(mockProvider);

    // Act
    await bootstrap();

    // Assert
    expect(aiModule.createAIProvider).toHaveBeenCalledWith(
      aiModule.AIProviderType.OPENAI,
      'test-openai-key',
      'gpt-4'
    );
  });

  it('should populate ContentRegistry using registerCoreContent()', async () => {
    // Arrange
    const mockConfig = {
      nodeEnv: 'test',
      port: 3000,
      web: {
        enabled: false,
        port: 3000,
        host: '0.0.0.0',
        corsEnabled: false,
        staticPath: './dist',
      },
      vestaboard: { apiKey: 'test-key', apiUrl: 'http://localhost:7000' },
      ai: {
        provider: 'openai' as const,
        openai: { apiKey: 'test-openai-key', model: 'gpt-4' },
      },
      dataSources: {},
      database: { type: 'sqlite' as const },
    };

    (envModule.loadConfig as jest.Mock).mockReturnValue(mockConfig);

    const mockProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn(),
    };

    (aiModule.createAIProvider as jest.Mock).mockReturnValue(mockProvider);

    // Act
    await bootstrap();

    // Assert
    expect(registerCore.registerCoreContent).toHaveBeenCalledTimes(1);
    // Verify it was called with ContentRegistry instance
    const callArgs = (registerCore.registerCoreContent as jest.Mock).mock.calls[0];
    expect(callArgs[0]).toBeInstanceOf(ContentRegistry);
  });

  it('should populate ContentRegistry using registerNotifications()', async () => {
    // Arrange
    const mockConfig = {
      nodeEnv: 'test',
      port: 3000,
      web: {
        enabled: false,
        port: 3000,
        host: '0.0.0.0',
        corsEnabled: false,
        staticPath: './dist',
      },
      vestaboard: { apiKey: 'test-key', apiUrl: 'http://localhost:7000' },
      ai: {
        provider: 'openai' as const,
        openai: { apiKey: 'test-openai-key', model: 'gpt-4' },
      },
      dataSources: {},
      database: { type: 'sqlite' as const },
    };

    (envModule.loadConfig as jest.Mock).mockReturnValue(mockConfig);

    const mockProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn(),
    };

    (aiModule.createAIProvider as jest.Mock).mockReturnValue(mockProvider);

    // Act
    await bootstrap();

    // Assert
    expect(registerNotifications.registerNotifications).toHaveBeenCalledTimes(1);
    // Verify it was called with ContentRegistry instance
    const callArgs = (registerNotifications.registerNotifications as jest.Mock).mock.calls[0];
    expect(callArgs[0]).toBeInstanceOf(ContentRegistry);
  });

  it('should return orchestrator, eventHandler, scheduler, and registry', async () => {
    // Arrange
    const mockConfig = {
      nodeEnv: 'test',
      port: 3000,
      web: {
        enabled: false,
        port: 3000,
        host: '0.0.0.0',
        corsEnabled: false,
        staticPath: './dist',
      },
      vestaboard: { apiKey: 'test-key', apiUrl: 'http://localhost:7000' },
      ai: {
        provider: 'openai' as const,
        openai: { apiKey: 'test-openai-key', model: 'gpt-4' },
      },
      dataSources: {},
      database: { type: 'sqlite' as const },
    };

    (envModule.loadConfig as jest.Mock).mockReturnValue(mockConfig);

    const mockProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn(),
    };

    (aiModule.createAIProvider as jest.Mock).mockReturnValue(mockProvider);

    // Act
    const result = await bootstrap();

    // Assert
    expect(result).toHaveProperty('orchestrator');
    expect(result).toHaveProperty('eventHandler');
    expect(result).toHaveProperty('scheduler');
    expect(result).toHaveProperty('registry');
  });

  it('should return contentRepository, voteRepository, and logModel when database configured', async () => {
    // Arrange
    const mockConfig = {
      nodeEnv: 'test',
      port: 3000,
      web: {
        enabled: false,
        port: 3000,
        host: '0.0.0.0',
        corsEnabled: false,
        staticPath: './dist',
      },
      vestaboard: { apiKey: 'test-key', apiUrl: 'http://localhost:7000' },
      ai: {
        provider: 'openai' as const,
        openai: { apiKey: 'test-openai-key', model: 'gpt-4' },
      },
      dataSources: {},
      database: { type: 'sqlite' as const },
    };

    (envModule.loadConfig as jest.Mock).mockReturnValue(mockConfig);

    const mockProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn(),
    };

    (aiModule.createAIProvider as jest.Mock).mockReturnValue(mockProvider);

    // Act
    const result = await bootstrap();

    // Assert - In test environment, database is always configured (in-memory)
    expect(result).toHaveProperty('contentRepository');
    expect(result).toHaveProperty('voteRepository');
    expect(result).toHaveProperty('logModel');
    expect(result.contentRepository).toBeDefined();
    expect(result.voteRepository).toBeDefined();
    expect(result.logModel).toBeDefined();
  });

  it('should handle missing Vestaboard config gracefully', async () => {
    // Arrange
    const mockConfig = {
      nodeEnv: 'test',
      port: 3000,
      web: {
        enabled: false,
        port: 3000,
        host: '0.0.0.0',
        corsEnabled: false,
        staticPath: './dist',
      },
      vestaboard: undefined, // Missing Vestaboard config
      ai: {
        provider: 'openai' as const,
        openai: { apiKey: 'test-openai-key', model: 'gpt-4' },
      },
      dataSources: {},
      database: { type: 'sqlite' as const },
    };

    (envModule.loadConfig as jest.Mock).mockReturnValue(mockConfig);

    const mockProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn(),
    };

    (aiModule.createAIProvider as jest.Mock).mockReturnValue(mockProvider);

    // Act & Assert
    await expect(bootstrap()).rejects.toThrow('Vestaboard configuration is required');
  });

  it('should handle optional Home Assistant configuration (not required)', async () => {
    // Arrange
    const mockConfig = {
      nodeEnv: 'test',
      port: 3000,
      web: {
        enabled: false,
        port: 3000,
        host: '0.0.0.0',
        corsEnabled: false,
        staticPath: './dist',
      },
      vestaboard: { apiKey: 'test-key', apiUrl: 'http://localhost:7000' },
      ai: {
        provider: 'openai' as const,
        openai: { apiKey: 'test-openai-key', model: 'gpt-4' },
      },
      dataSources: {
        homeAssistant: undefined, // Optional, should not throw
      },
      database: { type: 'sqlite' as const },
    };

    (envModule.loadConfig as jest.Mock).mockReturnValue(mockConfig);

    const mockProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn(),
    };

    (aiModule.createAIProvider as jest.Mock).mockReturnValue(mockProvider);

    // Act
    const result = await bootstrap();

    // Assert - should succeed without HA
    expect(result).toHaveProperty('orchestrator');
    expect(result).toHaveProperty('registry');
    // eventHandler should be null when HA not configured
    expect(result.eventHandler).toBeNull();
  });

  it('should create eventHandler when Home Assistant is configured', async () => {
    // Arrange
    const mockConfig = {
      nodeEnv: 'test',
      port: 3000,
      web: {
        enabled: false,
        port: 3000,
        host: '0.0.0.0',
        corsEnabled: false,
        staticPath: './dist',
      },
      vestaboard: { apiKey: 'test-key', apiUrl: 'http://localhost:7000' },
      ai: {
        provider: 'openai' as const,
        openai: { apiKey: 'test-openai-key', model: 'gpt-4' },
      },
      dataSources: {
        homeAssistant: {
          url: 'http://homeassistant.local:8123',
          token: 'test-token',
          websocketUrl: 'ws://homeassistant.local:8123/api/websocket',
        },
      },
      database: { type: 'sqlite' as const },
    };

    (envModule.loadConfig as jest.Mock).mockReturnValue(mockConfig);

    const mockProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn(),
    };

    (aiModule.createAIProvider as jest.Mock).mockReturnValue(mockProvider);

    // Act
    const result = await bootstrap();

    // Assert
    expect(result.eventHandler).not.toBeNull();
    expect(result.eventHandler).toBeDefined();
  });

  it('should handle missing AI configuration', async () => {
    // Arrange
    const mockConfig = {
      nodeEnv: 'test',
      port: 3000,
      web: {
        enabled: false,
        port: 3000,
        host: '0.0.0.0',
        corsEnabled: false,
        staticPath: './dist',
      },
      vestaboard: { apiKey: 'test-key', apiUrl: 'http://localhost:7000' },
      ai: {
        provider: 'openai' as const,
        openai: undefined, // Missing OpenAI config when provider is openai
      },
      dataSources: {},
      database: { type: 'sqlite' as const },
    };

    (envModule.loadConfig as jest.Mock).mockReturnValue(mockConfig);

    // Act & Assert
    await expect(bootstrap()).rejects.toThrow('AI provider configuration is required');
  });

  it('should support anthropic as AI provider', async () => {
    // Arrange
    const mockConfig = {
      nodeEnv: 'test',
      port: 3000,
      web: {
        enabled: false,
        port: 3000,
        host: '0.0.0.0',
        corsEnabled: false,
        staticPath: './dist',
      },
      vestaboard: { apiKey: 'test-key', apiUrl: 'http://localhost:7000' },
      ai: {
        provider: 'anthropic' as const,
        anthropic: { apiKey: 'test-anthropic-key', model: 'claude-sonnet-4' },
      },
      dataSources: {},
      database: { type: 'sqlite' as const },
    };

    (envModule.loadConfig as jest.Mock).mockReturnValue(mockConfig);

    const mockProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn(),
    };

    (aiModule.createAIProvider as jest.Mock).mockReturnValue(mockProvider);

    // Act
    await bootstrap();

    // Assert
    expect(aiModule.createAIProvider).toHaveBeenCalledWith(
      aiModule.AIProviderType.ANTHROPIC,
      'test-anthropic-key',
      'claude-sonnet-4'
    );
  });

  it('should create primary provider (openai) first, then alternate provider (anthropic)', async () => {
    // Arrange
    const mockConfig = {
      nodeEnv: 'test',
      port: 3000,
      web: {
        enabled: false,
        port: 3000,
        host: '0.0.0.0',
        corsEnabled: false,
        staticPath: './dist',
      },
      vestaboard: { apiKey: 'test-key', apiUrl: 'http://localhost:7000' },
      ai: {
        provider: 'openai' as const,
        openai: { apiKey: 'test-openai-key', model: 'gpt-4' },
        anthropic: { apiKey: 'test-anthropic-key', model: 'claude-sonnet-4' }, // Both configured
      },
      dataSources: {},
      database: { type: 'sqlite' as const },
    };

    (envModule.loadConfig as jest.Mock).mockReturnValue(mockConfig);

    const mockProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn(),
    };

    (aiModule.createAIProvider as jest.Mock).mockReturnValue(mockProvider);

    // Act
    await bootstrap();

    // Assert
    const calls = (aiModule.createAIProvider as jest.Mock).mock.calls;

    // Verify that createAIProvider was called exactly twice
    expect(calls.length).toBe(2);

    // Verify PRIMARY provider (OpenAI) is called FIRST
    expect(calls[0][0]).toBe(aiModule.AIProviderType.OPENAI);
    expect(calls[0][1]).toBe('test-openai-key');
    expect(calls[0][2]).toBe('gpt-4');

    // Verify ALTERNATE provider (Anthropic) is called SECOND
    expect(calls[1][0]).toBe(aiModule.AIProviderType.ANTHROPIC);
    expect(calls[1][1]).toBe('test-anthropic-key');
    expect(calls[1][2]).toBe('claude-sonnet-4');
  });

  it('should create primary provider (anthropic) first, then alternate provider (openai)', async () => {
    // Arrange
    const mockConfig = {
      nodeEnv: 'test',
      port: 3000,
      web: {
        enabled: false,
        port: 3000,
        host: '0.0.0.0',
        corsEnabled: false,
        staticPath: './dist',
      },
      vestaboard: { apiKey: 'test-key', apiUrl: 'http://localhost:7000' },
      ai: {
        provider: 'anthropic' as const,
        openai: { apiKey: 'test-openai-key', model: 'gpt-4' }, // Both configured
        anthropic: { apiKey: 'test-anthropic-key', model: 'claude-sonnet-4' },
      },
      dataSources: {},
      database: { type: 'sqlite' as const },
    };

    (envModule.loadConfig as jest.Mock).mockReturnValue(mockConfig);

    const mockProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn(),
    };

    (aiModule.createAIProvider as jest.Mock).mockReturnValue(mockProvider);

    // Act
    await bootstrap();

    // Assert
    const calls = (aiModule.createAIProvider as jest.Mock).mock.calls;

    // Verify that createAIProvider was called exactly twice
    expect(calls.length).toBe(2);

    // Verify PRIMARY provider (Anthropic) is called FIRST
    expect(calls[0][0]).toBe(aiModule.AIProviderType.ANTHROPIC);
    expect(calls[0][1]).toBe('test-anthropic-key');
    expect(calls[0][2]).toBe('claude-sonnet-4');

    // Verify ALTERNATE provider (OpenAI) is called SECOND
    expect(calls[1][0]).toBe(aiModule.AIProviderType.OPENAI);
    expect(calls[1][1]).toBe('test-openai-key');
    expect(calls[1][2]).toBe('gpt-4');
  });
});
