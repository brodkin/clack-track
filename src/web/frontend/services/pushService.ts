/**
 * Push Notification Service
 *
 * Handles push notification subscription, unsubscription, and permission requests.
 * Implements the Push API with VAPID authentication for secure push notifications.
 *
 * Architecture:
 * - Single Responsibility: Only handles push notification operations
 * - Dependency Inversion: Depends on browser APIs abstraction (Service Worker, Push Manager)
 * - Interface Segregation: Clean, focused API with minimal surface area
 */

import type { PushSubscriptionData, PushPermission } from './types.js';

/**
 * Check if push notifications are supported by the browser
 *
 * @returns True if Service Worker and Push Manager APIs are available
 */
export function isSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Request notification permission from the user
 *
 * @returns Permission status ('granted', 'denied', or 'default')
 */
export async function requestPermission(): Promise<PushPermission> {
  if (typeof Notification === 'undefined') {
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission as PushPermission;
}

/**
 * Convert base64 VAPID public key to Uint8Array
 *
 * Required for PushManager subscription options
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Subscribe to push notifications with VAPID public key
 *
 * @param vapidPublicKey - Base64-encoded VAPID public key from server
 * @returns Push subscription data (endpoint + keys)
 * @throws Error if service worker is not ready or subscription fails
 */
export async function subscribe(vapidPublicKey: string): Promise<PushSubscriptionData> {
  const registration = await navigator.serviceWorker.ready;
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey as BufferSource,
  });

  return subscription.toJSON() as PushSubscriptionData;
}

/**
 * Unsubscribe from push notifications
 *
 * @returns True if unsubscribed successfully, false if no subscription exists
 */
export async function unsubscribe(): Promise<boolean> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    return false;
  }

  return await subscription.unsubscribe();
}

/**
 * Get current push subscription if exists
 *
 * @returns Current subscription data or null if not subscribed
 */
export async function getSubscription(): Promise<PushSubscriptionData | null> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    return null;
  }

  return subscription.toJSON() as PushSubscriptionData;
}
