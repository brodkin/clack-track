/**
 * Unit tests for config API routes
 * Tests GET /api/config/vestaboard endpoint
 */

import { getVestaboardConfig, createConfigRouter } from '../../../../src/web/routes/config.js';
import type { Request, Response } from '../../../../src/web/types.js';

// Mock the config module
jest.mock('../../../../src/config/env.js', () => ({
  config: {
    vestaboard: {
      model: 'black',
    },
  },
}));

describe('Config API Routes', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock response with chainable status
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    mockResponse = {
      json: jsonSpy,
      status: statusSpy,
      send: jest.fn(),
    };

    // Create mock request
    mockRequest = {
      params: {},
      query: {},
      body: undefined,
    };
  });

  describe('GET /api/config/vestaboard', () => {
    it('should return vestaboard model configuration', async () => {
      await getVestaboardConfig(mockRequest, mockResponse);

      expect(jsonSpy).toHaveBeenCalledWith({
        model: 'black',
      });
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should return default model when vestaboard config is undefined', async () => {
      // Re-mock with undefined vestaboard config
      jest.resetModules();
      jest.doMock('../../../../src/config/env.js', () => ({
        config: {
          vestaboard: undefined,
        },
      }));

      // Re-import to get the new mock
      const { getVestaboardConfig: getVestaboardConfigNew } =
        await import('../../../../src/web/routes/config.js');

      await getVestaboardConfigNew(mockRequest, mockResponse);

      expect(jsonSpy).toHaveBeenCalledWith({
        model: 'black',
      });
    });
  });

  describe('createConfigRouter', () => {
    it('should create a router with vestaboard endpoint', () => {
      const router = createConfigRouter();

      // Check that the router has the expected route
      expect(router).toBeDefined();
      // Router.stack contains the route layers
      const routes = router.stack.map((layer: { route?: { path: string; methods: object } }) => ({
        path: layer.route?.path,
        methods: layer.route?.methods,
      }));

      expect(routes).toContainEqual({
        path: '/vestaboard',
        methods: { get: true },
      });
    });
  });
});

describe('Config API Routes - White model', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  let jsonSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonSpy = jest.fn();
    mockResponse = {
      json: jsonSpy,
      status: jest.fn().mockReturnValue({ json: jsonSpy }),
      send: jest.fn(),
    };
    mockRequest = {
      params: {},
      query: {},
      body: undefined,
    };
  });

  it('should return white model when configured', async () => {
    // Re-mock with white model
    jest.resetModules();
    jest.doMock('../../../../src/config/env.js', () => ({
      config: {
        vestaboard: {
          model: 'white',
        },
      },
    }));

    // Re-import to get the new mock
    const { getVestaboardConfig: getVestaboardConfigWhite } =
      await import('../../../../src/web/routes/config.js');

    await getVestaboardConfigWhite(mockRequest, mockResponse);

    expect(jsonSpy).toHaveBeenCalledWith({
      model: 'white',
    });
  });
});
