/**
 * Tests for ISSObserverGenerator
 *
 * Test coverage:
 * - Constructor creates instance with LIGHT tier
 * - getSystemPromptFile() returns 'major-update-base.txt'
 * - getUserPromptFile() returns 'iss-observer.txt'
 * - getTemplateVariables() injects ISS data correctly
 * - Random astronaut selected from ISS crew only (filters Tiangong)
 * - Random observation angle selected from dictionary
 * - Location-appropriate flavor selected based on position
 * - getCustomMetadata() tracks all selections
 * - Fallback values used on API failure
 * - Mock ISSClient for isolation
 */

import { ISSObserverGenerator } from '@/content/generators/ai/iss-observer-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import {
  ISSClient,
  type ISSPosition,
  type ISSLocation,
  type SpaceCrew,
  type ISSFullStatus,
} from '@/api/data-sources/iss-client';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import { createMockAIProvider } from '@tests/__helpers__/mockAIProvider';
import {
  OBSERVATION_ANGLES,
  LOCATION_FLAVORS,
} from '@/content/generators/ai/iss-observer-dictionaries';

// Mock createAIProvider function to avoid real API calls
jest.mock('@/api/ai/index.js', () => ({
  createAIProvider: jest.fn(),
  AIProviderType: {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
  },
}));

// Mock personality generation for consistent tests
jest.mock('@/content/personality/index.js', () => ({
  generatePersonalityDimensions: jest.fn(() => ({
    mood: 'cheerful',
    energyLevel: 'high',
    humorStyle: 'witty',
    obsession: 'coffee',
  })),
}));

import { createAIProvider } from '@/api/ai/index.js';

// Helper type for accessing protected members in tests
type ProtectedISSObserverGenerator = ISSObserverGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
};

