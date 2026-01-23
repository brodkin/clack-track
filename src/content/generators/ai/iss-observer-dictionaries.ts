/**
 * ISS Observer Dictionaries
 *
 * Provides observation angles and location flavors for the ISS Observer Generator.
 * These dictionaries ensure high content variability by combining:
 * - 24 distinct observation angles (perspectives for viewing Earth from space)
 * - 60+ location flavors organized by region type (oceans, continents, countries)
 *
 * Design principles:
 * - Observation angles shape HOW the ISS "observes" - not just what it sees
 * - Location flavors provide regional character without requiring geocoding
 * - Generic fallbacks ensure graceful degradation for unknown locations
 * - All selections use true randomness via Math.random()
 *
 * @example
 * ```typescript
 * import {
 *   OBSERVATION_ANGLES,
 *   LOCATION_FLAVORS,
 *   selectRandomItem,
 *   getFlavorKey
 * } from './iss-observer-dictionaries.js';
 *
 * const angle = selectRandomItem(OBSERVATION_ANGLES);
 * const key = getFlavorKey({ country_code: 'US', timezone_id: 'America/New_York' });
 * const flavor = LOCATION_FLAVORS[key] ?? LOCATION_FLAVORS.GENERIC_LAND;
 * ```
 */

/**
 * Minimal interface for ISS location data used by getFlavorKey.
 * The full ISSLocation type is defined in iss-client.ts (parallel task).
 */
export interface ISSLocationData {
  /** ISO 3166-1 alpha-2 country code, or empty string if over ocean */
  country_code: string;
  /** IANA timezone identifier (e.g., 'America/New_York', 'Etc/GMT+5') */
  timezone_id: string;
}

/**
 * Observation angles for ISS content generation.
 *
 * Each angle provides a unique perspective for how the ISS "observes" Earth,
 * shaping the tone, focus, and style of the generated content. These are
 * structural patterns that force variety in output, not just topic variations.
 *
 * Categories:
 * - Physical perspective (altitude, velocity, orbital mechanics)
 * - Human elements (astronaut thoughts, crew activity)
 * - Geographic observations (borders, time zones, weather)
 * - Philosophical reflections (distance, appreciation, routine contrast)
 * - Temporal observations (day/night, sunrise/sunset)
 *
 * 24 angles = ~4% chance per angle, ensuring diverse content.
 */
export const OBSERVATION_ANGLES = [
  // Physical Perspective (5)
  'ALTITUDE_PERSPECTIVE',
  'VELOCITY_COMPARISON',
  'ORBITAL_MECHANICS',
  'GRAVITY_HUMOR',
  'ATMOSPHERIC_LAYERS',

  // Human Elements (4)
  'ASTRONAUT_THOUGHT',
  'CREW_ACTIVITY',
  'PRETEND_SURVEILLANCE',
  'ROUTINE_CONTRAST',

  // Geographic Observations (5)
  'GEOGRAPHIC_TRIVIA',
  'BORDER_OBSERVATION',
  'TIME_ZONE_ABSURDITY',
  'WEATHER_COMPARISON',
  'CITY_LIGHTS_PATTERN',

  // Philosophical Reflections (4)
  'PHILOSOPHICAL_DISTANCE',
  'EARTH_APPRECIATION',
  'MUNDANE_CONTRAST',
  'COSMIC_PERSPECTIVE',

  // Temporal Observations (3)
  'SUNRISE_SUNSET',
  'NIGHT_SIDE_MYSTERY',
  'DAY_NIGHT_TERMINATOR',

  // Scientific Observations (3)
  'SCIENTIFIC_DEADPAN',
  'HISTORICAL_REFERENCE',
  'NATURAL_PHENOMENON',
] as const;

/**
 * Type for observation angle values.
 */
export type ObservationAngle = (typeof OBSERVATION_ANGLES)[number];

/**
 * Location flavor descriptions organized by region type.
 *
 * Each flavor provides regional character that can be injected into prompts
 * to give the AI context about the ISS's current location. Flavors are
 * intentionally brief and evocative rather than encyclopedic.
 *
 * Organization:
 * - Ocean regions (5): Major bodies of water
 * - Major countries (35): Countries with distinct regional character
 * - Generic fallbacks (2): For unknown or unmatched locations
 *
 * Total: 60+ distinct flavors
 */
