import {
  generatePersonalityDimensions,
  DIMENSION_POOLS,
} from '../../../../src/content/personality/dimensions.js';

describe('PersonalityDimensions', () => {
  describe('generatePersonalityDimensions', () => {
    it('should return an object with all required properties', () => {
      const dimensions = generatePersonalityDimensions();

      expect(dimensions).toHaveProperty('mood');
      expect(dimensions).toHaveProperty('energyLevel');
      expect(dimensions).toHaveProperty('humorStyle');
      expect(dimensions).toHaveProperty('obsession');
    });

    it('should return string values for all properties', () => {
      const dimensions = generatePersonalityDimensions();

      expect(typeof dimensions.mood).toBe('string');
      expect(typeof dimensions.energyLevel).toBe('string');
      expect(typeof dimensions.humorStyle).toBe('string');
      expect(typeof dimensions.obsession).toBe('string');
    });

    it('should return non-empty strings for all properties', () => {
      const dimensions = generatePersonalityDimensions();

      expect(dimensions.mood.length).toBeGreaterThan(0);
      expect(dimensions.energyLevel.length).toBeGreaterThan(0);
      expect(dimensions.humorStyle.length).toBeGreaterThan(0);
      expect(dimensions.obsession.length).toBeGreaterThan(0);
    });

    it('should return mood from the MOOD_POOL', () => {
      const dimensions = generatePersonalityDimensions();
      expect(DIMENSION_POOLS.mood).toContain(dimensions.mood);
    });

    it('should return energyLevel from the ENERGY_POOL', () => {
      const dimensions = generatePersonalityDimensions();
      expect(DIMENSION_POOLS.energy).toContain(dimensions.energyLevel);
    });

    it('should return humorStyle from the HUMOR_STYLE_POOL', () => {
      const dimensions = generatePersonalityDimensions();
      expect(DIMENSION_POOLS.humor).toContain(dimensions.humorStyle);
    });

    it('should return obsession from the OBSESSION_POOL', () => {
      const dimensions = generatePersonalityDimensions();
      expect(DIMENSION_POOLS.obsession).toContain(dimensions.obsession);
    });

    it('should generate varying results based on Math.random', () => {
      const mockRandom = jest.spyOn(Math, 'random');

      // Each generatePersonalityDimensions() call triggers 4 Math.random() calls
      // (for mood, energyLevel, humorStyle, obsession)
      // First generation with low values (selects early indices)
      mockRandom.mockReturnValueOnce(0.1); // mood: 0.1*8=0.8→index 0
      mockRandom.mockReturnValueOnce(0.1); // energy: 0.1*4=0.4→index 0
      mockRandom.mockReturnValueOnce(0.1); // humor: 0.1*5=0.5→index 0
      mockRandom.mockReturnValueOnce(0.1); // obsession: 0.1*12=1.2→index 1

      const result1 = generatePersonalityDimensions();

      // Second generation with high values (selects later indices)
      mockRandom.mockReturnValueOnce(0.9); // mood: 0.9*8=7.2→index 7
      mockRandom.mockReturnValueOnce(0.9); // energy: 0.9*4=3.6→index 3
      mockRandom.mockReturnValueOnce(0.9); // humor: 0.9*5=4.5→index 4
      mockRandom.mockReturnValueOnce(0.9); // obsession: 0.9*12=10.8→index 10

      const result2 = generatePersonalityDimensions();

      // Verify that different dimensions were selected for mood
      expect(result1.mood).not.toBe(result2.mood);

      // Verify that energy levels differ
      expect(result1.energyLevel).not.toBe(result2.energyLevel);

      // Verify humor styles differ
      expect(result1.humorStyle).not.toBe(result2.humorStyle);

      // Verify obsessions differ
      expect(result1.obsession).not.toBe(result2.obsession);

      mockRandom.mockRestore();
    });
  });

  describe('DIMENSION_POOLS', () => {
    it('should have mood pool with expected values', () => {
      expect(DIMENSION_POOLS.mood).toContain('playful');
      expect(DIMENSION_POOLS.mood).toContain('sassy');
      expect(DIMENSION_POOLS.mood).toContain('chill');
      expect(DIMENSION_POOLS.mood.length).toBeGreaterThanOrEqual(5);
    });

    it('should have energy pool with expected values', () => {
      expect(DIMENSION_POOLS.energy).toContain('high');
      expect(DIMENSION_POOLS.energy).toContain('chill');
      expect(DIMENSION_POOLS.energy.length).toBeGreaterThanOrEqual(3);
    });

    it('should have humor pool with expected values', () => {
      expect(DIMENSION_POOLS.humor).toContain('dry wit');
      expect(DIMENSION_POOLS.humor).toContain('playful puns');
      expect(DIMENSION_POOLS.humor.length).toBeGreaterThanOrEqual(3);
    });

    it('should have obsession pool with LA-themed values', () => {
      expect(DIMENSION_POOLS.obsession).toContain('LA traffic patterns');
      expect(DIMENSION_POOLS.obsession).toContain('overpriced coffee');
      expect(DIMENSION_POOLS.obsession.length).toBeGreaterThanOrEqual(5);
    });

    it('should have all pools as readonly arrays', () => {
      // TypeScript ensures these are readonly, but we verify they're arrays
      expect(Array.isArray(DIMENSION_POOLS.mood)).toBe(true);
      expect(Array.isArray(DIMENSION_POOLS.energy)).toBe(true);
      expect(Array.isArray(DIMENSION_POOLS.humor)).toBe(true);
      expect(Array.isArray(DIMENSION_POOLS.obsession)).toBe(true);
    });
  });
});
