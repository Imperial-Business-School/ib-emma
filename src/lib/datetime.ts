// UK-locale date/time formatters used throughout the app.
//
// formatDate    -> "DD/MM/YYYY"
// formatTime    -> "HH:MM" (24-hour)
// formatDateTime-> "DD/MM/YYYY HH:MM"
//
// All accept a Date, an ISO string, or null/undefined; return "" if the
// input is missing or unparseable. Pure functions, safe to use in either
// server or client components.

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-GB", DATE_OPTS) : "";
}

export function formatTime(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? d.toLocaleTimeString("en-GB", TIME_OPTS) : "";
}

export function formatDateTime(
  value: Date | string | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return "";
  return `${d.toLocaleDateString("en-GB", DATE_OPTS)} ${d.toLocaleTimeString("en-GB", TIME_OPTS)}`;
}
