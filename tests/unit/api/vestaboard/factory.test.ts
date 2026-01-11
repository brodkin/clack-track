import { describe, it, expect, beforeEach } from '@jest/globals';
import { createVestaboardClient } from '@/api/vestaboard/index';
import { VestaboardClientImpl } from '@/api/vestaboard/client';
import type { VestaboardClientConfig } from '@/api/vestaboard/types';

describe('Vestaboard Client Factory', () => {
  const MOCK_API_KEY = 'test-api-key-12345';
  const MOCK_API_URL = 'http://localhost:8080/local-api';

  // Note: Trivial constructor existence tests removed.
  // Factory behavior is tested via interface verification and instance independence tests below.

  describe('created client interface', () => {
    let client: ReturnType<typeof createVestaboardClient>;

    beforeEach(() => {
      client = createVestaboardClient({
        apiKey: MOCK_API_KEY,
        apiUrl: MOCK_API_URL,
      });
    });

    it('should implement VestaboardClient interface with sendText method', () => {
      expect(client).toBeDefined();
      expect(client).toHaveProperty('sendText');
      expect(typeof client.sendText).toBe('function');
    });

    it('should implement VestaboardClient interface with sendLayout method', () => {
      expect(client).toHaveProperty('sendLayout');
      expect(typeof client.sendLayout).toBe('function');
    });

    it('should implement VestaboardClient interface with sendLayoutWithAnimation method', () => {
      expect(client).toHaveProperty('sendLayoutWithAnimation');
      expect(typeof client.sendLayoutWithAnimation).toBe('function');
    });

    it('should implement VestaboardClient interface with readMessage method', () => {
      expect(client).toHaveProperty('readMessage');
      expect(typeof client.readMessage).toBe('function');
    });

    it('should implement VestaboardClient interface with validateConnection method', () => {
      expect(client).toHaveProperty('validateConnection');
      expect(typeof client.validateConnection).toBe('function');
    });
  });

  describe('factory pattern consistency', () => {
    it('should create independent client instances', () => {
      const config1: VestaboardClientConfig = {
        apiKey: 'key-1',
        apiUrl: 'http://api1.example.com',
      };
      const config2: VestaboardClientConfig = {
        apiKey: 'key-2',
        apiUrl: 'http://api2.example.com',
      };

      const client1 = createVestaboardClient(config1);
      const client2 = createVestaboardClient(config2);

      expect(client1).not.toBe(client2);
      expect(client1).toBeInstanceOf(VestaboardClientImpl);
      expect(client2).toBeInstanceOf(VestaboardClientImpl);
    });

    it('should create new instance on each call with same config', () => {
      const config: VestaboardClientConfig = {
        apiKey: MOCK_API_KEY,
        apiUrl: MOCK_API_URL,
      };

      const client1 = createVestaboardClient(config);
      const client2 = createVestaboardClient(config);

      expect(client1).not.toBe(client2);
    });
  });
});
