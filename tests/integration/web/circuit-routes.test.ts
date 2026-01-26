/**
 * Integration tests for circuit breaker API routes
 *
 * Tests GET /api/circuits, GET /api/circuits/:id,
 * POST /api/circuits/:id/on, POST /api/circuits/:id/off,
 * POST /api/circuits/:id/reset endpoints
 */

import {
  getAllCircuits,
  getCircuitById,
  enableCircuit,
  disableCircuit,
  resetCircuit,
  createCircuitRouter,
} from '../../../src/web/routes/circuit.js';
import { CircuitBreakerService } from '../../../src/services/circuit-breaker-service.js';
import type { CircuitBreakerState } from '../../../src/types/circuit-breaker.js';
import type { Request, Response } from '../../../src/web/types.js';

// Mock CircuitBreakerService
jest.mock('../../../src/services/circuit-breaker-service.js');

describe('Circuit Breaker API Routes', () => {
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

  describe('GET /api/circuits', () => {
    it('should return all circuits successfully', async () => {
      const mockCircuits: CircuitBreakerState[] = [
        {
          id: 1,
          circuitId: 'MASTER',
          circuitType: 'manual',
          state: 'on',
          defaultState: 'on',
          description: 'Global kill switch',
          failureCount: 0,
          successCount: 0,
          failureThreshold: 5,
          lastFailureAt: null,
          lastSuccessAt: null,
          stateChangedAt: '2025-01-15T10:00:00Z',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-15T10:00:00Z',
        },
        {
          id: 2,
          circuitId: 'SLEEP_MODE',
          circuitType: 'manual',
          state: 'off',
          defaultState: 'off',
          description: 'Quiet hours mode',
          failureCount: 0,
          successCount: 0,
          failureThreshold: 5,
          lastFailureAt: null,
          lastSuccessAt: null,
          stateChangedAt: '2025-01-15T10:00:00Z',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-15T10:00:00Z',
        },
      ];

      const mockGetAllCircuits = jest.fn().mockResolvedValue(mockCircuits);
      const mockService = {
        getAllCircuits: mockGetAllCircuits,
      } as unknown as CircuitBreakerService;

      await getAllCircuits(mockRequest, mockResponse, mockService);

      expect(mockGetAllCircuits).toHaveBeenCalledTimes(1);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockCircuits,
      });
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should return empty array when no circuits exist', async () => {
      const mockGetAllCircuits = jest.fn().mockResolvedValue([]);
      const mockService = {
        getAllCircuits: mockGetAllCircuits,
      } as unknown as CircuitBreakerService;

      await getAllCircuits(mockRequest, mockResponse, mockService);

      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should return 503 when service is not available', async () => {
      await getAllCircuits(mockRequest, mockResponse, undefined);

      expect(statusSpy).toHaveBeenCalledWith(503);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Circuit breaker service unavailable',
      });
    });

    it('should return 500 on service error', async () => {
      const mockGetAllCircuits = jest.fn().mockRejectedValue(new Error('DB error'));
      const mockService = {
        getAllCircuits: mockGetAllCircuits,
      } as unknown as CircuitBreakerService;

      await getAllCircuits(mockRequest, mockResponse, mockService);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve circuits',
      });
    });
  });

  describe('GET /api/circuits/:id', () => {
    it('should return a single circuit by ID', async () => {
      const mockCircuit: CircuitBreakerState = {
        id: 1,
        circuitId: 'MASTER',
        circuitType: 'manual',
        state: 'on',
        defaultState: 'on',
        description: 'Global kill switch',
        failureCount: 0,
        successCount: 0,
        failureThreshold: 5,
        lastFailureAt: null,
        lastSuccessAt: null,
        stateChangedAt: '2025-01-15T10:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
      };

      mockRequest.params = { id: 'MASTER' };

      const mockGetCircuitStatus = jest.fn().mockResolvedValue(mockCircuit);
      const mockService = {
        getCircuitStatus: mockGetCircuitStatus,
      } as unknown as CircuitBreakerService;

      await getCircuitById(mockRequest, mockResponse, mockService);

      expect(mockGetCircuitStatus).toHaveBeenCalledWith('MASTER');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockCircuit,
      });
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should return 404 when circuit not found', async () => {
      mockRequest.params = { id: 'NONEXISTENT' };

      const mockGetCircuitStatus = jest.fn().mockResolvedValue(null);
      const mockService = {
        getCircuitStatus: mockGetCircuitStatus,
      } as unknown as CircuitBreakerService;

      await getCircuitById(mockRequest, mockResponse, mockService);

      expect(mockGetCircuitStatus).toHaveBeenCalledWith('NONEXISTENT');
      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Circuit not found: NONEXISTENT',
      });
    });

    it('should return 503 when service is not available', async () => {
      mockRequest.params = { id: 'MASTER' };

      await getCircuitById(mockRequest, mockResponse, undefined);

      expect(statusSpy).toHaveBeenCalledWith(503);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Circuit breaker service unavailable',
      });
    });

    it('should return 500 on service error', async () => {
      mockRequest.params = { id: 'MASTER' };

      const mockGetCircuitStatus = jest.fn().mockRejectedValue(new Error('DB error'));
      const mockService = {
        getCircuitStatus: mockGetCircuitStatus,
      } as unknown as CircuitBreakerService;

      await getCircuitById(mockRequest, mockResponse, mockService);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve circuit',
      });
    });
  });

  describe('POST /api/circuits/:id/on', () => {
    it('should enable a circuit successfully', async () => {
      const mockCircuit: CircuitBreakerState = {
        id: 1,
        circuitId: 'MASTER',
        circuitType: 'manual',
        state: 'on',
        defaultState: 'on',
        description: 'Global kill switch',
        failureCount: 0,
        successCount: 0,
        failureThreshold: 5,
        lastFailureAt: null,
        lastSuccessAt: null,
        stateChangedAt: '2025-01-15T10:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
      };

      mockRequest.params = { id: 'MASTER' };

      const mockSetCircuitState = jest.fn().mockResolvedValue(undefined);
      const mockGetCircuitStatus = jest.fn().mockResolvedValue(mockCircuit);
      const mockService = {
        setCircuitState: mockSetCircuitState,
        getCircuitStatus: mockGetCircuitStatus,
      } as unknown as CircuitBreakerService;

      await enableCircuit(mockRequest, mockResponse, mockService);

      expect(mockSetCircuitState).toHaveBeenCalledWith('MASTER', 'on');
      expect(mockGetCircuitStatus).toHaveBeenCalledWith('MASTER');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockCircuit,
        message: 'Circuit MASTER enabled',
      });
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should return 404 when circuit not found', async () => {
      mockRequest.params = { id: 'NONEXISTENT' };

      const mockSetCircuitState = jest.fn().mockResolvedValue(undefined);
      const mockGetCircuitStatus = jest.fn().mockResolvedValue(null);
      const mockService = {
        setCircuitState: mockSetCircuitState,
        getCircuitStatus: mockGetCircuitStatus,
      } as unknown as CircuitBreakerService;

      await enableCircuit(mockRequest, mockResponse, mockService);

      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Circuit not found: NONEXISTENT',
      });
    });

    it('should return 503 when service is not available', async () => {
      mockRequest.params = { id: 'MASTER' };

      await enableCircuit(mockRequest, mockResponse, undefined);

      expect(statusSpy).toHaveBeenCalledWith(503);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Circuit breaker service unavailable',
      });
    });

    it('should return 500 on service error', async () => {
      mockRequest.params = { id: 'MASTER' };

      const mockSetCircuitState = jest.fn().mockRejectedValue(new Error('DB error'));
      const mockService = {
        setCircuitState: mockSetCircuitState,
        getCircuitStatus: jest.fn(),
      } as unknown as CircuitBreakerService;

      await enableCircuit(mockRequest, mockResponse, mockService);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to enable circuit',
      });
    });
  });

  describe('POST /api/circuits/:id/off', () => {
    it('should disable a circuit successfully', async () => {
      const mockCircuit: CircuitBreakerState = {
        id: 1,
        circuitId: 'MASTER',
        circuitType: 'manual',
        state: 'off',
        defaultState: 'on',
        description: 'Global kill switch',
        failureCount: 0,
        successCount: 0,
        failureThreshold: 5,
        lastFailureAt: null,
        lastSuccessAt: null,
        stateChangedAt: '2025-01-15T10:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
      };

      mockRequest.params = { id: 'MASTER' };

      const mockSetCircuitState = jest.fn().mockResolvedValue(undefined);
      const mockGetCircuitStatus = jest.fn().mockResolvedValue(mockCircuit);
      const mockService = {
        setCircuitState: mockSetCircuitState,
        getCircuitStatus: mockGetCircuitStatus,
      } as unknown as CircuitBreakerService;

      await disableCircuit(mockRequest, mockResponse, mockService);

      expect(mockSetCircuitState).toHaveBeenCalledWith('MASTER', 'off');
      expect(mockGetCircuitStatus).toHaveBeenCalledWith('MASTER');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockCircuit,
        message: 'Circuit MASTER disabled',
      });
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should return 404 when circuit not found', async () => {
      mockRequest.params = { id: 'NONEXISTENT' };

      const mockSetCircuitState = jest.fn().mockResolvedValue(undefined);
      const mockGetCircuitStatus = jest.fn().mockResolvedValue(null);
      const mockService = {
        setCircuitState: mockSetCircuitState,
        getCircuitStatus: mockGetCircuitStatus,
      } as unknown as CircuitBreakerService;

      await disableCircuit(mockRequest, mockResponse, mockService);

      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Circuit not found: NONEXISTENT',
      });
    });

    it('should return 503 when service is not available', async () => {
      mockRequest.params = { id: 'MASTER' };

      await disableCircuit(mockRequest, mockResponse, undefined);

      expect(statusSpy).toHaveBeenCalledWith(503);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Circuit breaker service unavailable',
      });
    });

    it('should return 500 on service error', async () => {
      mockRequest.params = { id: 'MASTER' };

      const mockSetCircuitState = jest.fn().mockRejectedValue(new Error('DB error'));
      const mockService = {
        setCircuitState: mockSetCircuitState,
        getCircuitStatus: jest.fn(),
      } as unknown as CircuitBreakerService;

      await disableCircuit(mockRequest, mockResponse, mockService);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to disable circuit',
      });
    });
  });

  describe('POST /api/circuits/:id/reset', () => {
    it('should reset a provider circuit successfully', async () => {
      const mockCircuit: CircuitBreakerState = {
        id: 3,
        circuitId: 'PROVIDER_OPENAI',
        circuitType: 'provider',
        state: 'on',
        defaultState: 'on',
        description: 'OpenAI provider circuit',
        failureCount: 0,
        successCount: 0,
        failureThreshold: 5,
        lastFailureAt: null,
        lastSuccessAt: null,
        stateChangedAt: '2025-01-15T10:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
      };

      mockRequest.params = { id: 'PROVIDER_OPENAI' };

      const mockResetProviderCircuit = jest.fn().mockResolvedValue(undefined);
      const mockGetCircuitStatus = jest
        .fn()
        .mockResolvedValueOnce({ ...mockCircuit, circuitType: 'provider' })
        .mockResolvedValueOnce(mockCircuit);
      const mockService = {
        resetProviderCircuit: mockResetProviderCircuit,
        getCircuitStatus: mockGetCircuitStatus,
      } as unknown as CircuitBreakerService;

      await resetCircuit(mockRequest, mockResponse, mockService);

      expect(mockResetProviderCircuit).toHaveBeenCalledWith('PROVIDER_OPENAI');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockCircuit,
        message: 'Circuit PROVIDER_OPENAI reset',
      });
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should return 400 when attempting to reset a manual circuit', async () => {
      const mockCircuit: CircuitBreakerState = {
        id: 1,
        circuitId: 'MASTER',
        circuitType: 'manual',
        state: 'on',
        defaultState: 'on',
        description: 'Global kill switch',
        failureCount: 0,
        successCount: 0,
        failureThreshold: 5,
        lastFailureAt: null,
        lastSuccessAt: null,
        stateChangedAt: '2025-01-15T10:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
      };

      mockRequest.params = { id: 'MASTER' };

      const mockGetCircuitStatus = jest.fn().mockResolvedValue(mockCircuit);
      const mockService = {
        resetProviderCircuit: jest.fn(),
        getCircuitStatus: mockGetCircuitStatus,
      } as unknown as CircuitBreakerService;

      await resetCircuit(mockRequest, mockResponse, mockService);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error:
          'Reset is only available for provider circuits. Use /on or /off for manual circuits.',
      });
    });

    it('should return 404 when circuit not found', async () => {
      mockRequest.params = { id: 'NONEXISTENT' };

      const mockGetCircuitStatus = jest.fn().mockResolvedValue(null);
      const mockService = {
        resetProviderCircuit: jest.fn(),
        getCircuitStatus: mockGetCircuitStatus,
      } as unknown as CircuitBreakerService;

      await resetCircuit(mockRequest, mockResponse, mockService);

      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Circuit not found: NONEXISTENT',
      });
    });

    it('should return 503 when service is not available', async () => {
      mockRequest.params = { id: 'PROVIDER_OPENAI' };

      await resetCircuit(mockRequest, mockResponse, undefined);

      expect(statusSpy).toHaveBeenCalledWith(503);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Circuit breaker service unavailable',
      });
    });

    it('should return 500 on service error', async () => {
      mockRequest.params = { id: 'PROVIDER_OPENAI' };

      const mockGetCircuitStatus = jest
        .fn()
        .mockResolvedValueOnce({ circuitType: 'provider', circuitId: 'PROVIDER_OPENAI' });
      const mockResetProviderCircuit = jest.fn().mockRejectedValue(new Error('DB error'));
      const mockService = {
        resetProviderCircuit: mockResetProviderCircuit,
        getCircuitStatus: mockGetCircuitStatus,
      } as unknown as CircuitBreakerService;

      await resetCircuit(mockRequest, mockResponse, mockService);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to reset circuit',
      });
    });
  });

  describe('Authentication', () => {
    it('should add requireAuth middleware to router', () => {
      const mockService = {
        getAllCircuits: jest.fn(),
        getCircuitStatus: jest.fn(),
        setCircuitState: jest.fn(),
        resetProviderCircuit: jest.fn(),
      } as unknown as CircuitBreakerService;

      const router = createCircuitRouter({ circuitBreakerService: mockService });

      // Get the router stack to check for middleware
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const routerStack = (router as any).stack as Array<{
        name?: string;
        handle?: { name: string };
        route?: { path: string };
      }>;

      // The first item should be the requireAuth middleware (no route property)
      const middlewareLayer = routerStack.find(layer => !layer.route);
      expect(middlewareLayer).toBeDefined();
      // Middleware function is named 'requireAuth'
      expect(middlewareLayer?.handle?.name).toBe('requireAuth');
    });

    it('should protect all routes with authentication', () => {
      const mockService = {
        getAllCircuits: jest.fn(),
        getCircuitStatus: jest.fn(),
        setCircuitState: jest.fn(),
        resetProviderCircuit: jest.fn(),
      } as unknown as CircuitBreakerService;

      const router = createCircuitRouter({ circuitBreakerService: mockService });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const routerStack = (router as any).stack as Array<{
        route?: { path: string };
      }>;

      // Count routes and middleware
      const routes = routerStack.filter(layer => layer.route);
      const middleware = routerStack.filter(layer => !layer.route);

      // Verify expected routes exist (don't assert exact count - it may grow)
      const routePaths = routes.map(r => r.route?.path);
      expect(routePaths).toContain('/');
      expect(routePaths).toContain('/:id');
      expect(routePaths).toContain('/:id/on');
      expect(routePaths).toContain('/:id/off');
      expect(routePaths).toContain('/:id/reset');

      // Should have at least 1 middleware (requireAuth)
      expect(middleware.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('createCircuitRouter', () => {
    it('should create router with injected service', () => {
      const mockService = {
        getAllCircuits: jest.fn(),
        getCircuitStatus: jest.fn(),
        setCircuitState: jest.fn(),
        resetProviderCircuit: jest.fn(),
      } as unknown as CircuitBreakerService;

      const router = createCircuitRouter({ circuitBreakerService: mockService });

      expect(router).toBeDefined();
      expect(typeof router).toBe('function'); // Express Router is a function
    });

    it('should create router without service (graceful degradation)', () => {
      const router = createCircuitRouter({});

      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });

    it('should create router with no dependencies argument', () => {
      const router = createCircuitRouter();

      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });

    it('should wire GET / route to getAllCircuits handler', async () => {
      const mockCircuits: CircuitBreakerState[] = [
        {
          id: 1,
          circuitId: 'MASTER',
          circuitType: 'manual',
          state: 'on',
          defaultState: 'on',
          description: 'Global kill switch',
          failureCount: 0,
          successCount: 0,
          failureThreshold: 5,
          lastFailureAt: null,
          lastSuccessAt: null,
          stateChangedAt: '2025-01-15T10:00:00Z',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-15T10:00:00Z',
        },
      ];

      const mockGetAllCircuits = jest.fn().mockResolvedValue(mockCircuits);
      const mockService = {
        getAllCircuits: mockGetAllCircuits,
      } as unknown as CircuitBreakerService;

      const router = createCircuitRouter({ circuitBreakerService: mockService });

      // Simulate Express route execution
      const req = {
        body: undefined,
        params: {},
        query: {},
      } as Request;

      const res = {
        json: jsonSpy,
        status: statusSpy,
        send: jest.fn(),
      } as Response;

      // Get the GET handler from the router stack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const routerStack = (router as any).stack as Array<{
        route?: {
          path: string;
          methods?: { get?: boolean };
          stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
        };
      }>;
      const getHandler = routerStack.find(
        layer => layer.route?.path === '/' && layer.route?.methods?.get
      );

      if (getHandler?.route?.stack[0]) {
        await getHandler.route.stack[0].handle(req, res);
      }

      expect(mockGetAllCircuits).toHaveBeenCalledTimes(1);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockCircuits,
      });
    });

    it('should wire GET /:id route to getCircuitById handler', async () => {
      const mockCircuit: CircuitBreakerState = {
        id: 1,
        circuitId: 'MASTER',
        circuitType: 'manual',
        state: 'on',
        defaultState: 'on',
        description: 'Global kill switch',
        failureCount: 0,
        successCount: 0,
        failureThreshold: 5,
        lastFailureAt: null,
        lastSuccessAt: null,
        stateChangedAt: '2025-01-15T10:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
      };

      const mockGetCircuitStatus = jest.fn().mockResolvedValue(mockCircuit);
      const mockService = {
        getCircuitStatus: mockGetCircuitStatus,
      } as unknown as CircuitBreakerService;

      const router = createCircuitRouter({ circuitBreakerService: mockService });

      // Simulate Express route execution
      const req = {
        body: undefined,
        params: { id: 'MASTER' },
        query: {},
      } as Request;

      const res = {
        json: jsonSpy,
        status: statusSpy,
        send: jest.fn(),
      } as Response;

      // Get the GET handler from the router stack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const routerStack = (router as any).stack as Array<{
        route?: {
          path: string;
          methods?: { get?: boolean };
          stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
        };
      }>;
      const getHandler = routerStack.find(
        layer => layer.route?.path === '/:id' && layer.route?.methods?.get
      );

      if (getHandler?.route?.stack[0]) {
        await getHandler.route.stack[0].handle(req, res);
      }

      expect(mockGetCircuitStatus).toHaveBeenCalledWith('MASTER');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockCircuit,
      });
    });

    it('should wire POST /:id/on route to enableCircuit handler', async () => {
      const mockCircuit: CircuitBreakerState = {
        id: 1,
        circuitId: 'MASTER',
        circuitType: 'manual',
        state: 'on',
        defaultState: 'on',
        description: 'Global kill switch',
        failureCount: 0,
        successCount: 0,
        failureThreshold: 5,
        lastFailureAt: null,
        lastSuccessAt: null,
        stateChangedAt: '2025-01-15T10:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
      };

      const mockSetCircuitState = jest.fn().mockResolvedValue(undefined);
      const mockGetCircuitStatus = jest.fn().mockResolvedValue(mockCircuit);
      const mockService = {
        setCircuitState: mockSetCircuitState,
        getCircuitStatus: mockGetCircuitStatus,
      } as unknown as CircuitBreakerService;

      const router = createCircuitRouter({ circuitBreakerService: mockService });

      // Simulate Express route execution
      const req = {
        body: undefined,
        params: { id: 'MASTER' },
        query: {},
      } as Request;

      const res = {
        json: jsonSpy,
        status: statusSpy,
        send: jest.fn(),
      } as Response;

      // Get the POST handler from the router stack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const routerStack = (router as any).stack as Array<{
        route?: {
          path: string;
          methods?: { post?: boolean };
          stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
        };
      }>;
      const postHandler = routerStack.find(
        layer => layer.route?.path === '/:id/on' && layer.route?.methods?.post
      );

      if (postHandler?.route?.stack[0]) {
        await postHandler.route.stack[0].handle(req, res);
      }

      expect(mockSetCircuitState).toHaveBeenCalledWith('MASTER', 'on');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockCircuit,
        message: 'Circuit MASTER enabled',
      });
    });

    it('should wire POST /:id/off route to disableCircuit handler', async () => {
      const mockCircuit: CircuitBreakerState = {
        id: 1,
        circuitId: 'MASTER',
        circuitType: 'manual',
        state: 'off',
        defaultState: 'on',
        description: 'Global kill switch',
        failureCount: 0,
        successCount: 0,
        failureThreshold: 5,
        lastFailureAt: null,
        lastSuccessAt: null,
        stateChangedAt: '2025-01-15T10:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
      };

      const mockSetCircuitState = jest.fn().mockResolvedValue(undefined);
      const mockGetCircuitStatus = jest.fn().mockResolvedValue(mockCircuit);
      const mockService = {
        setCircuitState: mockSetCircuitState,
        getCircuitStatus: mockGetCircuitStatus,
      } as unknown as CircuitBreakerService;

      const router = createCircuitRouter({ circuitBreakerService: mockService });

      // Simulate Express route execution
      const req = {
        body: undefined,
        params: { id: 'MASTER' },
        query: {},
      } as Request;

      const res = {
        json: jsonSpy,
        status: statusSpy,
        send: jest.fn(),
      } as Response;

      // Get the POST handler from the router stack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const routerStack = (router as any).stack as Array<{
        route?: {
          path: string;
          methods?: { post?: boolean };
          stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
        };
      }>;
      const postHandler = routerStack.find(
        layer => layer.route?.path === '/:id/off' && layer.route?.methods?.post
      );

      if (postHandler?.route?.stack[0]) {
        await postHandler.route.stack[0].handle(req, res);
      }

      expect(mockSetCircuitState).toHaveBeenCalledWith('MASTER', 'off');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockCircuit,
        message: 'Circuit MASTER disabled',
      });
    });

    it('should wire POST /:id/reset route to resetCircuit handler', async () => {
      const mockCircuit: CircuitBreakerState = {
        id: 3,
        circuitId: 'PROVIDER_OPENAI',
        circuitType: 'provider',
        state: 'on',
        defaultState: 'on',
        description: 'OpenAI provider circuit',
        failureCount: 0,
        successCount: 0,
        failureThreshold: 5,
        lastFailureAt: null,
        lastSuccessAt: null,
        stateChangedAt: '2025-01-15T10:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
      };

      const mockResetProviderCircuit = jest.fn().mockResolvedValue(undefined);
      const mockGetCircuitStatus = jest
        .fn()
        .mockResolvedValueOnce({ ...mockCircuit, circuitType: 'provider' })
        .mockResolvedValueOnce(mockCircuit);
      const mockService = {
        resetProviderCircuit: mockResetProviderCircuit,
        getCircuitStatus: mockGetCircuitStatus,
      } as unknown as CircuitBreakerService;

      const router = createCircuitRouter({ circuitBreakerService: mockService });

      // Simulate Express route execution
      const req = {
        body: undefined,
        params: { id: 'PROVIDER_OPENAI' },
        query: {},
      } as Request;

      const res = {
        json: jsonSpy,
        status: statusSpy,
        send: jest.fn(),
      } as Response;

      // Get the POST handler from the router stack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const routerStack = (router as any).stack as Array<{
        route?: {
          path: string;
          methods?: { post?: boolean };
          stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
        };
      }>;
      const postHandler = routerStack.find(
        layer => layer.route?.path === '/:id/reset' && layer.route?.methods?.post
      );

      if (postHandler?.route?.stack[0]) {
        await postHandler.route.stack[0].handle(req, res);
      }

      expect(mockResetProviderCircuit).toHaveBeenCalledWith('PROVIDER_OPENAI');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockCircuit,
        message: 'Circuit PROVIDER_OPENAI reset',
      });
    });
  });
});
