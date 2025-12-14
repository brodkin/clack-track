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
import { closeKnexInstance } from './storage/knex.js';

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

  // Bootstrap to get knex, repositories, and orchestrator
  const {
    knex,
    contentRepository,
    voteRepository,
    logModel,
    scheduler,
    eventHandler,
    orchestrator,
  } = await bootstrap();

  // Create WebServer with dependencies
  const webServer = new WebServer(
    {
      port: config.web.port,
      host: config.web.host,
      corsEnabled: config.web.corsEnabled,
      staticPath: config.web.staticPath,
    },
    { contentRepository, voteRepository, logModel }
  );

  try {
    await webServer.start();
    console.log(`Web interface available at http://${config.web.host}:${config.web.port}`);

    // Run initial major update to populate cache for minor updates
    // This ensures the first minor update has content to work with
    try {
      console.log('Running initial major content update...');
      await orchestrator.generateAndSend({
        updateType: 'major',
        timestamp: new Date(),
      });
      console.log('Initial major update completed');
    } catch (error) {
      console.warn('Initial major update failed, minor updates will retry:', error);
    }

    scheduler.start();
    if (eventHandler) await eventHandler.initialize();

    // Register coordinated signal handlers for graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      try {
        await webServer.stop();
        scheduler.stop();
        if (eventHandler) await eventHandler.shutdown();
        if (knex) await closeKnexInstance();
        process.exit(0);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => {
      gracefulShutdown('SIGTERM').catch(err => {
        console.error('Fatal error during shutdown:', err);
        process.exit(1);
      });
    });
    process.on('SIGINT', () => {
      gracefulShutdown('SIGINT').catch(err => {
        console.error('Fatal error during shutdown:', err);
        process.exit(1);
      });
    });
  } catch (error) {
    console.error('Failed to start web server:', error);
    scheduler.stop();
    if (eventHandler) await eventHandler.shutdown();
    if (knex) await closeKnexInstance();
    process.exit(1);
  }
}

main();

export { main };
