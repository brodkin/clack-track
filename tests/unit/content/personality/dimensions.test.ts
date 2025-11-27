import {
  generatePersonalityDimensions,
  DIMENSION_POOLS,
  type PersonalityDimensions,
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

    it('should generate varying results over multiple calls', () => {
      // Generate many dimensions and check for variation
      const results: PersonalityDimensions[] = [];
      for (let i = 0; i < 50; i++) {
        results.push(generatePersonalityDimensions());
      }

      // Check that we got at least some variation in each dimension
      const uniqueMoods = new Set(results.map(r => r.mood));
      const uniqueEnergy = new Set(results.map(r => r.energyLevel));
      const uniqueHumor = new Set(results.map(r => r.humorStyle));
      const uniqueObsession = new Set(results.map(r => r.obsession));

      // With 50 samples, we should see at least 2 unique values for each dimension
      expect(uniqueMoods.size).toBeGreaterThan(1);
      expect(uniqueEnergy.size).toBeGreaterThan(1);
      expect(uniqueHumor.size).toBeGreaterThan(1);
      expect(uniqueObsession.size).toBeGreaterThan(1);
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
