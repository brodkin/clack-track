/**
 * Tests for DailyRoastGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses MEDIUM model tier for tone calibration
 * - Validates prompt files exist
 * - Returns correct system and user prompt file names
 * - Injects random topic domain, topic, and roast format into prompts
 * - Covers all topic domains and roast formats
 */

import { DailyRoastGenerator } from '@/content/generators/ai/daily-roast-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedDailyRoastGenerator = DailyRoastGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
  selectRandomTopic(): { topicDomain: string; topic: string };
  selectRandomRoastFormat(): string;
};

describe('DailyRoastGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;

  beforeEach(() => {
    // Mock PromptLoader
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn(),
      loadPromptTemplateWithVariables: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    // Mock ModelTierSelector
    mockModelTierSelector = {
      select: jest.fn(),
      getAlternate: jest.fn(),
    } as unknown as jest.Mocked<ModelTierSelector>;
  });

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, and MEDIUM tier', () => {
      const generator = new DailyRoastGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(DailyRoastGenerator);
    });

    it('should use MEDIUM model tier for tone calibration', async () => {
      // Set up mocks for generate() call
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

      // Verify via observable behavior: modelTierSelector.select is called with MEDIUM tier
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
    });

    it('should work without API keys (default empty object)', () => {
      const generator = new DailyRoastGenerator(mockPromptLoader, mockModelTierSelector);

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(DailyRoastGenerator);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new DailyRoastGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedDailyRoastGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return daily-roast.txt', () => {
      const generator = new DailyRoastGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedDailyRoastGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('daily-roast.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new DailyRoastGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when user prompt file is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt content') // system prompt exists
        .mockRejectedValueOnce(new Error('File not found: daily-roast.txt')); // user prompt missing

      const generator = new DailyRoastGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
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

      // Run multiple times to test randomness covers all domains
      const selectedDomains = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const { topicDomain } = generator.selectRandomTopic();
        selectedDomains.add(topicDomain);
        expect(validDomains).toContain(topicDomain);
      }

      // With 100 iterations, we should have hit most domains
      expect(selectedDomains.size).toBeGreaterThan(1);
    });

    it('should select valid topics within each domain', () => {
      const generator = new DailyRoastGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedDailyRoastGenerator;

      // Run multiple times to verify topic selection works
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

      // Run multiple times to test randomness
      const selectedFormats = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const format = generator.selectRandomRoastFormat();
        selectedFormats.add(format);
        expect(validFormats).toContain(format);
      }

      // With 50 iterations, we should have hit most formats
      expect(selectedFormats.size).toBeGreaterThan(1);
    });
  });

  describe('generate()', () => {
    it('should load correct prompts and use MEDIUM tier', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new DailyRoastGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedDailyRoastGenerator;

      // Verify the generator uses the correct prompt files via protected methods
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('daily-roast.txt');

      // Verify tier via observable behavior
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
    });

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
        // May fail without AI provider - we're testing the prompt loading
      }

      // Verify loadPromptWithVariables was called with topic variables
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
      // Access the static constant through the class
      const domains = DailyRoastGenerator.TOPIC_DOMAINS;

      expect(domains).toHaveProperty('WORK_LIFE');
      expect(domains).toHaveProperty('MORNING_RITUALS');
      expect(domains).toHaveProperty('TECHNOLOGY');
      expect(domains).toHaveProperty('SOCIAL');
      expect(domains).toHaveProperty('LIFESTYLE');
      expect(domains).toHaveProperty('DATING');

      // Verify each domain has topics
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
