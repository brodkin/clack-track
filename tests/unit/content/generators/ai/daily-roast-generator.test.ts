/**
 * Tests for DailyRoastGenerator
 *
 * Generator-specific behavior:
 * - Topic selection (6 domains with topics)
 * - Roast format selection (4 formats)
 * - TOPIC_DOMAINS and ROAST_FORMATS constants
 * - Template variable injection (topicDomain, topic, roastFormat)
 */

import { DailyRoastGenerator } from '@/content/generators/ai/daily-roast-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedDailyRoastGenerator = DailyRoastGenerator & {
  selectRandomTopic(): { topicDomain: string; topic: string };
  selectRandomRoastFormat(): string;
};

describe('DailyRoastGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;

  beforeEach(() => {
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn(),
      loadPromptTemplateWithVariables: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    mockModelTierSelector = {
      select: jest.fn(),
      getAlternate: jest.fn(),
    } as unknown as jest.Mocked<ModelTierSelector>;
  });

  describe('topic selection', () => {
    it('should select from valid topic domains', () => {
      const generator = new DailyRoastGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedDailyRoastGenerator;

      const validDomains = [
        'WORK_LIFE',
        'MORNING_RITUALS',
        'TECHNOLOGY',
        'SOCIAL',
        'LIFESTYLE',
        'DATING',
      ];

      const selectedDomains = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const { topicDomain } = generator.selectRandomTopic();
        selectedDomains.add(topicDomain);
        expect(validDomains).toContain(topicDomain);
      }

      expect(selectedDomains.size).toBeGreaterThan(1);
    });

    it('should select valid topics within each domain', () => {
      const generator = new DailyRoastGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedDailyRoastGenerator;

      for (let i = 0; i < 50; i++) {
        const { topicDomain, topic } = generator.selectRandomTopic();
        expect(topicDomain).toBeDefined();
        expect(topic).toBeDefined();
        expect(typeof topic).toBe('string');
        expect(topic.length).toBeGreaterThan(0);
      }
    });
  });

  describe('roast format selection', () => {
    it('should select from valid roast formats', () => {
      const generator = new DailyRoastGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedDailyRoastGenerator;

      const validFormats = ['OBSERVATION', 'ACCUSATION', 'CONFESSION', 'COMPARISON'];

      const selectedFormats = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const format = generator.selectRandomRoastFormat();
        selectedFormats.add(format);
        expect(validFormats).toContain(format);
      }

      expect(selectedFormats.size).toBeGreaterThan(1);
    });
  });

  describe('template variable injection', () => {
    it('should inject topic variables into user prompt', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new DailyRoastGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider
      }

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'daily-roast.txt'
      );

      expect(userPromptCall).toBeDefined();
      const variables = userPromptCall?.[2];
      expect(variables).toHaveProperty('topicDomain');
      expect(variables).toHaveProperty('topic');
      expect(variables).toHaveProperty('roastFormat');
    });
  });

  describe('TOPIC_DOMAINS constant', () => {
    it('should contain all required topic domains with their topics', () => {
      const domains = DailyRoastGenerator.TOPIC_DOMAINS;

      expect(domains).toHaveProperty('WORK_LIFE');
      expect(domains).toHaveProperty('MORNING_RITUALS');
      expect(domains).toHaveProperty('TECHNOLOGY');
      expect(domains).toHaveProperty('SOCIAL');
      expect(domains).toHaveProperty('LIFESTYLE');
      expect(domains).toHaveProperty('DATING');

      expect(domains.WORK_LIFE).toContain('meetings');
      expect(domains.MORNING_RITUALS).toContain('snooze button');
      expect(domains.TECHNOLOGY).toContain('passwords');
      expect(domains.SOCIAL).toContain('small talk');
      expect(domains.LIFESTYLE).toContain('gym memberships');
      expect(domains.DATING).toContain('dating apps');
    });
  });

  describe('ROAST_FORMATS constant', () => {
    it('should contain all required roast formats', () => {
      const formats = DailyRoastGenerator.ROAST_FORMATS;

      expect(formats).toContain('OBSERVATION');
      expect(formats).toContain('ACCUSATION');
      expect(formats).toContain('CONFESSION');
      expect(formats).toContain('COMPARISON');
      expect(formats.length).toBe(4);
    });
  });
});
