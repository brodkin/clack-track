/**
 * ISS (International Space Station) Client
 * Fetches ISS position, geocoding data, and astronaut crew information
 * from WhereTheISS.at and Open Notify APIs
 */

/** ISS position data from WhereTheISS.at API */
export interface ISSPosition {
  latitude: number;
  longitude: number;
  altitude: number; // km above Earth
  velocity: number; // km/h
  visibility: 'daylight' | 'eclipsed';
  timestamp: Date;
}

/** Location data from reverse geocoding */
export interface ISSLocation {
  country_code: string | null;
  timezone_id: string | null;
  region: string | null;
  ocean: string | null; // Populated when over ocean
}

/** Individual astronaut/cosmonaut */
export interface SpaceCrewMember {
  name: string;
  craft: string; // e.g., "ISS", "Tiangong"
}

/** Crew data from Open Notify API */
export interface SpaceCrew {
  number: number;
  people: SpaceCrewMember[];
}

/** Combined ISS status */
export interface ISSFullStatus {
  position: ISSPosition;
  location: ISSLocation;
  crew: SpaceCrew;
}

/** Raw API response from WhereTheISS.at position endpoint */
interface WhereTheISSPositionResponse {
  name: string;
  id: number;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: 'daylight' | 'eclipsed';
  footprint: number;
  timestamp: number;
  daynum: number;
  solar_lat: number;
  solar_lon: number;
  units: string;
}

/** Raw API response from WhereTheISS.at geocode endpoint */
interface WhereTheISSGeocodeResponse {
  latitude: number;
  longitude: number;
  timezone_id: string;
  offset: number;
  country_code: string;
  map_url: string;
}

/** Raw API response from Open Notify astros endpoint */
interface OpenNotifyAstrosResponse {
  message: string;
  number: number;
  people: Array<{
    name: string;
    craft: string;
  }>;
}

/** Ocean boundaries for detection when geocoding returns no country */
interface OceanBoundary {
  name: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

/**
 * Client for fetching ISS tracking data from public APIs
 */
export class ISSClient {
  private readonly timeout: number;
  private readonly positionUrl: string;
  private readonly geocodeBaseUrl: string;
  private readonly astrosUrl: string;

  /**
   * Ocean boundaries for detection
   * Based on approximate geographic boundaries
   */
  private readonly oceanBoundaries: OceanBoundary[] = [
    // Pacific Ocean (split into two regions due to date line)
    { name: 'Pacific Ocean', latMin: -60, latMax: 60, lonMin: 100, lonMax: 180 },
    { name: 'Pacific Ocean', latMin: -60, latMax: 60, lonMin: -180, lonMax: -100 },
    // Atlantic Ocean
    { name: 'Atlantic Ocean', latMin: -60, latMax: 60, lonMin: -80, lonMax: 0 },
    // Indian Ocean
    { name: 'Indian Ocean', latMin: -60, latMax: 30, lonMin: 20, lonMax: 120 },
    // Arctic Ocean
    { name: 'Arctic Ocean', latMin: 66, latMax: 90, lonMin: -180, lonMax: 180 },
    // Southern Ocean
    { name: 'Southern Ocean', latMin: -90, latMax: -60, lonMin: -180, lonMax: 180 },
  ];

  constructor(timeout: number = 10000) {
    this.timeout = timeout;
    this.positionUrl = 'https://api.wheretheiss.at/v1/satellites/25544';
    this.geocodeBaseUrl = 'https://api.wheretheiss.at/v1/coordinates';
    this.astrosUrl = 'http://api.open-notify.org/astros.json';
  }

  /**
   * Fetch with timeout wrapper
   * @param url - URL to fetch
   * @returns Response from fetch
   * @throws Error on timeout or network failure
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get current ISS position
   * @returns ISS position data including coordinates, altitude, velocity, visibility
   * @throws Error on network failure or API error
   */
  async getPosition(): Promise<ISSPosition> {
    const response = await this.fetchWithTimeout(this.positionUrl);

    if (!response.ok) {
      throw new Error(`ISS position API error: HTTP ${response.status} ${response.statusText}`);
    }

    const data: WhereTheISSPositionResponse = await response.json();

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      altitude: data.altitude,
      velocity: data.velocity,
      visibility: data.visibility,
      timestamp: new Date(data.timestamp * 1000),
    };
  }

  /**
   * Detect which ocean the coordinates are over
   * @param lat - Latitude
   * @param lon - Longitude
   * @returns Ocean name or null if not detected
   */
  private detectOcean(lat: number, lon: number): string | null {
    for (const ocean of this.oceanBoundaries) {
      if (
        lat >= ocean.latMin &&
        lat <= ocean.latMax &&
        lon >= ocean.lonMin &&
        lon <= ocean.lonMax
      ) {
        return ocean.name;
      }
    }
    return null;
  }

  /**
   * Reverse geocode coordinates to get location information
   * @param lat - Latitude
   * @param lon - Longitude
   * @returns Location data with country, timezone, region, or ocean if over water
   */
  async reverseGeocode(lat: number, lon: number): Promise<ISSLocation> {
    const url = `${this.geocodeBaseUrl}/${lat},${lon}`;

    try {
      const response = await this.fetchWithTimeout(url);

      // API returns 404 when coordinates are over ocean
      if (response.status === 404) {
        const ocean = this.detectOcean(lat, lon);
        return {
          country_code: null,
          timezone_id: null,
          region: null,
          ocean: ocean,
        };
      }

      if (!response.ok) {
        throw new Error(`Geocode API error: HTTP ${response.status} ${response.statusText}`);
      }

      const data: WhereTheISSGeocodeResponse = await response.json();

      return {
        country_code: data.country_code || null,
        timezone_id: data.timezone_id || null,
        region: null, // API doesn't provide region in standard response
        ocean: null,
      };
    } catch (error) {
      // On any error, attempt ocean detection as fallback
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Geocode request timeout after ${this.timeout}ms`);
      }

      // For network errors, try to detect ocean
      const ocean = this.detectOcean(lat, lon);
      if (ocean) {
        return {
          country_code: null,
          timezone_id: null,
          region: null,
          ocean: ocean,
        };
      }

      throw error;
    }
  }

  /**
   * Get current space crew from Open Notify API
   * @returns List of astronauts/cosmonauts currently in space
   * @throws Error on network failure or API error
   */
  async getSpaceCrew(): Promise<SpaceCrew> {
    const response = await this.fetchWithTimeout(this.astrosUrl);

    if (!response.ok) {
      throw new Error(`Astronauts API error: HTTP ${response.status} ${response.statusText}`);
    }

    const data: OpenNotifyAstrosResponse = await response.json();

    if (data.message !== 'success') {
      throw new Error(`Astronauts API returned failure: ${data.message}`);
    }

    return {
      number: data.number,
      people: data.people.map(person => ({
        name: person.name,
        craft: person.craft,
      })),
    };
  }

  /**
   * Get full ISS status combining position, location, and crew
   * Convenience method that calls all three APIs
   * @returns Combined status with position, location, and crew data
   * @throws Error if any API call fails
   */
  async getFullStatus(): Promise<ISSFullStatus> {
    // Get position first, then use coordinates for geocoding
    const position = await this.getPosition();

    // Fetch location and crew in parallel
    const [location, crew] = await Promise.all([
      this.reverseGeocode(position.latitude, position.longitude),
      this.getSpaceCrew(),
    ]);

    return {
      position,
      location,
      crew,
    };
  }
}
