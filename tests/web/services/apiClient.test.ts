/**
 * API Client Test Suite
 *
 * Tests the type-safe HTTP client for all API endpoints
 */

import { apiClient } from '../../../src/web/frontend/services/apiClient.js';
import { ApiError } from '../../../src/web/frontend/services/types.js';
import type { ContentRecord } from '../../../src/storage/models/content.js';
import type { VoteRecord } from '../../../src/storage/models/vote.js';
import type { LogRecord } from '../../../src/storage/models/log.js';

// Mock fetch globally
global.fetch = jest.fn();

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLatestContent', () => {
    it('should fetch the latest content successfully', async () => {
      const mockContent: ContentRecord = {
        id: 123,
        text: 'Motivational Quote',
        type: 'major',
        generatedAt: new Date('2025-01-01T12:00:00Z'),
        sentAt: new Date('2025-01-01T12:01:00Z'),
        aiProvider: 'openai',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { content: mockContent },
        }),
      });

      const result = await apiClient.getLatestContent();

      expect(global.fetch).toHaveBeenCalledWith('/api/content/latest', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      expect(result.success).toBe(true);
      expect(result.data?.content).toEqual(mockContent);
    });

    it('should handle no content available', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { content: null },
        }),
      });

      const result = await apiClient.getLatestContent();

      expect(result.success).toBe(true);
      expect(result.data?.content).toBeNull();
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          success: false,
          error: 'Database connection failed',
        }),
      });

      await expect(apiClient.getLatestContent()).rejects.toThrow(
        'API Error (500): Database connection failed'
      );
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      await expect(apiClient.getLatestContent()).rejects.toThrow('Network failure');
    });
  });

  describe('getContentHistory', () => {
    it('should fetch content history with default params', async () => {
      const mockContents: ContentRecord[] = [
        {
          id: 1,
          text: 'Quote 1',
          type: 'major',
          generatedAt: new Date('2025-01-01T12:00:00Z'),
          sentAt: new Date('2025-01-01T12:01:00Z'),
          aiProvider: 'openai',
        },
        {
          id: 2,
          text: 'Quote 2',
          type: 'minor',
          generatedAt: new Date('2025-01-01T13:00:00Z'),
          sentAt: new Date('2025-01-01T13:01:00Z'),
          aiProvider: 'anthropic',
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { contents: mockContents, total: 2 },
        }),
      });

      const result = await apiClient.getContentHistory();

      expect(global.fetch).toHaveBeenCalledWith('/api/content/history', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      expect(result.success).toBe(true);
      expect(result.data?.contents).toHaveLength(2);
      expect(result.data?.total).toBe(2);
    });

    it('should fetch content history with limit param', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { contents: [], total: 0 },
        }),
      });

      await apiClient.getContentHistory({ limit: 5 });

      expect(global.fetch).toHaveBeenCalledWith('/api/content/history?limit=5', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should fetch content history with type filter', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { contents: [], total: 0 },
        }),
      });

      await apiClient.getContentHistory({ type: 'major' });

      expect(global.fetch).toHaveBeenCalledWith('/api/content/history?type=major', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should fetch content history with multiple params', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { contents: [], total: 0 },
        }),
      });

      await apiClient.getContentHistory({ limit: 10, type: 'minor' });

      expect(global.fetch).toHaveBeenCalledWith('/api/content/history?limit=10&type=minor', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle empty history', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { contents: [], total: 0 },
        }),
      });

      const result = await apiClient.getContentHistory();

      expect(result.success).toBe(true);
      expect(result.data?.contents).toEqual([]);
      expect(result.data?.total).toBe(0);
    });
  });

  describe('submitVote', () => {
    it('should submit a good vote successfully', async () => {
      const mockVote: VoteRecord = {
        id: 123,
        contentId: 'content-123',
        vote: 'good',
        votedAt: new Date('2025-01-01T12:00:00Z'),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: { vote: mockVote },
        }),
      });

      const result = await apiClient.submitVote({
        contentId: 'content-123',
        vote: 'good',
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId: 'content-123',
          vote: 'good',
        }),
      });
      expect(result.success).toBe(true);
      expect(result.data?.vote).toEqual(mockVote);
    });

    it('should submit a bad vote successfully', async () => {
      const mockVote: VoteRecord = {
        id: 456,
        contentId: 'content-123',
        vote: 'bad',
        votedAt: new Date('2025-01-01T12:00:00Z'),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: { vote: mockVote },
        }),
      });

      const result = await apiClient.submitVote({
        contentId: 'content-123',
        vote: 'bad',
      });

      expect(result.success).toBe(true);
      expect(result.data?.vote.vote).toBe('bad');
    });

    it('should handle validation errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          success: false,
          error: 'Invalid vote value',
        }),
      });

      await expect(
        apiClient.submitVote({ contentId: 'content-123', vote: 'good' })
      ).rejects.toThrow('API Error (400): Invalid vote value');
    });

    it('should handle missing contentId', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          success: false,
          error: 'Content ID is required',
        }),
      });

      await expect(apiClient.submitVote({ contentId: '', vote: 'good' })).rejects.toThrow(
        'API Error (400): Content ID is required'
      );
    });
  });

  describe('getLogs', () => {
    it('should fetch logs with default params', async () => {
      const mockLogs: LogRecord[] = [
        {
          id: 1,
          level: 'info',
          message: 'Content generated successfully',
          timestamp: new Date('2025-01-01T12:00:00Z'),
        },
        {
          id: 2,
          level: 'error',
          message: 'Failed to send to Vestaboard',
          timestamp: new Date('2025-01-01T12:01:00Z'),
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { logs: mockLogs, total: 2 },
        }),
      });

      const result = await apiClient.getLogs();

      expect(global.fetch).toHaveBeenCalledWith('/api/logs', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      expect(result.success).toBe(true);
      expect(result.data?.logs).toHaveLength(2);
      expect(result.data?.total).toBe(2);
    });

    it('should fetch logs with level filter', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { logs: [], total: 0 },
        }),
      });

      await apiClient.getLogs({ level: 'error' });

      expect(global.fetch).toHaveBeenCalledWith('/api/logs?level=error', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should fetch logs with limit param', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { logs: [], total: 0 },
        }),
      });

      await apiClient.getLogs({ limit: 50 });

      expect(global.fetch).toHaveBeenCalledWith('/api/logs?limit=50', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should fetch logs with multiple filters', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { logs: [], total: 0 },
        }),
      });

      await apiClient.getLogs({ level: 'warn', limit: 25 });

      expect(global.fetch).toHaveBeenCalledWith('/api/logs?level=warn&limit=25', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle empty logs', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { logs: [], total: 0 },
        }),
      });

      const result = await apiClient.getLogs();

      expect(result.success).toBe(true);
      expect(result.data?.logs).toEqual([]);
    });
  });

  describe('ApiError', () => {
    it('should create ApiError with all properties', () => {
      const error = new ApiError('Test error', 500, { details: 'Server error' });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.response).toEqual({ details: 'Server error' });
      expect(error.name).toBe('ApiError');
    });

    it('should create ApiError without optional properties', () => {
      const error = new ApiError('Simple error');

      expect(error.message).toBe('Simple error');
      expect(error.statusCode).toBeUndefined();
      expect(error.response).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          success: false,
          error: 'Resource not found',
        }),
      });

      await expect(apiClient.getLatestContent()).rejects.toThrow(
        'API Error (404): Resource not found'
      );
    });

    it('should handle 500 errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          success: false,
          error: 'Internal server error',
        }),
      });

      await expect(apiClient.getLatestContent()).rejects.toThrow(
        'API Error (500): Internal server error'
      );
    });

    it('should handle responses without error messages', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({
          success: false,
        }),
      });

      await expect(apiClient.getLatestContent()).rejects.toThrow(
        'API Error (503): Service Unavailable'
      );
    });

    it('should handle malformed JSON responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(apiClient.getLatestContent()).rejects.toThrow('Invalid JSON');
    });

    it('should handle network timeouts', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Request timeout'));

      await expect(apiClient.getLatestContent()).rejects.toThrow('Request timeout');
    });
  });
});
