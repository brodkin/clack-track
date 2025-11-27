/**
 * Personality Module
 *
 * Exports personality dimension generation and template variable resolution
 * for dynamic content personalization.
 *
 * @module content/personality
 */

export {
  generatePersonalityDimensions,
  DIMENSION_POOLS,
  type PersonalityDimensions,
} from './dimensions.js';

export {
  resolveTemplateVariables,
  findUnresolvedVariables,
  type TemplateVariables,
} from './template-resolver.js';