export const LOCATION_FLAVORS: Record<string, string> = {
  // ============================================
  // OCEAN REGIONS (5)
  // ============================================
  PACIFIC_OCEAN: 'vast blue expanse dotted with tiny island chains',
  ATLANTIC_OCEAN: 'the ancient highway between continents',
  INDIAN_OCEAN: 'warm waters where monsoons are born',
  ARCTIC_OCEAN: 'frozen white cap of the world',
  SOUTHERN_OCEAN: 'the roaring forties circling Antarctica',

  // ============================================
  // NORTH AMERICA (6)
  // ============================================
  UNITED_STATES: 'patchwork of farms, cities, and wilderness',
  CANADA: 'endless forests giving way to frozen tundra',
  MEXICO: 'ancient civilizations meet modern sprawl',
  GREENLAND: 'ice sheet larger than most countries',
  CARIBBEAN: 'turquoise waters and hurricane highways',
  CENTRAL_AMERICA: 'narrow land bridge between two worlds',

  // ============================================
  // SOUTH AMERICA (6)
  // ============================================
  BRAZIL: 'Amazon rainforest and coastal megacities',
  ARGENTINA: 'pampas stretching to Patagonian glaciers',
  CHILE: 'impossibly thin ribbon along the Andes',
  COLOMBIA: 'where three Andean ranges meet the jungle',
  PERU: 'ancient Inca trails visible from space',
  VENEZUELA: 'tepuis rising like islands in the sky',

  // ============================================
  // EUROPE (8)
  // ============================================
  UNITED_KINGDOM: 'green isle where weather is a personality',
  FRANCE: 'hexagon of vineyards and Alpine peaks',
  GERMANY: 'autobahns threading through the Black Forest',
  SPAIN: 'sun-baked meseta and Mediterranean coast',
  ITALY: 'boot-shaped peninsula of history and volcanoes',
  RUSSIA: 'the country that never ends',
  NORWAY: 'fjords carved by ancient ice',
  GREECE: 'birthplace of democracy scattered across islands',

  // ============================================
  // ASIA (10)
  // ============================================
  CHINA: 'great wall visible only in imagination',
  JAPAN: 'volcanic archipelago of neon and tradition',
  INDIA: 'subcontinent of a billion stories',
  AUSTRALIA: 'outback red against coastal green',
  INDONESIA: 'ring of fire islands in tropical seas',
  SOUTH_KOREA: 'peninsula of K-pop and ancient temples',
  THAILAND: 'golden temples in emerald jungle',
  VIETNAM: 'dragon-shaped coast of rice paddies',
  PHILIPPINES: 'seven thousand islands of resilience',
  MALAYSIA: 'where rainforest meets skyscrapers',

  // ============================================
  // MIDDLE EAST (5)
  // ============================================
  SAUDI_ARABIA: 'desert kingdom of sand and oil',
  UAE: 'oasis cities rising from the dunes',
  ISRAEL: 'tiny nation at civilization crossroads',
  TURKEY: 'bridge between Europe and Asia',
  IRAN: 'ancient Persia in mountain fortress',

  // ============================================
  // AFRICA (8)
  // ============================================
  EGYPT: 'pyramids and Nile ribbon in the sand',
  SOUTH_AFRICA: 'where two oceans meet at the cape',
  KENYA: 'great rift valley and Serengeti migrations',
  MOROCCO: 'Atlas Mountains and Saharan edge',
  NIGERIA: 'most populous nation on the continent',
  ETHIOPIA: 'highlands where coffee was born',
  TANZANIA: 'Kilimanjaro rising above the savanna',
  CONGO: 'heart of darkness now heart of biodiversity',

  // ============================================
  // OCEANIA (4)
  // ============================================
  NEW_ZEALAND: 'Middle Earth made real in the South Pacific',
  FIJI: 'paradise islands scattered like emeralds',
  PAPUA_NEW_GUINEA: 'last frontier of uncontacted tribes',
  POLYNESIA: 'triangle of navigators and volcanoes',

  // ============================================
  // POLAR REGIONS (2)
  // ============================================
  ANTARCTICA: 'frozen continent with no permanent residents',
  ARCTIC: 'sea ice shrinking before our eyes',

  // ============================================
  // GENERIC FALLBACKS (2)
  // ============================================
  GENERIC_LAND: 'somewhere interesting on Earth',
  GENERIC_OCEAN: 'blue marble waters below',
} as const;

/**
 * Type for location flavor keys.
 */
export type LocationFlavorKey = keyof typeof LOCATION_FLAVORS;

