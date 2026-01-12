/**
 * Mock Data for UI Development
 *
 * Placeholder data matching API response types for static UI mockups
 */

import type { ContentRecord } from '../../../storage/models/content.js';

/**
 * Mock Vestaboard content records
 */
export const mockContentRecords: ContentRecord[] = [
  {
    id: 1,
    text: 'TECH NEWS UPDATE\n\nAI ADVANCES IN\nHEALTHCARE SECTOR',
    type: 'major',
    generatedAt: new Date('2025-11-28T10:30:00Z'),
    sentAt: new Date('2025-11-28T10:30:05Z'),
    aiProvider: 'openai',
    generatorId: 'tech-news',
    aiModel: 'gpt-4.1-mini',
    tokensUsed: 260,
    status: 'success',
  },
  {
    id: 2,
    text: 'GLOBAL NEWS TODAY\n\nCLIMATE SUMMIT\nPROGRESS MADE',
    type: 'major',
    generatedAt: new Date('2025-11-28T09:15:00Z'),
    sentAt: new Date('2025-11-28T09:15:05Z'),
    aiProvider: 'openai',
    generatorId: 'global-news',
    aiModel: 'gpt-4.1-mini',
    tokensUsed: 260,
    status: 'success',
  },
  {
    id: 3,
    text: 'WEATHER FORECAST\n\nSUNNY 72°F\nPERFECT DAY AHEAD',
    type: 'major',
    generatedAt: new Date('2025-11-28T08:00:00Z'),
    sentAt: new Date('2025-11-28T08:00:05Z'),
    aiProvider: 'openai',
    generatorId: 'weather-focus',
    aiModel: 'gpt-4.1-mini',
    tokensUsed: 230,
    status: 'success',
  },
  {
    id: 4,
    text: 'ANCIENT LEAVES FALL\nWHISPERING WIND CARRIES\nHOPE FOR TOMORROW',
    type: 'major',
    generatedAt: new Date('2025-11-27T16:45:00Z'),
    sentAt: new Date('2025-11-27T16:45:05Z'),
    aiProvider: 'anthropic',
    generatorId: 'haiku',
    aiModel: 'claude-sonnet-4.5',
    tokensUsed: 180,
    status: 'success',
  },
  {
    id: 5,
    text: 'MARKET UPDATE\n\nSTOCKS RISE AS\nINFLATION COOLS',
    type: 'major',
    generatedAt: new Date('2025-11-27T12:30:00Z'),
    sentAt: new Date('2025-11-27T12:30:05Z'),
    aiProvider: 'openai',
    generatorId: 'global-news',
    aiModel: 'gpt-4.1-mini',
    tokensUsed: 245,
    status: 'success',
  },
];

/**
 * Mock user profile data
 */
export interface MockUserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  lastLogin: Date;
}

export const mockUserProfile: MockUserProfile = {
  id: 'mock-user-1',
  email: 'demo@example.com',
  name: 'Demo User',
  createdAt: new Date('2025-01-15T00:00:00Z'),
  lastLogin: new Date('2025-11-28T10:30:00Z'),
};

/**
 * Mock passkey data
 */
export interface MockPasskey {
  id: string;
  name: string;
  createdAt: Date;
  lastUsed: Date;
  deviceType: 'phone' | 'tablet' | 'laptop' | 'desktop' | 'security-key';
}

export const mockPasskeys: MockPasskey[] = [
  {
    id: 'passkey-1',
    name: 'iPhone 15 Pro',
    createdAt: new Date('2025-01-15T10:00:00Z'),
    lastUsed: new Date('2025-11-28T10:30:00Z'),
    deviceType: 'phone',
  },
  {
    id: 'passkey-2',
    name: 'MacBook Pro',
    createdAt: new Date('2025-01-16T14:30:00Z'),
    lastUsed: new Date('2025-11-27T08:15:00Z'),
    deviceType: 'laptop',
  },
  {
    id: 'passkey-3',
    name: 'YubiKey 5C',
    createdAt: new Date('2025-02-01T09:00:00Z'),
    lastUsed: new Date('2025-11-20T16:45:00Z'),
    deviceType: 'security-key',
  },
];

/**
 * Mock Vestaboard formatted content (6x22 character grid)
 */
export const mockFormattedContent = [
  [0, 0, 0, 5, 13, 2, 18, 1, 3, 5, 0, 20, 8, 5, 0, 10, 15, 21, 18, 14, 5, 25],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 5, 22, 5, 18, 25, 0, 19, 13, 1, 12, 12, 0, 19, 20, 5, 16, 0, 0],
  [0, 0, 0, 0, 6, 15, 18, 23, 1, 18, 4, 0, 13, 1, 20, 20, 5, 18, 19, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

/**
 * Get the latest mock content (for Welcome page)
 */
export function getMockLatestContent(): ContentRecord {
  return mockContentRecords[0];
}

/**
 * Get mock content history (for History page)
 */
export function getMockContentHistory(limit = 5): ContentRecord[] {
  return mockContentRecords.slice(0, limit);
}
