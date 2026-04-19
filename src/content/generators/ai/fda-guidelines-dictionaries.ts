/**
 * FDA Food Code Provision Index
 *
 * Each provision pairs a real 2022 Food Code section with its topic domain
 * and a list of facets (specific sub-rules or angles inside that section).
 * Selection samples one section AND one facet, expanding the permutation
 * space well past the 50 raw section count.
 *
 * Design:
 * - Section is injected deterministically (no hallucination).
 * - Topic activates the right neighborhood of the model's knowledge.
 * - Facet narrows inside the section so the model doesn't default to the
 *   same "headline rule" every time.
 *
 * Totals: 51 sections × avg ~7 facets = ~360+ distinct combinations.
 */

export interface FoodCodeProvision {
  readonly section: string;
  readonly topic: string;
  readonly facets: readonly string[];
}

export const FOOD_CODE_PROVISIONS: readonly FoodCodeProvision[] = [
  // Employee health and hygiene
  {
    section: '2-201.11',
    topic: 'employee illness reporting and exclusion',
    facets: [
      'the Big 6 reportable symptoms',
      'vomiting or diarrhea symptoms',
      'jaundice exclusion',
      'sore throat with fever',
      'open lesions or boils on hands or arms',
      'diagnosis with Norovirus',
      'diagnosis with Salmonella',
      'diagnosis with Shigella',
      'diagnosis with Hepatitis A',
      'diagnosis with E. coli O157:H7',
    ],
  },
  {
    section: '2-301.12',
    topic: 'handwashing procedure',
    facets: [
      'minimum total duration of handwashing',
      'vigorous friction portion of the wash',
      'cleaning under and around fingernails',
      'required water temperature at the sink',
      'use of soap or cleaning compound',
      'required rinse and dry steps',
    ],
  },
  {
    section: '2-301.14',
    topic: 'when hands must be washed',
    facets: [
      'after using the restroom',
      'before starting a work shift',
      'after handling raw animal food and before ready-to-eat',
      'after coughing sneezing or blowing the nose',
      'after eating drinking or using tobacco',
      'after touching the body or clothing',
      'between glove changes',
      'after handling soiled utensils or equipment',
    ],
  },
  {
    section: '2-301.15',
    topic: 'where handwashing may occur',
    facets: [
      'prohibition on using prep sinks for handwashing',
      'prohibition on using warewashing sinks for handwashing',
      'requirement to use a dedicated handwashing sink',
      'mop sinks excluded from handwashing',
    ],
  },
  {
    section: '2-301.16',
    topic: 'hand antiseptic use after handwashing',
    facets: [
      'hand antiseptic as a supplement not a replacement for washing',
      'FDA-approved active ingredients only',
      'required compliance with FDA monograph',
      'use only after handwashing is complete',
    ],
  },
  {
    section: '2-302.11',
    topic: 'fingernail maintenance for food handlers',
    facets: [
      'trimmed and filed requirements',
      'prohibition on nail polish for handlers of exposed food',
      'prohibition on artificial fingernails for handlers of exposed food',
      'intact gloves as an exception to the polish rule',
    ],
  },
  {
    section: '2-303.11',
    topic: 'jewelry prohibition for food handlers',
    facets: [
      'plain ring band exception',
      'prohibition on bracelets',
      'prohibition on watches on wrists and arms',
      'prohibition on stoned rings',
    ],
  },
  {
    section: '2-304.11',
    topic: 'clean outer clothing for food handlers',
    facets: [
      'requirement for clean outer garments',
      'purpose of preventing contamination of food or contact surfaces',
    ],
  },
  {
    section: '2-401.11',
    topic: 'eating drinking and tobacco use in prep areas',
    facets: [
      'designated area for employee meals',
      'closed beverage container with straw exception',
      'prohibition on tobacco use in prep and service areas',
      'prohibition on unwrapped gum or food in prep areas',
    ],
  },
  {
    section: '2-402.11',
    topic: 'hair restraints for food handlers',
    facets: [
      'effective hair restraint requirement',
      'beard restraint requirement',
      'exemptions for counter staff and food servers',
    ],
  },

  // Food source and receiving
  {
    section: '3-201.11',
    topic: 'approved food sources',
    facets: [
      'regulatory inspection requirement for food sources',
      'prohibition on hunted wild game for service',
      'requirement that shellfish come from an NSSP-listed source',
      'prohibition on home-prepared food for service',
    ],
  },
  {
    section: '3-202.11',
    topic: 'receiving temperatures for potentially hazardous food',
    facets: [
      'TCS cold food receipt at 41 F or below',
      'shellstock and shucked shellfish receiving temperature',
      'live molluscan shellfish temperature allowance',
      'raw eggs at an ambient air temperature of 45 F or less',
      'hot TCS food receipt at 135 F or above',
    ],
  },
  {
    section: '3-202.15',
    topic: 'package integrity on receipt',
    facets: [
      'prohibition on accepting swollen cans',
      'prohibition on accepting crushed or rusted cans',
      'prohibition on accepting broken or leaking packages',
    ],
  },
  {
    section: '3-202.18',
    topic: 'shellstock identification tags',
    facets: [
      'retention of tags for 90 days after last sale',
      'required tag information including harvest location',
      'prohibition on comingling shellstock from different sources',
    ],
  },
  {
    section: '3-402.11',
    topic: 'parasite destruction in fish served raw or undercooked',
    facets: [
      'freezing at -4 F or below for 168 hours',
      'freezing at -31 F or below for 15 hours',
      'freezing at -31 F then holding at -4 F for 24 hours',
      'exemption for molluscan shellfish',
      'exemption for aquacultured fish fed pellets',
      'exemption for tuna species listed in the Food Code',
    ],
  },

  // Contamination prevention
  {
    section: '3-301.11',
    topic: 'bare hand contact with ready-to-eat food',
    facets: [
      'prohibition on bare hand contact with ready-to-eat food',
      'required use of suitable utensils tongs or gloves',
      'authorization exception for bare hand contact',
      'handwashing required before glove use',
    ],
  },
  {
    section: '3-302.11',
    topic: 'separation of raw animal food from ready-to-eat food',
    facets: [
      'storage order by final cook temperature',
      'poultry stored on the lowest shelf',
      'ready-to-eat food stored above raw animal food',
      'physical separation by packaging during storage',
      'separation during preparation and display',
    ],
  },
  {
    section: '3-304.12',
    topic: 'in-use utensil storage between tasks',
    facets: [
      'storage in food with handle extended above the food',
      'storage in running water in a dipper well',
      'storage in water maintained at 135 F or above',
      'storage on a clean surface cleaned every four hours',
    ],
  },
  {
    section: '3-304.14',
    topic: 'wiping cloth solutions and use',
    facets: [
      'wet wiping cloths kept in sanitizer solution between uses',
      'chlorine solution concentration for wiping cloths',
      'quaternary ammonium solution concentration for wiping cloths',
      'dry wiping cloths kept dry and free of debris',
    ],
  },

  // Food storage and display
  {
    section: '3-305.11',
    topic: 'food storage location and elevation above floor',
    facets: [
      'storage at least 6 inches above the floor',
      'prohibition on storage under exposed sewer lines',
      'prohibition on storage under leaking water lines',
      'prohibition on storage in locker rooms or toilet rooms',
    ],
  },
  {
    section: '3-306.13',
    topic: 'consumer self-service operation requirements',
    facets: [
      'required sneeze guards at self-service food',
      'dispensing utensil provision for self-service',
      'prohibition on re-serving returned food',
      'supervision and replenishment of self-service stations',
    ],
  },

  // Temperature control - cooking and reheating
  {
    section: '3-401.11',
    topic: 'minimum cooking temperatures for raw animal foods',
    facets: [
      'poultry cooked to 165 F for 1 second',
      'stuffed meat or pasta cooked to 165 F for 1 second',
      'ground meat or comminuted fish cooked to 155 F for 17 seconds',
      'whole-muscle beef or pork cooked to 145 F for 15 seconds',
      'whole-muscle roasts at 130 F with a time-temperature table',
      'fish cooked to 145 F for 15 seconds',
      'shell eggs for immediate service cooked to 145 F for 15 seconds',
      'shell eggs not for immediate service cooked to 155 F for 17 seconds',
      'plant food cooked for hot holding at 135 F',
    ],
  },
  {
    section: '3-401.12',
    topic: 'microwave cooking of raw animal foods',
    facets: [
      'heating to at least 165 F in all parts',
      'rotation or stirring during cooking',
      'two-minute post-cook stand time',
      'covered container requirement during cook',
    ],
  },
  {
    section: '3-403.11',
    topic: 'reheating for hot holding',
    facets: [
      'reheating to 165 F within two hours',
      'reheating commercially processed ready-to-eat food to 135 F',
      'reheating remains for hot holding only not for further holding past shift',
    ],
  },

  // Temperature control - cooling, thawing, holding
  {
    section: '3-501.11',
    topic: 'keeping frozen food frozen',
    facets: ['frozen food maintained frozen', 'protection from temperature abuse during storage'],
  },
  {
    section: '3-501.13',
    topic: 'approved thawing methods',
    facets: [
      'thawing under refrigeration at 41 F or below',
      'thawing under running water at 70 F or below',
      'thawing as part of the cooking process',
      'thawing in a microwave as part of continuous cooking',
    ],
  },
  {
    section: '3-501.14',
    topic: 'cooling time and temperature',
    facets: [
      'cooling from 135 F to 70 F within two hours',
      'cooling from 70 F to 41 F within an additional four hours',
      'total cooling window of six hours for cooked TCS food',
      'ambient-temperature food cooling within four hours to 41 F',
    ],
  },
  {
    section: '3-501.15',
    topic: 'approved cooling methods',
    facets: [
      'use of shallow pans to reduce product depth',
      'use of ice baths with stirring',
      'use of rapid-cooling equipment such as blast chillers',
      'use of ice as an ingredient added to cool a product',
      'separation into smaller portions to speed cooling',
    ],
  },
  {
    section: '3-501.16',
    topic: 'hot and cold holding temperatures',
    facets: [
      'cold holding of TCS food at 41 F or below',
      'hot holding of TCS food at 135 F or above',
      'cold holding at 45 F allowance with written variance',
    ],
  },
  {
    section: '3-501.17',
    topic: 'date marking of ready-to-eat food',
    facets: [
      'date mark required when held more than 24 hours',
      'maximum holding of seven days at 41 F or below',
      'date represents the date of preparation or opening',
      'combined foods take the earliest date of their components',
    ],
  },
  {
    section: '3-501.18',
    topic: 'disposition of date-marked food',
    facets: [
      'discard of food exceeding its date mark',
      'discard of visibly spoiled food regardless of date',
      'prohibition on reclaiming expired food by reheating',
    ],
  },
  {
    section: '3-501.19',
    topic: 'time as a public health control',
    facets: [
      'four hour limit when starting at any temperature',
      'six hour limit when starting below 70 F',
      'written procedure requirement for use of time control',
      'discard requirement at the end of the time limit',
      'marking requirement showing time food is removed from temperature control',
    ],
  },

  // Advanced processing and vulnerable populations
  {
    section: '3-502.12',
    topic: 'reduced oxygen packaging',
    facets: [
      'HACCP plan requirement for reduced oxygen packaging',
      'cook-chill and sous vide process controls',
      'temperature and time limits for ROP food',
      'labeling requirement for ROP food',
    ],
  },
  {
    section: '3-801.11',
    topic: 'requirements for highly susceptible populations',
    facets: [
      'prohibition on serving raw or undercooked animal food',
      'pasteurized egg requirement for pooled eggs',
      'prohibition on bare hand contact with ready-to-eat food',
      'prohibition on unpasteurized juice for these populations',
    ],
  },

  // Consumer and labeling
  {
    section: '3-602.11',
    topic: 'food labels and major allergen disclosure',
    facets: [
      'the common name of the food',
      'ingredient list in descending order of weight',
      'major food allergen declaration',
      'net quantity of contents',
      'manufacturer or distributor name and address',
    ],
  },
  {
    section: '3-603.11',
    topic: 'consumer advisory for undercooked animal food',
    facets: [
      'required disclosure identifying the items',
      'required reminder about risk from undercooked food',
      'asterisk footnote format for menu disclosure',
      'applies to raw and undercooked animal foods offered for sale',
    ],
  },

  // Warewashing and equipment
  {
    section: '4-202.11',
    topic: 'food contact surface construction and smoothness',
    facets: [
      'smooth and non-absorbent surfaces',
      'free of breaks open seams cracks or pits',
      'accessible for cleaning and inspection',
      'durable under normal use conditions',
    ],
  },
  {
    section: '4-301.12',
    topic: 'manual warewashing sink compartment requirements',
    facets: [
      'three separate compartments for wash rinse and sanitize',
      'drainboards or drain racks adjacent to the sink',
      'compartment sized to submerge the largest equipment',
    ],
  },
  {
    section: '4-501.19',
    topic: 'manual warewashing wash solution temperature',
    facets: [
      'wash water at 110 F minimum',
      'maintenance of wash solution temperature during use',
      'change-out when water becomes soiled',
    ],
  },
  {
    section: '4-501.114',
    topic: 'chemical sanitizer concentration for warewashing',
    facets: [
      'chlorine at 50 to 100 ppm at 75 F or warmer',
      'chlorine at 25 to 50 ppm at 100 F or warmer',
      'quaternary ammonium at 200 ppm per manufacturer',
      'iodine at 12.5 to 25 ppm at 75 F or warmer',
      'minimum ten second immersion time for chlorine',
      'minimum thirty second immersion for quat and iodine',
      'pH limits for chlorine sanitizer effectiveness',
    ],
  },
  {
    section: '4-602.11',
    topic: 'cleaning frequency for food contact surfaces',
    facets: [
      'every four hours during continuous use with TCS food',
      'every 24 hours for non-TCS food contact surfaces',
      'immediately after contact with raw animal food before contact with ready-to-eat',
      'between uses with different raw animal foods',
      'when switching food types that affect allergens',
    ],
  },
  {
    section: '4-703.11',
    topic: 'hot water and chemical sanitization methods',
    facets: [
      'hot water manual immersion at 171 F for 30 seconds',
      'mechanical hot water final rinse requirements',
      'chemical sanitization per section 4-501.114',
    ],
  },

  // Plumbing and utilities
  {
    section: '5-202.12',
    topic: 'backflow prevention on plumbing',
    facets: [
      'air gap of at least twice the pipe diameter and no less than one inch',
      'approved backflow prevention device',
      'installation at each cross connection',
    ],
  },
  {
    section: '5-203.11',
    topic: 'required handwashing sink locations',
    facets: [
      'handwashing sink in each food prep area',
      'handwashing sink in each warewashing area',
      'handwashing sink in or near each toilet room',
    ],
  },
  {
    section: '5-205.11',
    topic: 'handwashing sink use restrictions',
    facets: [
      'use for handwashing only',
      'prohibition on dumping food or mop water into the handwashing sink',
      'prohibition on washing utensils in the handwashing sink',
    ],
  },
  {
    section: '6-301.11',
    topic: 'handwashing cleanser availability',
    facets: [
      'soap or cleaning compound at every handwashing sink',
      'dispensed in a sanitary manner',
    ],
  },
  {
    section: '6-301.12',
    topic: 'hand drying provision',
    facets: [
      'individual disposable paper towels',
      'continuous cloth towel system in a dispenser',
      'heated-air hand drying device',
      'prohibition on shared cloth towels',
    ],
  },

  // Chemicals and pest control
  {
    section: '6-501.111',
    topic: 'controlling pests on the premises',
    facets: [
      'routine inspection for insect and rodent evidence',
      'use of approved methods for pest elimination',
      'removal of harborage and entry points',
      'disposal of dead pests in a sanitary manner',
    ],
  },
  {
    section: '7-201.11',
    topic: 'separation of toxic materials from food',
    facets: [
      'separation by spacing or partitioning',
      'storage below food single-service items and equipment',
      'labeling of all working containers of toxic materials',
      'secure storage away from food and contact surfaces',
    ],
  },
  {
    section: '7-202.12',
    topic: 'conditions of use for poisonous or toxic materials',
    facets: [
      'use only per manufacturer directions',
      'restricted use pesticides applied by licensed applicators',
      'prohibition on use that contaminates food or food contact surfaces',
    ],
  },

  // Additional prep and contamination controls
  {
    section: '3-301.12',
    topic: 'preventing contamination when tasting food',
    facets: [
      'use of a single-use utensil for tasting',
      'prohibition on re-dipping a used tasting utensil',
      'disposal of the tasting utensil after one use',
    ],
  },
  {
    section: '3-304.15',
    topic: 'use limitations on single-use gloves',
    facets: [
      'single-use gloves discarded when damaged or soiled',
      'gloves changed between tasks',
      'gloves changed after handling raw animal food',
      'handwashing required before donning new gloves',
      'prohibition on reuse of single-use gloves',
    ],
  },
  {
    section: '3-307.11',
    topic: 'miscellaneous sources of contamination',
    facets: [
      'protection from coughing and sneezing',
      'protection from handling money then food',
      'protection from cleaning chemicals during service',
      'protection from overhead condensation',
    ],
  },

  // Equipment and facility
  {
    section: '4-501.11',
    topic: 'good repair and proper adjustment of equipment',
    facets: [
      'equipment maintained in good repair',
      'accurate thermometers calibrated within manufacturer specification',
      'cutting boards replaced when scored beyond effective cleaning',
      'damaged gaskets replaced promptly',
    ],
  },
  {
    section: '4-501.12',
    topic: 'maintenance of cutting surfaces',
    facets: [
      'cutting surfaces resurfaced or replaced when damaged',
      'prohibition on use of deeply scored cutting boards',
      'smoothness and cleanability of cutting surfaces',
    ],
  },
  {
    section: '4-601.11',
    topic: 'food-contact surfaces clean condition',
    facets: [
      'visible food debris removed between uses',
      'surfaces free of encrusted grease and soil',
      'visibly clean to sight and touch standard',
    ],
  },
  {
    section: '4-902.11',
    topic: 'air drying of equipment and utensils',
    facets: [
      'air drying after final sanitization',
      'prohibition on towel-drying cleaned and sanitized equipment',
      'drainage positioning during air dry',
    ],
  },
  {
    section: '4-402.11',
    topic: 'spacing or sealing of fixed equipment',
    facets: [
      'sealed to adjoining equipment or wall',
      'spacing sufficient to permit cleaning underneath and around',
      'mobile equipment exception for ease of movement',
    ],
  },

  // Physical facilities
  {
    section: '5-501.113',
    topic: 'covering trash and refuse receptacles',
    facets: [
      'receptacles for moist or decomposable waste covered when not in use',
      'outdoor receptacles fitted with tight-fitting lids',
      'lids kept closed between uses',
    ],
  },
  {
    section: '6-202.15',
    topic: 'protecting outer openings',
    facets: [
      'tight-fitting doors with self-closers',
      'screens at windows with at least 16 mesh per square inch',
      'air curtains meeting the Food Code velocity standard',
      'sealing of openings around utility lines',
    ],
  },
  {
    section: '6-501.11',
    topic: 'repair of physical facilities',
    facets: [
      'floors walls and ceilings maintained in good repair',
      'prompt repair of broken tile and grout',
      'repair of peeling paint in food areas',
    ],
  },
  {
    section: '6-501.12',
    topic: 'cleaning frequency for physical facilities',
    facets: [
      'floors cleaned as often as necessary to keep them clean',
      'wet cleaning only during times of low service or closure',
      'dustless methods of cleaning floor surfaces',
      'cleaning maintenance tools to prevent soil buildup',
    ],
  },

  // Receipt, shellfish, and advanced
  {
    section: '3-202.17',
    topic: 'shucked shellfish receiving and labeling',
    facets: [
      'shucked shellfish in packages of a specified size bearing proper labeling',
      'certification number of packer on the container',
      'refusal of shellfish in unlabeled containers',
    ],
  },
  {
    section: '3-304.11',
    topic: 'food contact with utensils and equipment',
    facets: [
      'food contact with only clean and sanitized surfaces',
      'prohibition on placing exposed food on unclean surfaces',
      'protection of food during storage preparation display and service',
    ],
  },
  {
    section: '3-306.11',
    topic: 'display of ready-to-eat food',
    facets: [
      'packaging protection for displayed ready-to-eat food',
      'counter service dispensed from approved equipment',
      'protection from consumer contamination at the point of display',
    ],
  },

  // Utensil and warewashing specifics
  {
    section: '4-501.111',
    topic: 'manual hot water sanitization temperatures',
    facets: [
      'immersion for at least 30 seconds at 171 F or above',
      'temperature measuring device accessible to verify hot water immersion',
      'rack or basket used to submerge equipment fully',
    ],
  },
  {
    section: '4-501.112',
    topic: 'mechanical hot water sanitization temperatures',
    facets: [
      'final rinse temperature of 180 F for stationary rack machines',
      'final rinse temperature of 160 F at the utensil surface for conveyor machines',
      'temperature measuring device in the final rinse line',
    ],
  },
  {
    section: '4-501.115',
    topic: 'on-site test kits for chemical sanitizers',
    facets: [
      'test kit available to verify sanitizer concentration',
      'testing before use and at intervals during use',
      'accuracy of the test kit appropriate for the sanitizer in use',
    ],
  },
] as const;

/**
 * Selects a random provision and a random facet within that provision.
 *
 * Returns the section, topic, and the selected facet as a flattened object
 * so the generator can inject all three as template variables.
 */
export function selectRandomProvision(): {
  section: string;
  topic: string;
  facet: string;
} {
  const pIndex = Math.floor(Math.random() * FOOD_CODE_PROVISIONS.length);
  const provision = FOOD_CODE_PROVISIONS[pIndex];
  const fIndex = Math.floor(Math.random() * provision.facets.length);
  return {
    section: provision.section,
    topic: provision.topic,
    facet: provision.facets[fIndex],
  };
}