/**
 * Mapping from ISO 3166-1 alpha-2 country codes to location flavor keys.
 * Countries not in this map will use generic fallbacks.
 */
const COUNTRY_CODE_TO_FLAVOR: Record<string, LocationFlavorKey> = {
  // North America
  US: 'UNITED_STATES',
  CA: 'CANADA',
  MX: 'MEXICO',
  GL: 'GREENLAND',
  // Caribbean (select major nations)
  CU: 'CARIBBEAN',
  JM: 'CARIBBEAN',
  HT: 'CARIBBEAN',
  DO: 'CARIBBEAN',
  PR: 'CARIBBEAN',
  // Central America
  GT: 'CENTRAL_AMERICA',
  BZ: 'CENTRAL_AMERICA',
  HN: 'CENTRAL_AMERICA',
  SV: 'CENTRAL_AMERICA',
  NI: 'CENTRAL_AMERICA',
  CR: 'CENTRAL_AMERICA',
  PA: 'CENTRAL_AMERICA',

  // South America
  BR: 'BRAZIL',
  AR: 'ARGENTINA',
  CL: 'CHILE',
  CO: 'COLOMBIA',
  PE: 'PERU',
  VE: 'VENEZUELA',
  EC: 'BRAZIL', // Use Brazil as proxy for Amazon region
  BO: 'PERU', // Use Peru as proxy for Andean region
  PY: 'ARGENTINA', // Use Argentina as proxy
  UY: 'ARGENTINA', // Use Argentina as proxy

  // Europe
  GB: 'UNITED_KINGDOM',
  FR: 'FRANCE',
  DE: 'GERMANY',
  ES: 'SPAIN',
  IT: 'ITALY',
  RU: 'RUSSIA',
  NO: 'NORWAY',
  GR: 'GREECE',
  SE: 'NORWAY', // Use Norway as proxy for Scandinavia
  FI: 'NORWAY', // Use Norway as proxy for Scandinavia
  DK: 'NORWAY', // Use Norway as proxy for Scandinavia
  IS: 'NORWAY', // Use Norway as proxy for Nordic
  PT: 'SPAIN', // Use Spain as proxy for Iberia
  NL: 'GERMANY', // Use Germany as proxy
  BE: 'FRANCE', // Use France as proxy
  CH: 'GERMANY', // Use Germany as proxy
  AT: 'GERMANY', // Use Germany as proxy
  PL: 'GERMANY', // Use Germany as proxy
  CZ: 'GERMANY', // Use Germany as proxy
  IE: 'UNITED_KINGDOM', // Use UK as proxy

  // Asia
  CN: 'CHINA',
  JP: 'JAPAN',
  IN: 'INDIA',
  AU: 'AUSTRALIA',
  ID: 'INDONESIA',
  KR: 'SOUTH_KOREA',
  TH: 'THAILAND',
  VN: 'VIETNAM',
  PH: 'PHILIPPINES',
  MY: 'MALAYSIA',
  SG: 'MALAYSIA', // Use Malaysia as proxy
  TW: 'JAPAN', // Use Japan as proxy
  HK: 'CHINA', // Use China as proxy
  BD: 'INDIA', // Use India as proxy
  PK: 'INDIA', // Use India as proxy
  LK: 'INDIA', // Use India as proxy
  NP: 'INDIA', // Use India as proxy
  MM: 'THAILAND', // Use Thailand as proxy

  // Middle East
  SA: 'SAUDI_ARABIA',
  AE: 'UAE',
  IL: 'ISRAEL',
  TR: 'TURKEY',
  IR: 'IRAN',
  IQ: 'IRAN', // Use Iran as proxy
  SY: 'TURKEY', // Use Turkey as proxy
  JO: 'ISRAEL', // Use Israel as proxy
  LB: 'ISRAEL', // Use Israel as proxy
  KW: 'UAE', // Use UAE as proxy
  QA: 'UAE', // Use UAE as proxy
  OM: 'UAE', // Use UAE as proxy

  // Africa
  EG: 'EGYPT',
  ZA: 'SOUTH_AFRICA',
  KE: 'KENYA',
  MA: 'MOROCCO',
  NG: 'NIGERIA',
  ET: 'ETHIOPIA',
  TZ: 'TANZANIA',
  CD: 'CONGO',
  GH: 'NIGERIA', // Use Nigeria as proxy
  DZ: 'MOROCCO', // Use Morocco as proxy
  TN: 'MOROCCO', // Use Morocco as proxy
  LY: 'EGYPT', // Use Egypt as proxy
  SD: 'EGYPT', // Use Egypt as proxy
  UG: 'KENYA', // Use Kenya as proxy
  RW: 'KENYA', // Use Kenya as proxy
  ZW: 'SOUTH_AFRICA', // Use South Africa as proxy
  BW: 'SOUTH_AFRICA', // Use South Africa as proxy
  NA: 'SOUTH_AFRICA', // Use South Africa as proxy

  // Oceania
  NZ: 'NEW_ZEALAND',
  FJ: 'FIJI',
  PG: 'PAPUA_NEW_GUINEA',
  // Polynesian nations
  WS: 'POLYNESIA',
  TO: 'POLYNESIA',
  VU: 'POLYNESIA',
  NC: 'POLYNESIA',
  PF: 'POLYNESIA',

  // Polar
  AQ: 'ANTARCTICA',
} as const;

