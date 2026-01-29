/**
 * Priceless Parody Dictionaries
 *
 * Provides variability seeds for the Priceless Generator.
 * These dictionaries ensure high content variability by combining:
 * - ~200 scenarios across 13 categories (WHERE/WHEN the scene takes place)
 * - ~75 comedy tropes (the TYPE of comedic failure, not the specific joke)
 * - ~20 tones (the VOICE/REGISTER of delivery)
 *
 * Design principles:
 * - Scenarios set the STAGE (a setting, not a punchline)
 * - Tropes give DIRECTION (a comedy concept, not a specific gag)
 * - Tones set the VOICE (delivery style, not content)
 * - All selections use true randomness via Math.random()
 *
 * These are SEEDS not SCRIPTS - they point the LLM toward a creative
 * territory without writing the joke. The LLM invents the specific
 * items, prices, and priceless reveal.
 *
 * Total combinations: ~200 × 75 × 20 = ~300,000
 *
 * @example
 * ```typescript
 * import {
 *   PRICELESS_SCENARIOS,
 *   PRICELESS_TROPES,
 *   PRICELESS_TONES,
 *   selectRandomItem,
 * } from './priceless-dictionaries.js';
 *
 * const category = selectRandomCategory(PRICELESS_SCENARIOS);
 * const scenario = selectRandomItem(PRICELESS_SCENARIOS[category]);
 * const trope = selectRandomItem(PRICELESS_TROPES);
 * const tone = selectRandomItem(PRICELESS_TONES);
 * ```
 */

// ============================================================================
// SCENARIOS - Where/when the scene takes place (~200 across 13 categories)
// ============================================================================

/**
 * Scenario categories for priceless parodies.
 *
 * Each scenario is a SETTING - a recognizable life situation that
 * provides context for the setup items. The LLM decides what
 * purchases make sense and what goes wrong.
 */
