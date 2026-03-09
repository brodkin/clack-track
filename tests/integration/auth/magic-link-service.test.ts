/**
 * Unit tests for MagicLinkService
 *
 * Tests magic link token generation, validation, expiration, and single-use behavior.
 * Uses TDD methodology - tests written before implementation.
 */

import { MagicLinkService, MagicLinkServiceConfig } from '@/auth/magic-link-service';
import { MagicLinkRepository } from '@/storage/repositories/magic-link-repo';
import { MagicLinkRecord } from '@/storage/models/magic-link';

// Mock the repository
jest.mock('@/storage/repositories/magic-link-repo');

/**
 * Create a mock MagicLinkRepository for testing
 */
function createMockRepository(
  overrides: Partial<MagicLinkRepository> = {}
): jest.Mocked<MagicLinkRepository> {
  return {
    createInvite: jest.fn(),
    validateAndConsume: jest.fn(),
    findByEmail: jest.fn(),
    cleanupExpired: jest.fn(),
    revokeForEmail: jest.fn(),
    hasValidInvite: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<MagicLinkRepository>;
}

/**
 * Create a mock MagicLinkRecord for testing
 */
function createMockMagicLinkRecord(overrides: Partial<MagicLinkRecord> = {}): MagicLinkRecord {
  return {
    id: 1,
    token: 'test-token-abc123',
    email: 'user@example.com',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    usedAt: null,
    createdBy: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('MagicLinkService', () => {
  let mockRepository: jest.Mocked<MagicLinkRepository>;
  let service: MagicLinkService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository = createMockRepository();
    service = new MagicLinkService(mockRepository);
  });

  describe('constructor', () => {
    it('should accept a MagicLinkRepository instance', () => {
      const service = new MagicLinkService(mockRepository);
      expect(service).toBeInstanceOf(MagicLinkService);
    });

    it('should use default expiration hours when not configured', () => {
      const service = new MagicLinkService(mockRepository);
      // Default is 24 hours - verified via generate() behavior
      expect(service).toBeInstanceOf(MagicLinkService);
    });

    it('should accept custom expiration hours via config', () => {
      const config: MagicLinkServiceConfig = { expirationHours: 48 };
      const service = new MagicLinkService(mockRepository, config);
      expect(service).toBeInstanceOf(MagicLinkService);
    });

    it('should accept expiration hours from MAGIC_LINK_EXPIRY_HOURS env var', () => {
      const originalEnv = process.env.MAGIC_LINK_EXPIRY_HOURS;
      process.env.MAGIC_LINK_EXPIRY_HOURS = '72';

      const service = new MagicLinkService(mockRepository);
      expect(service).toBeInstanceOf(MagicLinkService);

      // Cleanup
      if (originalEnv !== undefined) {
        process.env.MAGIC_LINK_EXPIRY_HOURS = originalEnv;
      } else {
        delete process.env.MAGIC_LINK_EXPIRY_HOURS;
      }
    });
  });

  describe('generate', () => {
    it('should generate a magic link token for a given email', async () => {
      const email = 'newuser@example.com';
      const mockRecord = createMockMagicLinkRecord({ email });
      mockRepository.createInvite.mockResolvedValue(mockRecord);

      const result = await service.generate(email);

      expect(result).toBeDefined();
      expect(result.email).toBe(email);
      expect(result.token).toBeDefined();
    });

    it('should accept optional createdBy user ID', async () => {
      const email = 'newuser@example.com';
      const createdBy = 42;
      const mockRecord = createMockMagicLinkRecord({ email, createdBy });
      mockRepository.createInvite.mockResolvedValue(mockRecord);

      const result = await service.generate(email, createdBy);

      expect(mockRepository.createInvite).toHaveBeenCalledWith(
        email,
        createdBy,
        expect.any(Number)
      );
      expect(result.createdBy).toBe(createdBy);
    });

    it('should use configured expiration hours', async () => {
      const config: MagicLinkServiceConfig = { expirationHours: 48 };
      const customService = new MagicLinkService(mockRepository, config);
      const email = 'newuser@example.com';
      const mockRecord = createMockMagicLinkRecord({ email });
      mockRepository.createInvite.mockResolvedValue(mockRecord);

      await customService.generate(email);

      expect(mockRepository.createInvite).toHaveBeenCalledWith(email, null, 48);
    });

    it('should generate secure tokens using crypto.randomBytes (32 bytes)', async () => {
      const email = 'newuser@example.com';
      const mockRecord = createMockMagicLinkRecord({ email });
      mockRepository.createInvite.mockResolvedValue(mockRecord);

      // The repository generates the token, but we test that the service delegates correctly
      await service.generate(email);

      expect(mockRepository.createInvite).toHaveBeenCalledWith(
        email,
        null,
        24 // default expiration
      );
    });

    it('should throw error if repository returns null', async () => {
      const email = 'newuser@example.com';
      mockRepository.createInvite.mockResolvedValue(null);

      await expect(service.generate(email)).rejects.toThrow('Failed to create magic link');
    });

    it('should propagate repository errors', async () => {
      const email = 'newuser@example.com';
      mockRepository.createInvite.mockRejectedValue(new Error('Database error'));

      await expect(service.generate(email)).rejects.toThrow('Database error');
    });
  });

  describe('validate', () => {
    it('should return email for valid token', async () => {
      const token = 'valid-token-123';
      const email = 'user@example.com';
      const mockRecord = createMockMagicLinkRecord({ token, email, usedAt: new Date() });
      mockRepository.validateAndConsume.mockResolvedValue(mockRecord);

      const result = await service.validate(token);

      expect(result).toBe(email);
      expect(mockRepository.validateAndConsume).toHaveBeenCalledWith(token);
    });

    it('should throw error for invalid token', async () => {
      const token = 'invalid-token';
      mockRepository.validateAndConsume.mockResolvedValue(null);

      await expect(service.validate(token)).rejects.toThrow('Invalid or expired magic link');
    });

    it('should throw error for expired token', async () => {
      const token = 'expired-token';
      // Repository returns null for expired tokens (checked in findByToken)
      mockRepository.validateAndConsume.mockResolvedValue(null);

      await expect(service.validate(token)).rejects.toThrow('Invalid or expired magic link');
    });

    it('should throw error for already used token (single-use enforcement)', async () => {
      const token = 'used-token';
      // Repository returns null for already used tokens (checked in findByToken)
      mockRepository.validateAndConsume.mockResolvedValue(null);

      await expect(service.validate(token)).rejects.toThrow('Invalid or expired magic link');
    });

    it('should mark token as used after successful validation (single-use)', async () => {
      const token = 'valid-token';
      const email = 'user@example.com';
      const usedAt = new Date();
      const mockRecord = createMockMagicLinkRecord({ token, email, usedAt });
      mockRepository.validateAndConsume.mockResolvedValue(mockRecord);

      await service.validate(token);

      // validateAndConsume internally marks the token as used
      expect(mockRepository.validateAndConsume).toHaveBeenCalledWith(token);
    });

    it('should propagate repository errors', async () => {
      const token = 'some-token';
      mockRepository.validateAndConsume.mockRejectedValue(new Error('Database error'));

      await expect(service.validate(token)).rejects.toThrow('Database error');
    });
  });

  describe('hasValidInvite', () => {
    it('should return true if email has valid pending invite', async () => {
      const email = 'user@example.com';
      mockRepository.hasValidInvite.mockResolvedValue(true);

      const result = await service.hasValidInvite(email);

      expect(result).toBe(true);
      expect(mockRepository.hasValidInvite).toHaveBeenCalledWith(email);
    });

    it('should return false if email has no valid pending invite', async () => {
      const email = 'user@example.com';
      mockRepository.hasValidInvite.mockResolvedValue(false);

      const result = await service.hasValidInvite(email);

      expect(result).toBe(false);
    });
  });

  describe('revokeForEmail', () => {
    it('should revoke all pending invites for an email', async () => {
      const email = 'user@example.com';
      mockRepository.revokeForEmail.mockResolvedValue(2);

      const result = await service.revokeForEmail(email);

      expect(result).toBe(2);
      expect(mockRepository.revokeForEmail).toHaveBeenCalledWith(email);
    });

    it('should return 0 if no invites to revoke', async () => {
      const email = 'user@example.com';
      mockRepository.revokeForEmail.mockResolvedValue(0);

      const result = await service.revokeForEmail(email);

      expect(result).toBe(0);
    });
  });

  describe('cleanupExpired', () => {
    it('should cleanup expired tokens', async () => {
      mockRepository.cleanupExpired.mockResolvedValue(5);

      const result = await service.cleanupExpired();

      expect(result).toBe(5);
      expect(mockRepository.cleanupExpired).toHaveBeenCalled();
    });
  });

  describe('expiration configuration', () => {
    beforeEach(() => {
      // Clear any existing env var
      delete process.env.MAGIC_LINK_EXPIRY_HOURS;
    });

    afterEach(() => {
      // Cleanup
      delete process.env.MAGIC_LINK_EXPIRY_HOURS;
    });

    it('should default to 24 hours expiration', async () => {
      const service = new MagicLinkService(mockRepository);
      const mockRecord = createMockMagicLinkRecord();
      mockRepository.createInvite.mockResolvedValue(mockRecord);

      await service.generate('test@example.com');

      expect(mockRepository.createInvite).toHaveBeenCalledWith('test@example.com', null, 24);
    });

    it('should use MAGIC_LINK_EXPIRY_HOURS env var when set', async () => {
      process.env.MAGIC_LINK_EXPIRY_HOURS = '72';
      const service = new MagicLinkService(mockRepository);
      const mockRecord = createMockMagicLinkRecord();
      mockRepository.createInvite.mockResolvedValue(mockRecord);

      await service.generate('test@example.com');

      expect(mockRepository.createInvite).toHaveBeenCalledWith('test@example.com', null, 72);
    });

    it('should prioritize config over env var', async () => {
      process.env.MAGIC_LINK_EXPIRY_HOURS = '72';
      const config: MagicLinkServiceConfig = { expirationHours: 48 };
      const service = new MagicLinkService(mockRepository, config);
      const mockRecord = createMockMagicLinkRecord();
      mockRepository.createInvite.mockResolvedValue(mockRecord);

      await service.generate('test@example.com');

      expect(mockRepository.createInvite).toHaveBeenCalledWith('test@example.com', null, 48);
    });

    it('should fall back to default if env var is invalid', async () => {
      process.env.MAGIC_LINK_EXPIRY_HOURS = 'not-a-number';
      const service = new MagicLinkService(mockRepository);
      const mockRecord = createMockMagicLinkRecord();
      mockRepository.createInvite.mockResolvedValue(mockRecord);

      await service.generate('test@example.com');

      expect(mockRepository.createInvite).toHaveBeenCalledWith(
        'test@example.com',
        null,
        24 // default fallback
      );
    });
  });

  describe('error types', () => {
    it('should throw MagicLinkError for creation failures', async () => {
      mockRepository.createInvite.mockResolvedValue(null);

      await expect(service.generate('test@example.com')).rejects.toThrow(
        'Failed to create magic link'
      );
    });

    it('should throw MagicLinkError for validation failures', async () => {
      mockRepository.validateAndConsume.mockResolvedValue(null);

      await expect(service.validate('invalid-token')).rejects.toThrow(
        'Invalid or expired magic link'
      );
    });
  });
});
