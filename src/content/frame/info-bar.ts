import { charToCode } from '../../api/vestaboard/character-converter.js';
import type { WeatherData } from '../../services/weather-service.js';

export interface InfoBarData {
  weatherData?: WeatherData;
  dateTime?: Date; // Default: new Date()
}

/**
 * Format the info bar for the bottom row of the Vestaboard frame.
 *
 * Format: "{DAY} {DATE}{MONTH} {TIME} {WEATHER_COLOR}{TEMP}"
 * Example: "WED 26NOV 10:30 [G]72F " (21 chars + 1 color bar = 22 total)
 * Where [G] is an actual color code (66) that renders as a colored block.
 *
 * Uses single space between all components. Trailing padding reserves
 * space for triple-digit temperatures (e.g., 100F).
 *
 * The last character (column 21) is reserved for the color bar,
 * so this function returns 21 character codes for columns 0-20.
 * Column 21 will be filled by the frame generator with the color bar.
 *
 * @param data - Weather and date/time data
 * @returns Array of 21 character codes for the info bar
 */
export function formatInfoBar(data: InfoBarData): number[] {
  const now = data.dateTime ?? new Date();

  // Format components
  const day = formatDay(now); // "WED" (3 chars)
  const dateMonth = formatDateMonth(now); // "26NOV" (5 chars) or "5NOV" (4 chars)
  const time = formatTime(now); // "10:30" (5 chars)

  // Build info string with single space separators
  let infoStr = `${day} ${dateMonth} ${time}`;
  let colorCodePosition = -1; // Track where to insert actual color code

  if (data.weatherData) {
    // Add weather with single space and placeholder for color
    // Use space as placeholder, we'll replace with actual color code after
    const tempStr = formatTemperature(data.weatherData);
    colorCodePosition = infoStr.length + 1; // Position after the space separator
    infoStr = `${infoStr}  ${tempStr}`; // Two spaces: separator + placeholder for color
  }

  // Pad to exactly 21 characters (trailing padding reserves space for 100F temps)
  infoStr = infoStr.padEnd(21, ' ').substring(0, 21);

  // Convert to character codes
  const codes = [...infoStr].map(char => charToCode(char));

  // Replace placeholder with actual color code for colored display
  if (data.weatherData && colorCodePosition >= 0 && colorCodePosition < 21) {
    codes[colorCodePosition] = data.weatherData.colorCode;
  }

  return codes;
}

function formatDay(date: Date): string {
  // Return 3-letter uppercase day abbreviation
  return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase().slice(0, 3);
}

function formatDateMonth(date: Date): string {
  // Return date + month as "26NOV" format (no leading zero on date)
  const day = date.getDate().toString();
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase().slice(0, 3);
  return `${day}${month}`;
}

function formatTime(date: Date): string {
  // Return 24-hour time as "HH:MM" format
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatTemperature(weather: WeatherData): string {
  // Format temperature with unit suffix
  // Return "72F" or "22C" format (no degree symbol - not supported)
  const unit = weather.temperatureUnit === '°C' ? 'C' : 'F';
  return `${weather.temperature}${unit}`;
}
