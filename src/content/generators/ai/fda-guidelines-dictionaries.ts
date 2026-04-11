/**
 * FDA Guidelines Dictionaries
 *
 * Provides variability seeds for the FDA Guidelines Generator.
 * These dictionaries ensure high content variability by combining:
 * - 12 regulatory bodies (which agency/country)
 * - ~80 topic sub-areas across 10 categories (what area of food regulation)
 * - 8 presentation angles (how the fact is framed)
 *
 * Design principles:
 * - Bodies define the REGULATORY AUTHORITY (not specific laws)
 * - Topics define the SUBJECT AREA (not specific facts)
 * - Angles define the PRESENTATION FRAME (not the content)
 * - All selections use true randomness via Math.random()
 *
 * These are SEEDS not SCRIPTS - they point the LLM toward a domain
 * of regulatory trivia without forcing specific facts.
 *
 * Total combinations: 12 x ~80 x 8 = ~7,680
 *
 * @example
 * ```typescript
 * import {
 *   REGULATORY_BODIES,
 *   PRESENTATION_ANGLES,
 *   selectRandomItem,
 *   selectRandomCategory,
 *   selectRandomTopic,
 * } from './fda-guidelines-dictionaries.js';
 *
 * const body = selectRandomItem(REGULATORY_BODIES);
 * const category = selectRandomCategory();
 * const topic = selectRandomTopic(category);
 * const angle = selectRandomItem(PRESENTATION_ANGLES);
 * ```
 */

/**
 * Regulatory bodies and food safety agencies worldwide.
 *
 * Each entry represents a government agency or international body
 * that sets food standards. The LLM uses its knowledge of each
 * body's regulations to produce specific, accurate facts.
 *
 * 12 entries = ~8% chance per body per generation.
 */
export const REGULATORY_BODIES = [
  'US_FDA',
  'USDA',
  'EU_COMMISSION',
  'JAPAN_MHLW',
  'CANADA_CFIA',
  'UK_FSA',
  'AUSTRALIA_FSANZ',
  'CODEX_ALIMENTARIUS',
  'SOUTH_KOREA_MFDS',
  'INDIA_FSSAI',
  'BRAZIL_ANVISA',
  'MEXICO_COFEPRIS',
] as const;

/**
 * Topic categories with nested sub-topics for food regulation facts.
 *
 * Each category contains 8 sub-topics that represent specific areas
 * of food regulation. The nested structure ensures broad coverage
 * across very different regulatory domains.
 *
 * 10 categories x 8 sub-topics = 80 total sub-topics.
 */
