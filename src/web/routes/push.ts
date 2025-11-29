/**
 * Push Notification Routes
 *
 * Handles push notification subscription management for PWA.
 * Stores subscriptions and enables sending push notifications to clients.
 *
 * Architecture:
 * - Single Responsibility: Only handles push subscription endpoints
 * - Dependency Inversion: Accepts Express router as abstraction
 * - Interface Segregation: Clean REST API (subscribe, unsubscribe)
 */

import { Router, type Request, type Response } from 'express';
import webpush from 'web-push';

const router = Router();

// In-memory storage for push subscriptions (production should use database)
// TODO: Replace with database storage in production
const pushSubscriptions = new Map<string, webpush.PushSubscription>();

// Configure VAPID keys from environment
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

/**
 * POST /api/push/subscribe
 * Store a push notification subscription
 */
router.post('/subscribe', (req: Request, res: Response): void => {
  try {
    const subscription = req.body as webpush.PushSubscription;

    if (!subscription || !subscription.endpoint) {
      res.status(400).json({ error: 'Invalid subscription object' });
      return;
    }

    // Store subscription (keyed by endpoint for uniqueness)
    pushSubscriptions.set(subscription.endpoint, subscription);

    res.status(201).json({
      success: true,
      message: 'Subscription saved successfully',
    });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

/**
 * DELETE /api/push/unsubscribe
 * Remove a push notification subscription
 */
router.delete('/unsubscribe', (req: Request, res: Response): void => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      res.status(400).json({ error: 'Endpoint is required' });
      return;
    }

    const existed = pushSubscriptions.delete(endpoint);

    if (!existed) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Subscription removed successfully',
    });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

/**
 * POST /api/push/test
 * Send a test push notification (development only)
 */
router.post('/test', async (req: Request, res: Response): Promise<void> => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Test endpoint disabled in production' });
    return;
  }

  try {
    const { endpoint, title, body } = req.body;

    if (!endpoint) {
      res.status(400).json({ error: 'Endpoint is required' });
      return;
    }

    const subscription = pushSubscriptions.get(endpoint);
    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    const payload = JSON.stringify({
      title: title || 'Test Notification',
      body: body || 'This is a test push notification from Clack Track',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    });

    await webpush.sendNotification(subscription, payload);

    res.json({
      success: true,
      message: 'Test notification sent successfully',
    });
  } catch (error) {
    console.error('Error sending test push notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

/**
 * GET /api/push/vapid-public-key
 * Return VAPID public key for client-side subscription
 */
router.get('/vapid-public-key', (_req: Request, res: Response): void => {
  if (!vapidPublicKey) {
    res.status(500).json({ error: 'VAPID keys not configured' });
    return;
  }

  res.json({ publicKey: vapidPublicKey });
});

export { router as pushRouter };
