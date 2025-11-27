/**
 * Personality Dimensions Module
 *
 * Generates dynamic personality attributes for AI content generation.
 * Each generation request gets randomized dimensions (mood, energy, humor style)
 * to add variety while maintaining a consistent persona identity.
 *
 * @module content/personality/dimensions
 */

/**
 * Personality dimension configuration for content generation.
 *
 * Dynamic dimensions vary per request, while static dimensions
 * maintain consistent persona identity.
 *
 * @interface PersonalityDimensions
 */
export interface PersonalityDimensions {
  /** Current mood/emotional tone (playful, contemplative, energetic, etc.) */
  mood: string;
  /** Energy level affecting enthusiasm and verbosity */
  energyLevel: string;
  /** Style of humor to employ */
  humorStyle: string;
  /** Current cultural fixation or topic of interest */
  obsession: string;
}

/**
 * Pool of available mood values.
 * Moods affect the emotional tone of generated content.
 */
const MOOD_POOL = [
  'playful',
  'contemplative',
  'energetic',
  'sassy',
  'irreverent',
  'tender',
  'dramatic',
  'chill',
] as const;

/**
 * Pool of available energy levels.
 * Energy affects enthusiasm, punctuation, and verbosity.
 */
const ENERGY_POOL = ['high', 'medium', 'chill', 'chaotic'] as const;

/**
 * Pool of available humor styles.
 * Determines the type of wit and comedic approach.
 */
const HUMOR_STYLE_POOL = [
  'dry wit',
  'playful puns',
  'gentle sarcasm',
  'wholesome warmth',
  'campy drama',
] as const;

/**
 * Pool of available obsessions (LA-themed cultural fixations).
 * Topics the persona might reference or weave into content.
 */
const OBSESSION_POOL = [
  'mid-century modern architecture',
  'Taylor Swift deep cuts',
  'Trader Joes seasonal items',
  'LA traffic patterns',
  'questionable 90s fashion',
  'overpriced coffee',
  'plant parenthood',
  'reality TV drama',
  'hiking trail drama',
  'astrology nonsense',
  'vintage thrift finds',
  'the perfect taco',
] as const;

/**
 * Selects a random element from an array.
 *
 * @param array - Array to select from
 * @returns Randomly selected element
 */
function randomFrom<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generates a new set of personality dimensions.
 *
 * Each call produces randomized values from the dimension pools,
 * creating variety in content generation while maintaining
 * the core persona identity.
 *
 * @returns Fresh personality dimensions for content generation
 *
 * @example
 * ```typescript
 * const personality = generatePersonalityDimensions();
 * // {
 * //   mood: 'sassy',
 * //   energyLevel: 'high',
 * //   humorStyle: 'dry wit',
 * //   obsession: 'overpriced coffee'
 * // }
 * ```
 */
export function generatePersonalityDimensions(): PersonalityDimensions {
  return {
    mood: randomFrom(MOOD_POOL),
    energyLevel: randomFrom(ENERGY_POOL),
    humorStyle: randomFrom(HUMOR_STYLE_POOL),
    obsession: randomFrom(OBSESSION_POOL),
  };
}

/**
 * Export pools for testing and introspection
 */
export const DIMENSION_POOLS = {
  mood: MOOD_POOL,
  energy: ENERGY_POOL,
  humor: HUMOR_STYLE_POOL,
  obsession: OBSESSION_POOL,
} as const;
