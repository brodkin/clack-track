/**
 * Wrong Number Voicemail Dictionaries
 *
 * Provides variability seeds for the Wrong Number Voicemail Generator.
 * These dictionaries ensure high content variability by combining:
 * - 15 caller archetypes (voice energy, not specific characters)
 * - 20 situation domains (category of chaos, not specific scenarios)
 * - 4 urgency levels (emotional tone of the message)
 *
 * Design principles:
 * - Archetypes define WHO is calling (energy/voice type, not names)
 * - Domains define WHAT category of mess (not specific incidents)
 * - Urgency sets the emotional tone without scripting content
 * - All selections use true randomness via Math.random()
 *
 * These are SEEDS not SCRIPTS - they point the LLM toward a domain
 * of chaos without forcing specific jokes or characters.
 *
 * @example
 * ```typescript
 * import {
 *   CALLER_ARCHETYPES,
 *   SITUATION_DOMAINS,
 *   URGENCY_LEVELS,
 *   selectRandomItem,
 * } from './wrong-number-voicemail-dictionaries.js';
 *
 * const archetype = selectRandomItem(CALLER_ARCHETYPES);
 * const domain = selectRandomItem(SITUATION_DOMAINS);
 * const urgency = selectRandomItem(URGENCY_LEVELS);
 * ```
 */

/**
 * Caller archetypes for voicemail generation.
 *
 * Each archetype defines the ENERGY and VOICE of the caller,
 * not a specific character. The LLM invents names, relationships,
 * and specifics based on the archetype's general vibe.
 *
 * Categories:
 * - Panic spectrum (frantic to suspiciously calm)
 * - Professional energy (formal, harried, confused)
 * - Quirky energy (rambling, breathless, deadpan)
 * - Cryptic energy (vague, ominous, mysterious)
 * - Misc (coordinators, apologizers, cheerful disaster reporters)
 *
 * 15 archetypes = ~7% chance per archetype
 */
export const CALLER_ARCHETYPES = [
  // Panic spectrum (4)
  'FRANTIC_NEIGHBOR',
  'PANICKED_RELATIVE',
  'SUSPICIOUSLY_CALM_FRIEND',
  'RESIGNED_REPEAT_CALLER',

  // Professional energy (3)
  'CONFUSED_PROFESSIONAL',
  'OVERLY_FORMAL_STRANGER',
  'HARRIED_SERVICE_WORKER',

  // Quirky energy (3)
  'RAMBLING_ELDERLY_CALLER',
  'BREATHLESS_TEENAGER',
  'DEADPAN_MONOTONE',

  // Cryptic energy (3)
  'CRYPTIC_ACQUAINTANCE',
  'VAGUE_AUTHORITY_FIGURE',
  'CHEERFUL_DISASTER_REPORTER',

  // Misc (2)
  'EXASPERATED_COORDINATOR',
  'APOLOGETIC_MESS_MAKER',
] as const;

/**
 * Situation domains for voicemail generation.
 *
 * Each domain defines a CATEGORY of chaos, not a specific incident.
 * The LLM invents the specific scenario, characters, and details
 * based on the domain's general territory.
 *
 * Categories:
 * - Creature chaos (animals, insects, wildlife)
 * - Domestic disasters (appliances, plumbing, deliveries)
 * - Social chaos (events, family, neighbors)
 * - Logistical nightmares (transport, scheduling, lost items)
 * - Mysterious situations (phenomena, identity, bureaucracy)
 * - Escalating problems (spiraling, favors, DIY, food, tech)
 *
 * 20 domains = 5% chance per domain
 */
export const SITUATION_DOMAINS = [
  // Creature chaos (3)
  'ANIMAL_INCIDENT',
  'INSECT_SITUATION',
  'WILDLIFE_ENCOUNTER',

  // Domestic disasters (3)
  'APPLIANCE_MALFUNCTION',
  'PLUMBING_CATASTROPHE',
  'MYSTERIOUS_DELIVERY',

  // Social chaos (3)
  'EVENT_GONE_WRONG',
  'FAMILY_DRAMA',
  'NEIGHBOR_DISPUTE',

  // Logistical nightmares (3)
  'TRANSPORTATION_CHAOS',
  'SCHEDULING_DISASTER',
  'LOST_ITEM_CRISIS',

  // Mysterious situations (3)
  'UNEXPLAINED_PHENOMENON',
  'MISTAKEN_IDENTITY',
  'BUREAUCRATIC_NIGHTMARE',

  // Escalating problems (5)
  'MINOR_ISSUE_SPIRALED',
  'FAVOR_GONE_WRONG',
  'DIY_DISASTER',
  'FOOD_SITUATION',
  'TECH_MELTDOWN',
] as const;

/**
 * Urgency levels for voicemail generation.
 *
 * Sets the emotional tone of the message without scripting content.
 * The contrast between urgency and content creates humor.
 *
 * 4 levels = 25% chance per level
 */
export const URGENCY_LEVELS = [
  'CALM_BUT_CONCERNING',
  'INCREASINGLY_WORRIED',
  'FULL_PANIC',
  'SUSPICIOUSLY_CALM',
] as const;

/**
 * Type for caller archetype values.
 */
export type CallerArchetype = (typeof CALLER_ARCHETYPES)[number];

/**
 * Type for situation domain values.
 */
export type SituationDomain = (typeof SITUATION_DOMAINS)[number];

/**
 * Type for urgency level values.
 */
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

/**
 * Selects a random item from an array using Math.random().
 *
 * Uses true programmatic randomness rather than LLM-based selection,
 * which exhibits bias toward certain items.
 *
 * @typeParam T - Type of array elements
 * @param array - Array to select from (must have at least one element)
 * @returns Randomly selected element
 *
 * @example
 * ```typescript
 * const archetype = selectRandomItem(CALLER_ARCHETYPES);
 * // Returns one of the 15 caller archetypes
 * ```
 */
export function selectRandomItem<T>(array: readonly T[]): T {
  if (array.length === 0) {
    throw new Error('Cannot select from empty array');
  }
  const index = Math.floor(Math.random() * array.length);
  return array[index];
}

/**
 * Gets a random caller archetype.
 *
 * Convenience wrapper around selectRandomItem for caller archetypes.
 *
 * @returns Randomly selected caller archetype
 */
export function getRandomCallerArchetype(): CallerArchetype {
  return selectRandomItem(CALLER_ARCHETYPES);
}

/**
 * Gets a random situation domain.
 *
 * Convenience wrapper around selectRandomItem for situation domains.
 *
 * @returns Randomly selected situation domain
 */
export function getRandomSituationDomain(): SituationDomain {
  return selectRandomItem(SITUATION_DOMAINS);
}

/**
 * Gets a random urgency level.
 *
 * Convenience wrapper around selectRandomItem for urgency levels.
 *
 * @returns Randomly selected urgency level
 */
export function getRandomUrgencyLevel(): UrgencyLevel {
  return selectRandomItem(URGENCY_LEVELS);
}
