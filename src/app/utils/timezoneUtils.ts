/**
 * Timezone utilities for meeting scheduling
 * Ensures meetings are stored in UTC on the server
 * and displayed in the user's local timezone on the client
 */

/**
 * Get user's timezone offset in minutes
 */
export const getUserTimezoneOffset = (): number => {
  return new Date().getTimezoneOffset();
};

/**
 * Get user's timezone identifier (e.g., "America/New_York")
 * Uses Intl API if available, falls back to UTC offset
 */
export const getUserTimezoneId = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

/**
 * Convert local date and time to UTC ISO string
 * @param date - Date string in format "YYYY-MM-DD"
 * @param time - Time string in format "HH:mm"
 * @returns UTC ISO string (e.g., "2025-04-18T18:00:00Z")
 */
export const convertLocalToUTC = (date: string, time: string): string => {
  if (!date || !time) throw new Error('Date and time are required');

  // Create date in local timezone
  const localDateTime = new Date(`${date}T${time}:00`);
  
  if (isNaN(localDateTime.getTime())) {
    throw new Error('Invalid date or time format');
  }

  // Convert to UTC string
  return localDateTime.toISOString();
};

/**
 * Extract date and time from UTC ISO string in user's local timezone
 * @param isoString - UTC ISO string (e.g., "2025-04-18T18:00:00Z") or date/time arrays/strings from backend
 * @returns Object with date and time in local timezone
 */
export const convertUTCToLocal = (isoString: string): { date: string; time: string } => {
  const utcDate = new Date(isoString);
  
  if (isNaN(utcDate.getTime())) {
    throw new Error('Invalid ISO string');
  }

  // Get local date and time
  const year = utcDate.getFullYear();
  const month = String(utcDate.getMonth() + 1).padStart(2, '0');
  const day = String(utcDate.getDate()).padStart(2, '0');
  const hours = String(utcDate.getHours()).padStart(2, '0');
  const minutes = String(utcDate.getMinutes()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
};

/**
 * Convert date/time values (in any format) to local timezone
 * Handles: arrays [Y,M,D], [H,M,S], strings, and ISO strings
 * @param dateValue - Date as array, string, or formatted value
 * @param timeValue - Time as array, string, or formatted value
 * @returns Object with date and time as strings (YYYY-MM-DD and HH:mm format)
 */
export const convertBackendDateTimeToLocal = (
  dateValue: any,
  timeValue: any
): { date: string; time: string } => {
  try {
    // Convert date array [Y,M,D] to string "YYYY-MM-DD"
    let dateStr = '';
    if (Array.isArray(dateValue)) {
      const [year, month, day] = dateValue;
      dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else if (typeof dateValue === 'string') {
      dateStr = dateValue;
    }

    // Convert time array [H,M,S] to string "HH:mm:ss"
    let timeStr = '';
    if (Array.isArray(timeValue)) {
      const [hour = 0, minute = 0, second = 0] = timeValue;
      timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
    } else if (typeof timeValue === 'string') {
      // Ensure it has seconds if not
      timeStr = timeValue.includes(':') ? timeValue : `${timeValue}:00`;
    }

    // Now use the ISO string conversion with the Z (UTC) indicator
    if (dateStr && timeStr) {
      const isoString = `${dateStr}T${timeStr}Z`;
      return convertUTCToLocal(isoString);
    }

    return { date: dateStr, time: timeStr };
  } catch (error) {
    console.error('Error converting backend date/time:', error);
    // Fallback: return as-is if something goes wrong
    return {
      date: Array.isArray(dateValue)
        ? `${dateValue[0]}-${String(dateValue[1]).padStart(2, '0')}-${String(dateValue[2]).padStart(2, '0')}`
        : String(dateValue),
      time: Array.isArray(timeValue)
        ? `${String(timeValue[0]).padStart(2, '0')}:${String(timeValue[1]).padStart(2, '0')}`
        : String(timeValue),
    };
  }
}

/**
 * Format meeting date for display (converts from UTC to local timezone)
 * @param dateValue - Date as array, string, or formatted value
 * @returns Formatted date string (e.g., "Apr 20, 2026")
 */
export const formatMeetingDateLocal = (dateValue: any): string => {
  try {
    let dateStr = '';
    if (Array.isArray(dateValue)) {
      const [year, month, day] = dateValue;
      dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else {
      dateStr = String(dateValue);
    }

    const date = new Date(`${dateStr}T00:00:00Z`);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
};

/**
 * Format meeting time for display (converts from UTC to local timezone)
 * @param dateValue - Date as array, string, or formatted value
 * @param timeValue - Time as array, string, or formatted value
 * @returns Formatted time string (e.g., "2:00 PM")
 */
export const formatMeetingTimeLocal = (dateValue: any, timeValue: any): string => {
  try {
    const { date, time } = convertBackendDateTimeToLocal(dateValue, timeValue);
    const [hours, minutes] = time.split(':');
    const localDate = new Date(2000, 0, 1, parseInt(hours), parseInt(minutes), 0);
    return localDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'N/A';
  }
};


