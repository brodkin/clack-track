/**
 * Apple Keynote Food Generator
 *
 * Generates parodies of Apple keynote presentations applied to traditional
 * Americana foods. Tim Cook-level gravitas announcing cheeseburgers, fries,
 * and milkshakes with oddly specific stats and bold product names.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/apple-keynote-food.txt for keynote rhetoric guidance
 * - Three variety dimensions: food items (~150), keynote styles (~16), product modifiers (~30)
 * - Total combinations: ~72,000
 * - Optimized with LIGHT model tier for efficiency
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Selects random food, style, modifier
 * - getCustomMetadata(): Tracks selections for debugging/analytics
 *
 * @example
 * ```typescript
 * const generator = new AppleKeynoteFoodGenerator(
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
 * console.log(content.text); // "INTRODUCING\nFRIES ULTRA\n47% MORE CRISP\nWE CANT WAIT TO SEE\nWHAT YOU DIP"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';
import {
  FOOD_ITEMS,
  KEYNOTE_STYLES,
  STYLE_GUIDANCE,
  PRODUCT_MODIFIERS,
  selectRandomFood,
  selectRandomStyle,
  selectRandomModifier,
} from './apple-keynote-food-dictionaries.js';

// Re-export dictionaries for testing
export { FOOD_ITEMS, KEYNOTE_STYLES, STYLE_GUIDANCE, PRODUCT_MODIFIERS };

/**
 * Generates Apple keynote-style announcements of Americana foods.
 *
 * Three variety dimensions ensure high output diversity:
 * 1. Food items (~150 across 11 categories)
 * 2. Keynote rhetoric styles (~16 distinct patterns)
 * 3. Product modifiers (~30 tech-inspired name suffixes)
 */
export class AppleKeynoteFoodGenerator extends AIPromptGenerator {
  static readonly FOOD_ITEMS = FOOD_ITEMS;
  static readonly KEYNOTE_STYLES = KEYNOTE_STYLES;
  static readonly STYLE_GUIDANCE = STYLE_GUIDANCE;
  static readonly PRODUCT_MODIFIERS = PRODUCT_MODIFIERS;

  private selectedCategory: string = '';
  private selectedFood: string = '';
  private selectedStyle: string = '';
  private selectedModifier: string = '';

  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {}
  ) {
    super(promptLoader, modelTierSelector, ModelTierEnum.LIGHT, apiKeys);
  }

  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  protected getUserPromptFile(): string {
    return 'apple-keynote-food.txt';
  }

  /**
   * Selects a random food item and its category.
   * Public for testing.
   */
  selectRandomFood(): { category: string; food: string } {
    return selectRandomFood();
  }

  /**
   * Selects a random keynote rhetoric style.
   * Public for testing.
   */
  selectRandomStyle(): string {
    return selectRandomStyle();
  }

  /**
   * Selects a random product modifier.
   * Public for testing.
   */
  selectRandomModifier(): string {
    return selectRandomModifier();
  }

  /**
   * Hook: Selects random food, style, and modifier for template injection.
   *
   * Style guidance is injected selectively based on the chosen style.
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    const { category, food } = this.selectRandomFood();
    const style = this.selectRandomStyle();
    const modifier = this.selectRandomModifier();

    this.selectedCategory = category;
    this.selectedFood = food;
    this.selectedStyle = style;
    this.selectedModifier = modifier;

    return {
      foodItem: food,
      keynoteStyle: style,
      keynoteStyleGuidance: STYLE_GUIDANCE[style as keyof typeof STYLE_GUIDANCE],
      productModifier: modifier,
    };
  }

  /**
   * Hook: Returns selection choices in metadata for tracking.
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      foodCategory: this.selectedCategory,
      foodItem: this.selectedFood,
      keynoteStyle: this.selectedStyle,
      productModifier: this.selectedModifier,
    };
  }
}