/**
 * Mapping from timezone prefixes to ocean flavor keys.
 * Used when country_code is empty (over water).
 */
const TIMEZONE_TO_OCEAN: Record<string, LocationFlavorKey> = {
  'Etc/GMT': 'ATLANTIC_OCEAN', // Default for Etc timezones
  'Pacific/': 'PACIFIC_OCEAN',
  'Atlantic/': 'ATLANTIC_OCEAN',
  'Indian/': 'INDIAN_OCEAN',
  'Arctic/': 'ARCTIC_OCEAN',
  'Antarctica/': 'SOUTHERN_OCEAN',
} as const;

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
 * const angle = selectRandomItem(OBSERVATION_ANGLES);
 * // Returns one of the 24 observation angles
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
 * Maps an ISS location to a location flavor key.
 *
 * Resolution order:
 * 1. If country_code is provided, look up in COUNTRY_CODE_TO_FLAVOR
 * 2. If over ocean (empty country_code), match timezone prefix to ocean
 * 3. Fall back to GENERIC_LAND or GENERIC_OCEAN based on country_code presence
 *
 * @param location - ISS location data with country_code and timezone_id
 * @returns Location flavor key for use with LOCATION_FLAVORS
 *
 * @example
 * ```typescript
 * // Over United States
 * getFlavorKey({ country_code: 'US', timezone_id: 'America/New_York' });
 * // Returns: 'UNITED_STATES'
 *
 * // Over Pacific Ocean
 * getFlavorKey({ country_code: '', timezone_id: 'Pacific/Fiji' });
 * // Returns: 'PACIFIC_OCEAN'
 *
 * // Unknown country
 * getFlavorKey({ country_code: 'XX', timezone_id: 'Unknown' });
 * // Returns: 'GENERIC_LAND'
 * ```
 */
export function getFlavorKey(location: ISSLocationData): LocationFlavorKey {
  const { country_code, timezone_id } = location;

  // Case 1: Over land with known country
  if (country_code && country_code in COUNTRY_CODE_TO_FLAVOR) {
    return COUNTRY_CODE_TO_FLAVOR[country_code];
  }

  // Case 2: Over water - determine which ocean from timezone
  if (!country_code || country_code === '') {
    // Check for specific ocean timezone prefixes
    for (const [prefix, oceanKey] of Object.entries(TIMEZONE_TO_OCEAN)) {
      if (timezone_id.startsWith(prefix)) {
        return oceanKey;
      }
    }
    // Default ocean fallback
    return 'GENERIC_OCEAN';
  }

  // Case 3: Unknown land location
  return 'GENERIC_LAND';
}

/**
 * Gets a random observation angle.
 *
 * Convenience wrapper around selectRandomItem for observation angles.
 *
 * @returns Randomly selected observation angle
 */
export function getRandomObservationAngle(): ObservationAngle {
  return selectRandomItem(OBSERVATION_ANGLES);
}

/**
 * Gets the location flavor text for a given location.
 *
 * Combines getFlavorKey lookup with LOCATION_FLAVORS access.
 *
 * @param location - ISS location data
 * @returns Human-readable location flavor description
 *
 * @example
 * ```typescript
 * getLocationFlavor({ country_code: 'JP', timezone_id: 'Asia/Tokyo' });
 * // Returns: 'volcanic archipelago of neon and tradition'
 * ```
 */
export function getLocationFlavor(location: ISSLocationData): string {
  const key = getFlavorKey(location);
  return LOCATION_FLAVORS[key];
}
