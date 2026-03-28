/**
 * Fake Gay News Generator
 *
 * Generates satirical, raunchy gay gossip headlines styled as breaking news.
 * Think WeHo gossip column meets late night news ticker - scandalous,
 * provocative, and unapologetically queer humor.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/fake-gay-news.txt for content guidance
 * - Variety via GAY_NEWS_TOPICS (~30 topics) and GAY_NEWS_FORMATS (~15 formats)
 * - Purple square (🟪) prefix to signal gay news content
 * - MEDIUM model tier for clever, boundary-pushing humor
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Selects random topic and format for {{gayNewsTopic}}, {{gayNewsFormat}}
 * - getCustomMetadata(): Adds selectedTopic and selectedFormat to metadata for tracking
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier, type GenerationContext } from '../../../types/content-generator.js';

/**
 * Gay culture topics for fake news headlines.
 * Broad enough to allow creative freedom, specific enough to anchor the humor.
 */
export const GAY_NEWS_TOPICS: readonly string[] = [
  // Hookup & Dating
  'hookup apps',
  'grindr distance alerts',
  'blank profiles',
  'hosting vs traveling',
  'the DMs',
  'situationships',
  'open relationships',
  'u up texts',
  // Body & Fitness
  'leg day at the gay gym',
  'protein shake obsession',
  'harness season prep',
  'thirst traps',
  'shirtless selfies',
  'body hair discourse',
  // Nightlife & Social
  'WeHo bar drama',
  'circuit parties',
  'drag brunch',
  'bottle service gays',
  'the afterparty',
  'gay halloween costumes',
  'pride float politics',
  // Types & Tribes
  'tops and bottoms',
  'vers discourse',
  'twink expiration dates',
  'bear community',
  'leather daddies',
  'the masc4masc debate',
  // Lifestyle & Culture
  'poppers',
  'bathhouse etiquette',
  'gay brunch wars',
  'the group chat',
  'astrology gays',
  'skincare routines',
  'interior decorating feuds',
  'dog park cruising allegations',
  // Drama & Gossip
  'the ex sighting',
  'who blocked who',
  'the cheating scandal',
  'the throuple implosion',
  'instagram unfollowing spree',
  'the borrowed harness',
] as const;

/**
 * News presentation formats that shape HOW the fake headline is delivered.
 * Each format forces a structurally different output.
 */
export const GAY_NEWS_FORMATS: readonly string[] = [
  'breaking news alert',
  'eyewitness report',
  'investigative expose',
  'anonymous poll results',
  'public safety announcement',
  'sources say blind item',
  'product recall notice',
  'community advisory',
  'developing story update',
  'exclusive interview excerpt',
  'editorial opinion',
  'on-scene live report',
  'whistleblower leak',
  'neighborhood watch alert',
  'scientific study findings',
] as const;

/**
 * Generates satirical gay gossip headlines as fake breaking news.
 *
 * Extends AIPromptGenerator with gay-news-specific prompts,
 * MEDIUM model tier for clever humor, and variety dimensions
 * for topic and format selection.
 */
export class FakeGayNewsGenerator extends AIPromptGenerator {
  /** Stores the selected topic for metadata tracking. */
  protected selectedTopic: string = '';

  /** Stores the selected format for metadata tracking. */
  protected selectedFormat: string = '';

  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {}
  ) {
    super(promptLoader, modelTierSelector, ModelTier.MEDIUM, apiKeys);
  }

  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  protected getUserPromptFile(): string {
    return 'fake-gay-news.txt';
  }

  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedTopic = this.selectRandom(GAY_NEWS_TOPICS);
    this.selectedFormat = this.selectRandom(GAY_NEWS_FORMATS);

    return {
      gayNewsTopic: this.selectedTopic,
      gayNewsFormat: this.selectedFormat,
    };
  }

  protected getCustomMetadata(): Record<string, unknown> {
    return {
      selectedTopic: this.selectedTopic,
      selectedFormat: this.selectedFormat,
    };
  }

  private selectRandom<T>(array: readonly T[]): T {
    const index = Math.floor(Math.random() * array.length);
    return array[index];
  }
}
