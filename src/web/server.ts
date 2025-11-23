import { log } from '../utils/logger.js';

export class WebServer {
  private port: number;
  private server: unknown; // TODO: Replace with actual HTTP server type

  constructor(port: number = 3000) {
    this.port = port;
  }

  async start(): Promise<void> {
    // TODO: Implement web server startup
    // 1. Set up Express/Fastify/other framework
    // 2. Register routes from ./routes
    // 3. Serve static files from public/
    // 4. Start listening
    log(`Web server would start on port ${this.port}`);
    throw new Error('Not implemented');
  }

  async stop(): Promise<void> {
    // TODO: Implement graceful shutdown
    log('Web server stopped');
  }
}
