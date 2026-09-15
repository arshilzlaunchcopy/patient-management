/**
 * Date helpers. The clinic runs on Asia/Dhaka (UTC+6, no DST).
 *
 * Postgres `date` columns arrive as 'YYYY-MM-DD' strings. They are treated
 * as calendar dates and never passed through `new Date(string)`, which would
 * reinterpret them in the server's local timezone.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's calendar date in Dhaka as 'YYYY-MM-DD'. */
export function todayDhaka(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** ISO timestamp → '16 Sep 2026, 19:35' in Dhaka time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** 'YYYY-MM-DD' → '12 Mar 2026'. Returns '' for null/invalid input. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = DATE_RE.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}`;
}

/** Is `iso` strictly before today's Dhaka date? */
export function isPastDate(iso: string | null | undefined): boolean {
  return !!iso && DATE_RE.test(iso) && iso < todayDhaka();
}

/** Whole years between a 'YYYY-MM-DD' birth date and today in Dhaka. */
export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const m = DATE_RE.exec(dob);
  if (!m) return null;
  const [ty, tm, td] = todayDhaka().split("-").map(Number);
  const [by, bm, bd] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age >= 0 ? age : null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Add calendar months to a 'YYYY-MM-DD' date, clamping the day to the
 * target month's length (31 Jan + 1 month = 28/29 Feb). Pure string math.
 */
export function addMonths(iso: string, months: number): string {
  const m = DATE_RE.exec(iso);
  if (!m) return iso;
  let y = Number(m[1]);
  let mo = Number(m[2]) - 1 + months;
  y += Math.floor(mo / 12);
  mo = ((mo % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const d = Math.min(Number(m[3]), daysInMonth);
  return `${y}-${pad2(mo + 1)}-${pad2(d)}`;
}

/** 'YYYY-MM-DD' → '12 Mar' (no year), for compact chart axes. */
export function formatDayMonth(iso: string): string {
  const m = DATE_RE.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}

export const MONTH_NAMES_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Build 'YYYY-MM-DD' from parts (month is 1-based). */
export function toIso(y: number, m1: number, d: number): string {
  return `${y}-${pad2(m1)}-${pad2(d)}`;
}

/** Add whole days to a 'YYYY-MM-DD' date. */
export function addDays(iso: string, days: number): string {
  const m = DATE_RE.exec(iso);
  if (!m) return iso;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
  const dt = new Date(t);
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Day of week for a 'YYYY-MM-DD' date: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(iso: string): number {
  const m = DATE_RE.exec(iso);
  if (!m) return 0;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

export function daysInMonth(y: number, m1: number): number {
  return new Date(Date.UTC(y, m1, 0)).getUTCDate();
}

/** 'September 2026' */
export function monthLabel(y: number, m1: number): string {
  return `${MONTH_NAMES_LONG[m1 - 1]} ${y}`;
}

/** Parse 'YYYY-MM' → { y, m1 } or null. */
export function parseMonth(value: string | undefined): { y: number; m1: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const y = Number(m[1]);
  const m1 = Number(m[2]);
  if (m1 < 1 || m1 > 12 || y < 2000 || y > 2100) return null;
  return { y, m1 };
}

/** 'HH:MM' or 'HH:MM:SS' → '8:00 pm'. */
export function formatTime(value: string | null | undefined): string {
  const m = /^(\d{2}):(\d{2})/.exec(value ?? "");
  if (!m) return value ?? "";
  const h = Number(m[1]);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

/** 'HH:MM:SS' → 'HH:MM' for <input type="time">. */
export function toInputTime(value: string | null | undefined): string {
  const m = /^(\d{2}):(\d{2})/.exec(value ?? "");
  return m ? `${m[1]}:${m[2]}` : "";
}

/** Is `value` a well-formed 'YYYY-MM-DD' calendar date? */
export function isIsoDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= daysInMonth;
}
