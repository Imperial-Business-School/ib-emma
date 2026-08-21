// UK-locale, Europe/London-timezone date/time formatters used throughout
// the app.
//
// formatDate    -> "DD/MM/YYYY"
// formatTime    -> "HH:MM" (24-hour, UK time)
// formatDateTime-> "DD/MM/YYYY HH:MM" (UK time)
//
// All accept a Date, an ISO string, or null/undefined; return "" if the
// input is missing or unparseable. Locale and timezone are fixed so
// formatting is identical on the server (UTC) and the client (whatever
// timezone the browser is in).

const TZ = "Europe/London";

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

const TIME_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fixMidnight(s: string): string {
  // en-GB sometimes formats midnight as "24:00" instead of "00:00".
  return s.replace(/^24:/, "00:");
}

export function formatDate(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-GB", DATE_OPTS) : "";
}

export function formatTime(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? fixMidnight(d.toLocaleTimeString("en-GB", TIME_OPTS)) : "";
}

export function formatDateTime(
  value: Date | string | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return "";
  return `${d.toLocaleDateString("en-GB", DATE_OPTS)} ${fixMidnight(d.toLocaleTimeString("en-GB", TIME_OPTS))}`;
}

// Parse a "YYYY-MM-DDTHH:MM" string from a <input type="datetime-local">
// as Europe/London time, returning the corresponding UTC instant.
//
// new Date("YYYY-MM-DDTHH:MM") uses the SERVER's local timezone, which on
// Vercel is UTC. That makes the deadline land an hour earlier than the
// admin intended during BST. We bias by the UK offset on the chosen date.
export function parseUkLocalDateTime(s: string): Date | null {
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!m) return null;
  const [, Y, M, D, h, mi, se] = m;
  // Start with the same wall clock time treated as UTC.
  const utcGuess = new Date(
    Date.UTC(+Y, +M - 1, +D, +h, +mi, +(se ?? "0")),
  );
  // Format utcGuess in Europe/London. The difference between that and the
  // original wall clock is exactly the UK offset on that date.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(utcGuess);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const hh = get("hour") === "24" ? "00" : get("hour");
  const ukAsUtc = Date.UTC(
    +get("year"),
    +get("month") - 1,
    +get("day"),
    +hh,
    +get("minute"),
    +get("second"),
  );
  const offsetMs = ukAsUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

// Given a "YYYY-MM-DD" deadline date, return the instant at which the
// deadline is deemed to have passed: midnight UK time on the *following*
// calendar date. Returns null on malformed input.
//
// Used everywhere overdue detection compares against "now": a deadline
// picked as e.g. 2026-06-30 is passed once local UK time ticks over
// into 2026-07-01.
export function endOfDeadlineDay(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  // Advance one calendar day using a UTC-anchored Date, then convert
  // that midnight-UTC into midnight-UK-time via parseUkLocalDateTime.
  const utcNext = new Date(Date.UTC(+y, +mo - 1, +d + 1));
  const nY = utcNext.getUTCFullYear();
  const nM = String(utcNext.getUTCMonth() + 1).padStart(2, "0");
  const nD = String(utcNext.getUTCDate()).padStart(2, "0");
  return parseUkLocalDateTime(`${nY}-${nM}-${nD}T00:00`);
}

// Format a "YYYY-MM-DD" date string as UK-format "DD/MM/YYYY". Skips
// timezone conversion since we're already on a bare date.
export function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

// Today's UK date as a "YYYY-MM-DD" string. Used to enforce
// "no deadlines in the past" both as the `min` attribute on <input
// type="date"> and as a server-side check in the corresponding actions.
export function todayUkIsoDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

// Format an ISO timestamp into the "YYYY-MM-DDTHH:MM" shape expected by
// <input type="datetime-local">, using Europe/London time.
export function toDatetimeLocalValue(
  value: Date | string | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return "";
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hh = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hh}:${get("minute")}`;
}
