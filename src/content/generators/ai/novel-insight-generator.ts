/**
 * Novel Insight Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * fresh perspectives and "I never thought of it that way" moments using AI.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/novel-insight.txt for novel insight guidance
 * - Uses MEDIUM model tier for more complex reasoning (fresh perspectives)
 * - Programmatic topic selection from 100+ curated topics across 16 knowledge domains
 * - Random output style selection (mind-blown fact, provocative question, novel connection)
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects topic and outputStyle into prompt
 * - getCustomMetadata(): Tracks selection choices in metadata
 *
 * Novel insights aim to reframe familiar concepts in unexpected ways,
 * offering perspectives that make viewers pause and see things differently.
 * The tone is thought-provoking yet accessible, encouraging curiosity
 * without being pretentious.
 *
 * @example
 * ```typescript
 * const generator = new NovelInsightGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   { openai: 'sk-...', anthropic: 'sk-ant-...' }
 * );
 *
 * const content = await generator.generate({
 *   timestamp: new Date().toISOString(),
 *   timezone: 'America/New_York'
 * });
 *
 * console.log(content.text); // "YOUR COMFORT ZONE\nIS JUST A CIRCLE\nYOU DREW YOURSELF"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier } from '../../../types/content-generator.js';
import type { GenerationContext } from '../../../types/content-generator.js';

/**
 * Generates fresh perspectives and thought-provoking novel insights
 *
 * Extends AIPromptGenerator with novel-insight-specific prompts
 * and MEDIUM model tier selection for complex reasoning.
 * Uses programmatic topic selection to ensure true randomness
 * (LLMs cannot reliably generate random selections).
 */
export class NovelInsightGenerator extends AIPromptGenerator {
  /**
   * Curated list of 100+ intellectual topics across 16 knowledge domains.
   * Topics are selected programmatically using Math.random() to ensure
   * true randomness, unlike LLM "random" selections which exhibit bias.
   */
  static readonly TOPICS: readonly string[] = [
    // Physics (12 topics)
    'quantum entanglement',
    'wave-particle duality',
    'time dilation',
    'entropy and thermodynamics',
    'Heisenberg uncertainty principle',
    'black holes',
    'dark matter',
    'Higgs field',
    'speed of light',
    'antimatter',
    'string theory',
    'quantum superposition',

    // Mathematics (12 topics)
    'prime numbers',
    'infinity types',
    'Godel incompleteness theorem',
    'Fibonacci sequence',
    'golden ratio',
    'fractals',
    'non-Euclidean geometry',
    'topology',
    'chaos theory',
    'concept of zero',
    'imaginary numbers',
    'probability paradoxes',

    // Astronomy (10 topics)
    'scale of the universe',
    'exoplanets',
    'cosmic microwave background',
    'stellar lifecycles',
    'neutron stars',
    'gravitational waves',
    'light years and cosmic distances',
    'multiverse theories',
    'pale blue dot perspective',
    'Fermi paradox',

    // Biology (12 topics)
    'DNA and genetic code',
    'evolution mechanisms',
    'epigenetics',
    'microbiome',
    'cellular processes',
    'CRISPR gene editing',
    'convergent evolution',
    'extremophiles',
    'bioluminescence',
    'brain plasticity',
    'circadian rhythms',
    'symbiosis',

    // Chemistry (10 topics)
    'periodic table patterns',
    'chemical bonds',
    'chirality',
    'water anomalies',
    'carbon chemistry',
    'catalysis',
    'states of matter',
    'crystal structures',
    'pH scale',
    'electronegativity',

    // Psychology (12 topics)
    'cognitive biases',
    'memory formation',
    'perception illusions',
    'Dunning-Kruger effect',
    'confirmation bias',
    'anchoring effect',
    'flow states',
    'cognitive dissonance',
    'placebo effect',
    'decision making heuristics',
    'attention mechanisms',
    'consciousness theories',

    // Neuroscience (10 topics)
    'neuroplasticity',
    'mirror neurons',
    'split-brain research',
    'synaptic pruning',
    'default mode network',
    'dreams and REM sleep',
    'language processing in the brain',
    'pattern recognition',
    'embodied cognition',
    'sensory processing',

    // Linguistics (8 topics)
    'language acquisition',
    'Sapir-Whorf hypothesis',
    'phonemes and phonology',
    'etymology patterns',
    'linguistic relativity',
    'grammar universals',
    'language evolution',
    'semantic drift',

    // Philosophy (10 topics)
    'Ship of Theseus',
    'trolley problem',
    'Chinese room argument',
    'mind-body problem',
    'determinism vs free will',
    'epistemology',
    'thought experiments',
    'paradoxes of identity',
    'emergence',
    'causation theories',

    // Economics (8 topics)
    'invisible hand',
    'game theory',
    'behavioral economics',
    'tragedy of the commons',
    'network effects',
    'opportunity cost',
    'sunk cost fallacy',
    'market equilibrium',

    // History (6 topics)
    'butterfly effects in history',
    'technology diffusion',
    'cultural exchange',
    'path dependency',
    'unintended consequences',
    'collective memory',

    // Sociology (8 topics)
    'social construction',
    'emergent behavior',
    'groupthink',
    'network theory',
    'Dunbar number',
    'strength of weak ties',
    'norm formation',
    'status signaling',

    // Technology (8 topics)
    "Moore's law",
    'artificial intelligence concepts',
    'cryptography basics',
    'information theory',
    'Turing machines',
    'internet architecture',
    'algorithmic bias',
    'abstraction layers',

    // Ecology (6 topics)
    'ecosystem dynamics',
    'keystone species',
    'trophic cascades',
    'carrying capacity',
    'biodiversity',
    'island biogeography',

    // Art and Aesthetics (6 topics)
    'color theory',
    'golden ratio in art',
    'negative space',
    'perspective in art',
    'creativity research',
    'aesthetic universals',

    // Music Theory (6 topics)
    'harmonic series',
    'rhythm and time signatures',
    'musical intervals',
    'why music moves us emotionally',
    'consonance and dissonance',
    'earworms and musical memory',
  ] as const;