export const PRICELESS_SCENARIOS = {
  /** Professional life situations */
  PROFESSIONAL: [
    'job interview',
    'first day at work',
    'important presentation',
    'performance review',
    'team building exercise',
    'office party',
    'conference talk',
    'salary negotiation',
    'client dinner',
    'exit interview',
    'company all-hands',
    'business trip',
    'expense report',
    'networking event',
    'office fire drill',
    'company softball game',
    'lunch with the boss',
    'elevator pitch',
    'hackathon',
    'onboarding orientation',
  ],

  /** Social outings and gatherings */
  SOCIAL: [
    'first date',
    'meeting the parents',
    'high school reunion',
    'wedding toast',
    'dinner party',
    'housewarming party',
    'neighborhood barbecue',
    'book club meeting',
    'surprise birthday party',
    'game night',
    'baby shower',
    'double date',
    'house party',
    'karaoke night',
    'trivia night',
    'escape room',
    'potluck dinner',
    'beach day with friends',
    'new years eve party',
  ],

  /** Family dynamics */
  FAMILY: [
    'family dinner',
    'thanksgiving',
    'family reunion',
    'holiday photo',
    'parent-teacher conference',
    'school play',
    'family road trip',
    'family game night',
    'holiday gift exchange',
    'graduation ceremony',
    'family vacation',
    'cooking with parents',
    'christmas morning',
    'family zoom call',
    'teaching kid to drive',
    'holiday card photo',
    'easter egg hunt',
    'sibling visit',
    'grandparents birthday',
  ],

  /** Romance and relationships */
  ROMANTIC: [
    'anniversary dinner',
    'the proposal',
    'valentines day',
    'meeting online date',
    'couples cooking class',
    'weekend getaway',
    'meeting their friends',
    'moving in together',
    'wedding planning',
    'honeymoon',
    'engagement party',
    'couples workout',
    'dance class',
    'furniture shopping together',
    'joint bank account setup',
  ],

  /** Everyday errands and routines */
  DAILY_LIFE: [
    'grocery shopping',
    'gym workout',
    'doctor appointment',
    'home improvement project',
    'cooking for guests',
    'self-checkout',
    'parallel parking',
    'getting a haircut',
    'apartment hunting',
    'furniture assembly',
    'morning commute',
    'dentist visit',
    'pharmacy pickup',
    'coffee shop order',
    'return line at store',
    'car inspection',
    'moving day',
    'dog walking',
    'calling customer support',
    'waiting at the dmv',
    'laundry day',
    'yard work',
  ],

  /** Screens and devices */
  TECHNOLOGY: [
    'video call',
    'sending an email',
    'social media post',
    'online dating profile',
    'screen sharing',
    'smart home setup',
    'online review',
    'password reset',
    'software update',
    'printer setup',
    'new phone setup',
    'wifi troubleshooting',
    'online shopping',
    'group chat',
    'podcast recording',
    'streaming setup',
  ],

  /** Eating out and food prep */
  DINING: [
    'fancy restaurant',
    'food truck order',
    'cooking for a date',
    'wine tasting',
    'brunch spot',
    'barbecue cookout',
    'potluck contribution',
    'tasting menu',
    'cooking class',
    'fast food drive through',
    'business lunch',
    'all you can eat challenge',
    'farmers market',
    'coffee shop first date',
    'rehearsal dinner',
  ],

  /** Sports and outdoor activities */
  FITNESS: [
    'marathon',
    'yoga class',
    'spin class',
    'rock climbing',
    'ski trip',
    'hiking adventure',
    'golf outing',
    'tennis match',
    'fun run',
    'crossfit class',
    'personal training session',
    'bowling night',
    'pickup basketball',
    'surfing lesson',
    'ice skating',
  ],

  /** Getting from A to B */
  TRAVEL: [
    'airport security',
    'hotel check-in',
    'overseas vacation',
    'cruise ship',
    'rental car pickup',
    'road trip pit stop',
    'tourist attraction',
    'customs line',
    'flight delay',
    'guided tour',
    'train ride',
    'rideshare',
    'airbnb checkout',
    'passport control',
    'redeye flight',
    'resort pool',
  ],

  /** Buying things */
  SHOPPING: [
    'black friday',
    'car dealership',
    'open house',
    'wedding registry',
    'back to school shopping',
    'garage sale',
    'thrift store',
    'electronics store',
    'pet store visit',
    'hardware store trip',
    'costco run',
    'antique shopping',
    'car buying',
    'luxury store browsing',
  ],

  /** School and learning */
  EDUCATION: [
    'first day of school',
    'college orientation',
    'final exam',
    'class presentation',
    'science fair',
    'study group',
    'thesis defense',
    'field trip',
    'school picture day',
    'prom night',
    'college application',
    'campus tour',
    'alumni event',
    'spelling bee',
  ],

  /** Milestone moments */
  CELEBRATIONS: [
    'birthday party',
    'graduation day',
    'surprise party',
    'retirement party',
    'promotion celebration',
    'new year countdown',
    'championship game watch',
    'baby announcement',
    'gender reveal',
    'farewell party',
    'milestone birthday',
    'award ceremony',
    'housewarming',
    'welcome home party',
    'engagement party',
  ],

  /** Health and self-care */
  WELLNESS: [
    'spa day',
    'therapy session',
    'meditation retreat',
    'new diet start',
    'new year resolution',
    'juice cleanse',
    'sleep tracking',
    'annual physical',
    'eye exam',
    'teeth whitening',
    'massage appointment',
    'health screening',
  ],
} as const;

// ============================================================================
// TROPES - The type of comedic failure (~75 entries)
// ============================================================================

/**
 * Comedy tropes for priceless parodies.
 *
 * Each trope is a CONCEPT - a type of comedic failure that the
 * LLM uses as creative direction. The trope names the comedy
 * pattern, not the specific gag.
 *
 * The LLM invents the specific scenario based on the trope:
 * - "accidental broadcast" could be a hot mic, screen share, smart speaker, etc.
 * - "wrong recipient" could be a text, email, gift, or wave
 *
 * Organized by comedy family for readability, but selected as a flat array.
 */
