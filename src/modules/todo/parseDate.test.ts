import { describe, expect, it } from 'vitest';
import { parseDue } from './parseDate';

const TODAY = '2026-11-05'; // a Thursday
const due = (s: string, today = TODAY, dayFirst = true) => parseDue(s, today, { dayFirst })?.due ?? null;
const title = (s: string) => parseDue(s, TODAY, { dayFirst: true })?.title ?? null;

describe('relative words', () => {
  it.each([
    ['Call Ana today', '2026-11-05'],
    ['Call Ana tonight', '2026-11-05'],
    ['Call Ana tomorrow', '2026-11-06'],
    ['Call Ana TOMORROW', '2026-11-06'],
    ['Call Ana tmrw', '2026-11-06'],
    ['Call Ana day after tomorrow', '2026-11-07'],
    ['Pay rent in 3 days', '2026-11-08'],
    ['Pay rent in a day', '2026-11-06'],
    ['Pay rent in two weeks', '2026-11-19'],
    ['Pay rent in 1 month', '2026-12-05'],
    ['Pay rent next week', '2026-11-12'],
    ['Pay rent next month', '2026-12-05'],
    ['Clean garage this weekend', '2026-11-07'],
    ['Clean garage next weekend', '2026-11-14'],
  ])('%s', (s, d) => expect(due(s)).toBe(d));

  it('clamps to the end of a shorter month', () => {
    expect(due('Pay next month', '2026-01-31')).toBe('2026-02-28');
  });
});

describe('weekdays', () => {
  it.each([
    ['Gym friday', '2026-11-06'], // tomorrow
    ['Gym this friday', '2026-11-06'],
    ['Gym next friday', '2026-11-13'], // the one in next week
    ['Gym monday', '2026-11-09'],
    ['Gym next monday', '2026-11-09'],
    ['Gym thursday', '2026-11-12'], // today is Thursday, so next week's
    ['Gym this thursday', '2026-11-05'],
    ['Gym next thursday', '2026-11-12'],
    ['Gym on sat', '2026-11-07'],
    ['Gym next sun', '2026-11-15'],
    ['Gym fri', '2026-11-06'],
  ])('%s', (s, d) => expect(due(s)).toBe(d));

  it('next monday from a Sunday is tomorrow', () => {
    expect(due('Gym next monday', '2026-11-08')).toBe('2026-11-09');
  });

  it('crosses into the next month and year', () => {
    expect(due('Gym friday', '2026-12-31')).toBe('2027-01-01');
  });
});

describe('explicit dates', () => {
  it.each([
    ['Exam nov 15', '2026-11-15'],
    ['Exam November 15th', '2026-11-15'],
    ['Exam 15 nov', '2026-11-15'],
    ['Exam 15th of November', '2026-11-15'],
    ['Exam on dec 1', '2026-12-01'],
    ['Exam nov 15, 2027', '2027-11-15'],
    ['Exam jan 3', '2027-01-03'], // already passed this year
    ['Exam may 5', '2027-05-05'],
    ['Exam 2027-02-03', '2027-02-03'],
    ['Exam on the 20th', '2026-11-20'],
    ['Exam by the 2nd', '2026-12-02'], // the 2nd has passed this month
    ['Exam on the 31st', '2026-12-31'], // November has no 31st
  ])('%s', (s, d) => expect(due(s)).toBe(d));

  it('reads numeric dates in the device order', () => {
    expect(due('Exam 3/12', TODAY, true)).toBe('2026-12-03');
    expect(due('Exam 3/12', TODAY, false)).toBe('2027-03-12');
    expect(due('Exam on 25/12/2027')).toBe('2027-12-25');
    expect(due('Exam on 25/12/27')).toBe('2027-12-25');
  });

  it('skips dates that do not exist', () => {
    expect(due('Exam feb 30')).toBeNull();
    expect(due('Exam 31/11')).toBeNull();
    expect(due('Exam 2026-13-45')).toBeNull();
  });
});

describe('the title', () => {
  it.each([
    ['Call Ana tomorrow', 'Call Ana'],
    ['Tomorrow call Ana', 'call Ana'],
    ['Call tomorrow Ana', 'Call Ana'],
    ['Submit report by friday', 'Submit report'],
    ['Report due tomorrow', 'Report'],
    ['Book table for friday', 'Book table'],
    ['Call Ana, tomorrow', 'Call Ana'],
    ['Call Ana - tomorrow', 'Call Ana'],
    ['Pagar a conta de luz amanhã tomorrow', 'Pagar a conta de luz amanhã'],
  ])('%s becomes %s', (s, t) => expect(title(s)).toBe(t));

  it('keeps a time, which has nowhere else to go', () => {
    expect(parseDue('Dentist tomorrow 3pm', TODAY)).toMatchObject({ title: 'Dentist 3pm', due: '2026-11-06' });
  });

  it('never leaves a to-do without a title', () => {
    expect(parseDue('tomorrow', TODAY)).toBeNull();
    expect(parseDue('by friday', TODAY)).toBeNull();
  });

  it('prefers the last date, and the longest phrase', () => {
    expect(parseDue('Prepare monday slides by friday', TODAY, { dayFirst: true })).toMatchObject({ title: 'Prepare monday slides', due: '2026-11-06' });
    expect(parseDue('Call day after tomorrow', TODAY)).toMatchObject({ title: 'Call', phrase: 'day after tomorrow' });
  });

  it('reports where the phrase is, for highlighting', () => {
    const p = parseDue('Call Ana next friday please', TODAY)!;
    expect('Call Ana next friday please'.slice(p.start, p.end)).toBe('next friday');
  });
});

describe('words that only look like dates', () => {
  it.each([
    'Buy sun cream',
    'Wake up with the sun',
    'Sat on the bench',
    'Add 1/2 cup of sugar',
    'May I call Ana',
    'Read the march of progress',
    'Book for 15 people',
    'Fix the 15th floor',
    'Saturday\'s party prep',
    'Todayish',
    'Mondays are hard',
    'Marry Ana',
    'Print 2026-11',
    'Plan the day',
    'Next steps',
    'In two minds',
    'Friendly chat',
    '',
  ])('%s', (s) => expect(parseDue(s, TODAY, { dayFirst: true })).toBeNull());
});

describe('dismissing', () => {
  it('skips an ignored phrase, and can fall back to another', () => {
    expect(parseDue('Watch Friday the movie', TODAY, { ignore: ['friday'] })).toBeNull();
    expect(parseDue('Watch Friday the movie tomorrow', TODAY, { ignore: ['tomorrow'] })).toMatchObject({ title: 'Watch the movie tomorrow', due: '2026-11-06' });
  });
});
