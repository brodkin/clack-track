import { generateCommand, testBoardCommand, testAICommand } from './commands/index.js';

export async function runCLI(args: string[]): Promise<void> {
  const command = args[2]; // First two args are node and script path

  // Parse basic flags
  const parseOptions = (args: string[]) => {
    const options: Record<string, string | boolean> = {};
    for (let i = 3; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
        options[key] = value;
        if (value !== true) i++; // Skip next arg if it was used as a value
      }
    }
    return options;
  };

  switch (command) {
    case 'generate':
      await generateCommand({ type: 'major' });
      break;
    case 'test-board':
      await testBoardCommand();
      break;
    case 'test-ai': {
      const options = parseOptions(args);
      await testAICommand({
        provider: typeof options.provider === 'string' ? options.provider : 'all',
        interactive: typeof options.interactive === 'boolean' ? options.interactive : false,
        customPrompt: typeof options.prompt === 'string' ? options.prompt : undefined,
      });
      break;
    }
    default:
      console.log(`
Clack Track CLI

Usage:
  npm run generate                  Generate and send major content update
  npm run test-board                Test Vestaboard connection
  npm run test:ai [options]         Test AI provider connectivity

Available commands:
  generate      Generate new content and send to Vestaboard
  test-board    Test connection to Vestaboard
  test-ai       Test AI provider connectivity

Test AI Options:
  --provider <name>    Provider to test: openai, anthropic, or all (default: all)
  --interactive        Enable interactive mode
  --prompt <text>      Custom prompt to test with
      `);
  }
}
