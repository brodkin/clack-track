/**
 * Apple Keynote Food Dictionaries
 *
 * Three variety dimensions for the Apple Keynote Food generator:
 * 1. FOOD_ITEMS - Americana foods across 11 categories (~150 items)
 * 2. KEYNOTE_STYLES - Apple keynote rhetoric patterns (~16 styles)
 * 3. PRODUCT_MODIFIERS - Bold tech-inspired product name suffixes (~30 modifiers)
 *
 * Total combinations: ~150 × 16 × 30 = ~72,000
 *
 * @module content/generators/ai/apple-keynote-food-dictionaries
 */

/**
 * Traditional Americana food items organized by category.
 * These are the "products" being announced with keynote gravitas.
 */
export const FOOD_ITEMS = {
  BURGERS: [
    'cheeseburger',
    'double bacon burger',
    'smash burger',
    'slider',
    'patty melt',
    'western bbq burger',
    'mushroom swiss burger',
    'jalapeno burger',
    'turkey burger',
    'veggie burger',
    'double double',
    'butter burger',
    'blue cheese burger',
    'onion burger',
    'guacamole burger',
  ],

  FRIES: [
    'curly fries',
    'waffle fries',
    'cheese fries',
    'animal style fries',
    'chili cheese fries',
    'onion rings',
    'tater tots',
    'sweet potato fries',
    'crinkle cut fries',
    'shoestring fries',
    'steak fries',
    'loaded fries',
    'truffle fries',
    'seasoned fries',
  ],

  SHAKES_DRINKS: [
    'chocolate milkshake',
    'root beer float',
    'cherry coke',
    'lemonade',
    'strawberry shake',
    'vanilla malt',
    'orange julius',
    'chocolate egg cream',
    'arnold palmer',
    'banana shake',
    'cookies and cream shake',
    'peanut butter shake',
  ],

  BREAKFAST: [
    'pancake stack',
    'hash browns',
    'biscuits and gravy',
    'eggs over easy',
    'breakfast burrito',
    'french toast',
    'waffle',
    'bacon strips',
    'country omelette',
    'sausage links',
    'corned beef hash',
    'cinnamon roll',
    'breakfast sandwich',
  ],

  SANDWICHES: [
    'club sandwich',
    'grilled cheese',
    'BLT',
    'reuben',
    'po boy',
    'meatball sub',
    'philly cheesesteak',
    'pulled pork sandwich',
    'monte cristo',
    'sloppy joe',
    'french dip',
    'cuban sandwich',
    'lobster roll',
  ],

  PIZZA: [
    'pepperoni slice',
    'deep dish',
    'stuffed crust',
    'white pizza',
    'meat lovers',
    'calzone',
    'cheese slice',
    'hawaiian pizza',
    'detroit style',
    'new york slice',
    'sicilian square',
    'stromboli',
  ],

  SIDES_APPS: [
    'mozzarella sticks',
    'jalapeno poppers',
    'chicken wings',
    'corn dog',
    'coleslaw',
    'mac and cheese',
    'nachos',
    'breadsticks',
    'fried pickles',
    'potato skins',
    'hush puppies',
    'fried zucchini',
    'loaded potato',
  ],

  HOT_DOGS: [
    'classic hot dog',
    'chili dog',
    'chicago dog',
    'coney island dog',
    'bratwurst',
    'slaw dog',
    'bacon wrapped dog',
    'sonoran hot dog',
    'new york dirty water dog',
    'polish sausage',
  ],

  DESSERTS: [
    'apple pie',
    'brownie sundae',
    'funnel cake',
    'churro',
    'soft serve cone',
    'banana split',
    'hot fudge sundae',
    'fried oreos',
    'key lime pie',
    'peach cobbler',
    'ice cream sandwich',
    'milkshake cake',
    'deep fried twinkie',
  ],

  CONDIMENTS: [
    'ketchup',
    'mustard',
    'ranch dressing',
    'hot sauce',
    'mayo',
    'bbq sauce',
    'relish',
    'secret sauce',
    'honey mustard',
    'tartar sauce',
    'special seasoning',
    'fry sauce',
    'chipotle aioli',
  ],

  DINER_CLASSICS: [
    'meatloaf',
    'chicken fried steak',
    'pot roast',
    'tuna melt',
    'open face turkey sandwich',
    'liver and onions',
    'salisbury steak',
    'chicken pot pie',
    'beef stroganoff',
    'country fried chicken',
    'pork chop dinner',
    'blue plate special',
  ],
} as const;

/**
 * Keynote rhetoric style identifiers.
 * Each represents a distinct Apple presentation archetype.
 */
export const KEYNOTE_STYLES = [
  'product_launch',
  'spec_reveal',
  'one_more_thing',
  'environmental_claim',
  'lineup_reveal',
  'courage_moment',
  'developer_pitch',
  'magical_reveal',
  'chip_announcement',
  'privacy_focus',
  'paradigm_shift',
  'seamless_ecosystem',
  'health_feature',
  'tier_announcement',
  'design_superlative',
  'camera_feature',
] as const;

/**
 * Style-specific guidance injected into the prompt.
 * Each entry describes the rhetoric pattern the LLM should mimic.
 */
