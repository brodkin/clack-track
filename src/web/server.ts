import express, { Express } from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import { Server } from 'http';
import { log } from '../utils/logger.js';
import { createRateLimiter } from './middleware/rate-limit.js';
import { createAuthRouter } from './routes/auth.js';
import { createAccountRouter } from './routes/account.js';
import { pushRouter } from './routes/push.js';

export interface WebServerConfig {
  port?: number;
  host?: string;
  corsEnabled?: boolean;
  staticPath?: string;
}

/**
 * WebServer class - Handles HTTP server lifecycle with Express
 *
 * Implements Dependency Inversion Principle (SOLID):
 * - Accepts configuration via constructor injection
 * - Can be tested independently with mocked dependencies
 *
 * Single Responsibility:
 * - Only manages web server lifecycle (start/stop)
 * - Routes are registered separately
 */
export class WebServer {
  private port: number;
  private host: string;
  private corsEnabled: boolean;
  private staticPath: string;
  private app: Express;
  private server: Server | null = null;
  private signalHandlers: { [key: string]: NodeJS.SignalsListener } = {};

  constructor(config: WebServerConfig = {}) {
    this.port = config.port ?? 3000;
    this.host = config.host ?? '0.0.0.0';
    this.corsEnabled = config.corsEnabled ?? false;
    this.staticPath = config.staticPath ?? './src/web/frontend/dist';
    this.app = express();
  }

  async start(): Promise<void> {
    if (this.server) {
      throw new Error('Server is already running');
    }

    // Set up middleware
    this.setupMiddleware();

    // Start listening
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, this.host, () => {
          log(`Web server listening on http://${this.host}:${this.port}`);
          resolve();
        });

        // Register signal handlers for graceful shutdown
        this.registerSignalHandlers();
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    // Clean up signal handlers
    this.cleanupSignalHandlers();

    return new Promise(resolve => {
      this.server!.close(err => {
        if (err) {
          log(`Warning: Error during server shutdown: ${err.message}`);
        } else {
          log('Web server stopped');
        }
        this.server = null;
        resolve();
      });
    });
  }

  private setupMiddleware(): void {
    // Security headers middleware (must be first for security-first ordering)
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
      })
    );

    // Compression middleware for response optimization
    this.app.use(compression());

    // CORS middleware (typically for development)
    if (this.corsEnabled) {
      this.app.use(cors());
    }

    // Rate limiting middleware for API routes
    // Default: 100 requests per 15 minutes per IP
    // Configurable via environment variables:
    // - RATE_LIMIT_WINDOW_MS (time window in milliseconds)
    // - RATE_LIMIT_MAX_REQUESTS (max requests per window)
    const rateLimiter = createRateLimiter();
    this.app.use('/api', rateLimiter);

    // Static file serving
    this.app.use(express.static(this.staticPath));

    // JSON body parsing
    this.app.use(express.json());

    // Register API routes
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Authentication routes
    const authRouter = createAuthRouter();
    this.app.use('/api/auth', authRouter);

    // Account management routes
    const accountRouter = createAccountRouter();
    this.app.use('/api/account', accountRouter);

    // Push notification routes
    this.app.use('/api/push', pushRouter);
  }

  private registerSignalHandlers(): void {
    // Remove existing handlers if any
    this.cleanupSignalHandlers();

    const gracefulShutdown = async (signal: string) => {
      log(`Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    // Create and store new handlers
    this.signalHandlers['SIGTERM'] = () => gracefulShutdown('SIGTERM');
    this.signalHandlers['SIGINT'] = () => gracefulShutdown('SIGINT');

    // Register handlers
    process.on('SIGTERM', this.signalHandlers['SIGTERM']);
    process.on('SIGINT', this.signalHandlers['SIGINT']);
  }

  private cleanupSignalHandlers(): void {
    if (this.signalHandlers['SIGTERM']) {
      process.off('SIGTERM', this.signalHandlers['SIGTERM']);
    }
    if (this.signalHandlers['SIGINT']) {
      process.off('SIGINT', this.signalHandlers['SIGINT']);
    }
  }
}
