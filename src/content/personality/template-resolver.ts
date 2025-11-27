/**
 * Template Variable Resolver
 *
 * Provides Mustache-style template variable substitution for prompt templates.
 * Replaces {{variableName}} placeholders with actual values from a variables map.
 *
 * @module content/personality/template-resolver
 */

/**
 * Type for template variable values.
 * Supports strings directly, or values that can be converted to strings.
 */
export type TemplateVariables = Record<string, string | number | boolean>;

/**
 * Resolves template variables in a string.
 *
 * Replaces all occurrences of {{variableName}} with the corresponding
 * value from the variables map. Unknown variables are preserved as-is
 * to allow for graceful degradation.
 *
 * @param template - String containing {{variable}} placeholders
 * @param variables - Map of variable names to values
 * @returns Template with variables substituted
 *
 * @example
 * ```typescript
 * const template = 'Hello {{name}}, your mood is {{mood}}!';
 * const vars = { name: 'Houseboy', mood: 'sassy' };
 * const result = resolveTemplateVariables(template, vars);
 * // 'Hello Houseboy, your mood is sassy!'
 * ```
 *
 * @example
 * ```typescript
 * // Unknown variables are preserved
 * const template = 'Hello {{name}}, {{unknown}} variable';
 * const vars = { name: 'World' };
 * const result = resolveTemplateVariables(template, vars);
 * // 'Hello World, {{unknown}} variable'
 * ```
 */
export function resolveTemplateVariables(template: string, variables: TemplateVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, variableName: string) => {
    const value = variables[variableName];
    if (value === undefined) {
      // Preserve unknown variables for debugging visibility
      return match;
    }
    return String(value);
  });
}

/**
 * Checks if a template contains any unresolved variables.
 *
 * Useful for validation and debugging to ensure all expected
 * variables have been provided.
 *
 * @param template - Template string to check
 * @returns Array of unresolved variable names (empty if all resolved)
 *
 * @example
 * ```typescript
 * const template = 'Hello {{name}}, your {{mood}} is showing';
 * const unresolved = findUnresolvedVariables(template);
 * // ['name', 'mood']
 *
 * const resolved = resolveTemplateVariables(template, { name: 'World', mood: 'joy' });
 * const stillUnresolved = findUnresolvedVariables(resolved);
 * // []
 * ```
 */
export function findUnresolvedVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  return [...matches].map(match => match[1]);
}
