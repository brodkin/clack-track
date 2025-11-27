/**
 * Content List CLI Command
 *
 * Displays all registered content generators grouped by priority
 * with their metadata (id, name, modelTier, applyFrame).
 *
 * @module cli/commands/content-list
 */

import { ContentRegistry } from '../../content/registry/content-registry.js';
import { ContentPriority } from '../../types/content-generator.js';
import type { RegisteredGenerator } from '../../content/registry/content-registry.js';
import { bootstrap } from '../../bootstrap.js';

/**
 * Priority group display configuration
 */
interface PriorityGroup {
  priority: ContentPriority;
  label: string;
  description: string;
}

/**
 * Priority groups in display order (P0 → P2 → P3)
 */
const PRIORITY_GROUPS: PriorityGroup[] = [
  {
    priority: ContentPriority.NOTIFICATION,
    label: 'P0 - NOTIFICATION',
    description: 'Immediate interrupts from Home Assistant events',
  },
  {
    priority: ContentPriority.NORMAL,
    label: 'P2 - NORMAL',
    description: 'Standard content generation',
  },
  {
    priority: ContentPriority.FALLBACK,
    label: 'P3 - FALLBACK',
    description: 'Static fallback content when AI fails',
  },
];

/**
 * Format a boolean value for display
 */
function formatBoolean(value: boolean | undefined): string {
  // Default applyFrame to true if undefined
  const resolved = value ?? true;
  return resolved ? 'Yes' : 'No';
}

/**
 * Format model tier for display
 */
function formatModelTier(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * Display a single generator in table row format
 */
function displayGenerator(gen: RegisteredGenerator): void {
  const { registration } = gen;

  // Table row with aligned columns
  const id = registration.id.padEnd(25);
  const name = registration.name.padEnd(30);
  const tier = formatModelTier(registration.modelTier).padEnd(8);
  const frame = formatBoolean(registration.applyFrame).padEnd(5);

  console.log(`  │ ${id} │ ${name} │ ${tier} │ ${frame} │`);
}

/**
 * Display a priority group section
 */
function displayPriorityGroup(group: PriorityGroup, generators: RegisteredGenerator[]): void {
  console.log('');
  console.log(
    `┌─ ${group.label} ────────────────────────────────────────────────────────────────────────┐`
  );
  console.log(`│  ${group.description.padEnd(85)} │`);
  console.log(
    '└──────────────────────────────────────────────────────────────────────────────────────┘'
  );

  if (generators.length === 0) {
    console.log('  (none)');
    return;
  }

  // Table header
  console.log('');
  console.log(
    '  ┌─────────────────────────────┬────────────────────────────────┬──────────┬───────┐'
  );
  console.log(
    '  │ ID                          │ Name                           │ Tier     │ Frame │'
  );
  console.log(
    '  ├─────────────────────────────┼────────────────────────────────┼──────────┼───────┤'
  );

  // Table rows
  generators.forEach(displayGenerator);

  // Table footer
  console.log(
    '  └─────────────────────────────┴────────────────────────────────┴──────────┴───────┘'
  );
}

/**
 * Content list command - displays all registered content generators
 *
 * Lists all generators from ContentRegistry grouped by priority level.
 * Shows metadata including id, name, modelTier, and applyFrame status.
 *
 * @example
 * ```typescript
 * // From CLI
 * npm run content:list
 *
 * // Programmatically
 * import { contentListCommand } from './commands/content-list.js';
 * await contentListCommand();
 * ```
 */
export async function contentListCommand(): Promise<void> {
  // Bootstrap to populate the registry with generators
  const { scheduler } = await bootstrap();

  try {
    const registry = ContentRegistry.getInstance();
    const allGenerators = registry.getAll();

    // Display header
    console.log('');
    console.log(
      '═══════════════════════════════════════════════════════════════════════════════════════'
    );
    console.log(
      '                        Registered Content Generators                                  '
    );
    console.log(
      '═══════════════════════════════════════════════════════════════════════════════════════'
    );

    // Display each priority group
    for (const group of PRIORITY_GROUPS) {
      const groupGenerators = registry.getByPriority(group.priority);
      displayPriorityGroup(group, groupGenerators);
    }

    // Display total count
    console.log('');
    console.log(
      '───────────────────────────────────────────────────────────────────────────────────────'
    );
    console.log(`Total: ${allGenerators.length} generator${allGenerators.length === 1 ? '' : 's'}`);
    console.log(
      '═══════════════════════════════════════════════════════════════════════════════════════'
    );
    console.log('');
  } finally {
    // Clean shutdown - stop scheduler
    scheduler.stop();
  }
}