  /**
   * Output style definitions that guide the LLM on how to present the content.
   * One style is selected randomly per generation to ensure variety.
   */
  static readonly OUTPUT_STYLES: readonly string[] = [
    // Original 3 styles
    'MIND-BLOWN FACT: Share a surprising true fact that reframes understanding. Start with "DID YOU KNOW..." and make it genuinely surprising.',
    'PROVOCATIVE QUESTION: Ask a thought-provoking question that challenges assumptions. Use "WHAT IF..." or "WHY DO WE..." style.',
    'NOVEL CONNECTION: Connect two disparate concepts in an unexpected way. Use "X IS BASICALLY Y" format to illuminate a surprising link.',

    // Counter-intuitive insights
    'COUNTER-INTUITIVE TRUTH: Present something that seems wrong but is actually true. Challenge common sense with verified facts.',
    'BEAUTIFUL PARADOX: Share a fascinating paradox that makes people think. Frame it as an intriguing contradiction worth pondering.',

    // Perspective shifts
    'SCALE SHIFT: Put something in perspective by dramatically changing scale - from cosmic to atomic, or milliseconds to eons.',
    'REFRAME: Take something familiar and present it from a completely unexpected angle that changes how you see it.',
    'HIDDEN PATTERN: Reveal a pattern that exists all around us but most people never notice.',

    // Language and meaning
    'ETYMOLOGY INSIGHT: Share a word origin that reveals something profound about how we think or what we value.',
    'THOUGHT EXPERIMENT: Present a classic or novel thought experiment that illuminates a deeper truth about reality or human nature.',
  ] as const;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedTopic: string = '';
  private selectedStyle: string = '';

  /**
   * Programmatically selects a random topic from the TOPICS array.
   * Uses Math.random() for true randomness, unlike LLM-based selection
   * which exhibits bias toward certain topics.
   *
   * @returns A randomly selected topic string
   */
  static selectTopic(): string {
    const index = Math.floor(Math.random() * NovelInsightGenerator.TOPICS.length);
    return NovelInsightGenerator.TOPICS[index];
  }

  /**
   * Programmatically selects a random output style from the OUTPUT_STYLES array.
   * Uses Math.random() for true randomness.
   *
   * @returns A randomly selected output style string
   */
  static selectOutputStyle(): string {
    const index = Math.floor(Math.random() * NovelInsightGenerator.OUTPUT_STYLES.length);
    return NovelInsightGenerator.OUTPUT_STYLES[index];
  }

  /**
   * Creates a new NovelInsightGenerator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param apiKeys - Record of provider names to API keys (e.g., {'openai': 'sk-...', 'anthropic': 'sk-ant-...'})
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {}
  ) {
    // Use MEDIUM tier for novel insights (more complex reasoning for fresh perspectives)
    super(promptLoader, modelTierSelector, ModelTier.MEDIUM, apiKeys);
  }

  /**
   * Returns the filename for the system prompt
   *
   * Uses the major update base prompt which provides general
   * Vestaboard formatting constraints and creative guidelines.
   *
   * @returns Filename of the system prompt
   */
  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  /**
   * Returns the filename for the user prompt
   *
   * Uses the novel-insight prompt which specifies the content type,
   * structure, and tone for thought-provoking perspectives.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'novel-insight.txt';
  }

  /**
   * Hook: Selects random topic and style, returns as template variables.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with topic and outputStyle
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedTopic = NovelInsightGenerator.selectTopic();
    this.selectedStyle = NovelInsightGenerator.selectOutputStyle();

    return {
      topic: this.selectedTopic,
      outputStyle: this.selectedStyle,
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   *
   * @returns Metadata with selectedTopic and selectedStyle
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      selectedTopic: this.selectedTopic,
      selectedStyle: this.selectedStyle,
    };
  }
}
