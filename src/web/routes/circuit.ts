/**
 * Circuit Breaker API Routes
 *
 * REST API endpoints for managing circuit breaker states.
 * Provides endpoints for listing, viewing, enabling, disabling, and resetting circuits.
 *
 * SECURITY: All routes require authentication via requireAuth middleware.
 * This protects admin operations (enabling/disabling MASTER circuit, SLEEP_MODE, etc.)
 *
 * @module web/routes/circuit
 */

import { Router } from 'express';
import { Request, Response, WebDependencies } from '../types.js';
import type { CircuitBreakerService } from '../../services/circuit-breaker-service.js';
import { requireAuth } from './account.js';

/**
 * Extended WebDependencies with circuit breaker service
 */
export interface CircuitDependencies extends WebDependencies {
  /** Circuit breaker service for state management */
  circuitBreakerService?: CircuitBreakerService;
}

/**
 * GET /api/circuits
 * Returns all circuits with their current state and metadata
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param service - CircuitBreakerService instance (required for operation)
 */
export async function getAllCircuits(
  req: Request,
  res: Response,
  service?: CircuitBreakerService
): Promise<void> {
  // Return 503 if service not available (graceful degradation)
  if (!service) {
    res.status(503).json({
      success: false,
      error: 'Circuit breaker service unavailable',
    });
    return;
  }

  try {
    const circuits = await service.getAllCircuits();

    res.json({
      success: true,
      data: circuits,
    });
  } catch (error) {
    console.error('Error retrieving circuits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve circuits',
    });
  }
}

/**
 * GET /api/circuits/:id
 * Returns a single circuit's status by its ID
 *
 * @param req - Express request object with params.id
 * @param res - Express response object
 * @param service - CircuitBreakerService instance (required for operation)
 */
export async function getCircuitById(
  req: Request,
  res: Response,
  service?: CircuitBreakerService
): Promise<void> {
  // Return 503 if service not available (graceful degradation)
  if (!service) {
    res.status(503).json({
      success: false,
      error: 'Circuit breaker service unavailable',
    });
    return;
  }

  try {
    const circuitId = req.params.id;
    const circuit = await service.getCircuitStatus(circuitId);

    if (!circuit) {
      res.status(404).json({
        success: false,
        error: `Circuit not found: ${circuitId}`,
      });
      return;
    }

    res.json({
      success: true,
      data: circuit,
    });
  } catch (error) {
    console.error('Error retrieving circuit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve circuit',
    });
  }
}

/**
 * POST /api/circuits/:id/on
 * Enables a circuit (sets state to 'on')
 *
 * @param req - Express request object with params.id
 * @param res - Express response object
 * @param service - CircuitBreakerService instance (required for operation)
 */
export async function enableCircuit(
  req: Request,
  res: Response,
  service?: CircuitBreakerService
): Promise<void> {
  // Return 503 if service not available (graceful degradation)
  if (!service) {
    res.status(503).json({
      success: false,
      error: 'Circuit breaker service unavailable',
    });
    return;
  }

  try {
    const circuitId = req.params.id;

    await service.setCircuitState(circuitId, 'on');

    // Fetch updated circuit to return in response
    const circuit = await service.getCircuitStatus(circuitId);

    if (!circuit) {
      res.status(404).json({
        success: false,
        error: `Circuit not found: ${circuitId}`,
      });
      return;
    }

    res.json({
      success: true,
      data: circuit,
      message: `Circuit ${circuitId} enabled`,
    });
  } catch (error) {
    console.error('Error enabling circuit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable circuit',
    });
  }
}

/**
 * POST /api/circuits/:id/off
 * Disables a circuit (sets state to 'off')
 *
 * @param req - Express request object with params.id
 * @param res - Express response object
 * @param service - CircuitBreakerService instance (required for operation)
 */
export async function disableCircuit(
  req: Request,
  res: Response,
  service?: CircuitBreakerService
): Promise<void> {
  // Return 503 if service not available (graceful degradation)
  if (!service) {
    res.status(503).json({
      success: false,
      error: 'Circuit breaker service unavailable',
    });
    return;
  }

  try {
    const circuitId = req.params.id;

    await service.setCircuitState(circuitId, 'off');

    // Fetch updated circuit to return in response
    const circuit = await service.getCircuitStatus(circuitId);

    if (!circuit) {
      res.status(404).json({
        success: false,
        error: `Circuit not found: ${circuitId}`,
      });
      return;
    }

    res.json({
      success: true,
      data: circuit,
      message: `Circuit ${circuitId} disabled`,
    });
  } catch (error) {
    console.error('Error disabling circuit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable circuit',
    });
  }
}

/**
 * POST /api/circuits/:id/reset
 * Resets a provider circuit (counters to 0, state to ON)
 * Only available for provider circuits, not manual circuits.
 *
 * @param req - Express request object with params.id
 * @param res - Express response object
 * @param service - CircuitBreakerService instance (required for operation)
 */
export async function resetCircuit(
  req: Request,
  res: Response,
  service?: CircuitBreakerService
): Promise<void> {
  // Return 503 if service not available (graceful degradation)
  if (!service) {
    res.status(503).json({
      success: false,
      error: 'Circuit breaker service unavailable',
    });
    return;
  }

  try {
    const circuitId = req.params.id;

    // First check if circuit exists and is a provider circuit
    const existingCircuit = await service.getCircuitStatus(circuitId);

    if (!existingCircuit) {
      res.status(404).json({
        success: false,
        error: `Circuit not found: ${circuitId}`,
      });
      return;
    }

    // Reset is only valid for provider circuits
    if (existingCircuit.circuitType !== 'provider') {
      res.status(400).json({
        success: false,
        error:
          'Reset is only available for provider circuits. Use /on or /off for manual circuits.',
      });
      return;
    }

    await service.resetProviderCircuit(circuitId);

    // Fetch updated circuit to return in response
    const circuit = await service.getCircuitStatus(circuitId);

    res.json({
      success: true,
      data: circuit,
      message: `Circuit ${circuitId} reset`,
    });
  } catch (error) {
    console.error('Error resetting circuit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset circuit',
    });
  }
}

/**
 * Create and configure circuit router
 *
 * @param dependencies - CircuitDependencies containing circuitBreakerService
 * @returns Express router with circuit routes
 */
export function createCircuitRouter(dependencies: CircuitDependencies = {}): Router {
  const router = Router();
  const { circuitBreakerService } = dependencies;

  // All circuit routes require authentication
  // This protects admin operations like enabling/disabling MASTER circuit
  router.use(requireAuth);

  // GET /api/circuits - List all circuits
  router.get('/', (req, res) =>
    getAllCircuits(req as Request, res as Response, circuitBreakerService)
  );

  // GET /api/circuits/:id - Get single circuit
  router.get('/:id', (req, res) =>
    getCircuitById(req as Request, res as Response, circuitBreakerService)
  );

  // POST /api/circuits/:id/on - Enable circuit
  router.post('/:id/on', (req, res) =>
    enableCircuit(req as Request, res as Response, circuitBreakerService)
  );

  // POST /api/circuits/:id/off - Disable circuit
  router.post('/:id/off', (req, res) =>
    disableCircuit(req as Request, res as Response, circuitBreakerService)
  );

  // POST /api/circuits/:id/reset - Reset provider circuit
  router.post('/:id/reset', (req, res) =>
    resetCircuit(req as Request, res as Response, circuitBreakerService)
  );

  return router;
}
