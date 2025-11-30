/**
 * Tests for push notification service
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  isSupported,
  requestPermission,
  subscribe,
  unsubscribe,
  getSubscription,
} from '@/web/frontend/services/pushService.js';

// Mock service worker and push manager
const mockServiceWorkerRegistration: any = {
  pushManager: {
    subscribe: jest.fn(),
    getSubscription: jest.fn(),
  },
};

const mockServiceWorker: any = {
  register: jest.fn(),
  ready: Promise.resolve(mockServiceWorkerRegistration),
};

// Store original values for restoration
const originalNavigatorServiceWorker = Object.getOwnPropertyDescriptor(
  global.navigator,
  'serviceWorker'
);
const originalWindowPushManager = Object.getOwnPropertyDescriptor(global.window, 'PushManager');
const originalWindowNotification = Object.getOwnPropertyDescriptor(global.window, 'Notification');
const originalGlobalNotification = Object.getOwnPropertyDescriptor(global, 'Notification');

// Setup global mocks
beforeEach(() => {
  jest.clearAllMocks();

  // Mock PushManager on window
  Object.defineProperty(global.window, 'PushManager', {
    value: jest.fn(),
    writable: true,
    configurable: true,
  });

  // Mock navigator.serviceWorker
  Object.defineProperty(global.navigator, 'serviceWorker', {
    value: mockServiceWorker,
    writable: true,
    configurable: true,
  });

  // Mock Notification API
  const notificationMock = {
    permission: 'default',
    requestPermission: jest.fn<() => Promise<string>>().mockResolvedValue('granted'),
  };
  Object.defineProperty(global.window, 'Notification', {
    value: notificationMock,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(global, 'Notification', {
    value: notificationMock,
    writable: true,
    configurable: true,
  });

  // Mock PushSubscription
  Object.defineProperty(global, 'PushSubscription', {
    value: class PushSubscription {
      endpoint = 'https://example.com/push/endpoint';
      options = { applicationServerKey: null };
      getKey(name: string) {
        if (name === 'p256dh') return new ArrayBuffer(65);
        if (name === 'auth') return new ArrayBuffer(16);
        return null;
      }
      toJSON() {
        return {
          endpoint: this.endpoint,
          keys: {
            p256dh: 'mock-p256dh-key',
            auth: 'mock-auth-key',
          },
        };
      }
    },
    writable: true,
    configurable: true,
  });
});

// Restore original values after each test
afterEach(() => {
  if (originalNavigatorServiceWorker) {
    Object.defineProperty(global.navigator, 'serviceWorker', originalNavigatorServiceWorker);
  }
  if (originalWindowPushManager) {
    Object.defineProperty(global.window, 'PushManager', originalWindowPushManager);
  } else {
    delete (global.window as any).PushManager;
  }
  if (originalWindowNotification) {
    Object.defineProperty(global.window, 'Notification', originalWindowNotification);
  } else {
    delete (global.window as any).Notification;
  }
  if (originalGlobalNotification) {
    Object.defineProperty(global, 'Notification', originalGlobalNotification);
  } else {
    delete (global as any).Notification;
  }
});

describe('pushService', () => {
  describe('isSupported', () => {
    it('should return true when service worker and push manager are supported', () => {
      expect(isSupported()).toBe(true);
    });

    it('should return false when service worker is not supported', () => {
      // Temporarily delete serviceWorker from navigator
      const navDescriptor = Object.getOwnPropertyDescriptor(global.navigator, 'serviceWorker');
      try {
        delete (global.navigator as any).serviceWorker;

        expect(isSupported()).toBe(false);
      } finally {
        // Restore serviceWorker
        if (navDescriptor) {
          Object.defineProperty(global.navigator, 'serviceWorker', navDescriptor);
        } else {
          Object.defineProperty(global.navigator, 'serviceWorker', {
            value: mockServiceWorker,
            writable: true,
            configurable: true,
          });
        }
      }
    });
  });

  describe('requestPermission', () => {
    it('should request notification permission', async () => {
      const result = await requestPermission();

      expect((global as any).Notification.requestPermission).toHaveBeenCalled();
      expect(result).toBe('granted');
    });

    it('should return denied when permission is denied', async () => {
      const mockFn = (global as any).Notification.requestPermission as jest.Mock<
        () => Promise<string>
      >;
      mockFn.mockResolvedValueOnce('denied');

      const result = await requestPermission();
      expect(result).toBe('denied');
    });

    it('should return denied when Notification API is not available', async () => {
      // Temporarily delete Notification
      const globalNotifDescriptor = Object.getOwnPropertyDescriptor(global, 'Notification');
      const windowNotifDescriptor = Object.getOwnPropertyDescriptor(global.window, 'Notification');
      try {
        delete (global as any).Notification;
        delete (global.window as any).Notification;

        const result = await requestPermission();
        expect(result).toBe('denied');
      } finally {
        // Restore Notification
        if (globalNotifDescriptor) {
          Object.defineProperty(global, 'Notification', globalNotifDescriptor);
        }
        if (windowNotifDescriptor) {
          Object.defineProperty(global.window, 'Notification', windowNotifDescriptor);
        }
      }
    });
  });

  describe('subscribe', () => {
    it('should subscribe to push notifications with VAPID key', async () => {
      const vapidPublicKey = 'BMxYGZF4CkGgTfQl6U1234567890abcdef';
      const mockSubscription = new (global as any).PushSubscription();

      const mockFn = mockServiceWorkerRegistration.pushManager.subscribe as jest.Mock<
        (options?: any) => Promise<any>
      >;
      mockFn.mockResolvedValue(mockSubscription);

      const subscription = await subscribe(vapidPublicKey);

      expect(mockServiceWorkerRegistration.pushManager.subscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      });

      expect(subscription).toEqual({
        endpoint: 'https://example.com/push/endpoint',
        keys: {
          p256dh: 'mock-p256dh-key',
          auth: 'mock-auth-key',
        },
      });
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from push notifications', async () => {
      const mockSubscription: any = {
        unsubscribe: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      };

      const mockFn = mockServiceWorkerRegistration.pushManager.getSubscription as jest.Mock<
        () => Promise<any>
      >;
      mockFn.mockResolvedValue(mockSubscription);

      const result = await unsubscribe();

      expect(mockServiceWorkerRegistration.pushManager.getSubscription).toHaveBeenCalled();
      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when no active subscription exists', async () => {
      const mockFn = mockServiceWorkerRegistration.pushManager.getSubscription as jest.Mock<
        () => Promise<any>
      >;
      mockFn.mockResolvedValue(null);

      const result = await unsubscribe();
      expect(result).toBe(false);
    });
  });

  describe('getSubscription', () => {
    it('should return current subscription if exists', async () => {
      const mockSubscription = new (global as any).PushSubscription();

      const mockFn = mockServiceWorkerRegistration.pushManager.getSubscription as jest.Mock<
        () => Promise<any>
      >;
      mockFn.mockResolvedValue(mockSubscription);

      const subscription = await getSubscription();

      expect(subscription).toEqual({
        endpoint: 'https://example.com/push/endpoint',
        keys: {
          p256dh: 'mock-p256dh-key',
          auth: 'mock-auth-key',
        },
      });
    });

    it('should return null when no subscription exists', async () => {
      const mockFn = mockServiceWorkerRegistration.pushManager.getSubscription as jest.Mock<
        () => Promise<any>
      >;
      mockFn.mockResolvedValue(null);

      const subscription = await getSubscription();
      expect(subscription).toBeNull();
    });
  });
});
