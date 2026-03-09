/**
 * Tests for ISSObserverGenerator
 *
 * Generator-specific behavior:
 * - ISS data fetching (getFullStatus)
 * - Position/location/crew injection into template variables
 * - Velocity in mph conversion
 * - ISS-only crew filtering (not Tiangong)
 * - Fallback astronaut text
 * - Observation angle from dictionaries
 * - Location flavor selection (country-specific, ocean, generic)
 * - Fallback values on API failure
 * - Custom metadata (issDataFetched, position, location, crewCount, etc.)
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

    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn().mockResolvedValue('mocked prompt content'),
    } as unknown as jest.Mocked<PromptLoader>;

    mockModelTierSelector = {
      select: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    mockISSClient = {
      getPosition: jest.fn().mockResolvedValue(mockPosition),
      reverseGeocode: jest.fn().mockResolvedValue(mockLocation),
      getSpaceCrew: jest.fn().mockResolvedValue(mockCrew),
      getFullStatus: jest.fn().mockResolvedValue(mockFullStatus),
    } as unknown as jest.Mocked<ISSClient>;

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

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'iss-observer.txt',
        expect.objectContaining({
          latitude: '51.51',
          longitude: '-0.13',
          altitude: '409',
          velocity: '27601',
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

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;

      expect(templateVars.velocityMph).toBeDefined();
      expect(parseInt(templateVars.velocityMph as string)).toBeCloseTo(17150, -2);
    });

    it('should inject crew count (ISS only, not Tiangong)', async () => {
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
          crewCount: '7',
        })
      );
    });

    it('should inject observation angle from dictionaries', async () => {
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

  describe('location-appropriate flavor selection', () => {
    it('should select appropriate flavor for known country', async () => {
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
          country_code: 'XX',
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
    it('should track issDataFetched, position, location, crewCount, astronaut, angle, and flavor', async () => {
      const generator = new ISSObserverGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockISSClient
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.issDataFetched).toBe(true);
      expect(result.metadata?.position).toBeDefined();
      expect(result.metadata?.location).toBeDefined();
      expect(result.metadata?.crewCount).toBe(7);
      expect(result.metadata?.selectedAstronaut).toBeDefined();
      expect(OBSERVATION_ANGLES).toContain(result.metadata?.observationAngle);
      expect(Object.values(LOCATION_FLAVORS)).toContain(result.metadata?.locationFlavor);
    });
  });

  describe('fallback values on API failure', () => {
    it('should use fallback values when ISSClient throws error', async () => {
      mockISSClient.getFullStatus.mockRejectedValue(new Error('ISS API down'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

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
  });
});
