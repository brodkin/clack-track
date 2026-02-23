/**
 * Integration test: Local News Generator Tool-Based Submission Compliance
 *
 * Validates that the LocalNewsGenerator successfully works with ToolBasedGenerator
 * after the prompt augmentation fix (clack-tdsq.3.1). The fix appends a tool-use
 * instruction to the system prompt, resolving a contradiction where the OUTPUT FORMAT
 * section said "text only" but tool-based generation expected submit_content tool calls.
 *
 * Test strategy:
 * - Mock the AI provider at the boundary to return tool calls (submit_content)
 * - Mock the RSS client to provide deterministic LA news feed data
 * - Use the real ToolBasedGenerator, LocalNewsGenerator, PromptLoader, and
 *   submit_content validation pipeline
 * - Verify that tool-based generation completes with toolAccepted: true
 *
 * This test does NOT make live API calls -- all external boundaries are mocked.
 */

import { ToolBasedGenerator } from '@/content/generators/tool-based-generator';
import { LocalNewsGenerator } from '@/content/generators/ai/local-news-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { RSSClient, type RSSItem } from '@/api/data-sources/rss-client';
import type { AIProvider, AIGenerationRequest, AIGenerationResponse } from '@/types/ai';
import type { GenerationContext } from '@/types/content-generator';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Mock RSS data resembling LA Times and KTLA content
// ---------------------------------------------------------------------------

const now = new Date('2026-02-23T10:00:00-08:00');

/** Creates a recent RSSItem published within the 12-hour recency window */
function makeRecentItem(overrides: Partial<RSSItem> = {}): RSSItem {
  return {
    title: 'LAPD INVESTIGATING MULTI-CAR PILEUP ON 405 FREEWAY',
    link: 'https://www.latimes.com/california/story/2026-02-23/405-pileup',
    pubDate: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
    contentSnippet:
      'Authorities are investigating a multi-vehicle collision on the northbound 405 Freeway ' +
      'near the Getty Center exit that left three people injured and caused major traffic delays ' +
      'during the Monday morning commute.',
    source: 'LA Times',
    ...overrides,
  };
}

/** Typical LA local news headlines for edge case variety */
const LA_NEWS_ITEMS: RSSItem[] = [
  makeRecentItem(),
  makeRecentItem({
    title: 'HEAT WAVE EXPECTED TO HIT SOUTHERN CALIFORNIA THIS WEEKEND',
    link: 'https://ktla.com/news/heat-wave-2026-02',
    contentSnippet:
      'A ridge of high pressure building over the Southwest will push temperatures into the ' +
      'upper 90s across the LA basin, prompting heat advisories for vulnerable populations.',
    source: 'KTLA',
  }),
  makeRecentItem({
    title: 'METRO PURPLE LINE EXTENSION OPENS NEW STATIONS IN WESTWOOD',
    link: 'https://www.latimes.com/california/story/2026-02-23/purple-line-westwood',
    contentSnippet:
      'Two new subway stations in Westwood opened to riders today, marking a major milestone ' +
      'for the decades-long transit expansion project that will eventually reach the VA campus.',
    source: 'LA Times',
  }),
];

// ---------------------------------------------------------------------------
// Helper: Create a mock AI provider that responds with submit_content tool calls
// ---------------------------------------------------------------------------

/**
 * Creates a mock AI provider that simulates an LLM responding to tool-based
 * generation by calling submit_content with valid Vestaboard content.
 *
 * The mock examines the request to verify the system prompt contains the
 * tool-use augmentation, then returns a submit_content tool call.
 */