export const TOPIC_CATEGORIES = {
  FOOD_DEFINITIONS: [
    'identity standards for dairy products',
    'identity standards for bread and bakery',
    'identity standards for fruit and fruit products',
    'identity standards for seafood and fish products',
    'identity standards for meat and poultry products',
    'identity standards for condiments and sauces',
    'identity standards for eggs and egg products',
    'identity standards for confections and chocolate',
  ],
  GRADING_AND_CLASSIFICATION: [
    'egg grading standards and candling',
    'beef grading and marbling scales',
    'poultry inspection and classification',
    'fruit and vegetable grade standards',
    'maple syrup grading and color classes',
    'olive oil classification and purity tests',
    'honey grading and moisture requirements',
    'butter grading and scoring systems',
  ],
  LABELING_RULES: [
    'what qualifies as a serving size',
    'rules for health claims on packaging',
    'rules for nutrient content claims',
    'allergen labeling requirements',
    'country of origin labeling laws',
    'organic certification requirements',
    'non-gmo labeling standards',
    'date labeling and expiration conventions',
  ],
  INGREDIENT_REGULATIONS: [
    'gras (generally recognized as safe) status',
    'permitted food colorings and dyes',
    'approved artificial sweeteners',
    'preservative limits and thresholds',
    'permissible insect fragment tolerances',
    'acceptable mold count limits',
    'rodent hair tolerances in food',
    'moisture and fill requirements',
  ],
  BEVERAGES: [
    'what legally qualifies as juice vs drink',
    'alcohol content thresholds and labeling',
    'milk pasteurization requirements',
    'bottled water standards and classifications',
    'coffee and tea grading standards',
    'wine appellation and classification rules',
    'beer ingredient purity laws',
    'kombucha alcohol content regulations',
  ],
  RESTAURANT_AND_MENU: [
    'menu calorie disclosure requirements',
    'allergen notification rules for restaurants',
    'truth in menu laws and food descriptions',
    'claims like fresh or homemade on menus',
    'seafood substitution and naming rules',
    'portion size standards for menu claims',
    'gluten free kitchen requirements',
    'raw food disclosure requirements',
  ],
  PROCESSING_AND_SAFETY: [
    'pasteurization temperature and time standards',
    'canning and botulism prevention rules',
    'irradiation approval and labeling',
    'haccp requirements for food processors',
    'cold chain temperature requirements',
    'water activity thresholds for shelf stability',
    'thermal processing for low acid foods',
    'fermentation safety and ph requirements',
  ],
  INTERNATIONAL_QUIRKS: [
    'foods banned in some countries but legal in others',
    'naming disputes between countries over food terms',
    'protected designation of origin rules',
    'traditional specialty guaranteed labels',
    'maximum additive limits that vary by country',
    'food safety incident response protocols',
    'import restriction differences between nations',
    'cultural food definition controversies',
  ],
  PACKAGING_AND_PORTIONS: [
    'package fill requirements and slack fill laws',
    'standard of identity for container sizes',
    'net weight and drained weight rules',
    'food contact material safety rules',
    'single serve package definition standards',
    'bulk food labeling requirements',
    'recycling symbol requirements by country',
    'tamper evident packaging requirements',
  ],
  NOVELTY_AND_EDGE_CASES: [
    'regulations for novel foods and insects as food',
    'pet food vs human food regulatory boundaries',
    'dietary supplement vs food classification',
    'medical food vs conventional food rules',
    'infant formula composition requirements',
    'sports nutrition and protein bar regulations',
    'lab grown meat regulatory framework',
    'hemp and cbd food product rules',
  ],
} as const;

/**
 * Presentation angles for framing regulatory facts.
 *
 * Each angle shapes HOW the fact is presented, not WHAT fact
 * is chosen. This creates structural variety in outputs.
 *
 * 8 entries = ~12.5% chance per angle per generation.
 */
export const PRESENTATION_ANGLES = [
  'SURPRISING_DEFINITION',
  'WEIRD_LOOPHOLE',
  'GRADING_TRIVIA',
  'INTERNATIONAL_COMPARISON',
  'HISTORICAL_ORIGIN',
  'INDUSTRY_INSIDER',
  'CONSUMER_PROTECTION',
  'ABSURD_PRECISION',
] as const;

export type RegulatoryBody = (typeof REGULATORY_BODIES)[number];
export type TopicCategory = keyof typeof TOPIC_CATEGORIES;
export type PresentationAngle = (typeof PRESENTATION_ANGLES)[number];

/**
 * Selects a random item from a readonly array using Math.random().
 *
 * @param array - The array to select from
 * @returns A randomly selected item
 * @throws Error if the array is empty
 */
export function selectRandomItem<T>(array: readonly T[]): T {
  if (array.length === 0) {
    throw new Error('Cannot select from empty array');
  }
  const index = Math.floor(Math.random() * array.length);
  return array[index];
}

/**
 * Selects a random topic category key from TOPIC_CATEGORIES.
 *
 * @returns A randomly selected TopicCategory key
 */
export function selectRandomCategory(): TopicCategory {
  const categories = Object.keys(TOPIC_CATEGORIES) as TopicCategory[];
  return selectRandomItem(categories);
}

/**
 * Selects a random sub-topic from a given category.
 *
 * @param category - The topic category to select from
 * @returns A randomly selected sub-topic string
 */
export function selectRandomTopic(category: TopicCategory): string {
  return selectRandomItem(TOPIC_CATEGORIES[category]);
}
