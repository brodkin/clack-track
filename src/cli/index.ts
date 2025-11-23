import { generateCommand, testBoardCommand } from './commands/index.js';

export async function runCLI(args: string[]): Promise<void> {
  const command = args[2]; // First two args are node and script path

  // TODO: Implement proper CLI argument parsing (consider using yargs or commander)
  switch (command) {
    case 'generate':
      await generateCommand({ type: 'major' });
      break;
    case 'test-board':
      await testBoardCommand();
      break;
    default:
      console.log(`
Clack Track CLI

Usage:
  npm run generate        Generate and send major content update
  npm run test-board      Test Vestaboard connection

Available commands:
  generate      Generate new content and send to Vestaboard
  test-board    Test connection to Vestaboard
      `);
  }
}
