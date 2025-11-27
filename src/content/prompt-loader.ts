import { readFile } from 'fs/promises';
import { join } from 'path';
import {
  resolveTemplateVariables,
  type TemplateVariables,
} from './personality/template-resolver.js';

export interface PromptTemplate {
  system: string;
  user: string;
}

export class PromptLoader {
  private promptsDir: string;

  constructor(promptsDir: string = './prompts') {
    this.promptsDir = promptsDir;
  }

  async loadPrompt(category: 'system' | 'user', filename: string): Promise<string> {
    const filepath = join(this.promptsDir, category, filename);
    try {
      const content = await readFile(filepath, 'utf-8');
      return content.trim();
    } catch (error) {
      throw new Error(`Failed to load prompt: ${filepath}`, { cause: error });
    }
  }

  /**
   * Loads a prompt and substitutes template variables.
   *
   * Replaces {{variableName}} placeholders with values from the variables map.
   * Unknown variables are preserved as-is for visibility.
   *
   * @param category - Prompt category ('system' or 'user')
   * @param filename - Name of the prompt file
   * @param variables - Map of variable names to values
   * @returns Prompt content with variables substituted
   *
   * @example
   * ```typescript
   * const prompt = await loader.loadPromptWithVariables('system', 'major-update-base.txt', {
   *   mood: 'sassy',
   *   energyLevel: 'high',
   *   date: 'Thursday, November 27, 2025'
   * });
   * ```
   */
  async loadPromptWithVariables(
    category: 'system' | 'user',
    filename: string,
    variables: TemplateVariables
  ): Promise<string> {
    const content = await this.loadPrompt(category, filename);
    return resolveTemplateVariables(content, variables);
  }

  async loadPromptTemplate(systemFile: string, userFile: string): Promise<PromptTemplate> {
    const [system, user] = await Promise.all([
      this.loadPrompt('system', systemFile),
      this.loadPrompt('user', userFile),
    ]);
    return { system, user };
  }

  /**
   * Loads a prompt template with variables substituted in both prompts.
   *
   * @param systemFile - System prompt filename
   * @param userFile - User prompt filename
   * @param variables - Map of variable names to values
   * @returns Prompt template with variables substituted in both prompts
   */
  async loadPromptTemplateWithVariables(
    systemFile: string,
    userFile: string,
    variables: TemplateVariables
  ): Promise<PromptTemplate> {
    const [system, user] = await Promise.all([
      this.loadPromptWithVariables('system', systemFile, variables),
      this.loadPromptWithVariables('user', userFile, variables),
    ]);
    return { system, user };
  }
}