export const STYLE_GUIDANCE: Record<(typeof KEYNOTE_STYLES)[number], string> = {
  product_launch: `Grand unveiling energy. "Introducing X. The most advanced Y we've ever created." Reverent pause before the name drop. This is the moment the audience has been waiting for.`,

  spec_reveal: `Oddly specific stats delivered with profound gravity. Pattern: "With [odd number]% more [quality] than the previous generation." The more mundane the stat, the more seriously it must be presented. Bar charts energy. Invent your own number - do not default to common ones.`,

  one_more_thing: `The legendary surprise reveal. Build anticipation, then drop the bombshell. "And one more thing..." Pause. Let it breathe. Then unveil something absurdly mundane as if it changes everything.`,

  environmental_claim: `Sustainability theater. "Made with 100% recycled W. Our most sustainable X yet." Carbon neutral condiments. Post-consumer packaging pride. Earnest commitment to saving the planet through burger innovation.`,

  lineup_reveal: `The product family announcement. State the tier trio on ONE opener line: "CHEESEBURGER. PRO. ULTRA." or "FRIES. FRIES MAX. FRIES ULTRA." (one line maximum - never stack across multiple lines). Then use remaining lines for the spec and landing as normal. Do NOT consume the entire output on the lineup; the stat and landing still apply.`,

  courage_moment: `The confident subtraction. Remove a beloved element of the food and treat its absence as progress - but NEVER name the removal as brave, bold, or courageous. State it as quiet inevitability. "It no longer needs [removed element]. Everything it needs is already here." Let the audience draw the conclusion themselves.`,

  developer_pitch: `The platform framing. Treat the food as an extensible surface for builders - an SDK for condiments, an API for toppings, a developer kit for bun architecture. Speak to creators, not consumers. Avoid "pairs with", "all your favorites", or any language that addresses the end viewer directly. Describe what's now possible with architectural seriousness.`,

  magical_reveal: `Pure wonder, delivered flatly. "Magical" stated as simple fact. Describe an ordinary mechanic - the sizzle, the drip, the crunch, the melt - as if witnessing it for the first time. Understatement carries the awe. No direct address to the viewer, no "you're going to love it".`,

  chip_announcement: `Processing power flex. "Powered by the all-new [name] chip. Up to [N]x faster than anything." Technical jargon about food performance. Benchmark scores for flavor. Thermal efficiency of a griddle. Choose a fresh multiplier each time.`,

  privacy_focus: `Data protection but for food. "What happens in your X stays in your X." Serious commitment to protecting the sanctity of a meal. End-to-end encrypted toppings. On-device digestion.`,

  paradigm_shift: `World-changing gravitas. "This changes everything. Again." Framing a minor menu addition as a civilization-defining moment. Before and after this burger, history is divided.`,

  seamless_ecosystem: `Integration without the pitch. "It just works." Describe silent connections - fries aware of the shake, condiments synced to the burger, sides that anticipate. Architectural calm, not feature bullets. Avoid "all your favorites" or any consumer-facing language.`,

  health_feature: `Wellness technology. "X can now detect when you need Z." Health monitoring for cravings. Calorie awareness that somehow makes you feel good about eating more. Biometric dipping sauce.`,

  tier_announcement: `The premium tier reveal. Introduce a distinct Pro/Max/+ edition of the food ("CHEESEBURGER PRO", "FRIES MAX", "MILKSHAKE+") and describe the ONE concrete refinement that distinguishes it from the base model: thicker construction, rarer ingredient, extended process. Architectural language, not marketing. Do NOT use "membership", "monthly", "subscription", "all your favorites". The tier is a product, not a service.`,

  design_superlative: `Industrial design worship. "The thinnest X we've ever made." Obsessive attention to physical form. Millimeter measurements. Weight comparisons. The taper. The finish. The hand feel of a burger.`,

  camera_feature: `Imaging technology applied to food. "Capture every moment of your X in stunning detail." Computational photography for meals. Night mode for late-night drive-thru. Portrait mode for your plate.`,
};

/**
 * Bold tech-inspired product name modifiers.
 * Applied as suffixes to food items for maximum corporate absurdity.
 * No actual Apple brand names - the parody is in the convention, not trademark.
 */
export const PRODUCT_MODIFIERS = [
  // Size/Tier
  'Max',
  'Ultra',
  'Extreme',
  'Infinite',
  'Supreme',
  'Lite',
  'Nano',
  'XL',
  'XS',
  // Material/Finish
  'Titanium',
  'Ceramic',
  'Carbon',
  'Platinum',
  'Obsidian',
  'Brushed Steel',
  // Tech-Sounding
  'Neural',
  'Quantum',
  'Fusion',
  'Turbo',
  'Hyperdrive',
  'Spatial',
  'Liquid',
  // Edition
  'Limited Edition',
  'Founders Edition',
  'Heritage Collection',
  'Signature Series',
  'Anniversary Edition',
  'Midnight',
  'Eclipse',
] as const;

export type FoodCategory = keyof typeof FOOD_ITEMS;
export type KeynoteStyle = (typeof KEYNOTE_STYLES)[number];
export type ProductModifier = (typeof PRODUCT_MODIFIERS)[number];

/**
 * Selects a random food item and its category
 */
export function selectRandomFood(): { category: FoodCategory; food: string } {
  const categoryKeys = Object.keys(FOOD_ITEMS) as FoodCategory[];
  const randomCategory = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
  const items = FOOD_ITEMS[randomCategory];
  const randomItem = items[Math.floor(Math.random() * items.length)];

  return {
    category: randomCategory,
    food: randomItem,
  };
}

/**
 * Selects a random keynote rhetoric style
 */
export function selectRandomStyle(): KeynoteStyle {
  return KEYNOTE_STYLES[Math.floor(Math.random() * KEYNOTE_STYLES.length)];
}

/**
 * Selects a random product modifier
 */
export function selectRandomModifier(): ProductModifier {
  return PRODUCT_MODIFIERS[Math.floor(Math.random() * PRODUCT_MODIFIERS.length)];
}
