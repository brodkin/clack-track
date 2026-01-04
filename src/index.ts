// CRITICAL: Load dotenv FIRST before any other imports that might use process.env
// Preserve NODE_ENV if already set (e.g., by Jest test runner)
const preserveNodeEnv = process.env.NODE_ENV;
import dotenv from 'dotenv';
dotenv.config({ override: true });
if (preserveNodeEnv) {
  process.env.NODE_ENV = preserveNodeEnv;
}

import { WebServer } from './web/server.js';
import { config } from './config/env.js';
import { runCLI } from './cli/index.js';
import { bootstrap } from './bootstrap.js';

async function main() {
  // Check if running as CLI command
  const args = process.argv;
  const command = args[2];

  // If a CLI command is provided, run CLI mode
  if (
    command &&
    [
      'generate',
      'test-board',
      'test-ai',
      'test-ha',
      'frame',
      'content:list',
      'content:test',
    ].includes(command)
  ) {
    await runCLI(args);
    return;
  }

  // Otherwise, start web server
  console.log('Clack Track starting...');

  // Check if web server is enabled
  if (!config.web.enabled) {
    console.log('Web server disabled via WEB_SERVER_ENABLED=false');
    console.log('Running in headless mode (CLI commands only)');
    return;
  }

  // Initialize web server
  const webServer = new WebServer({
    port: config.web.port,
    host: config.web.host,
    corsEnabled: config.web.corsEnabled,
    staticPath: config.web.staticPath,
  });

  try {
    await webServer.start();
    console.log(`Web interface available at http://${config.web.host}:${config.web.port}`);
  } catch (error) {
    console.error('Failed to start web server:', error);
    process.exit(1);
  }

  // Initialize all components via bootstrap
  console.log('Initializing daemon components...');
  const { scheduler, eventHandler, haClient, database } = await bootstrap();

  // Start the scheduler for minute-by-minute minor updates
  scheduler.start();
  console.log('Scheduler started for periodic minor updates');

  // Initialize Home Assistant event handler if configured
  // HA connection failures are non-fatal - app continues without event-driven updates
  if (eventHandler) {
    try {
      await eventHandler.initialize();
      console.log('Home Assistant event handler initialized');
    } catch (error) {
      console.error(
        'Home Assistant event handler failed to initialize:',
        error instanceof Error ? error.message : String(error)
      );
      console.log('Continuing without Home Assistant integration');
    }
  }

  // Register graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);

    // Stop scheduler first to prevent new updates
    scheduler.stop();
    console.log('Scheduler stopped');

    // Disconnect Home Assistant client if configured
    if (haClient) {
      await haClient.disconnect();
      console.log('Home Assistant client disconnected');
    }

    // Disconnect database if configured
    if (database) {
      await database.disconnect();
      console.log('Database disconnected');
    }

    // Stop web server
    await webServer.stop();
    console.log('Web server stopped');

    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  console.log('Clack Track daemon running');
}

main();

export { main };
