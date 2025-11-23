import 'dotenv/config';
import { WebServer } from './web/server.js';
import { config } from './config/env.js';

async function main() {
  console.log('Clack Track starting...');

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
