import {
  generateCommand,
  testBoardCommand,
  testAICommand,
  testHACommand,
  contentListCommand,
  contentTestCommand,
  dbResetCommand,
} from './commands/index.js';
import { frameCommand } from './commands/frame.js';

// Define flags that are boolean (don't expect values)
const BOOLEAN_FLAGS = new Set([
  'skip-weather',
  'skip-colors',
  'verbose',
  'v',
  'interactive',
  'list',
  'with-frame',
  'truncate',
  'seed',
  'force',
]);

export async function runCLI(args: string[]): Promise<void> {
  const command = args[2]; // First two args are node and script path

  // Parse basic flags
  const parseOptions = (args: string[]) => {
    const options: Record<string, string | boolean> = {};
    for (let i = 3; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        // Only capture next arg as value if this flag is NOT a boolean flag
        const isBooleanFlag = BOOLEAN_FLAGS.has(key);
        const value =
          !isBooleanFlag && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
        options[key] = value;
        if (value !== true) i++; // Skip next arg if it was used as a value
      }
    }
    return options;
  };

  switch (command) {
    case 'generate': {
      const options = parseOptions(args);
      await generateCommand({
        type: 'major',
        generator: typeof options.generator === 'string' ? options.generator : undefined,
      });
      break;
    }
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
    case 'test-ha': {
      const options = parseOptions(args);
      await testHACommand({
        list: typeof options.list === 'boolean' ? options.list : false,
        entity: typeof options.entity === 'string' ? options.entity : undefined,
        watch: typeof options.watch === 'string' ? options.watch : undefined,
      });
      break;
    }
    case 'frame': {
      const options = parseOptions(args);
      // Find the first positional argument (not a flag or flag value)
      let textArg: string | undefined;
      for (let i = 3; i < args.length; i++) {
        const arg = args[i];
        if (!arg.startsWith('--')) {
          // Check if this is a value for a preceding non-boolean flag
          const prevArg = args[i - 1];
          if (prevArg?.startsWith('--') && !BOOLEAN_FLAGS.has(prevArg.slice(2))) {
            // This is a value for a flag, skip it
            continue;
          }
          textArg = arg;
          break;
        }
      }
      await frameCommand({
        text: typeof options.text === 'string' ? options.text : textArg,
        skipWeather: options['skip-weather'] === true,
        skipColors: options['skip-colors'] === true,
        verbose: options.verbose === true || options.v === true,
      });
      break;
    }
    case 'content:list':
      await contentListCommand();
      break;
    case 'content:test': {
      const options = parseOptions(args);
      const generatorId = args[3] && !args[3].startsWith('--') ? args[3] : undefined;
      await contentTestCommand({
        generatorId,
        withFrame: options['with-frame'] === true,
      });
      break;
    }
    case 'db:reset': {
      const options = parseOptions(args);
      await dbResetCommand({
        truncate: options.truncate === true,
        seed: options.seed === true,
        force: options.force === true,
      });
      break;
    }
    default:
      console.log(`
Clack Track CLI

Usage:
  npm run generate [--generator <id>]   Generate and send major content update
  npm run test-board                    Test Vestaboard connection
  npm run test:ai [options]             Test AI provider connectivity
  npm run test:ha [options]             Test Home Assistant connectivity
  npm run frame [text] [options]        Generate and preview a Vestaboard frame
  npm run content:list                  List all registered content generators
  npm run content:test <id> [options]   Test a specific generator without sending
  npm run db:reset [options]            Reset database (development/test only)

Available commands:
  generate        Generate new content and send to Vestaboard
  test-board      Test connection to Vestaboard
  test-ai         Test AI provider connectivity
  test-ha         Test Home Assistant connectivity
  frame           Generate and preview a Vestaboard frame
  content:list    List all registered content generators
  content:test    Test a specific generator (dry run)
  db:reset        Reset database with safety guards (dev/test only)

Generate Options:
  --generator <id>     Force specific generator (use content:list to see IDs)

Test AI Options:
  --provider <name>    Provider to test: openai, anthropic, or all (default: all)
  --interactive        Enable interactive mode
  --prompt <text>      Custom prompt to test with

Test HA Options:
  --list               List all entities
  --entity <id>        Get specific entity state (e.g., light.living_room)
  --watch <event>      Subscribe to events for 30 seconds (e.g., state_changed)

Frame Options:
  --skip-weather       Skip weather/HA integration
  --skip-colors        Skip AI color selection
  --verbose, -v        Show timing breakdown for service calls

Content Test Options:
  --with-frame         Apply frame decoration to generated content

DB Reset Options:
  --truncate           Truncate tables instead of dropping (keeps schema)
  --seed               Run seeds after reset
  --force              Skip confirmation prompts (for CI/CD)
      `);
  }
}
