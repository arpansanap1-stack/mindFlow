/**
 * Time formatting and conversion utilities for 12-hour format display and 24-hour API synchronization.
 */

/**
 * Returns YYYY-MM-DD in user's local timezone (avoiding UTC toISOString offset bugs).
 */
export function getLocalDateStr(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts a 24-hour time string ("HH:MM" or "HH:MM:SS") into 12-hour format ("h:mm AM/PM").
 */
export function formatTime12(timeStr) {
  if (!timeStr) return '';
  const parts = String(timeStr).split(':');
  if (parts.length < 2) return timeStr;

  let hour = parseInt(parts[0], 10);
  const minute = parts[1].padStart(2, '0');
  if (isNaN(hour)) return timeStr;

  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${hour}:${minute} ${period}`;
}

/**
 * Formats a start and end time into a clean 12-hour range (e.g., "9:00 AM – 10:30 AM").
 */
export function formatTimeRange12(startTime, endTime) {
  if (!startTime) return '';
  const startFmt = formatTime12(startTime);
  if (!endTime) return startFmt;
  const endFmt = formatTime12(endTime);
  return `${startFmt} – ${endFmt}`;
}

/**
 * Formats an ISO datetime or deadline string into a user-friendly 12-hour string.
 * e.g. "Today at 5:00 PM", "Tomorrow at 9:30 AM", or "Sep 28 at 2:00 PM".
 */
export function formatDeadline12(deadlineStr) {
  if (!deadlineStr) return null;
  const date = new Date(deadlineStr);
  if (isNaN(date.getTime())) return deadlineStr;

  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();

  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const timeFormatted = `${hour12}:${minutes} ${period}`;

  if (isToday) {
    return `Today at ${timeFormatted}`;
  } else if (isTomorrow) {
    return `Tomorrow at ${timeFormatted}`;
  } else {
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day} at ${timeFormatted}`;
  }
}

/**
 * Splits 24-hr time ("14:30" or "14:30:00") into { hour12: 2, minute: 30, period: "PM" }.
 */
export function splitTime24(time24) {
  if (!time24) return { hour12: 9, minute: 0, period: 'AM' };
  const parts = String(time24).split(':');
  let h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return { hour12: h, minute: m, period };
}

/**
 * Joins { hour12: 2, minute: 30, period: "PM" } into "14:30:00".
 */
export function joinTime12To24(hour12, minute, period) {
  let h = parseInt(hour12, 10) || 12;
  const m = String(parseInt(minute, 10) || 0).padStart(2, '0');
  const p = (period || 'AM').toUpperCase();

  if (p === 'PM' && h < 12) h += 12;
  if (p === 'AM' && h === 12) h = 0;

  return `${String(h).padStart(2, '0')}:${m}:00`;
}

/**
 * Formats a list of deep work windows e.g. ["09:00-11:00", "14:00-16:00"]
 * into a human-readable 12-hour string: "9:00 AM - 11:00 AM, 2:00 PM - 4:00 PM".
 */
export function formatDeepHoursForDisplay(deepHoursArray) {
  if (!deepHoursArray || !Array.isArray(deepHoursArray) || deepHoursArray.length === 0) {
    return '';
  }
  return deepHoursArray
    .map((range) => {
      const [start, end] = range.split('-');
      if (!start || !end) return range;
      return `${formatTime12(start)} - ${formatTime12(end)}`;
    })
    .join(', ');
}

/**
 * Parses user input for preferred deep work hours which may be in 12-hour or 24-hour format
 * and outputs standard ["HH:MM-HH:MM"] format for backend storage.
 */
export function parseDeepHoursInput(inputStr) {
  if (!inputStr || !inputStr.trim()) return [];
  const entries = inputStr.split(',').map((s) => s.trim()).filter(Boolean);
  const result = [];

  for (const entry of entries) {
    const parts = entry.split('-').map((s) => s.trim());
    if (parts.length !== 2) continue;

    const parsePart = (str) => {
      const match12 = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
      if (!match12) return null;
      let h = parseInt(match12[1], 10);
      const m = match12[2] ? match12[2] : '00';
      const p = match12[3] ? match12[3].toUpperCase() : null;

      if (p === 'PM' && h < 12) h += 12;
      if (p === 'AM' && h === 12) h = 0;

      return `${String(h).padStart(2, '0')}:${m}`;
    };

    const start24 = parsePart(parts[0]);
    const end24 = parsePart(parts[1]);
    if (start24 && end24) {
      result.push(`${start24}-${end24}`);
    }
  }

  return result;
}
