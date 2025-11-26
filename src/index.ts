// CRITICAL: Load dotenv FIRST before any other imports that might use process.env
import dotenv from 'dotenv';
dotenv.config({ override: true });

import { WebServer } from './web/server.js';
import { config } from './config/env.js';
import { runCLI } from './cli/index.js';

async function main() {
  // Check if running as CLI command
  const args = process.argv;
  const command = args[2];

  // If a CLI command is provided, run CLI mode
  if (command && ['generate', 'test-board', 'test-ai', 'test-ha', 'frame'].includes(command)) {
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
}

main();

export { main };
