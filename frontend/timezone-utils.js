// ============== TIMEZONE UTILITIES ==============
// Handles timezone conversion for displaying times in the restaurant's local timezone

/**
 * Format a UTC timestamp to the restaurant's timezone
 * @param {string|Date} utcTime - UTC timestamp (ISO string or Date object)
 * @param {string} timezone - IANA timezone (e.g., 'America/New_York', 'Asia/Tokyo', 'UTC')
 * @param {string} format - Display format ('time', 'date', 'datetime', 'month', 'full')
 * @returns {string} Formatted time in restaurant's timezone
 */
function formatTimeWithTimezone(utcTime, timezone = 'UTC', format = 'datetime') {
  try {
    // Convert to Date object if string
    let date;
    if (typeof utcTime === 'string') {
      // Handle PostgreSQL timestamp format (2026-02-16 09:37:15.808925)
      // by adding Z to make it explicitly UTC
      const timeStr = utcTime.includes('T') || utcTime.includes('Z') 
        ? utcTime 
        : utcTime.replace(' ', 'T') + 'Z';
      date = new Date(timeStr);
    } else {
      date = utcTime;
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    // Use Intl.DateTimeFormat for proper timezone conversion
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    if (format === 'time') {
      // Return only time portion
      const parts = formatter.formatToParts(date);
      const hour = parts.find(p => p.type === 'hour')?.value || '00';
      const minute = parts.find(p => p.type === 'minute')?.value || '00';
      return `${hour}:${minute}`;
    } else if (format === 'date') {
      // Return only date portion (short format)
      const parts = formatter.formatToParts(date);
      const monthNum = parseInt(parts.find(p => p.type === 'month')?.value || '01');
      const dayNum = parseInt(parts.find(p => p.type === 'day')?.value || '01');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[monthNum - 1]} ${dayNum}`;
    } else if (format === 'month') {
      // Return only month and year
      const parts = formatter.formatToParts(date);
      const monthNum = parseInt(parts.find(p => p.type === 'month')?.value || '01');
      const year = parts.find(p => p.type === 'year')?.value || '2024';
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNames[monthNum - 1]} ${year}`;
    } else if (format === 'datetime') {
      // Return date and time
      const parts = formatter.formatToParts(date);
      const month = parts.find(p => p.type === 'month')?.value || '01';
      const day = parts.find(p => p.type === 'day')?.value || '01';
      const hour = parts.find(p => p.type === 'hour')?.value || '00';
      const minute = parts.find(p => p.type === 'minute')?.value || '00';
      return `${month}/${day} ${hour}:${minute}`;
    } else {
      // Return full datetime string
      return formatter.format(date);
    }
  } catch (err) {
    console.error('Timezone formatting error:', err, 'timezone:', timezone);
    return new Date(utcTime).toLocaleString();
  }
}

/**
 * Get time elapsed since a UTC timestamp in the restaurant's timezone
 * @param {string|Date} utcTime - UTC timestamp
 * @param {string} timezone - IANA timezone
 * @returns {string} Elapsed time string (e.g., "2h 30m", "45m")
 */
function getElapsedTime(utcTime, timezone = 'UTC') {
  try {
    const date = typeof utcTime === 'string' ? new Date(utcTime) : utcTime;
    const elapsedMs = Date.now() - date.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    
    if (elapsedMinutes < 60) {
      return `${elapsedMinutes}m`;
    } else {
      const hours = Math.floor(elapsedMinutes / 60);
      const minutes = elapsedMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  } catch (err) {
    console.error('Elapsed time calculation error:', err);
    return '0m';
  }
}

/**
 * Get valid IANA timezone names
 * @returns {string[]} Array of IANA timezone identifiers
 */
function getTimezoneList() {
  return [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Hong_Kong',
    'Asia/Singapore',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Australia/Sydney',
    'Pacific/Auckland',
    'America/Toronto',
    'America/Sao_Paulo',
    'Africa/Cairo',
    'Africa/Johannesburg'
  ];
}

/**
 * Validate timezone string
 * @param {string} timezone - Timezone to validate
 * @returns {boolean} Whether timezone is valid
 */
function isValidTimezone(timezone) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Calculate elapsed time with timezone awareness
 * Detects and corrects for common timezone offset issues
 * @param {string|Date} startTime - Start time in UTC
 * @param {string} timezone - IANA timezone
 * @returns {object} { minutes, hours, display: "Xh Ym" or "just now" }
 */
function calculateElapsedTimeWithTimezone(startTime, timezone = 'UTC') {
  try {
    // Handle PostgreSQL timestamp format
    let start;
    if (typeof startTime === 'string') {
      const timeStr = startTime.includes('T') || startTime.includes('Z') 
        ? startTime 
        : startTime.replace(' ', 'T') + 'Z';
      start = new Date(timeStr);
    } else {
      start = startTime;
    }
    
    const now = new Date();
    
    if (isNaN(start.getTime())) {
      return { minutes: 0, hours: 0, display: 'Invalid time' };
    }
    
    const elapsedMs = now - start;
    const elapsedMinutes = Math.round(elapsedMs / 60000);
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    
    // If elapsed time is negative (clock sync issue), return "just now"
    if (elapsedMinutes < 0) {
      return { minutes: 0, hours: 0, display: 'just now' };
    }
    
    // If less than 1 minute, show "just now"
    if (elapsedMinutes < 1) {
      return { minutes: 0, hours: 0, display: 'just now' };
    }
    
    // Format display string
    let display = '';
    if (elapsedHours > 0) {
      display = `${elapsedHours}h ${elapsedMinutes % 60}m`;
    } else {
      display = `${elapsedMinutes}m`;
    }
    
    return { minutes: elapsedMinutes, hours: elapsedHours, display };
  } catch (err) {
    console.error('Error calculating elapsed time:', err);
    return { minutes: 0, hours: 0, display: '?' };
  }
}

/**
 * Get current time in restaurant's timezone
 * @param {string} timezone - IANA timezone
 * @returns {string} Current time in restaurant's timezone
 */
function getCurrentTimeInTimezone(timezone = 'UTC') {
  return formatTimeWithTimezone(new Date(), timezone, 'time');
}
