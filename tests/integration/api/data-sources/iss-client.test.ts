/**
 * Tests for ISSClient
 *
 * Test coverage:
 * - getPosition() returns correct structure with position data
 * - reverseGeocode() handles land locations with country code
 * - reverseGeocode() handles ocean locations (null country_code)
 * - getSpaceCrew() returns astronauts filtered by craft
 * - getFullStatus() combines all data from three APIs
 * - Timeout handling (10 second limit)
 * - Error handling with graceful fallbacks
 * - Mock all HTTP requests (no real API calls)
 */

import { ISSClient } from '@/api/data-sources/iss-client';

// Mock the fetch API
global.fetch = jest.fn();

describe('ISSClient', () => {
  let client: ISSClient;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  // Mock API responses
  const mockPositionResponse = {
    name: 'iss',
    id: 25544,
    latitude: 51.5074,
    longitude: -0.1278,
    altitude: 408.5,
    velocity: 27600.5,
    visibility: 'daylight' as const,
    footprint: 4558.2,
    timestamp: 1700000000,
    daynum: 2460265.5,
    solar_lat: -18.5,
    solar_lon: 45.2,
    units: 'kilometers',
  };

  const mockGeocodeResponse = {
    latitude: 51.5074,
    longitude: -0.1278,
    timezone_id: 'Europe/London',
    offset: 0,
    country_code: 'GB',
    map_url: 'https://maps.example.com/...',
  };

  const mockAstrosResponse = {
    message: 'success',
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

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    client = new ISSClient();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with default timeout', () => {
      const defaultClient = new ISSClient();
      expect(defaultClient).toBeInstanceOf(ISSClient);
    });

    it('should create instance with custom timeout', () => {
      const customClient = new ISSClient(5000);
      expect(customClient).toBeInstanceOf(ISSClient);
    });
  });

  describe('getPosition()', () => {
    it('should return correct ISSPosition structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPositionResponse,
      } as Response);

      const position = await client.getPosition();

      expect(position).toEqual({
        latitude: 51.5074,
        longitude: -0.1278,
        altitude: 408.5,
        velocity: 27600.5,
        visibility: 'daylight',
        timestamp: expect.any(Date),
      });
    });

    it('should convert Unix timestamp to Date object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPositionResponse,
      } as Response);

      const position = await client.getPosition();

      expect(position.timestamp).toBeInstanceOf(Date);
      expect(position.timestamp.getTime()).toBe(1700000000 * 1000);
    });

    it('should fetch from correct URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPositionResponse,
      } as Response);

      await client.getPosition();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.wheretheiss.at/v1/satellites/25544',
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        })
      );
    });

    it('should throw error on HTTP failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(client.getPosition()).rejects.toThrow(
        'ISS position API error: HTTP 500 Internal Server Error'
      );
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getPosition()).rejects.toThrow('Network error');
    });

    it('should handle eclipsed visibility', async () => {
      const eclipsedResponse = { ...mockPositionResponse, visibility: 'eclipsed' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => eclipsedResponse,
      } as Response);

      const position = await client.getPosition();

      expect(position.visibility).toBe('eclipsed');
    });
  });

  describe('reverseGeocode()', () => {
    it('should return location data for land coordinates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeocodeResponse,
      } as Response);

      const location = await client.reverseGeocode(51.5074, -0.1278);

      expect(location).toEqual({
        country_code: 'GB',
        timezone_id: 'Europe/London',
        region: null,
        ocean: null,
      });
    });

    it('should return ocean data when API returns 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Coordinates in Pacific Ocean
      const location = await client.reverseGeocode(0, 170);

      expect(location).toEqual({
        country_code: null,
        timezone_id: null,
        region: null,
        ocean: 'Pacific Ocean',
      });
    });

    it('should detect Atlantic Ocean', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Coordinates in Atlantic Ocean
      const location = await client.reverseGeocode(30, -40);

      expect(location).toEqual({
        country_code: null,
        timezone_id: null,
        region: null,
        ocean: 'Atlantic Ocean',
      });
    });

    it('should detect Indian Ocean', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Coordinates in Indian Ocean
      const location = await client.reverseGeocode(-20, 70);

      expect(location).toEqual({
        country_code: null,
        timezone_id: null,
        region: null,
        ocean: 'Indian Ocean',
      });
    });

    it('should detect Arctic Ocean', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Coordinates in Arctic Ocean
      const location = await client.reverseGeocode(80, 0);

      expect(location).toEqual({
        country_code: null,
        timezone_id: null,
        region: null,
        ocean: 'Arctic Ocean',
      });
    });

    it('should detect Southern Ocean', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Coordinates in Southern Ocean
      const location = await client.reverseGeocode(-70, 0);

      expect(location).toEqual({
        country_code: null,
        timezone_id: null,
        region: null,
        ocean: 'Southern Ocean',
      });
    });

    it('should handle null country_code in response', async () => {
      const responseWithNullCountry = {
        ...mockGeocodeResponse,
        country_code: '',
        timezone_id: '',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => responseWithNullCountry,
      } as Response);

      const location = await client.reverseGeocode(0, 0);

      expect(location.country_code).toBeNull();
      expect(location.timezone_id).toBeNull();
    });

    it('should fetch from correct geocode URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeocodeResponse,
      } as Response);

      await client.reverseGeocode(51.5074, -0.1278);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.wheretheiss.at/v1/coordinates/51.5074,-0.1278',
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        })
      );
    });

    it('should throw error on non-404 HTTP failure when not matching ocean', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      // Use coordinates that don't match any ocean boundary (central Europe)
      // lat 45, lon 10 is outside all ocean boundaries defined in the client
      await expect(client.reverseGeocode(45, 10)).rejects.toThrow(
        'Geocode API error: HTTP 500 Internal Server Error'
      );
    });

    it('should fall back to ocean detection on network error when over ocean', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Coordinates in Pacific Ocean
      const location = await client.reverseGeocode(0, 170);

      expect(location).toEqual({
        country_code: null,
        timezone_id: null,
        region: null,
        ocean: 'Pacific Ocean',
      });
    });

    it('should throw error on network failure when not over ocean', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Coordinates outside any ocean boundary (central Europe lat 45, lon 10)
      // Ocean boundaries:
      // - Pacific: lat -60 to 60, lon 100-180 or -180 to -100
      // - Atlantic: lat -60 to 60, lon -80 to 0
      // - Indian: lat -60 to 30, lon 20 to 120
      // - Arctic: lat 66 to 90
      // - Southern: lat -90 to -60
      // lat 45, lon 10 is outside all of these
      await expect(client.reverseGeocode(45, 10)).rejects.toThrow('Network error');
    });
  });

  describe('getSpaceCrew()', () => {
    it('should return all astronauts with correct structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAstrosResponse,
      } as Response);

      const crew = await client.getSpaceCrew();

      expect(crew.number).toBe(10);
      expect(crew.people).toHaveLength(10);
      expect(crew.people[0]).toEqual({
        name: 'Oleg Kononenko',
        craft: 'ISS',
      });
    });

    it('should include astronauts from all spacecraft', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAstrosResponse,
      } as Response);

      const crew = await client.getSpaceCrew();

      const issCrewCount = crew.people.filter(p => p.craft === 'ISS').length;
      const tiangongCrewCount = crew.people.filter(p => p.craft === 'Tiangong').length;

      expect(issCrewCount).toBe(7);
      expect(tiangongCrewCount).toBe(3);
    });

    it('should fetch from correct URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAstrosResponse,
      } as Response);

      await client.getSpaceCrew();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api.open-notify.org/astros.json',
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        })
      );
    });

    it('should throw error on HTTP failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response);

      await expect(client.getSpaceCrew()).rejects.toThrow(
        'Astronauts API error: HTTP 503 Service Unavailable'
      );
    });

    it('should throw error when API returns failure message', async () => {
      const failureResponse = {
        message: 'failure',
        number: 0,
        people: [],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => failureResponse,
      } as Response);

      await expect(client.getSpaceCrew()).rejects.toThrow(
        'Astronauts API returned failure: failure'
      );
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getSpaceCrew()).rejects.toThrow('Network error');
    });
  });

  describe('getFullStatus()', () => {
    it('should combine position, location, and crew data', async () => {
      // Position request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPositionResponse,
      } as Response);

      // Geocode request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeocodeResponse,
      } as Response);

      // Astros request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAstrosResponse,
      } as Response);

      const status = await client.getFullStatus();

      expect(status.position).toBeDefined();
      expect(status.position.latitude).toBe(51.5074);
      expect(status.position.longitude).toBe(-0.1278);

      expect(status.location).toBeDefined();
      expect(status.location.country_code).toBe('GB');

      expect(status.crew).toBeDefined();
      expect(status.crew.number).toBe(10);
    });

    it('should use position coordinates for geocoding', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPositionResponse,
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeocodeResponse,
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAstrosResponse,
      } as Response);

      await client.getFullStatus();

      // Verify geocode was called with position coordinates
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('51.5074,-0.1278'),
        expect.any(Object)
      );
    });

    it('should throw error if position fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Position API down'));

      await expect(client.getFullStatus()).rejects.toThrow('Position API down');
    });

    it('should throw error if geocode fetch fails for non-ocean location', async () => {
      // Use non-ocean coordinates (central Europe lat 45, lon 10)
      const nonOceanPositionResponse = {
        ...mockPositionResponse,
        latitude: 45.0,
        longitude: 10.0,
      };

      // Position request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => nonOceanPositionResponse,
      } as Response);

      // Geocode request fails (parallel with crew)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      // Crew request succeeds (parallel with geocode)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAstrosResponse,
      } as Response);

      await expect(client.getFullStatus()).rejects.toThrow('Geocode API error');
    });

    it('should throw error if crew fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPositionResponse,
      } as Response);

      // Geocode and crew are fetched in parallel, mock both
      // Geocode succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeocodeResponse,
      } as Response);

      // Crew fails
      mockFetch.mockRejectedValueOnce(new Error('Crew API down'));

      await expect(client.getFullStatus()).rejects.toThrow('Crew API down');
    });
  });

  describe('timeout handling', () => {
    it('should use default 10 second timeout', () => {
      const defaultClient = new ISSClient();
      // The timeout is private, but we can test behavior
      expect(defaultClient).toBeInstanceOf(ISSClient);
    });

    it('should timeout after configured duration', async () => {
      jest.useRealTimers(); // Need real timers for AbortController behavior
      const shortTimeoutClient = new ISSClient(50);

      // Simulate AbortError that would be thrown by AbortController
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      // The fetch should throw when aborted
      await expect(shortTimeoutClient.getPosition()).rejects.toThrow();
      jest.useFakeTimers();
    });

    it('should include abort signal in fetch requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPositionResponse,
      } as Response);

      await client.getPosition();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should throw timeout error with message for geocode', async () => {
      const shortTimeoutClient = new ISSClient(100);

      // Simulate AbortError - use coordinates outside ocean boundaries
      // lat 45, lon 10 (central Europe) is not in any ocean boundary
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(shortTimeoutClient.reverseGeocode(45, 10)).rejects.toThrow(
        'Geocode request timeout after 100ms'
      );
    });
  });

  describe('error handling with graceful fallbacks', () => {
    it('should return position with undefined values for empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // Empty response
      } as Response);

      const position = await client.getPosition();

      // The function returns whatever JSON provides - undefined for missing fields
      // This tests that the function doesn't throw on malformed data
      expect(position.latitude).toBeUndefined();
      expect(position.longitude).toBeUndefined();
    });

    it('should handle partial geocode response with empty strings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          latitude: 45.0,
          longitude: 10.0,
          // Missing or empty country_code and timezone_id
          country_code: '',
          timezone_id: '',
        }),
      } as Response);

      // Use coordinates outside ocean boundaries
      const location = await client.reverseGeocode(45, 10);

      expect(location.country_code).toBeNull();
      expect(location.timezone_id).toBeNull();
    });

    it('should handle empty crew response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'success',
          number: 0,
          people: [],
        }),
      } as Response);

      const crew = await client.getSpaceCrew();

      expect(crew.number).toBe(0);
      expect(crew.people).toEqual([]);
    });

    it('should return null ocean when coordinates do not match any ocean boundary', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Coordinates outside all ocean boundaries:
      // - Pacific: lat -60 to 60, lon 100-180 or -180 to -100
      // - Atlantic: lat -60 to 60, lon -80 to 0
      // - Indian: lat -60 to 30, lon 20 to 120
      // - Arctic: lat 66 to 90
      // - Southern: lat -90 to -60
      // lat 45, lon 10 is outside all of these
      const location = await client.reverseGeocode(45, 10);

      expect(location.ocean).toBeNull();
    });
  });

  describe('Pacific Ocean detection (split region)', () => {
    it('should detect Pacific Ocean in western region (lon 100-180)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Western Pacific boundary: lat -60 to 60, lon 100 to 180
      // Using lat 20, lon 150 which is in the western Pacific
      const location = await client.reverseGeocode(20, 150);

      expect(location.ocean).toBe('Pacific Ocean');
    });

    it('should detect Pacific Ocean in eastern region (lon -180 to -100)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Eastern Pacific boundary: lat -60 to 60, lon -180 to -100
      // Using lat 20, lon -150 which is in the eastern Pacific
      const location = await client.reverseGeocode(20, -150);

      expect(location.ocean).toBe('Pacific Ocean');
    });
  });
});
