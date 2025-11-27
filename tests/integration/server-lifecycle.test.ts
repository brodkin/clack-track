/**
 * Integration tests for WebServer lifecycle management
 *
 * Tests environment configuration parsing for WEB_SERVER_ENABLED.
 * This validates the configuration layer integration without requiring
 * actual server instantiation (which would need HTTP mocking).
 */

// Mock dotenv.config to prevent loading .env file in tests
jest.mock('dotenv', () => ({
  config: jest.fn(() => ({ parsed: {} })), // Mock returns empty parsed result
}));

describe('WebServer Configuration Integration', () => {
  const originalEnv = { ...process.env };

  // Helper function to load config with fresh module cache
  // We use dynamic import to avoid the require() linting error
  async function getLoadConfigFunction() {
    // Clear the module cache so we get a fresh load with mocked dotenv
    jest.resetModules();

    // Ensure required env vars exist for module loading
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    process.env.NODE_ENV = 'test';

    // Import the function - this will trigger module initialization with current env
    // and mocked dotenv.config (won't load .env file)
    const module = await import('../../src/config/env.js');
    return module.loadConfig;
  }

  beforeEach(() => {
    // Ensure required env vars exist for module loading
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Clear the module cache after each test
    jest.resetModules();
    jest.clearAllMocks();

    // Restore original environment
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  describe('WEB_SERVER_ENABLED configuration', () => {
    it('should parse WEB_SERVER_ENABLED=true as enabled', async () => {
      // Arrange
      process.env.WEB_SERVER_ENABLED = 'true';
      const loadConfig = await getLoadConfigFunction();

      // Act
      const config = loadConfig();

      // Assert
      expect(config.web.enabled).toBe(true);
    });

    it('should parse WEB_SERVER_ENABLED=false as disabled', async () => {
      // Arrange
      process.env.WEB_SERVER_ENABLED = 'false';
      const loadConfig = await getLoadConfigFunction();

      // Act
      const config = loadConfig();

      // Assert
      expect(config.web.enabled).toBe(false);
    });

    it('should default to enabled when WEB_SERVER_ENABLED is not set', async () => {
      // Arrange
      delete process.env.WEB_SERVER_ENABLED;
      const loadConfig = await getLoadConfigFunction();

      // Act
      const config = loadConfig();

      // Assert - should default to true
      expect(config.web.enabled).toBe(true);
    });

    it('should handle WEB_SERVER_ENABLED with other web config', async () => {
      // Arrange
      process.env.WEB_SERVER_ENABLED = 'false';
      process.env.WEB_PORT = '8080';
      process.env.WEB_HOST = 'localhost';
      process.env.CORS_ENABLED = 'true';
      const loadConfig = await getLoadConfigFunction();

      // Act
      const config = loadConfig();

      // Assert - all config should be parsed correctly
      expect(config.web.enabled).toBe(false);
      expect(config.web.port).toBe(8080);
      expect(config.web.host).toBe('localhost');
      expect(config.web.corsEnabled).toBe(true);
    });
  });

  describe('Integration with main application flow', () => {
    it('should provide config.web.enabled for conditional server startup', async () => {
      // Arrange
      process.env.WEB_SERVER_ENABLED = 'false';
      const loadConfig = await getLoadConfigFunction();

      // Act
      const config = loadConfig();

      // Assert - This is what index.ts would check
      const shouldStartServer = config.web.enabled;
      expect(shouldStartServer).toBe(false);
    });

    it('should maintain backward compatibility when WEB_SERVER_ENABLED is omitted', async () => {
      // Arrange - Simulate existing .env files without WEB_SERVER_ENABLED
      delete process.env.WEB_SERVER_ENABLED;
      process.env.WEB_PORT = '3000';
      const loadConfig = await getLoadConfigFunction();

      // Act
      const config = loadConfig();

      // Assert - Server should be enabled by default
      expect(config.web.enabled).toBe(true);
      expect(config.web.port).toBe(3000);
    });
  });
});
