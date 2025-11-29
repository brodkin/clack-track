/**
 * Tests for ContentRepository
 * Verifies repository pattern wrapping ContentModel with graceful error handling
 */

import { ContentRepository } from '../../../src/storage/repositories/content-repo.js';
import { ContentModel } from '../../../src/storage/models/content.ts';
import type { ContentRecord } from '../../../src/storage/models/content.js';

// Mock ContentModel
jest.mock('../../../src/storage/models/content.ts');

describe('ContentRepository', () => {
  let repository: ContentRepository;
  let mockModel: jest.Mocked<ContentModel>;

  beforeEach(() => {
    // Create mock model instance
    mockModel = {
      create: jest.fn(),
      findLatest: jest.fn(),
      findByStatus: jest.fn(),
      findFailures: jest.fn(),
      findById: jest.fn(),
      findByType: jest.fn(),
      findLatestSent: jest.fn(),
      markSent: jest.fn(),
      deleteOlderThan: jest.fn(),
    } as unknown as jest.Mocked<ContentModel>;

    // Create repository with mocked model
    repository = new ContentRepository(mockModel);
  });

  describe('save()', () => {
    it('should save content record via model', async () => {
      const contentData: Omit<ContentRecord, 'id'> = {
        text: 'Test content',
        type: 'major',
        generatedAt: new Date('2025-11-28T10:00:00Z'),
        sentAt: new Date('2025-11-28T10:00:05Z'),
        aiProvider: 'openai',
        status: 'success',
        generatorId: 'motivational',
        generatorName: 'Motivational Generator',
        priority: 2,
        aiModel: 'gpt-4.1-mini',
        modelTier: 'MEDIUM',
      };

      const savedRecord: ContentRecord = { id: 1, ...contentData };
      mockModel.create.mockResolvedValue(savedRecord);

      await repository.save(contentData);

      expect(mockModel.create).toHaveBeenCalledWith(contentData);
    });

    it('should handle database errors gracefully without throwing', async () => {
      const contentData: Omit<ContentRecord, 'id'> = {
        text: 'Test content',
        type: 'major',
        generatedAt: new Date(),
        sentAt: new Date(),
        aiProvider: 'openai',
      };

      const dbError = new Error('Database connection lost');
      mockModel.create.mockRejectedValue(dbError);

      // Repository should NOT throw - fire-and-forget pattern
      await expect(repository.save(contentData)).resolves.toBeUndefined();
    });

    it('should log errors when save fails', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const contentData: Omit<ContentRecord, 'id'> = {
        text: 'Test',
        type: 'major',
        generatedAt: new Date(),
        sentAt: null,
        aiProvider: 'openai',
      };

      mockModel.create.mockRejectedValue(new Error('Connection timeout'));

      await repository.save(contentData);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save content to database'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('findLatest()', () => {
    it('should fetch latest records via model', async () => {
      const mockRecords: ContentRecord[] = [
        {
          id: 2,
          text: 'Latest',
          type: 'major',
          generatedAt: new Date('2025-11-28T11:00:00Z'),
          sentAt: new Date('2025-11-28T11:00:05Z'),
          aiProvider: 'openai',
        },
        {
          id: 1,
          text: 'Older',
          type: 'major',
          generatedAt: new Date('2025-11-28T10:00:00Z'),
          sentAt: new Date('2025-11-28T10:00:05Z'),
          aiProvider: 'anthropic',
        },
      ];

      mockModel.findLatest.mockResolvedValue(mockRecords);

      const result = await repository.findLatest(10);

      expect(mockModel.findLatest).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockRecords);
    });

    it('should return empty array on database error', async () => {
      mockModel.findLatest.mockRejectedValue(new Error('Query failed'));

      const result = await repository.findLatest(5);

      expect(result).toEqual([]);
    });

    it('should log errors when fetch fails', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockModel.findLatest.mockRejectedValue(new Error('Database locked'));

      await repository.findLatest(10);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch latest content'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('findByStatus()', () => {
    it('should fetch records by status via model', async () => {
      const mockRecords: ContentRecord[] = [
        {
          id: 3,
          text: 'Failed content',
          type: 'major',
          generatedAt: new Date(),
          sentAt: null,
          aiProvider: 'openai',
          status: 'failed',
          errorType: 'RateLimitError',
          errorMessage: 'Too many requests',
        },
      ];

      mockModel.findByStatus.mockResolvedValue(mockRecords);

      const result = await repository.findByStatus('failed', 20);

      expect(mockModel.findByStatus).toHaveBeenCalledWith('failed', 20);
      expect(result).toEqual(mockRecords);
    });

    it('should return empty array on database error', async () => {
      mockModel.findByStatus.mockRejectedValue(new Error('Network timeout'));

      const result = await repository.findByStatus('success', 10);

      expect(result).toEqual([]);
    });
  });

  describe('findFailures()', () => {
    it('should delegate to findByStatus with failed status', async () => {
      const mockFailures: ContentRecord[] = [
        {
          id: 4,
          text: 'Error content',
          type: 'major',
          generatedAt: new Date(),
          sentAt: null,
          aiProvider: 'anthropic',
          status: 'failed',
        },
      ];

      mockModel.findFailures.mockResolvedValue(mockFailures);

      const result = await repository.findFailures(15);

      expect(mockModel.findFailures).toHaveBeenCalledWith(15);
      expect(result).toEqual(mockFailures);
    });

    it('should return empty array on database error', async () => {
      mockModel.findFailures.mockRejectedValue(new Error('Connection lost'));

      const result = await repository.findFailures(10);

      expect(result).toEqual([]);
    });

    it('should log errors when failures fetch fails', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockModel.findFailures.mockRejectedValue(new Error('Query timeout'));

      await repository.findFailures(10);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch failures'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
