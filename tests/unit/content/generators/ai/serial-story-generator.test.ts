/**
 * Tests for SerialStoryGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses MEDIUM model tier for story continuity
 * - Accepts ContentRepository and optional maxChapters in constructor
 * - getStoryState() queries previous chapters, detects new vs continuation
 * - getTemplateVariables() returns appropriate vars for chapter type
 * - getCustomMetadata() returns StoryChapterMetadata
 * - DEFAULT_MAX_CHAPTERS = 15, configurable via constructor
 * - Reuses SCENARIO and EMOTIONAL_BEAT dictionaries from story-fragment-generator
 */

import {
  SerialStoryGenerator,
  StoryState,
  SCENARIO,
  EMOTIONAL_BEAT,
} from '@/content/generators/ai/serial-story-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ContentRepository } from '@/storage/repositories/content-repo';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import type { ContentRecord } from '@/storage/models/content';

// Helper type for accessing protected members in tests
type ProtectedSerialStoryGenerator = SerialStoryGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  getTemplateVariables(context: GenerationContext): Promise<Record<string, string>>;
  getCustomMetadata(): Record<string, unknown>;
  modelTier: ModelTier;
};

describe('SerialStoryGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockContentRepository: jest.Mocked<ContentRepository>;

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

    // Mock ContentRepository
    mockContentRepository = {
      findLatestByGenerator: jest.fn(),
      save: jest.fn(),
      findLatest: jest.fn(),
      findByStatus: jest.fn(),
      findFailures: jest.fn(),
      saveContent: jest.fn(),
      getLatestContent: jest.fn(),
      getContentHistory: jest.fn(),
      cleanupOldRecords: jest.fn(),
    } as unknown as jest.Mocked<ContentRepository>;
  });

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, ContentRepository, and MEDIUM tier', () => {
      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      );

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(SerialStoryGenerator);
    });

    it('should use MEDIUM model tier for story continuity', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);
      mockContentRepository.findLatestByGenerator.mockResolvedValue([]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      );

      // Verify via observable behavior: modelTierSelector.select is called with MEDIUM tier
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
    });

    it('should use DEFAULT_MAX_CHAPTERS when maxChapters not provided', () => {
      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      );

      expect(generator.maxChapters).toBe(15);
    });

    it('should accept custom maxChapters via constructor', () => {
      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' },
        10
      );

      expect(generator.maxChapters).toBe(10);
    });
  });

  describe('DEFAULT_MAX_CHAPTERS', () => {
    it('should have static DEFAULT_MAX_CHAPTERS = 15', () => {
      expect(SerialStoryGenerator.DEFAULT_MAX_CHAPTERS).toBe(15);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return serial-story-chapter1.txt for new stories', async () => {
      mockContentRepository.findLatestByGenerator.mockResolvedValue([]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      // Get story state first (this sets internal state)
      await generator.getStoryState();

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('serial-story-chapter1.txt');
    });

    it('should return serial-story-continuation.txt for ongoing stories', async () => {
      const previousChapter: ContentRecord = {
        id: 1,
        text: 'Chapter 1 content',
        type: 'major',
        generatedAt: new Date(),
        sentAt: new Date(),
        aiProvider: 'openai',
        metadata: {
          storyChapter: 1,
          continueStory: true,
          chapterSummary: 'A mysterious door appeared',
        },
        generatorId: 'serial-story',
      };
      mockContentRepository.findLatestByGenerator.mockResolvedValue([previousChapter]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      // Get story state first (this sets internal state)
      await generator.getStoryState();

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('serial-story-continuation.txt');
    });
  });

  describe('getStoryState()', () => {
    it('should detect new story when no previous chapters exist', async () => {
      mockContentRepository.findLatestByGenerator.mockResolvedValue([]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      const state = await generator.getStoryState();

      expect(state.isNewStory).toBe(true);
      expect(state.currentChapter).toBe(1);
      expect(state.previousChapters).toEqual([]);
    });

    it('should detect continuation when previous chapters exist with continueStory:true', async () => {
      const previousChapter: ContentRecord = {
        id: 1,
        text: 'Chapter 1 content',
        type: 'major',
        generatedAt: new Date(),
        sentAt: new Date(),
        aiProvider: 'openai',
        metadata: {
          storyChapter: 1,
          continueStory: true,
          chapterSummary: 'A mysterious door appeared',
        },
        generatorId: 'serial-story',
      };
      mockContentRepository.findLatestByGenerator.mockResolvedValue([previousChapter]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      const state = await generator.getStoryState();

      expect(state.isNewStory).toBe(false);
      expect(state.currentChapter).toBe(2);
      expect(state.previousChapters).toHaveLength(1);
    });

    it('should detect new story when last chapter had continueStory:false', async () => {
      const finalChapter: ContentRecord = {
        id: 1,
        text: 'Final chapter content',
        type: 'major',
        generatedAt: new Date(),
        sentAt: new Date(),
        aiProvider: 'openai',
        metadata: {
          storyChapter: 8,
          continueStory: false,
          chapterSummary: 'The story concludes',
        },
        generatorId: 'serial-story',
      };
      mockContentRepository.findLatestByGenerator.mockResolvedValue([finalChapter]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      const state = await generator.getStoryState();

      expect(state.isNewStory).toBe(true);
      expect(state.currentChapter).toBe(1);
    });

    it('should detect new story when chapter count >= maxChapters', async () => {
      const chapters: ContentRecord[] = [];
      for (let i = 15; i >= 1; i--) {
        chapters.push({
          id: i,
          text: `Chapter ${i} content`,
          type: 'major',
          generatedAt: new Date(Date.now() - (15 - i) * 1000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: {
            storyChapter: i,
            continueStory: true,
            chapterSummary: `Summary for chapter ${i}`,
          },
          generatorId: 'serial-story',
        });
      }
      mockContentRepository.findLatestByGenerator.mockResolvedValue(chapters);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' },
        15
      ) as ProtectedSerialStoryGenerator;

      const state = await generator.getStoryState();

      expect(state.isNewStory).toBe(true);
      expect(state.currentChapter).toBe(1);
    });

    it('should query repository with correct generator ID', async () => {
      mockContentRepository.findLatestByGenerator.mockResolvedValue([]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      await generator.getStoryState();

      expect(mockContentRepository.findLatestByGenerator).toHaveBeenCalledWith('serial-story', 15);
    });
  });

  describe('getTemplateVariables()', () => {
    const mockContext: GenerationContext = {
      updateType: 'major',
      timestamp: new Date(),
    };

    it('should return scenario and emotionalBeat for chapter 1', async () => {
      mockContentRepository.findLatestByGenerator.mockResolvedValue([]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      const variables = await generator.getTemplateVariables(mockContext);

      expect(variables).toHaveProperty('scenario');
      expect(variables).toHaveProperty('emotionalBeat');
      expect(SCENARIO).toContain(variables.scenario);
      expect(EMOTIONAL_BEAT).toContain(variables.emotionalBeat);
    });

    it('should return currentChapter: "1" for chapter 1', async () => {
      mockContentRepository.findLatestByGenerator.mockResolvedValue([]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      const variables = await generator.getTemplateVariables(mockContext);

      expect(variables).toHaveProperty('currentChapter');
      expect(variables.currentChapter).toBe('1');
    });

    it('should return currentChapter as string for continuation', async () => {
      const previousChapters: ContentRecord[] = [
        {
          id: 3,
          text: 'Chapter 3',
          type: 'major',
          generatedAt: new Date(Date.now() - 1000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: 3, continueStory: true, chapterSummary: 'Summary 3' },
          generatorId: 'serial-story',
        },
        {
          id: 2,
          text: 'Chapter 2',
          type: 'major',
          generatedAt: new Date(Date.now() - 2000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: 2, continueStory: true, chapterSummary: 'Summary 2' },
          generatorId: 'serial-story',
        },
        {
          id: 1,
          text: 'Chapter 1',
          type: 'major',
          generatedAt: new Date(Date.now() - 3000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: 1, continueStory: true, chapterSummary: 'Summary 1' },
          generatorId: 'serial-story',
        },
      ];
      mockContentRepository.findLatestByGenerator.mockResolvedValue(previousChapters);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      const variables = await generator.getTemplateVariables(mockContext);

      expect(variables).toHaveProperty('currentChapter');
      expect(variables.currentChapter).toBe('4');
      expect(typeof variables.currentChapter).toBe('string');
    });

    it('should return previousChapters and currentChapter for continuation', async () => {
      const previousChapter: ContentRecord = {
        id: 1,
        text: 'THE DOOR APPEARED\nIN THE OLD BARN\nWHERE NOTHING HAD BEEN',
        type: 'major',
        generatedAt: new Date(),
        sentAt: new Date(),
        aiProvider: 'openai',
        metadata: {
          storyChapter: 1,
          continueStory: true,
          chapterSummary: 'A mysterious door appeared in the old barn',
        },
        generatorId: 'serial-story',
      };
      mockContentRepository.findLatestByGenerator.mockResolvedValue([previousChapter]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      const variables = await generator.getTemplateVariables(mockContext);

      expect(variables).toHaveProperty('previousChapters');
      expect(variables).toHaveProperty('currentChapter');
      expect(variables.currentChapter).toBe('2');
      expect(variables.previousChapters).toContain('Chapter 1');
    });

    it('should include arc phase flags for continuation (early arc)', async () => {
      const previousChapter: ContentRecord = {
        id: 1,
        text: 'Chapter 1',
        type: 'major',
        generatedAt: new Date(),
        sentAt: new Date(),
        aiProvider: 'openai',
        metadata: { storyChapter: 1, continueStory: true, chapterSummary: 'Summary' },
        generatorId: 'serial-story',
      };
      mockContentRepository.findLatestByGenerator.mockResolvedValue([previousChapter]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      const variables = await generator.getTemplateVariables(mockContext);

      // Chapter 2 is early arc (chapters 1-3)
      expect(variables.isEarlyArc).toBe('true');
      expect(variables.isMidArc).toBe('false');
      expect(variables.isLateArc).toBe('false');
      expect(variables.isResolutionArc).toBe('false');
    });

    it('should include arc phase flags for mid arc (chapters 4-6)', async () => {
      const chapters: ContentRecord[] = [];
      for (let i = 4; i >= 1; i--) {
        chapters.push({
          id: i,
          text: `Chapter ${i}`,
          type: 'major',
          generatedAt: new Date(Date.now() - (4 - i) * 1000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: i, continueStory: true, chapterSummary: `Summary ${i}` },
          generatorId: 'serial-story',
        });
      }
      mockContentRepository.findLatestByGenerator.mockResolvedValue(chapters);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      const variables = await generator.getTemplateVariables(mockContext);

      // Chapter 5 is mid arc (chapters 4-6)
      expect(variables.isEarlyArc).toBe('false');
      expect(variables.isMidArc).toBe('true');
      expect(variables.isLateArc).toBe('false');
      expect(variables.isResolutionArc).toBe('false');
    });

    it('should include arc phase flags for late arc (chapters 7-9)', async () => {
      const chapters: ContentRecord[] = [];
      for (let i = 7; i >= 1; i--) {
        chapters.push({
          id: i,
          text: `Chapter ${i}`,
          type: 'major',
          generatedAt: new Date(Date.now() - (7 - i) * 1000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: i, continueStory: true, chapterSummary: `Summary ${i}` },
          generatorId: 'serial-story',
        });
      }
      mockContentRepository.findLatestByGenerator.mockResolvedValue(chapters);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      const variables = await generator.getTemplateVariables(mockContext);

      // Chapter 8 is late arc (chapters 7-9)
      expect(variables.isEarlyArc).toBe('false');
      expect(variables.isMidArc).toBe('false');
      expect(variables.isLateArc).toBe('true');
      expect(variables.isResolutionArc).toBe('false');
    });

    it('should include arc phase flags for resolution arc (chapters 10+)', async () => {
      const chapters: ContentRecord[] = [];
      for (let i = 10; i >= 1; i--) {
        chapters.push({
          id: i,
          text: `Chapter ${i}`,
          type: 'major',
          generatedAt: new Date(Date.now() - (10 - i) * 1000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: i, continueStory: true, chapterSummary: `Summary ${i}` },
          generatorId: 'serial-story',
        });
      }
      mockContentRepository.findLatestByGenerator.mockResolvedValue(chapters);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      const variables = await generator.getTemplateVariables(mockContext);

      // Chapter 11 is resolution arc (chapters 10+)
      expect(variables.isEarlyArc).toBe('false');
      expect(variables.isMidArc).toBe('false');
      expect(variables.isLateArc).toBe('false');
      expect(variables.isResolutionArc).toBe('true');
    });

    it('should include chaptersRemaining for continuation (chapters until target end at 12)', async () => {
      const previousChapter: ContentRecord = {
        id: 1,
        text: 'Chapter 1',
        type: 'major',
        generatedAt: new Date(),
        sentAt: new Date(),
        aiProvider: 'openai',
        metadata: { storyChapter: 1, continueStory: true, chapterSummary: 'Summary' },
        generatorId: 'serial-story',
      };
      mockContentRepository.findLatestByGenerator.mockResolvedValue([previousChapter]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      const variables = await generator.getTemplateVariables(mockContext);

      // Chapter 2: chaptersRemaining = 12 - 2 = 10
      expect(variables.chaptersRemaining).toBe('10');
    });

    it('should include mustEndIn for continuation (chapters until hard max)', async () => {
      const chapters: ContentRecord[] = [];
      for (let i = 10; i >= 1; i--) {
        chapters.push({
          id: i,
          text: `Chapter ${i}`,
          type: 'major',
          generatedAt: new Date(Date.now() - (10 - i) * 1000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: i, continueStory: true, chapterSummary: `Summary ${i}` },
          generatorId: 'serial-story',
        });
      }
      mockContentRepository.findLatestByGenerator.mockResolvedValue(chapters);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' },
        15 // maxChapters
      ) as ProtectedSerialStoryGenerator;

      const variables = await generator.getTemplateVariables(mockContext);

      // Chapter 11: mustEndIn = 15 - 11 = 4
      expect(variables.mustEndIn).toBe('4');
      // chaptersRemaining = 12 - 11 = 1
      expect(variables.chaptersRemaining).toBe('1');
    });

    it('should clamp chaptersRemaining to 0 when past target', async () => {
      const chapters: ContentRecord[] = [];
      for (let i = 13; i >= 1; i--) {
        chapters.push({
          id: i,
          text: `Chapter ${i}`,
          type: 'major',
          generatedAt: new Date(Date.now() - (13 - i) * 1000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: i, continueStory: true, chapterSummary: `Summary ${i}` },
          generatorId: 'serial-story',
        });
      }
      mockContentRepository.findLatestByGenerator.mockResolvedValue(chapters);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' },
        15
      ) as ProtectedSerialStoryGenerator;

      const variables = await generator.getTemplateVariables(mockContext);

      // Chapter 14: chaptersRemaining = max(0, 12 - 14) = 0
      expect(variables.chaptersRemaining).toBe('0');
      // mustEndIn = max(0, 15 - 14) = 1
      expect(variables.mustEndIn).toBe('1');
    });
  });

  describe('getCustomMetadata()', () => {
    it('should return StoryChapterMetadata for chapter 1', async () => {
      mockContentRepository.findLatestByGenerator.mockResolvedValue([]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      // Trigger state determination
      await generator.getTemplateVariables({ updateType: 'major', timestamp: new Date() });

      const metadata = generator.getCustomMetadata();

      expect(metadata).toHaveProperty('storyChapter');
      expect(metadata.storyChapter).toBe(1);
      expect(metadata).toHaveProperty('isNewStory');
      expect(metadata.isNewStory).toBe(true);
      expect(metadata).toHaveProperty('scenario');
      expect(metadata).toHaveProperty('emotionalBeat');
    });

    it('should return StoryChapterMetadata for continuation', async () => {
      const previousChapter: ContentRecord = {
        id: 1,
        text: 'Chapter 1',
        type: 'major',
        generatedAt: new Date(),
        sentAt: new Date(),
        aiProvider: 'openai',
        metadata: { storyChapter: 1, continueStory: true, chapterSummary: 'Summary' },
        generatorId: 'serial-story',
      };
      mockContentRepository.findLatestByGenerator.mockResolvedValue([previousChapter]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      // Trigger state determination
      await generator.getTemplateVariables({ updateType: 'major', timestamp: new Date() });

      const metadata = generator.getCustomMetadata();

      expect(metadata.storyChapter).toBe(2);
      expect(metadata.isNewStory).toBe(false);
      // For continuation, scenario and emotionalBeat should not be set
      expect(metadata.scenario).toBeUndefined();
      expect(metadata.emotionalBeat).toBeUndefined();
    });

    it('should include arcPhase in metadata', async () => {
      mockContentRepository.findLatestByGenerator.mockResolvedValue([]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      // Trigger state determination
      await generator.getTemplateVariables({ updateType: 'major', timestamp: new Date() });

      const metadata = generator.getCustomMetadata();

      expect(metadata).toHaveProperty('arcPhase');
      expect(['early', 'mid', 'late', 'resolution']).toContain(metadata.arcPhase);
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      );

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('generate()', () => {
    it('should load correct prompts and use MEDIUM tier', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);
      mockContentRepository.findLatestByGenerator.mockResolvedValue([]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      // Verify the generator uses the correct prompt files via protected methods
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');

      // Verify tier via observable behavior
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
    });

    it('should pass scenario and emotionalBeat to prompt loader for chapter 1', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);
      mockContentRepository.findLatestByGenerator.mockResolvedValue([]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      );

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the variable injection
      }

      // Verify loadPromptWithVariables was called for user prompt with scenario and emotionalBeat
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'serial-story-chapter1.txt'
      );

      expect(userPromptCall).toBeDefined();
      expect(userPromptCall![2]).toHaveProperty('scenario');
      expect(userPromptCall![2]).toHaveProperty('emotionalBeat');
      expect(SCENARIO).toContain(userPromptCall![2].scenario);
      expect(EMOTIONAL_BEAT).toContain(userPromptCall![2].emotionalBeat);
    });

    it('should pass previousChapters and currentChapter for continuation', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const previousChapter: ContentRecord = {
        id: 1,
        text: 'Chapter 1',
        type: 'major',
        generatedAt: new Date(),
        sentAt: new Date(),
        aiProvider: 'openai',
        metadata: { storyChapter: 1, continueStory: true, chapterSummary: 'A door appeared' },
        generatorId: 'serial-story',
      };
      mockContentRepository.findLatestByGenerator.mockResolvedValue([previousChapter]);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      );

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the variable injection
      }

      // Verify loadPromptWithVariables was called for user prompt with continuation vars
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'serial-story-continuation.txt'
      );

      expect(userPromptCall).toBeDefined();
      expect(userPromptCall![2]).toHaveProperty('previousChapters');
      expect(userPromptCall![2]).toHaveProperty('currentChapter');
      expect(userPromptCall![2].currentChapter).toBe('2');
    });
  });

  describe('story arc boundary detection', () => {
    it('should only count chapters from the current story arc, not previous arcs', async () => {
      // Simulate: old story (5 chapters, concluded) + new story (1 chapter started)
      // findLatestByGenerator returns newest first
      const records: ContentRecord[] = [
        // Most recent: chapter 1 of NEW story
        {
          id: 6,
          text: 'New story chapter 1',
          type: 'major',
          generatedAt: new Date(Date.now() - 1000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: {
            storyChapter: 1,
            isNewStory: true,
            continueStory: true,
            chapterSummary: 'A new beginning',
          },
          generatorId: 'serial-story',
        },
        // Previous story final chapter (continueStory: false)
        {
          id: 5,
          text: 'Old story final chapter',
          type: 'major',
          generatedAt: new Date(Date.now() - 2000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: {
            storyChapter: 5,
            isNewStory: false,
            continueStory: false,
            chapterSummary: 'The old story ends',
          },
          generatorId: 'serial-story',
        },
        // Previous story chapters 4, 3, 2, 1
        {
          id: 4,
          text: 'Old story chapter 4',
          type: 'major',
          generatedAt: new Date(Date.now() - 3000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: 4, isNewStory: false, continueStory: true, chapterSummary: 'Ch4' },
          generatorId: 'serial-story',
        },
        {
          id: 3,
          text: 'Old story chapter 3',
          type: 'major',
          generatedAt: new Date(Date.now() - 4000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: 3, isNewStory: false, continueStory: true, chapterSummary: 'Ch3' },
          generatorId: 'serial-story',
        },
        {
          id: 2,
          text: 'Old story chapter 2',
          type: 'major',
          generatedAt: new Date(Date.now() - 5000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: 2, isNewStory: false, continueStory: true, chapterSummary: 'Ch2' },
          generatorId: 'serial-story',
        },
        {
          id: 1,
          text: 'Old story chapter 1',
          type: 'major',
          generatedAt: new Date(Date.now() - 6000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: 1, isNewStory: true, continueStory: true, chapterSummary: 'Ch1' },
          generatorId: 'serial-story',
        },
      ];
      mockContentRepository.findLatestByGenerator.mockResolvedValue(records);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      const state = await generator.getStoryState();

      // Should continue the current story arc (chapter 1 exists, continueStory: true)
      // Next chapter should be 2, NOT restart at 1
      expect(state.isNewStory).toBe(false);
      expect(state.currentChapter).toBe(2);
      // previousChapters should only contain chapter 1 of the current arc
      expect(state.previousChapters).toHaveLength(1);
    });

    it('should not trigger reachedMaxChapters from old story arc chapters', async () => {
      // maxChapters = 5, old story had 4 chapters + concluded, new story has 2 chapters
      // Total records = 7, but current arc only has 2 chapters
      const records: ContentRecord[] = [
        // Current arc: chapter 2
        {
          id: 7,
          text: 'New ch2',
          type: 'major',
          generatedAt: new Date(Date.now() - 1000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: 2, isNewStory: false, continueStory: true, chapterSummary: 'New ch2' },
          generatorId: 'serial-story',
        },
        // Current arc: chapter 1
        {
          id: 6,
          text: 'New ch1',
          type: 'major',
          generatedAt: new Date(Date.now() - 2000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: 1, isNewStory: true, continueStory: true, chapterSummary: 'New ch1' },
          generatorId: 'serial-story',
        },
        // Old arc boundary (concluded)
        {
          id: 5,
          text: 'Old final',
          type: 'major',
          generatedAt: new Date(Date.now() - 3000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: 4, isNewStory: false, continueStory: false, chapterSummary: 'Old final' },
          generatorId: 'serial-story',
        },
        // Old arc chapters
        {
          id: 4,
          text: 'Old ch3',
          type: 'major',
          generatedAt: new Date(Date.now() - 4000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: 3, isNewStory: false, continueStory: true, chapterSummary: 'Old ch3' },
          generatorId: 'serial-story',
        },
        {
          id: 3,
          text: 'Old ch2',
          type: 'major',
          generatedAt: new Date(Date.now() - 5000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: 2, isNewStory: false, continueStory: true, chapterSummary: 'Old ch2' },
          generatorId: 'serial-story',
        },
      ];
      mockContentRepository.findLatestByGenerator.mockResolvedValue(records);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' },
        5 // maxChapters = 5
      ) as ProtectedSerialStoryGenerator;

      const state = await generator.getStoryState();

      // Current arc has only 2 chapters, not 5+. Should continue to chapter 3.
      expect(state.isNewStory).toBe(false);
      expect(state.currentChapter).toBe(3);
    });

    it('should start new story after concluded story even with isNewStory marker in old records', async () => {
      // After a story concludes (continueStory: false), the next generation
      // should start chapter 1 of a NEW story
      const records: ContentRecord[] = [
        // Most recent: final chapter with continueStory: false
        {
          id: 5,
          text: 'Final chapter',
          type: 'major',
          generatedAt: new Date(Date.now() - 1000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: 5, isNewStory: false, continueStory: false, chapterSummary: 'The end' },
          generatorId: 'serial-story',
        },
        {
          id: 4,
          text: 'Ch4',
          type: 'major',
          generatedAt: new Date(Date.now() - 2000),
          sentAt: new Date(),
          aiProvider: 'openai',
          metadata: { storyChapter: 4, isNewStory: false, continueStory: true, chapterSummary: 'Ch4' },
          generatorId: 'serial-story',
        },
      ];
      mockContentRepository.findLatestByGenerator.mockResolvedValue(records);

      const generator = new SerialStoryGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        mockContentRepository,
        { openai: 'test-key' }
      ) as ProtectedSerialStoryGenerator;

      const state = await generator.getStoryState();

      // Should start a new story
      expect(state.isNewStory).toBe(true);
      expect(state.currentChapter).toBe(1);
      expect(state.previousChapters).toEqual([]);
    });
  });

  describe('StoryState interface', () => {
    it('should export StoryState type', () => {
      // TypeScript compile-time check
      const state: StoryState = {
        isNewStory: true,
        currentChapter: 1,
        previousChapters: [],
        arcPhase: 'early',
      };
      expect(state).toBeDefined();
    });
  });
});
