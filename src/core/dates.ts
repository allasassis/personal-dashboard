const pad = (n: number) => String(n).padStart(2, '0');

/** yyyy-mm-dd in the device's timezone. toISOString would give tomorrow's date late at night. */
export const toDay = (d: Date | number = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

export const parseDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (day: string, n: number) => {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
};

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, opts);
const dayFmt = fmt({ month: 'short', day: 'numeric' });
const dayYearFmt = fmt({ month: 'short', day: 'numeric', year: 'numeric' });
const longFmt = fmt({ weekday: 'long', month: 'long', day: 'numeric' });

export const shortDate = (d: Date | number) => dayFmt.format(d);
export const fullDate = (d: Date | number) => dayYearFmt.format(d);
export const longDate = (d: Date | number) => longFmt.format(d);

export const relativeDay = (day: string) => {
  const today = toDay();
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  if (day === addDays(today, 1)) return 'Tomorrow';
  return longDate(parseDay(day));
};

export const duration = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};

/** Monday of the week containing `day`. */
export const weekStart = (day: string) => addDays(day, -((parseDay(day).getDay() + 6) % 7));
