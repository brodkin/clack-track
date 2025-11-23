import { readFile } from 'fs/promises';
import { join } from 'path';

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

  async loadPromptTemplate(systemFile: string, userFile: string): Promise<PromptTemplate> {
    const [system, user] = await Promise.all([
      this.loadPrompt('system', systemFile),
      this.loadPrompt('user', userFile),
    ]);
    return { system, user };
  }
}
