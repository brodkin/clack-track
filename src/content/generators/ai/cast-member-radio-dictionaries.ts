/**
 * Cast Member Radio Dictionaries
 *
 * Provides variability seeds for the Cast Member Radio Generator.
 * These dictionaries ensure high content variability by combining:
 * - 25 caller stations (specific Disneyland locations/roles, not generic)
 * - 20 situation domains (categories of park chaos, not specific incidents)
 * - 5 urgency levels (radio communication tone)
 * - 8 shift moments (time-of-day context that shapes the scenario)
 *
 * Design principles:
 * - Stations reference REAL Disneyland (Anaheim) attractions, lands, and roles
 * - NO Walt Disney World, no overseas parks, no general Disney properties
 * - Domains define WHAT category of incident (not specific scenarios)
 * - Urgency sets the radio communication tone without scripting content
 * - Shift moments ground the scenario in a specific operational phase
 * - All selections use true randomness via Math.random()
 *
 * These are SEEDS not SCRIPTS - they point the LLM toward a corner of
 * the park and a category of chaos, then let it invent the rest.
 *
 * Total combinations: 25 x 20 x 5 x 8 = 20,000+ unique seeds
 *
 * @example
 * ```typescript
 * import {
 *   CALLER_STATIONS,
 *   SITUATION_DOMAINS,
 *   URGENCY_LEVELS,
 *   SHIFT_MOMENTS,
 *   selectRandomItem,
 * } from './cast-member-radio-dictionaries.js';
 *
 * const station = selectRandomItem(CALLER_STATIONS);
 * const domain = selectRandomItem(SITUATION_DOMAINS);
 * const urgency = selectRandomItem(URGENCY_LEVELS);
 * const moment = selectRandomItem(SHIFT_MOMENTS);
 * ```
 */

/**
 * Caller stations for Cast Member Radio generation.
 *
 * Each station is a specific Disneyland (Anaheim) location or Cast Member
 * role. These ground the radio chatter in real park geography and operations.
 * The LLM invents the specific Cast Member voice, their communication style,
 * and the incident details based on the station's known personality.
 *
 * Categories:
 * - Adventureland attractions and roles
 * - Fantasyland attractions and roles
 * - Tomorrowland attractions and roles
 * - Frontierland / New Orleans Square / Critter Country
 * - Main Street / Hub / Park Operations
 * - Galaxy's Edge
 * - Food and merchandise operations
 *
 * 25 stations = 4% chance per station
 */
export const CALLER_STATIONS = [
  // Adventureland (4)
  'JUNGLE_CRUISE_SKIPPER',
  'TIKI_ROOM_HOST',
  'INDIANA_JONES_DISPATCH',
  'ADVENTURELAND_MERCH',

  // Fantasyland (4)
  'MATTERHORN_CLIMBER',
  'HAUNTED_MANSION_BUTLER',
  'PIRATES_HELMSMAN',
  'ITS_A_SMALL_WORLD_OPERATOR',

  // Tomorrowland (4)
  'SPACE_MOUNTAIN_CONTROL',
  'AUTOPIA_PIT_CREW',
  'STAR_TOURS_FLIGHT_CREW',
  'BUZZ_LIGHTYEAR_RANGE',

  // Frontierland / NOS / Critter Country (3)
  'BIG_THUNDER_ENGINEER',
  'MARK_TWAIN_WHEELHOUSE',
  'SPLASH_MOUNTAIN_TOWER',

  // Main Street / Hub / Park Ops (4)
  'MAIN_STREET_EMPORIUM',
  'PARKING_TRAM_DRIVER',
  'FIREWORKS_PYRO_CREW',
  'CUSTODIAL_SWEEP_LEAD',

  // Galaxy's Edge (3)
  'SMUGGLERS_RUN_FLIGHT_OPS',
  'RISE_OF_RESISTANCE_DISPATCH',
  'OGAS_CANTINA_BAR',

  // Food and Misc (3)
  'CHURRO_CART_VENDOR',
  'DOLE_WHIP_STAND',
  'CHARACTER_ESCORT',
] as const;

