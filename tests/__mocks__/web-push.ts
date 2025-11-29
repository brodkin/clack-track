/**
 * Mock for web-push module
 * Used in unit tests to avoid pulling in native dependencies
 */

export default {
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({ statusCode: 201 }),
};
