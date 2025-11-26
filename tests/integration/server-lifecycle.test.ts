/**
 * Integration tests for WebServer lifecycle management
 *
 * Tests environment configuration parsing for WEB_SERVER_ENABLED.
 * This validates the configuration layer integration without requiring
 * actual server instantiation (which would need HTTP mocking).
 */
import { loadConfig } from '../../src/config/env.js';

describe('WebServer Configuration Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('WEB_SERVER_ENABLED configuration', () => {
    it('should parse WEB_SERVER_ENABLED=true as enabled', () => {
      // Arrange
      process.env.WEB_SERVER_ENABLED = 'true';

      // Act
      const config = loadConfig();

      // Assert
      expect(config.web.enabled).toBe(true);
    });

    it('should parse WEB_SERVER_ENABLED=false as disabled', () => {
      // Arrange
      process.env.WEB_SERVER_ENABLED = 'false';

      // Act
      const config = loadConfig();

      // Assert
      expect(config.web.enabled).toBe(false);
    });

    it('should default to enabled when WEB_SERVER_ENABLED is not set', () => {
      // Arrange
      delete process.env.WEB_SERVER_ENABLED;

      // Act
      const config = loadConfig();

      // Assert - should default to true
      expect(config.web.enabled).toBe(true);
    });

    it('should handle WEB_SERVER_ENABLED with other web config', () => {
      // Arrange
      process.env.WEB_SERVER_ENABLED = 'false';
      process.env.WEB_PORT = '8080';
      process.env.WEB_HOST = 'localhost';
      process.env.CORS_ENABLED = 'true';

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
    it('should provide config.web.enabled for conditional server startup', () => {
      // Arrange
      process.env.WEB_SERVER_ENABLED = 'false';

      // Act
      const config = loadConfig();

      // Assert - This is what index.ts would check
      const shouldStartServer = config.web.enabled;
      expect(shouldStartServer).toBe(false);
    });

    it('should maintain backward compatibility when WEB_SERVER_ENABLED is omitted', () => {
      // Arrange - Simulate existing .env files without WEB_SERVER_ENABLED
      delete process.env.WEB_SERVER_ENABLED;
      process.env.WEB_PORT = '3000';

      // Act
      const config = loadConfig();

      // Assert - Server should be enabled by default
      expect(config.web.enabled).toBe(true);
      expect(config.web.port).toBe(3000);
    });
  });
});
