/**
 * FDA Guidelines Generator
 *
 * Generates pedantic, factual rules from the FDA Food Code covering
 * topics from food manufacturing through food preparation. Delivered
 * dry and rigid - the regulation's own precision is the point.
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';
import { FOOD_CODE_PROVISIONS, selectRandomProvision } from './fda-guidelines-dictionaries.js';

interface SelectedProvision {
  section: string;
  topic: string;
  facet: string;
}

export class FdaGuidelinesGenerator extends AIPromptGenerator {
  static readonly FOOD_CODE_PROVISIONS = FOOD_CODE_PROVISIONS;

  protected selectedProvision: SelectedProvision = {
    section: FOOD_CODE_PROVISIONS[0].section,
    topic: FOOD_CODE_PROVISIONS[0].topic,
    facet: FOOD_CODE_PROVISIONS[0].facets[0],
  };

  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {}
  ) {
    super(promptLoader, modelTierSelector, ModelTierEnum.MEDIUM, apiKeys);
  }

  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  protected getUserPromptFile(): string {
    return 'fda-guidelines.txt';
  }

  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    const provision = selectRandomProvision();
    this.selectedProvision = provision;
    return {
      section: provision.section,
      topicArea: provision.topic,
      facet: provision.facet,
    };
  }

  protected getCustomMetadata(): Record<string, unknown> {
    return {
      section: this.selectedProvision.section,
      topicArea: this.selectedProvision.topic,
      facet: this.selectedProvision.facet,
    };
  }
}
