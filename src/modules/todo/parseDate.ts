// Finds a date written in plain words inside a to-do's title, like "Call Ana next friday".
// Common words that are sometimes dates ("sun", "sat", "1/2") need a clue before they
// count, because a wrong guess that eats part of the title is worse than no guess.

import { addDays, parseDay, toDay } from '../../core/dates';

export interface ParsedDate {
  /** The title with the date phrase removed. */
  title: string;
  due: string;
  /** Where the phrase sits in the original text. */
  start: number;
  end: number;
  phrase: string;
}

type Resolve = (m: RegExpMatchArray, today: string, dayFirst: boolean) => string | null;

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

const PREFIX = '(?:on|by|due|for|until)';
const OPT = `(?:${PREFIX}\\s+)?`;
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DAY = '(\\d{1,2})(?:st|nd|rd|th)?';
const YEAR = '(?:,?\\s+(\\d{4}))?';
const FULL_DAY = '(sunday|monday|tuesday|wednesday|thursday|friday|saturday)';
const SHORT_DAY = '(sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)';
const COUNT = `(\\d{1,3}|${Object.keys(NUMBERS).join('|')})`;

const monthIndex = (name: string) => MONTHS.findIndex((m) => m.startsWith(name.slice(0, 3).toLowerCase()));
const weekdayIndex = (name: string) => WEEKDAYS.findIndex((d) => d.startsWith(name.slice(0, 3).toLowerCase()));
const count = (word: string) => NUMBERS[word.toLowerCase()] ?? Number(word);

/** Null for dates that don't exist, such as February 30. */
function makeDate(year: number, month: number, day: number): string | null {
  const d = new Date(year, month, day);
  return d.getMonth() === month && d.getDate() === day ? toDay(d) : null;
}

/** Same day in a later month, or that month's last day when it's shorter. */
function addMonths(today: string, n: number) {
  const d = parseDay(today);
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return toDay(new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last)));
}

/** Without a year, a date that has already passed means next year. */
function monthDay(today: string, month: number, day: number, year?: string) {
  const thisYear = parseDay(today).getFullYear();
  if (year) return makeDate(Number(year), month, day);
  const date = makeDate(thisYear, month, day);
  // February 29 can be valid only in a later year, so check that one too.
  return date && date >= today ? date : makeDate(thisYear + 1, month, day);
}

/**
 * "friday" is the next one coming (a week away if today is Friday, since you'd say "today").
 * "this friday" can be today. "next friday" is the one in next week, weeks starting on Monday.
 */
function weekday(today: string, name: string, qualifier?: string) {
  const target = weekdayIndex(name);
  const now = parseDay(today).getDay();
  const ahead = (target - now + 7) % 7;
  const q = qualifier?.toLowerCase();
  if (q === 'next') {
    const toNextMonday = ((8 - now) % 7) || 7;
    return addDays(today, toNextMonday + ((target + 6) % 7));
  }
  if (q === 'this') return addDays(today, ahead);
  return addDays(today, ahead || 7);
}

