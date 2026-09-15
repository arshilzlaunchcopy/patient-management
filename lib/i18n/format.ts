import { bn } from "./bn";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Western digits → Bengali numerals. Everything else passes through. */
export function toBengaliDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD' → '১৮ জানু' */
export function formatDateBn(iso: string): string {
  const m = DATE_RE.exec(iso);
  if (!m) return toBengaliDigits(iso);
  return `${toBengaliDigits(Number(m[3]))} ${bn.monthsShort[Number(m[2]) - 1]}`;
}

/** 'YYYY-MM-DD' → 'শনিবার' */
export function weekdayBn(iso: string): string {
  const m = DATE_RE.exec(iso);
  if (!m) return "";
  const dow = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return bn.weekdays[dow];
}

/** 'YYYY-MM-DD' → 'শনিবার, ১৮ জানু' */
export function formatDateLongBn(iso: string): string {
  return `${weekdayBn(iso)}, ${formatDateBn(iso)}`;
}

function periodBn(hour: number): string {
  if (hour < 4) return "রাত";
  if (hour < 6) return "ভোর";
  if (hour < 12) return "সকাল";
  if (hour < 15) return "দুপুর";
  if (hour < 18) return "বিকাল";
  if (hour < 20) return "সন্ধ্যা";
  return "রাত";
}

function clockBn(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0
    ? `${toBengaliDigits(h12)}টা`
    : `${toBengaliDigits(h12)}:${toBengaliDigits(String(minute).padStart(2, "0"))}`;
}

/** 'HH:MM[:SS]' → 'রাত ৮টা' */
export function formatTimeBn(value: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(value);
  if (!m) return value;
  const h = Number(m[1]);
  return `${periodBn(h)} ${clockBn(h, Number(m[2]))}`;
}

/**
 * Call window as patients read it: 'রাত ৮টা - ১০টা' when both ends share a
 * period, otherwise 'সন্ধ্যা ৭টা - রাত ৯টা'.
 */
export function formatWindowBn(start: string, end: string): { start: string; end: string } {
  const ms = /^(\d{2}):(\d{2})/.exec(start);
  const me = /^(\d{2}):(\d{2})/.exec(end);
  if (!ms || !me) return { start, end };
  const hs = Number(ms[1]);
  const he = Number(me[1]);
  const samePeriod = periodBn(hs) === periodBn(he);
  return {
    start: `${periodBn(hs)} ${clockBn(hs, Number(ms[2]))}`,
    end: samePeriod
      ? clockBn(he, Number(me[2]))
      : `${periodBn(he)} ${clockBn(he, Number(me[2]))}`,
  };
}

/** Seconds → 'মম:সস' in Bengali numerals. */
export function formatCountdownBn(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return toBengaliDigits(`${mm}:${ss}`);
}
