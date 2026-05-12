// Centralized date / number formatters pinned to Kosca's deployment locale.
// Per docs/design-system.md §11: en-IN, IST, DD-MON-YYYY display, never en-US.
//
// All app surfaces MUST go through these helpers — never call
// `.toLocaleDateString()` / `.toLocaleString()` directly. That keeps server-
// rendered (Node, runs in container TZ) and client-rendered (browser, runs in
// the user's TZ) output identical.

const TZ = 'Asia/Kolkata';
const LOCALE = 'en-IN';

const MONTH_SHORT_UPPER = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function partsInTz(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

// "05-APR-2026"
export function formatDate(input: Date | string | null | undefined): string {
  if (input == null) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '—';
  const { day, month, year } = partsInTz(d);
  return `${String(day).padStart(2, '0')}-${MONTH_SHORT_UPPER[month - 1]}-${year}`;
}

// "05 Apr 2026, 06:20 am"
export function formatDateTime(input: Date | string | null | undefined): string {
  if (input == null) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '—';
  const { day, month, year, hour, minute } = partsInTz(d);
  const monthShort = MONTH_SHORT_UPPER[month - 1].charAt(0) + MONTH_SHORT_UPPER[month - 1].slice(1).toLowerCase();
  const ampm = hour < 12 ? 'am' : 'pm';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${String(day).padStart(2, '0')} ${monthShort} ${year}, ${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;
}

// "06:20 am" — time-of-day only
export function formatTime(input: Date | string | null | undefined): string {
  if (input == null) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '—';
  const { hour, minute } = partsInTz(d);
  const ampm = hour < 12 ? 'am' : 'pm';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;
}

// "YYYY-MM-DD" in IST — for native <input type="date"> values and for
// substituting into email templates ({{deadline}}).
export function formatDateInputIso(input: Date | string | null | undefined): string {
  if (input == null) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  const { day, month, year } = partsInTz(d);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// "1,23,456" Indian-grouped count.
export function formatCount(n: number): string {
  return n.toLocaleString(LOCALE);
}

// "₹1,23,456" — primary currency, no decimals.
export function formatCurrency(n: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n);
}

// "1,23,456.78" — precise currency / measurement.
export function formatPrecise(n: number): string {
  return n.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// "Never" placeholder for last-sync timestamps with no value.
export const NEVER = 'Never';

// "—" em-dash placeholder for empty table cells.
export const EMDASH = '—';
