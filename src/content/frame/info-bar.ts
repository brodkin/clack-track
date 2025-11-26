import { charToCode } from '../../api/vestaboard/character-converter.js';
import type { WeatherData } from '../../services/weather-service.js';

export interface InfoBarData {
  weatherData?: WeatherData;
  dateTime?: Date; // Default: new Date()
}

/**
 * Format the info bar for the bottom row of the Vestaboard frame.
 *
 * Format: "{DAY} {DATE}{MONTH} {TIME}   {WEATHER_COLOR}{TEMP}"
 * Example: "WED 26NOV 10:30   G72F" (22 characters total)
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
  const dateMonth = formatDateMonth(now); // "26NOV" (5 chars)
  const time = formatTime(now); // "10:30" (5 chars)

  // Build info string without weather
  // Format: "WED 26NOV 10:30   " = 18 chars (with padding)
  let infoStr = `${day} ${dateMonth} ${time}`;

  if (data.weatherData) {
    // Add weather: "  G72F" or "  O85F" etc.
    const colorChar = getColorChar(data.weatherData.colorCode);
    const tempStr = formatTemperature(data.weatherData);
    // Pad to position weather at right side
    // Total width: 21 chars (column 21 is color bar)
    // Weather portion: colorChar + temp = 1 + 3-4 chars
    const weatherStr = `${colorChar}${tempStr}`;
    const paddingNeeded = 21 - infoStr.length - weatherStr.length;
    infoStr = infoStr + ' '.repeat(Math.max(0, paddingNeeded)) + weatherStr;
  }

  // Ensure exactly 21 characters
  infoStr = infoStr.padEnd(21, ' ').substring(0, 21);

  // Convert to character codes
  return [...infoStr].map(char => charToCode(char));
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

function getColorChar(colorCode: number): string {
  // Map color code to single-letter display character
  // These will render as colored tiles on the Vestaboard
  const colorChars: Record<number, string> = {
    63: 'R', // RED
    64: 'O', // ORANGE
    65: 'Y', // YELLOW
    66: 'G', // GREEN
    67: 'B', // BLUE
    68: 'V', // VIOLET
    69: 'W', // WHITE
  };
  return colorChars[colorCode] ?? ' ';
}

function formatTemperature(weather: WeatherData): string {
  // Format temperature with unit suffix
  // Return "72F" or "22C" format (no degree symbol - not supported)
  const unit = weather.temperatureUnit === '°C' ? 'C' : 'F';
  return `${weather.temperature}${unit}`;
}