function createToolCompliantMockProvider(
  responseContent: string = 'TRAFFIC SNARLED ON\nTHE 405 NEAR GETTY\nTHREE INJURED IN\nMONDAY AM PILEUP'
): AIProvider & { generate: jest.Mock } {
  const generate = jest
    .fn()
    .mockImplementation(async (_request: AIGenerationRequest): Promise<AIGenerationResponse> => {
      return {
        text: '',
        model: 'gpt-4.1-mini',
        tokensUsed: 150,
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'call_test_001',
            name: 'submit_content',
            arguments: {
              content: responseContent,
              continueStory: false,
            },
          },
        ],
      };
    });

  return {
    generate,
    async validateConnection(): Promise<boolean> {
      return true;
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: Create a mock RSS client returning predetermined items
// ---------------------------------------------------------------------------

function createMockRSSClient(items: RSSItem[] = LA_NEWS_ITEMS): RSSClient {
  const client = new RSSClient();
  // Override getLatestItems to return our mock data without network calls
  client.getLatestItems = jest.fn().mockResolvedValue(items);
  return client;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Local News Generator - Tool-Based Submission Compliance', () => {
  // Resolve prompts directory relative to the worktree root
  const promptsDir = join(__dirname, '..', '..', '..', '..', 'prompts');
  let promptLoader: PromptLoader;
  let modelTierSelector: ModelTierSelector;
  let context: GenerationContext;

  beforeAll(() => {
    promptLoader = new PromptLoader(promptsDir);
    modelTierSelector = new ModelTierSelector('openai', ['openai', 'anthropic']);
  });

  beforeEach(() => {
    context = {
      updateType: 'major',
      timestamp: now,
    };
  });

  describe('successful tool-based generation', () => {
    it('completes generation via submit_content without exhaustion', async () => {
      const mockProvider = createToolCompliantMockProvider();
      const mockRSSClient = createMockRSSClient();

      const localNewsGen = new LocalNewsGenerator(
        promptLoader,
        modelTierSelector,
        { openai: 'test-key', anthropic: 'test-key' },
        mockRSSClient,
        ['https://www.latimes.com/local/rss2.0.xml', 'https://ktla.com/feed/']
      );

      const wrapped = ToolBasedGenerator.wrap(localNewsGen, {
        aiProvider: mockProvider,
        maxAttempts: 3,
        exhaustionStrategy: 'throw',
      });

      const result = await wrapped.generate(context);

      // Core assertion: tool-based generation accepted the content
      expect(result.metadata?.toolAccepted).toBe(true);
      expect(result.metadata?.toolAttempts).toBe(1);
      expect(result.outputMode).toBe('text');
      expect(result.text).toContain('TRAFFIC SNARLED ON');

      // Verify the AI provider was called with tool definitions
      expect(mockProvider.generate).toHaveBeenCalledTimes(1);
      const aiRequest = mockProvider.generate.mock.calls[0][0] as AIGenerationRequest;
      expect(aiRequest.tools).toBeDefined();
      expect(aiRequest.tools).toHaveLength(1);
      expect(aiRequest.tools![0].name).toBe('submit_content');

      // Verify the system prompt includes the tool-use augmentation
      expect(aiRequest.systemPrompt).toContain('OUTPUT FORMAT OVERRIDE');
      expect(aiRequest.systemPrompt).toContain('submit_content tool');

      // Verify RSS data was fetched
      expect(mockRSSClient.getLatestItems).toHaveBeenCalledWith([
        'https://www.latimes.com/local/rss2.0.xml',
        'https://ktla.com/feed/',
      ]);
    });

    it('passes news headline and snippet from RSS feed into user prompt', async () => {
      const mockProvider = createToolCompliantMockProvider();
      const singleItem = [
        makeRecentItem({
          title: 'WILDFIRE EVACUATIONS ORDERED IN MALIBU CANYON',
          contentSnippet: 'Residents of Malibu Canyon are urged to evacuate immediately.',
        }),
      ];
      const mockRSSClient = createMockRSSClient(singleItem);

      const localNewsGen = new LocalNewsGenerator(
        promptLoader,
        modelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      const wrapped = ToolBasedGenerator.wrap(localNewsGen, {
        aiProvider: mockProvider,
        maxAttempts: 3,
      });

      const result = await wrapped.generate(context);

      expect(result.metadata?.toolAccepted).toBe(true);

      // Verify the user prompt includes the headline and snippet
      const aiRequest = mockProvider.generate.mock.calls[0][0] as AIGenerationRequest;
      expect(aiRequest.userPrompt).toContain('WILDFIRE EVACUATIONS ORDERED IN MALIBU CANYON');
      expect(aiRequest.userPrompt).toContain(
        'Residents of Malibu Canyon are urged to evacuate immediately.'
      );
    });

    it('includes news metadata (feedUrls, headlineCount, moreInfoUrl) in result', async () => {
      const mockProvider = createToolCompliantMockProvider();
      const singleItem = [
        makeRecentItem({
          link: 'https://www.latimes.com/story/some-la-news',
        }),
      ];
      const mockRSSClient = createMockRSSClient(singleItem);

      const localNewsGen = new LocalNewsGenerator(
        promptLoader,
        modelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      const wrapped = ToolBasedGenerator.wrap(localNewsGen, {
        aiProvider: mockProvider,
        maxAttempts: 3,
      });

      const result = await wrapped.generate(context);

      expect(result.metadata?.toolAccepted).toBe(true);
      expect(result.metadata?.headlineCount).toBe(1);
      expect(result.metadata?.moreInfoUrl).toBe('https://www.latimes.com/story/some-la-news');
    });
  });

  describe('edge case: very long snippet does not cause exhaustion', () => {
    it('handles extremely long contentSnippet without tool exhaustion', async () => {
      // A very long snippet that might confuse the AI into generating overly long content
      // The mock AI provider is configured to return valid content regardless
      const longSnippet = 'A '.repeat(500) + 'extremely long news article content snippet.';
      const mockProvider = createToolCompliantMockProvider(
        'LONG STORY SHORT\nLA TRAFFIC IS BAD\nFILM AT ELEVEN'
      );
      const mockRSSClient = createMockRSSClient([
        makeRecentItem({
          title: 'MASSIVE INFRASTRUCTURE PROJECT SPANS ENTIRE LA COUNTY',
          contentSnippet: longSnippet,
        }),
      ]);

      const localNewsGen = new LocalNewsGenerator(
        promptLoader,
        modelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      const wrapped = ToolBasedGenerator.wrap(localNewsGen, {
        aiProvider: mockProvider,
        maxAttempts: 3,
        exhaustionStrategy: 'throw',
      });

      const result = await wrapped.generate(context);

      expect(result.metadata?.toolAccepted).toBe(true);
      expect(result.metadata?.toolExhausted).toBeUndefined();
      expect(result.metadata?.toolAttempts).toBe(1);
    });
  });

  describe('edge case: missing snippet handled gracefully', () => {
    it('generates content when RSS item has no contentSnippet', async () => {
      const mockProvider = createToolCompliantMockProvider(
        'QUAKE ROCKS LA\nNO DAMAGE REPORTED\nSTAY SAFE OUT THERE'
      );
      const noSnippetItem = makeRecentItem({
        title: 'MAGNITUDE 4.2 EARTHQUAKE SHAKES LOS ANGELES',
        contentSnippet: undefined,
      });
      const mockRSSClient = createMockRSSClient([noSnippetItem]);

      const localNewsGen = new LocalNewsGenerator(
        promptLoader,
        modelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      const wrapped = ToolBasedGenerator.wrap(localNewsGen, {
        aiProvider: mockProvider,
        maxAttempts: 3,
      });

      const result = await wrapped.generate(context);

      expect(result.metadata?.toolAccepted).toBe(true);
      expect(result.text).toContain('QUAKE ROCKS LA');

      // User prompt should still include the headline even without snippet
      const aiRequest = mockProvider.generate.mock.calls[0][0] as AIGenerationRequest;
      expect(aiRequest.userPrompt).toContain('MAGNITUDE 4.2 EARTHQUAKE SHAKES LOS ANGELES');
      // Snippet template variable should resolve to empty string
      // (BaseNewsGenerator returns '' when contentSnippet is undefined)
    });
  });

  describe('edge case: complex local news headlines', () => {
    it('handles crime/traffic/weather headlines typical of LA news', async () => {
      const complexItems: RSSItem[] = [
        makeRecentItem({
          title: 'LAPD: SUSPECT IN HOLLYWOOD BANK ROBBERY IDENTIFIED',
          contentSnippet:
            "Detectives have identified a person of interest in last week's armed robbery.",
          source: 'KTLA',
        }),
        makeRecentItem({
          title: 'SIG-ALERT: ALL LANES BLOCKED ON I-10 EAST AT CRENSHAW',
          contentSnippet:
            'A jackknifed big rig has shut down all eastbound lanes of the 10 Freeway.',
          source: 'LA Times',
        }),
        makeRecentItem({
          title: 'FLASH FLOOD WARNING FOR SAN GABRIEL MOUNTAINS',
          contentSnippet:
            'Atmospheric river expected to dump 3-5 inches of rain in burn scar areas.',
          source: 'KTLA',
        }),
      ];

      const mockProvider = createToolCompliantMockProvider(
        'HOLLYWOOD HEIST\nSUSPECT ID BY LAPD\nDETECTIVES ON CASE'
      );
      const mockRSSClient = createMockRSSClient(complexItems);

      const localNewsGen = new LocalNewsGenerator(
        promptLoader,
        modelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      const wrapped = ToolBasedGenerator.wrap(localNewsGen, {
        aiProvider: mockProvider,
        maxAttempts: 3,
      });

      const result = await wrapped.generate(context);

      expect(result.metadata?.toolAccepted).toBe(true);
      expect(result.metadata?.toolAttempts).toBe(1);
      expect(result.text.length).toBeGreaterThan(0);
    });
  });

  describe('tool-use augmentation prevents prompt contradiction', () => {
    it('system prompt contains both original OUTPUT FORMAT and the tool-use override', async () => {
      const mockProvider = createToolCompliantMockProvider();
      const mockRSSClient = createMockRSSClient();

      const localNewsGen = new LocalNewsGenerator(
        promptLoader,
        modelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      const wrapped = ToolBasedGenerator.wrap(localNewsGen, {
        aiProvider: mockProvider,
        maxAttempts: 3,
      });

      await wrapped.generate(context);

      const aiRequest = mockProvider.generate.mock.calls[0][0] as AIGenerationRequest;

      // The original system prompt has "Your response must be ONLY the display text"
      // (from major-update-base.txt OUTPUT FORMAT section)
      expect(aiRequest.systemPrompt).toContain('Your response must be ONLY the display text');

      // The augmentation OVERRIDES that with explicit tool-use instruction
      expect(aiRequest.systemPrompt).toContain('IMPORTANT - OUTPUT FORMAT OVERRIDE');
      expect(aiRequest.systemPrompt).toContain(
        'You MUST use the submit_content tool to submit your content'
      );
      expect(aiRequest.systemPrompt).toContain(
        'Any previous instructions about responding with "only display text"'
      );

      // The override appears AFTER the original instruction (appended, not prepended)
      const originalIndex = aiRequest.systemPrompt.indexOf(
        'Your response must be ONLY the display text'
      );
      const overrideIndex = aiRequest.systemPrompt.indexOf('OUTPUT FORMAT OVERRIDE');
      expect(overrideIndex).toBeGreaterThan(originalIndex);
    });
  });

  describe('rejection and retry behavior', () => {
    it('retries when first submission is rejected and succeeds on second attempt', async () => {
      const generate = jest
        .fn()
        // First call: AI returns content that is too long (will be rejected by validator)
        .mockResolvedValueOnce({
          text: '',
          model: 'gpt-4.1-mini',
          tokensUsed: 100,
          toolCalls: [
            {
              id: 'call_attempt_1',
              name: 'submit_content',
              arguments: {
                content:
                  'THIS LINE IS WAY TOO LONG FOR THE VESTABOARD DISPLAY LIMIT OF TWENTY ONE\nSECOND LINE ALSO EXCEEDS THE MAXIMUM CHARACTER LIMIT PER LINE ALLOWED',
                continueStory: false,
              },
            },
          ],
        })
        // Second call: AI returns valid content after receiving rejection feedback
        .mockResolvedValueOnce({
          text: '',
          model: 'gpt-4.1-mini',
          tokensUsed: 120,
          toolCalls: [
            {
              id: 'call_attempt_2',
              name: 'submit_content',
              arguments: {
                content: 'TRAFFIC JAM ON 405\nNEAR GETTY CENTER\nTHREE HURT IN CRASH',
                continueStory: false,
              },
            },
          ],
        });

      const mockProvider: AIProvider = {
        generate,
        async validateConnection() {
          return true;
        },
      };

      const mockRSSClient = createMockRSSClient();

      const localNewsGen = new LocalNewsGenerator(
        promptLoader,
        modelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      const wrapped = ToolBasedGenerator.wrap(localNewsGen, {
        aiProvider: mockProvider,
        maxAttempts: 3,
        exhaustionStrategy: 'throw',
      });

      const result = await wrapped.generate(context);

      // Should have needed 2 attempts
      expect(result.metadata?.toolAttempts).toBe(2);
      expect(result.metadata?.toolAccepted).toBe(true);
      expect(result.text).toBe('TRAFFIC JAM ON 405\nNEAR GETTY CENTER\nTHREE HURT IN CRASH');

      // Verify the second call received tool results (rejection feedback)
      expect(generate).toHaveBeenCalledTimes(2);
      const secondCallRequest = generate.mock.calls[1][0] as AIGenerationRequest;
      expect(secondCallRequest.toolResults).toBeDefined();
      expect(secondCallRequest.toolResults!.length).toBeGreaterThan(0);
    });
  });
});