export const PRICELESS_TROPES = [
  // Exposure & Discovery
  'accidental broadcast',
  'public evidence',
  'digital footprint',
  'the open tab',
  'social media archaeology',
  'the paper trail',
  'the background detail',
  'the metadata betrayal',
  'the algorithm knows',
  'the search history',

  // Wrong Target
  'wrong recipient',
  'mistaken identity',
  'the wrong assumption',
  'the confident misread',
  'the name you forgot',
  'the polite fiction exposed',
  'guilt by association',
  'the lookalike problem',

  // Timing & Sequence
  'unfortunate timing',
  'premature celebration',
  'the cascade failure',
  'the jinx',
  'karmic timing',
  'the slow realization',
  'the awkward encore',
  'the premature goodbye',

  // Self-Inflicted
  'the confident mistake',
  'the bluff called',
  'the humble brag backfire',
  'self-fulfilling prophecy',
  'the double down',
  'the obvious lie',
  'the graceful exit that wasnt',
  'the sunk cost commitment',
  'the cover-up worse than the crime',

  // Witnesses & Audience
  'the unintended audience',
  'the unexpected witness',
  'the honest child',
  'the loyal friend who overshares',
  'the pet that exposes you',
  'the silent professional judgment',
  'overheard confession',
  'the knowing look',

  // Technology & Digital
  'autocorrect chaos',
  'technology betrayal',
  'the shared account',
  'the accidental like',
  'the notification at the worst time',
  'the forwarded message',
  'the group chat leak',
  'the screen you forgot',

  // Physical & Visual
  'wardrobe betrayal',
  'oblivious embarrassment',
  'the mirror you didnt see',
  'the permanent marker moment',
  'the telltale stain',
  'the before and after',

  // Irony & Reversal
  'dramatic irony',
  'the reverse surprise',
  'the wrong lesson learned',
  'becoming what you mocked',
  'the advice that aged poorly',
  'fame for the wrong reason',
  'the fine print',

  // Purchases & Evidence
  'the incriminating receipt',
  'buyers remorse in real time',
  'the warranty just expired',
  'the receipt doesnt lie',
  'plausible deniability lost',

  // Social Dynamics
  'the handshake-hug miscalculation',
  'the joke that lands wrong',
  'the silence after you spoke',
  'drunk you versus sober you',
  'the walk after saying goodbye',
] as const;

// ============================================================================
// TONES - Voice/register of delivery (~20 entries)
// ============================================================================

/**
 * Tone registers for priceless parodies.
 *
 * Each tone sets the VOICE of the content - how the items and
 * reveal are described. The tone affects word choice and attitude
 * without changing the structural format.
 */
export const PRICELESS_TONES = [
  'deadpan corporate',
  'self-deprecating cringe',
  'gleeful schadenfreude',
  'understated british',
  'dramatic soap opera',
  'workplace sitcom',
  'reality tv confessional',
  'nature documentary narrator',
  'true crime podcast',
  'sports play-by-play',
  'news anchor gravitas',
  'late night monologue',
  'roast battle',
  'dad joke wholesome',
  'gen z unhinged',
  'infomercial narrator',
  'wedding toast sincerity',
  'acceptance speech humble',
  'courtroom testimony',
  'museum audio guide',
] as const;

// ============================================================================
// Types
// ============================================================================

/** Type for scenario category keys */
export type PricelessScenarioCategory = keyof typeof PRICELESS_SCENARIOS;

/** Type for individual scenario values */
export type PricelessScenario = (typeof PRICELESS_SCENARIOS)[PricelessScenarioCategory][number];

/** Type for comedy trope values */
export type PricelessTrope = (typeof PRICELESS_TROPES)[number];

/** Type for tone values */
export type PricelessTone = (typeof PRICELESS_TONES)[number];

// ============================================================================
// Selection Functions
// ============================================================================

/**
 * Selects a random item from an array using Math.random().
 *
 * Uses true programmatic randomness rather than LLM-based selection,
 * which exhibits bias toward certain items.
 *
 * @typeParam T - Type of array elements
 * @param array - Array to select from (must have at least one element)
 * @returns Randomly selected element
 */
export function selectRandomItem<T>(array: readonly T[]): T {
  if (array.length === 0) {
    throw new Error('Cannot select from empty array');
  }
  const index = Math.floor(Math.random() * array.length);
  return array[index];
}

/**
 * Selects a random scenario category key.
 *
 * @returns Randomly selected category key from PRICELESS_SCENARIOS
 */
export function selectRandomCategory(): PricelessScenarioCategory {
  const categories = Object.keys(PRICELESS_SCENARIOS) as PricelessScenarioCategory[];
  return selectRandomItem(categories);
}

/**
 * Selects a random scenario from a given category.
 *
 * @param category - The scenario category to select from
 * @returns Randomly selected scenario string
 */
export function selectRandomScenario(category: PricelessScenarioCategory): PricelessScenario {
  return selectRandomItem(PRICELESS_SCENARIOS[category]);
}

/**
 * Gets a random comedy trope.
 *
 * @returns Randomly selected comedy trope
 */
export function getRandomTrope(): PricelessTrope {
  return selectRandomItem(PRICELESS_TROPES);
}

/**
 * Gets a random tone register.
 *
 * @returns Randomly selected tone
 */
export function getRandomTone(): PricelessTone {
  return selectRandomItem(PRICELESS_TONES);
}
