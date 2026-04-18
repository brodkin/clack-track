/**
 * Wikipedia Fact Generator
 *
 * Concrete implementation of AIPromptGenerator for generating bite-sized
 * interesting facts from random Wikipedia articles.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/wikipedia-fact.txt for fact extraction guidance
 * - Fetches random Wikipedia article summaries (intro/lead section only)
 * - Token-optimized: Truncates articles to ~800 chars max
 * - AI extracts one interesting, surprising, or novel detail
 * - Optimized with MEDIUM model tier for creative fact selection
 * - Graceful fallback when Wikipedia API fails
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects article title and summary into prompt
 * - getCustomMetadata(): Tracks article data and fetch status
 *
 * @example
 * ```typescript
 * const generator = new WikipediaFactGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   { openai: 'sk-...', anthropic: 'sk-ant-...' }
 * );
 *
 * const content = await generator.generate({
 *   timestamp: new Date(),
 *   updateType: 'major'
 * });
 *
 * console.log(content.text); // "DID YOU KNOW?\nOCTOPUSES HAVE THREE\nHEARTS AND BLUE BLOOD"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { WikipediaClient, type WikipediaArticle } from '../../../api/data-sources/wikipedia.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Fallback values when Wikipedia API is unavailable
 */
const FALLBACK_VALUES = {
  title: 'The Internet',
  summary:
    'The Internet is a global system of interconnected computer networks that use the Internet protocol suite (TCP/IP) to communicate between networks and devices. It is a network of networks that consists of private, public, academic, business, and government networks of local to global scope, linked by a broad array of electronic, wireless, and optical networking technologies.',
  url: 'https://en.wikipedia.org/wiki/Internet',
} as const;

/**
 * Generates bite-sized interesting facts from random Wikipedia articles
 *
 * Extends AIPromptGenerator with Wikipedia-specific prompts and
 * random article injection for natural content variety.
 */
export class WikipediaFactGenerator extends AIPromptGenerator {
  private readonly wikipediaClient: WikipediaClient;

  /**
   * Tracks whether Wikipedia data was successfully fetched
   */
  private wikipediaDataFetched: boolean = false;

  /**
   * Fetched Wikipedia article data (null if fetch failed)
   */
  private article: WikipediaArticle | null = null;

  /**
   * Creates a new WikipediaFactGenerator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param apiKeys - Record of provider names to API keys (e.g., {'openai': 'sk-...', 'anthropic': 'sk-ant-...'})
   * @param wikipediaClient - Optional WikipediaClient for fetching article data (useful for testing)
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {},
    wikipediaClient?: WikipediaClient
  ) {
    // Use MEDIUM tier for creative fact extraction and engaging presentation
    super(promptLoader, modelTierSelector, ModelTierEnum.MEDIUM, apiKeys);
    this.wikipediaClient = wikipediaClient ?? new WikipediaClient();
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
   * Uses the wikipedia-fact prompt which specifies how to extract
   * and present interesting facts from articles.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'wikipedia-fact.txt';
  }

  /**
   * Hook: Fetches random Wikipedia article and returns as template variables.
   *
   * Fetches a random Wikipedia article summary (intro/lead section only)
   * and formats it for prompt injection via template variables.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with article title and summary
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    // Reset tracking state
    this.wikipediaDataFetched = false;
    this.article = null;

    // Default template variables using fallback values
    let templateVars: Record<string, string> = {
      articleTitle: FALLBACK_VALUES.title,
      articleSummary: FALLBACK_VALUES.summary,
    };

    try {
      // Fetch random Wikipedia article summary (max 800 chars)
      this.article = await this.wikipediaClient.getRandomArticleSummary(800);
      this.wikipediaDataFetched = true;

      // Update template variables with real article data
      templateVars = {
        articleTitle: this.article.title,
        articleSummary: this.article.extract,
      };
    } catch (error) {
      console.error('Failed to fetch Wikipedia article for prompt:', error);
      // Keep using fallback values set above
    }

    return templateVars;
  }

  /**
   * Hook: Returns Wikipedia data fetching status and article info in metadata.
   *
   * @returns Metadata with Wikipedia fetch status and article details
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      wikipediaDataFetched: this.wikipediaDataFetched,
      articleTitle: this.article?.title ?? FALLBACK_VALUES.title,
      articleUrl: this.article?.url ?? FALLBACK_VALUES.url,
      articleDescription: this.article?.description,
    };
  }
}
