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
import { ModelTierSelector, type ModelSelection } from '../../../api/ai/model-tier-selector.js';
import { createAIProvider, AIProviderType } from '../../../api/ai/index.js';
import { generatePersonalityDimensions } from '../../personality/index.js';
import { ModelTier } from '../../../types/content-generator.js';
import type { GenerationContext, GeneratedContent } from '../../../types/content-generator.js';
import type { AIProvider } from '../../../types/ai.js';

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
   * Generates novel insight content with programmatic topic and style selection.
   *
   * Overrides the base class generate() to:
   * 1. Select a random topic from the curated TOPICS array
   * 2. Select a random output style from OUTPUT_STYLES
   * 3. Inject both as template variables into the user prompt
   *
   * This ensures true randomness in topic selection, unlike asking the LLM
   * to "randomly select" which exhibits predictable bias.
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Programmatically select topic and style
    const selectedTopic = NovelInsightGenerator.selectTopic();
    const selectedStyle = NovelInsightGenerator.selectOutputStyle();

    // Step 2: Load system prompt with personality and date context
    const personality = context.personality ?? generatePersonalityDimensions();
    const loadedSystemPrompt = await this.promptLoader.loadPromptWithVariables(
      'system',
      this.getSystemPromptFile(),
      {
        mood: personality.mood,
        energyLevel: personality.energyLevel,
        humorStyle: personality.humorStyle,
        obsession: personality.obsession,
        persona: 'Houseboy',
        // Include date template variable following AIPromptGenerator.buildTemplateVariables() pattern
        date: context.timestamp.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      }
    );

    // Step 3: Apply dimension substitution (maxChars, maxLines) to system prompt
    const systemPrompt = this.applyDimensionSubstitution(loadedSystemPrompt);

    // Step 4: Load user prompt with topic and style injected
    const userPrompt = await this.promptLoader.loadPromptWithVariables(
      'user',
      this.getUserPromptFile(),
      {
        topic: selectedTopic,
        outputStyle: selectedStyle,
      }
    );

    // If promptsOnly mode, return just the prompts without AI call
    // This is used by ToolBasedGenerator to get prompts for its own AI call with tools
    if (context.promptsOnly) {
      return {
        text: '',
        outputMode: 'text',
        metadata: {
          tier: this.modelTier,
          personality,
          systemPrompt,
          userPrompt,
          selectedTopic,
          selectedStyle,
        },
      };
    }

    // Step 5: Select model and generate
    const selection: ModelSelection = this.modelTierSelector.select(this.modelTier);
    let lastError: Error | null = null;

    // Try preferred provider
    try {
      const provider = this.createProvider(selection);
      const response = await provider.generate({ systemPrompt, userPrompt });

      return {
        text: response.text,
        outputMode: 'text',
        metadata: {
          model: response.model,
          tier: this.modelTier,
          provider: selection.provider,
          tokensUsed: response.tokensUsed,
          personality,
          selectedTopic,
          selectedStyle,
        },
      };
    } catch (error) {
      lastError = error as Error;
    }

    // Try alternate provider
    const alternate = this.modelTierSelector.getAlternate(selection);
    if (alternate) {
      try {
        const alternateProvider = this.createProvider(alternate);
        const response = await alternateProvider.generate({ systemPrompt, userPrompt });

        return {
          text: response.text,
          outputMode: 'text',
          metadata: {
            model: response.model,
            tier: this.modelTier,
            provider: alternate.provider,
            tokensUsed: response.tokensUsed,
            failedOver: true,
            primaryError: lastError?.message,
            personality,
            selectedTopic,
            selectedStyle,
          },
        };
      } catch (alternateError) {
        lastError = alternateError as Error;
      }
    }

    throw new Error(`All AI providers failed for tier ${this.modelTier}: ${lastError?.message}`);
  }

  /**
   * Creates an AI provider instance for the given selection
   */
  private createProvider(selection: ModelSelection): AIProvider {
    const apiKey = this['apiKeys'][selection.provider];
    if (!apiKey) {
      throw new Error(`API key not found for provider: ${selection.provider}`);
    }
    return createAIProvider(selection.provider as AIProviderType, apiKey, selection.model);
  }
}
