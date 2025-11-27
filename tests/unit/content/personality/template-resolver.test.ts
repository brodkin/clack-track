import {
  resolveTemplateVariables,
  findUnresolvedVariables,
} from '../../../../src/content/personality/template-resolver.js';

describe('Template Resolver', () => {
  describe('resolveTemplateVariables', () => {
    it('should replace a single variable', () => {
      const template = 'Hello {{name}}!';
      const result = resolveTemplateVariables(template, { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should replace multiple variables', () => {
      const template = '{{greeting}} {{name}}, your mood is {{mood}}!';
      const result = resolveTemplateVariables(template, {
        greeting: 'Hello',
        name: 'Houseboy',
        mood: 'sassy',
      });
      expect(result).toBe('Hello Houseboy, your mood is sassy!');
    });

    it('should replace the same variable multiple times', () => {
      const template = '{{name}} says hi. {{name}} is happy.';
      const result = resolveTemplateVariables(template, { name: 'Bob' });
      expect(result).toBe('Bob says hi. Bob is happy.');
    });

    it('should preserve unknown variables', () => {
      const template = 'Hello {{name}}, {{unknown}} variable';
      const result = resolveTemplateVariables(template, { name: 'World' });
      expect(result).toBe('Hello World, {{unknown}} variable');
    });

    it('should handle empty variables object', () => {
      const template = 'Hello {{name}}!';
      const result = resolveTemplateVariables(template, {});
      expect(result).toBe('Hello {{name}}!');
    });

    it('should handle template with no variables', () => {
      const template = 'Hello World!';
      const result = resolveTemplateVariables(template, { name: 'Unused' });
      expect(result).toBe('Hello World!');
    });

    it('should handle empty template', () => {
      const result = resolveTemplateVariables('', { name: 'Test' });
      expect(result).toBe('');
    });

    it('should convert number values to strings', () => {
      const template = 'Count: {{count}}';
      const result = resolveTemplateVariables(template, { count: 42 });
      expect(result).toBe('Count: 42');
    });

    it('should convert boolean values to strings', () => {
      const template = 'Active: {{active}}';
      const result = resolveTemplateVariables(template, { active: true });
      expect(result).toBe('Active: true');
    });

    it('should handle variables with underscores', () => {
      const template = 'Level: {{energy_level}}';
      const result = resolveTemplateVariables(template, { energy_level: 'high' });
      expect(result).toBe('Level: high');
    });

    it('should handle variables at start and end of template', () => {
      const template = '{{start}} middle {{end}}';
      const result = resolveTemplateVariables(template, {
        start: 'BEGIN',
        end: 'END',
      });
      expect(result).toBe('BEGIN middle END');
    });

    it('should handle multiline templates', () => {
      const template = `Line 1: {{first}}
Line 2: {{second}}
Line 3: {{third}}`;
      const result = resolveTemplateVariables(template, {
        first: 'A',
        second: 'B',
        third: 'C',
      });
      expect(result).toBe(`Line 1: A
Line 2: B
Line 3: C`);
    });

    it('should not match partial variable syntax', () => {
      const template = 'Invalid: {name} or {{name or name}}';
      const result = resolveTemplateVariables(template, { name: 'Test' });
      expect(result).toBe('Invalid: {name} or {{name or name}}');
    });

    it('should handle real-world prompt template', () => {
      const template = `You are {{persona}}, generating content.

PERSONALITY:
- Mood: {{mood}}
- Energy: {{energyLevel}}

Current date: {{date}}`;

      const result = resolveTemplateVariables(template, {
        persona: 'Houseboy',
        mood: 'playful',
        energyLevel: 'high',
        date: 'Thursday, November 27, 2025',
      });

      expect(result).toContain('You are Houseboy, generating content.');
      expect(result).toContain('- Mood: playful');
      expect(result).toContain('- Energy: high');
      expect(result).toContain('Current date: Thursday, November 27, 2025');
    });
  });

  describe('findUnresolvedVariables', () => {
    it('should find a single unresolved variable', () => {
      const template = 'Hello {{name}}!';
      const unresolved = findUnresolvedVariables(template);
      expect(unresolved).toEqual(['name']);
    });

    it('should find multiple unresolved variables', () => {
      const template = '{{greeting}} {{name}}, mood: {{mood}}';
      const unresolved = findUnresolvedVariables(template);
      expect(unresolved).toEqual(['greeting', 'name', 'mood']);
    });

    it('should return empty array when no variables', () => {
      const template = 'Hello World!';
      const unresolved = findUnresolvedVariables(template);
      expect(unresolved).toEqual([]);
    });

    it('should find duplicate variable references', () => {
      const template = '{{name}} says {{name}} twice';
      const unresolved = findUnresolvedVariables(template);
      expect(unresolved).toEqual(['name', 'name']);
    });

    it('should return empty array for empty string', () => {
      const unresolved = findUnresolvedVariables('');
      expect(unresolved).toEqual([]);
    });

    it('should work with resolved template', () => {
      const template = 'Hello {{name}}!';
      const resolved = resolveTemplateVariables(template, { name: 'World' });
      const unresolved = findUnresolvedVariables(resolved);
      expect(unresolved).toEqual([]);
    });

    it('should find variables remaining after partial resolution', () => {
      const template = '{{greeting}} {{name}}, your {{mood}} is showing';
      const partiallyResolved = resolveTemplateVariables(template, {
        greeting: 'Hello',
      });
      const unresolved = findUnresolvedVariables(partiallyResolved);
      expect(unresolved).toEqual(['name', 'mood']);
    });
  });
});