describe('ISSObserverGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockISSClient: jest.Mocked<ISSClient>;

  const mockPosition: ISSPosition = {
    latitude: 51.5074,
    longitude: -0.1278,
    altitude: 408.5,
    velocity: 27600.5,
    visibility: 'daylight',
    timestamp: new Date('2024-01-15T10:30:00Z'),
  };

  const mockLocation: ISSLocation = {
    country_code: 'GB',
    timezone_id: 'Europe/London',
    region: null,
    ocean: null,
  };

  const mockCrew: SpaceCrew = {
    number: 10,
    people: [
      { name: 'Oleg Kononenko', craft: 'ISS' },
      { name: 'Nikolai Chub', craft: 'ISS' },
      { name: 'Tracy Dyson', craft: 'ISS' },
      { name: 'Matthew Dominick', craft: 'ISS' },
      { name: 'Michael Barratt', craft: 'ISS' },
      { name: 'Jeanette Epps', craft: 'ISS' },
      { name: 'Alexander Grebenkin', craft: 'ISS' },
      { name: 'Ye Guangfu', craft: 'Tiangong' },
      { name: 'Li Cong', craft: 'Tiangong' },
      { name: 'Li Guangsu', craft: 'Tiangong' },
    ],
  };

  const mockFullStatus: ISSFullStatus = {
    position: mockPosition,
    location: mockLocation,
    crew: mockCrew,
  };

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock PromptLoader
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn().mockResolvedValue('mocked prompt content'),
    } as unknown as jest.Mocked<PromptLoader>;

    // Mock ModelTierSelector
    mockModelTierSelector = {
      select: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    // Mock ISSClient
    mockISSClient = {
      getPosition: jest.fn().mockResolvedValue(mockPosition),
      reverseGeocode: jest.fn().mockResolvedValue(mockLocation),
      getSpaceCrew: jest.fn().mockResolvedValue(mockCrew),
      getFullStatus: jest.fn().mockResolvedValue(mockFullStatus),
    } as unknown as jest.Mocked<ISSClient>;

    // Mock createAIProvider to return a successful mock provider
    (createAIProvider as jest.Mock).mockReturnValue(
      createMockAIProvider({
        response: {
          text: 'ISS NOW OVER LONDON\nCREW OF 7 WATCHING',
          model: 'gpt-4.1-nano',
          tokensUsed: 100,
        },
      })
    );
  });

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, and LIGHT tier', () => {
      const generator = new ISSObserverGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(ISSObserverGenerator);
    });

    it('should accept optional ISSClient dependency', () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(ISSObserverGenerator);
    });

    it('should use LIGHT model tier for efficiency', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new ISSObserverGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedISSObserverGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return iss-observer.txt', () => {
      const generator = new ISSObserverGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedISSObserverGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('iss-observer.txt');
    });
  });

  describe('validate()', () => {
    it('should validate that prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new ISSObserverGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new ISSObserverGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('getTemplateVariables()', () => {
    it('should fetch ISS data from ISSClient when provided', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      expect(mockISSClient.getFullStatus).toHaveBeenCalled();
    });

    it('should inject ISS position data into user prompt', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      // Verify loadPromptWithVariables was called with ISS data
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'iss-observer.txt',
        expect.objectContaining({
          latitude: '51.51',
          longitude: '-0.13',
          altitude: '409', // Rounded
          velocity: '27601', // Rounded
          visibility: 'daylight',
        })
      );
    });

    it('should inject velocity in mph', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      // User prompt is the second call (index 1)
      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);

      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;

      // 27600.5 km/h * 0.621371 = 17150 mph (approximately)
      expect(templateVars.velocityMph).toBeDefined();
      expect(parseInt(templateVars.velocityMph as string)).toBeCloseTo(17150, -2);
    });

    it('should inject location data', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'iss-observer.txt',
        expect.objectContaining({
          location: 'GB',
        })
      );
    });

    it('should inject crew count (ISS only)', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'iss-observer.txt',
        expect.objectContaining({
          crewCount: '7', // Only ISS crew, not Tiangong
        })
      );
    });

    it('should inject observation angle', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;

      expect(templateVars.observationAngle).toBeDefined();
      expect(OBSERVATION_ANGLES).toContain(templateVars.observationAngle);
    });

    it('should inject location flavor', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;

      expect(templateVars.locationFlavor).toBeDefined();
      expect(Object.values(LOCATION_FLAVORS)).toContain(templateVars.locationFlavor);
    });
  });

  describe('random astronaut selection', () => {
    it('should select random astronaut from ISS crew only', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;

      const issCrewNames = mockCrew.people.filter(p => p.craft === 'ISS').map(p => p.name);

      expect(templateVars.astronaut).toBeDefined();
      expect(issCrewNames).toContain(templateVars.astronaut);
    });

    it('should not select astronauts from Tiangong', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      // Run multiple times to check randomization
      const selectedAstronauts: string[] = [];
      for (let i = 0; i < 10; i++) {
        mockPromptLoader.loadPromptWithVariables.mockClear();
        mockISSClient.getFullStatus.mockClear();
        mockISSClient.getFullStatus.mockResolvedValue(mockFullStatus);

        await generator.generate(mockContext);

        const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
        const userPromptCall = calls[1];
        const templateVars = userPromptCall[2] as Record<string, unknown>;
        selectedAstronauts.push(templateVars.astronaut as string);
      }

      const tiangongCrewNames = mockCrew.people
        .filter(p => p.craft === 'Tiangong')
        .map(p => p.name);

      // None of the selected astronauts should be from Tiangong
      for (const astronaut of selectedAstronauts) {
        expect(tiangongCrewNames).not.toContain(astronaut);
      }
    });

    it('should use fallback when no ISS crew available', async () => {
      const noISSCrew: SpaceCrew = {
        number: 3,
        people: [
          { name: 'Ye Guangfu', craft: 'Tiangong' },
          { name: 'Li Cong', craft: 'Tiangong' },
          { name: 'Li Guangsu', craft: 'Tiangong' },
        ],
      };

      mockISSClient.getFullStatus.mockResolvedValue({
        ...mockFullStatus,
        crew: noISSCrew,
      });

      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;

      expect(templateVars.astronaut).toBe('An ISS crew member');
    });
  });

  describe('random observation angle selection', () => {
    it('should select from valid observation angles', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;

      expect(OBSERVATION_ANGLES).toContain(templateVars.observationAngle);
    });

    it('should produce varied angles across multiple generations', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      const selectedAngles = new Set<string>();

      for (let i = 0; i < 20; i++) {
        mockPromptLoader.loadPromptWithVariables.mockClear();
        mockISSClient.getFullStatus.mockClear();
        mockISSClient.getFullStatus.mockResolvedValue(mockFullStatus);

        await generator.generate(mockContext);

        const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
        const userPromptCall = calls[1];
        const templateVars = userPromptCall[2] as Record<string, unknown>;
        selectedAngles.add(templateVars.observationAngle as string);
      }

      // With 24 angles and 20 tries, we should see some variety
      expect(selectedAngles.size).toBeGreaterThan(1);
    });
  });

  describe('location-appropriate flavor selection', () => {
    it('should select appropriate flavor for known country', async () => {
      // US location
      mockISSClient.getFullStatus.mockResolvedValue({
        ...mockFullStatus,
        location: {
          country_code: 'US',
          timezone_id: 'America/New_York',
          region: null,
          ocean: null,
        },
      });

      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;

      expect(templateVars.locationFlavor).toBe(LOCATION_FLAVORS.UNITED_STATES);
    });

    it('should select ocean flavor when over water', async () => {
      mockISSClient.getFullStatus.mockResolvedValue({
        ...mockFullStatus,
        location: {
          country_code: null,
          timezone_id: 'Pacific/Fiji',
          region: null,
          ocean: 'Pacific Ocean',
        },
      });

      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;

      expect(templateVars.locationFlavor).toBe(LOCATION_FLAVORS.PACIFIC_OCEAN);
    });

    it('should use generic flavor for unknown location', async () => {
      mockISSClient.getFullStatus.mockResolvedValue({
        ...mockFullStatus,
        location: {
          country_code: 'XX', // Unknown country code
          timezone_id: 'Unknown',
          region: null,
          ocean: null,
        },
      });

      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;

      expect(templateVars.locationFlavor).toBe(LOCATION_FLAVORS.GENERIC_LAND);
    });

    it('should format location as ocean name when over water', async () => {
      mockISSClient.getFullStatus.mockResolvedValue({
        ...mockFullStatus,
        location: {
          country_code: null,
          timezone_id: null,
          region: null,
          ocean: 'Atlantic Ocean',
        },
      });

      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;

      expect(templateVars.location).toBe('Atlantic Ocean');
    });

    it('should format location as region when country_code is null and region is present', async () => {
      mockISSClient.getFullStatus.mockResolvedValue({
        ...mockFullStatus,
        location: {
          country_code: null,
          timezone_id: 'Europe/London',
          region: 'Northern Europe',
          ocean: null,
        },
      });

      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;

      expect(templateVars.location).toBe('Northern Europe');
    });

    it('should use fallback location when no location data available', async () => {
      mockISSClient.getFullStatus.mockResolvedValue({
        ...mockFullStatus,
        location: {
          country_code: null,
          timezone_id: null,
          region: null,
          ocean: null,
        },
      });

      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;

      expect(templateVars.location).toBe('somewhere over Earth');
    });
  });

  describe('getCustomMetadata()', () => {
    it('should track issDataFetched status', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.issDataFetched).toBe(true);
    });

    it('should track position data', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.position).toBeDefined();
      expect(result.metadata?.position).toMatchObject({
        latitude: mockPosition.latitude,
        longitude: mockPosition.longitude,
      });
    });

    it('should track location data', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.location).toBeDefined();
      expect(result.metadata?.location).toMatchObject({
        country_code: 'GB',
      });
    });

    it('should track crew count (ISS only)', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.crewCount).toBe(7);
    });

    it('should track selected astronaut', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.selectedAstronaut).toBeDefined();
      expect(typeof result.metadata?.selectedAstronaut).toBe('string');
    });

    it('should track selected observation angle', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.observationAngle).toBeDefined();
      expect(OBSERVATION_ANGLES).toContain(result.metadata?.observationAngle);
    });

    it('should track location flavor', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.locationFlavor).toBeDefined();
      expect(Object.values(LOCATION_FLAVORS)).toContain(result.metadata?.locationFlavor);
    });
  });

  describe('fallback values on API failure', () => {
    it('should use fallback values when ISSClient throws error', async () => {
      mockISSClient.getFullStatus.mockRejectedValue(new Error('ISS API down'));

      // Spy on console.error to verify error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      // Verify fallback values were used
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'iss-observer.txt',
        expect.objectContaining({
          latitude: '0.00',
          longitude: '0.00',
          altitude: '408',
          velocity: '27600',
          visibility: 'unknown',
          location: 'somewhere over Earth',
          crewCount: '7',
          astronaut: 'An ISS crew member',
        })
      );

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch ISS data for prompt:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should set issDataFetched to false on API failure', async () => {
      mockISSClient.getFullStatus.mockRejectedValue(new Error('ISS API down'));
      jest.spyOn(console, 'error').mockImplementation();

      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.issDataFetched).toBe(false);
    });

    it('should use fallback velocityMph on API failure', async () => {
      mockISSClient.getFullStatus.mockRejectedValue(new Error('ISS API down'));
      jest.spyOn(console, 'error').mockImplementation();

      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'iss-observer.txt',
        expect.objectContaining({
          velocityMph: '17150',
        })
      );
    });

    it('should use fallback locationFlavor on API failure', async () => {
      mockISSClient.getFullStatus.mockRejectedValue(new Error('ISS API down'));
      jest.spyOn(console, 'error').mockImplementation();

      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'iss-observer.txt',
        expect.objectContaining({
          locationFlavor: LOCATION_FLAVORS.GENERIC_LAND,
        })
      );
    });

    it('should still select random observation angle on API failure', async () => {
      mockISSClient.getFullStatus.mockRejectedValue(new Error('ISS API down'));
      jest.spyOn(console, 'error').mockImplementation();

      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;

      expect(templateVars.observationAngle).toBeDefined();
      expect(OBSERVATION_ANGLES).toContain(templateVars.observationAngle);
    });
  });

  describe('generate()', () => {
    it('should generate content with expected GeneratedContent structure', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      const result = await generator.generate(mockContext);

      expect(result).toBeDefined();
      expect(result.text).toBe('ISS NOW OVER LONDON\nCREW OF 7 WATCHING');
      expect(result.outputMode).toBe('text');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.model).toBe('gpt-4.1-nano');
      expect(result.metadata?.tier).toBe(ModelTier.LIGHT);
      expect(result.metadata?.provider).toBe('openai');
    });

    it('should load system prompt with personality variables', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      // Verify system prompt was loaded with personality variables
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'system',
        'major-update-base.txt',
        expect.objectContaining({
          mood: 'cheerful',
          energyLevel: 'high',
          humorStyle: 'witty',
          obsession: 'coffee',
          persona: 'Houseboy',
        })
      );
    });

    it('should handle AI provider failures gracefully', async () => {
      (createAIProvider as jest.Mock).mockReturnValue(
        createMockAIProvider({
          shouldFail: true,
          failureError: new Error('AI provider error'),
        })
      );

      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await expect(generator.generate(mockContext)).rejects.toThrow(
        /All AI providers failed for tier/
      );
    });

    it('should failover to alternate provider on primary failure', async () => {
      const primaryProvider = createMockAIProvider({
        shouldFail: true,
        failureError: new Error('Primary provider error'),
      });

      const alternateProvider = createMockAIProvider({
        response: {
          text: 'Alternate provider content',
          model: 'claude-haiku-4.5',
          tokensUsed: 45,
        },
      });

      (createAIProvider as jest.Mock)
        .mockReturnValueOnce(primaryProvider)
        .mockReturnValueOnce(alternateProvider);

      mockModelTierSelector.getAlternate.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-haiku-4.5',
        tier: ModelTier.LIGHT,
      });

      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key', anthropic: 'test-key-2' },
        mockISSClient
      );

      const result = await generator.generate(mockContext);

      expect(result.text).toBe('Alternate provider content');
      expect(result.metadata?.provider).toBe('anthropic');
      expect(result.metadata?.failedOver).toBe(true);
      expect(result.metadata?.primaryError).toContain('Primary provider error');
    });
  });

  describe('integration with base class Template Method pattern', () => {
    it('should use getTemplateVariables() hook to inject ISS data', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      await generator.generate(mockContext);

      // The hook should have been called, injecting ISS variables
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls[1];
      expect(userPromptCall[2]).toHaveProperty('latitude');
      expect(userPromptCall[2]).toHaveProperty('astronaut');
      expect(userPromptCall[2]).toHaveProperty('observationAngle');
    });

    it('should use getCustomMetadata() hook to track ISS data', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      const result = await generator.generate(mockContext);

      // ISS tracking data should be in metadata from getCustomMetadata() hook
      expect(result.metadata?.issDataFetched).toBeDefined();
      expect(result.metadata?.position).toBeDefined();
      expect(result.metadata?.selectedAstronaut).toBeDefined();
    });

    it('should inherit retry logic from AIPromptGenerator', () => {
      const generator = new ISSObserverGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify that generate method exists (inherited from base class)
      expect(typeof generator.generate).toBe('function');
    });

    it('should inherit validation logic from AIPromptGenerator', () => {
      const generator = new ISSObserverGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify that validate method exists (inherited from base class)
      expect(typeof generator.validate).toBe('function');
    });
  });
});