const RULES: [string, Resolve][] = [
  [`${OPT}day after tomorrow`, (_, t) => addDays(t, 2)],
  [`${OPT}(?:today|tonight)`, (_, t) => t],
  [`${OPT}(?:tomorrow|tmrw|tmr)`, (_, t) => addDays(t, 1)],
  [`${OPT}in\\s+${COUNT}\\s+days?`, (m, t) => addDays(t, count(m[1]))],
  [`${OPT}in\\s+${COUNT}\\s+weeks?`, (m, t) => addDays(t, count(m[1]) * 7)],
  [`${OPT}in\\s+${COUNT}\\s+months?`, (m, t) => addMonths(t, count(m[1]))],
  [`${OPT}next week`, (_, t) => addDays(t, 7)],
  [`${OPT}next month`, (_, t) => addMonths(t, 1)],
  [`${OPT}this weekend`, (_, t) => (parseDay(t).getDay() === 0 ? t : weekday(t, 'saturday', 'this'))],
  [`${OPT}next weekend`, (_, t) => weekday(t, 'saturday', 'next')],
  [`${OPT}(?:(next|this)\\s+)?${FULL_DAY}`, (m, t) => weekday(t, m[2], m[1])],
  [`(?:${PREFIX}\\s+)(?:(next|this)\\s+)?${SHORT_DAY}`, (m, t) => weekday(t, m[2], m[1])],
  [`(next|this)\\s+${SHORT_DAY}`, (m, t) => weekday(t, m[2], m[1])],
  ['(mon|tues?|wed|thu(?:rs?)?|fri)(?=\\s*$)', (m, t) => weekday(t, m[1])],
  [`${OPT}${MONTH}\\s+${DAY}${YEAR}`, (m, t) => monthDay(t, monthIndex(m[1]), Number(m[2]), m[3])],
  [`${OPT}${DAY}\\s+(?:of\\s+)?${MONTH}${YEAR}`, (m, t) => monthDay(t, monthIndex(m[2]), Number(m[1]), m[3])],
  [
    `${PREFIX}\\s+(?:the\\s+)?${DAY}`,
    (m, t) => {
      // Requires an ordinal or "the": "due 15" is too vague, "by the 15th" is not.
      if (!/(st|nd|rd|th|the)/i.test(m[0])) return null;
      const d = parseDay(t);
      for (let i = 0; i < 12; i++) {
        const date = makeDate(d.getFullYear(), d.getMonth() + i, Number(m[1]));
        if (date && date >= t) return date;
      }
      return null;
    },
  ],
  [`${OPT}(\\d{4})-(\\d{2})-(\\d{2})`, (m) => makeDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]))],
  // "1/2" is often a fraction, so a numeric date needs a clue or to end the text.
  [`(?:${PREFIX}\\s+(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?|(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?(?=\\s*$))`, (m, t, dayFirst) => {
    const [a, b, y] = m[1] ? [m[1], m[2], m[3]] : [m[4], m[5], m[6]];
    const [day, month] = dayFirst ? [a, b] : [b, a];
    const year = y && y.length === 2 ? `20${y}` : y;
    return monthDay(t, Number(month) - 1, Number(day), year);
  }],
];

const COMPILED = RULES.map(([source, resolve]) => ({
  // A word on its own: not part of a longer word, and not a possessive like "Monday's".
  re: new RegExp(`(?<![\\p{L}\\p{N}/-])(?:${source})(?![\\p{L}\\p{N}'’/-])`, 'giu'),
  resolve,
}));

const defaultDayFirst = () => {
  const parts = new Intl.DateTimeFormat(undefined).formatToParts(new Date(2026, 10, 25)).map((p) => p.type);
  return parts.indexOf('day') < parts.indexOf('month');
};

const clean = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, '')
    .trim();

export function parseDue(
  text: string,
  today: string = toDay(),
  opts: { ignore?: string[]; dayFirst?: boolean } = {},
): ParsedDate | null {
  const dayFirst = opts.dayFirst ?? defaultDayFirst();
  const ignored = new Set((opts.ignore ?? []).map((s) => s.toLowerCase()));

  const found: { start: number; end: number; due: string }[] = [];
  for (const { re, resolve } of COMPILED) {
    for (const m of text.matchAll(re)) {
      if (ignored.has(m[0].toLowerCase())) continue;
      const due = resolve(m, today, dayFirst);
      if (due) found.push({ start: m.index, end: m.index + m[0].length, due });
    }
  }
  // Where phrases overlap the longest one is meant: "day after tomorrow" over "tomorrow".
  const whole = found.filter((a) => !found.some((b) => b !== a && b.start <= a.start && b.end >= a.end && b.end - b.start > a.end - a.start));
  if (!whole.length) return null;

  // Dates tend to come last: "Prepare monday slides by friday" is due on Friday.
  const best = whole.reduce((a, b) => (b.start > a.start ? b : a));
  const title = clean(text.slice(0, best.start) + ' ' + text.slice(best.end));
  if (!title) return null; // "tomorrow" alone is a to-do called tomorrow, not an empty one
  return { title, due: best.due, start: best.start, end: best.end, phrase: text.slice(best.start, best.end) };
}