/**
 * Situation domains for Cast Member Radio generation.
 *
 * Each domain defines a CATEGORY of park incident, not a specific scenario.
 * The LLM invents the actual incident, characters involved, and absurd
 * details based on the domain's general territory combined with the station.
 *
 * Categories:
 * - Guest behavior incidents (what guests do)
 * - Ride and attraction issues (mechanical/operational)
 * - Character and entertainment chaos (performers/shows)
 * - Food and merchandise situations (supply/demand/spills)
 * - Logistics and operations (crowd flow, scheduling, weather)
 * - Unexplained park phenomena (the weird stuff)
 *
 * 20 domains = 5% chance per domain
 */
export const SITUATION_DOMAINS = [
  // Guest behavior (4)
  'GUEST_BOUNDARY_VIOLATION',
  'LOST_CHILD_OR_ADULT',
  'PROPOSAL_GONE_WRONG',
  'ANNUAL_PASSHOLDER_DISPUTE',

  // Ride / attraction issues (4)
  'ANIMATRONIC_MALFUNCTION',
  'RIDE_VEHICLE_INCIDENT',
  'QUEUE_LINE_SITUATION',
  'AUDIO_OR_LIGHTING_GLITCH',

  // Character / entertainment (3)
  'CHARACTER_WARDROBE_CRISIS',
  'PARADE_LOGISTICS_CHAOS',
  'MEET_AND_GREET_MELTDOWN',

  // Food / merchandise (3)
  'SUPPLY_SHORTAGE_EMERGENCY',
  'FOOD_SPILL_OR_MESS',
  'MERCH_FRENZY',

  // Logistics / ops (3)
  'CROWD_FLOW_BREAKDOWN',
  'SCHEDULING_CATASTROPHE',
  'WEATHER_COMPLICATION',

  // Unexplained park phenomena (3)
  'WILDLIFE_INTRUSION',
  'MYSTERIOUS_OCCURRENCE',
  'URBAN_LEGEND_SIGHTING',
] as const;

/**
 * Urgency levels for Cast Member Radio generation.
 *
 * Sets the radio communication tone without scripting content.
 * The contrast between professional radio protocol and absurd
 * situations is where the humor lives.
 *
 * 5 levels = 20% chance per level
 */
export const URGENCY_LEVELS = [
  'ROUTINE_CHECK_IN',
  'MILDLY_CONCERNED',
  'INCREASINGLY_WORRIED',
  'FULL_CODE_DISNEY',
  'SUSPICIOUSLY_CALM',
] as const;

/**
 * Shift moments for Cast Member Radio generation.
 *
 * Grounds the radio call in a specific time-of-day context. The operational
 * phase changes everything about a radio call — a rope drop incident has
 * completely different energy than a 2am maintenance discovery.
 *
 * These moments shape:
 * - WHO would plausibly be on radio (maintenance at 2am, not churro cart)
 * - WHAT kind of situations arise (pre-show prep vs. crowd chaos vs. cleanup)
 * - The TONE of the call (morning optimism vs. end-of-day exhaustion)
 *
 * 8 moments = 12.5% chance per moment
 */
export const SHIFT_MOMENTS = [
  'ROPE_DROP',
  'MIDDAY_RUSH',
  'PARADE_STAGING',
  'FIREWORKS_COUNTDOWN',
  'PARK_CLOSE',
  'AFTER_HOURS_MAINTENANCE',
  'EARLY_MORNING_PREP',
  'SHIFT_CHANGE',
] as const;

/**
 * Type for caller station values.
 */
export type CallerStation = (typeof CALLER_STATIONS)[number];

/**
 * Type for situation domain values.
 */
export type SituationDomain = (typeof SITUATION_DOMAINS)[number];

/**
 * Type for urgency level values.
 */
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

/**
 * Type for shift moment values.
 */
export type ShiftMoment = (typeof SHIFT_MOMENTS)[number];

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
 * const station = selectRandomItem(CALLER_STATIONS);
 * // Returns one of the 25 caller stations
 * ```
 */
export function selectRandomItem<T>(array: readonly T[]): T {
  if (array.length === 0) {
    throw new Error('Cannot select from empty array');
  }
  const index = Math.floor(Math.random() * array.length);
  return array[index];
}
