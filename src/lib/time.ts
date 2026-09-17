import { parseISO } from "date-fns";

// Log start times are stored as free text ("6:00 AM", "18:00") rather than a
// structured time column, so date/time-range filtering has to parse them the
// same way a person reads the TIME column, not compare raw strings. Shared
// between the client-side picker (activity-log-table.tsx) and the server
// query layer (queries.ts) so both agree on what a given time string means.
export function parseTimeToMinutes(time: string): number | null {
  const trimmed = time.trim();
  const withMeridiem = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (withMeridiem) {
    let hours = parseInt(withMeridiem[1], 10);
    const minutes = parseInt(withMeridiem[2], 10);
    const meridiem = withMeridiem[3].toUpperCase();
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const plain = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (plain) {
    return parseInt(plain[1], 10) * 60 + parseInt(plain[2], 10);
  }
  return null;
}

export function logStartTimestamp(logDate: string, startTime: string): number | null {
  const minutes = parseTimeToMinutes(startTime);
  if (minutes === null) return null;
  return parseISO(logDate).getTime() + minutes * 60_000;
}
