import { describe, expect, it, vi } from 'vitest';

// The maths doesn't touch storage, and the store opens IndexedDB when it's imported.
vi.mock('../../core/store', () => ({ defineCollection: () => ({}), useRecords: () => [] }));
const { bestStreak, completion, currentStreak, scheduleLabel } = await import('./data');

const TODAY = '2026-11-05'; // a Thursday
const created = new Date(2026, 8, 1).getTime();
const daily = { days: [0, 1, 2, 3, 4, 5, 6], createdAt: created };
const mwf = { days: [1, 3, 5], createdAt: created };
const set = (...days: string[]) => new Set(days);

describe('currentStreak', () => {
  it('is zero with nothing ticked', () => {
    expect(currentStreak(daily, set(), TODAY)).toBe(0);
  });
  it('counts back from today', () => {
    expect(currentStreak(daily, set('2026-11-05', '2026-11-04', '2026-11-03'), TODAY)).toBe(3);
  });
  it('is not broken by today being unticked so far', () => {
    expect(currentStreak(daily, set('2026-11-04', '2026-11-03'), TODAY)).toBe(2);
  });
  it('is broken by a missed day', () => {
    expect(currentStreak(daily, set('2026-11-05', '2026-11-03'), TODAY)).toBe(1);
    expect(currentStreak(daily, set('2026-11-03'), TODAY)).toBe(0);
  });
  it('skips days off', () => {
    // Wed 4, Mon 2, Fri Oct 30. Thursday today is off, so it isn't waiting on anything.
    expect(currentStreak(mwf, set('2026-11-04', '2026-11-02', '2026-10-30'), TODAY)).toBe(3);
  });
  it('is broken by a missed scheduled day, even with days off around it', () => {
    expect(currentStreak(mwf, set('2026-11-04', '2026-10-30'), TODAY)).toBe(1);
  });
  it('counts a tick on a day off as a bonus', () => {
    expect(currentStreak(mwf, set('2026-11-05', '2026-11-04'), TODAY)).toBe(2);
  });
  it('stops at the start of the history rather than running forever', () => {
    const fresh = { days: [1], createdAt: new Date(2026, 10, 5).getTime() };
    expect(currentStreak(fresh, set(), TODAY)).toBe(0);
  });
  it('works across a month and a daylight saving change', () => {
    const days = Array.from({ length: 12 }, (_, i) => `2026-10-${String(31 - i).padStart(2, '0')}`);
    expect(currentStreak(daily, set(...days, '2026-11-01'), '2026-11-01')).toBe(13);
  });
});

describe('bestStreak', () => {
  it('finds the longest run in the past', () => {
    expect(bestStreak(daily, set('2026-10-01', '2026-10-02', '2026-10-03', '2026-11-05'), TODAY)).toBe(3);
  });
  it('includes filled-in days from before the habit was created', () => {
    const recent = { ...daily, createdAt: new Date(2026, 10, 4).getTime() };
    expect(bestStreak(recent, set('2026-10-01', '2026-10-02'), TODAY)).toBe(2);
  });
  it('is zero with nothing ticked', () => {
    expect(bestStreak(daily, set(), TODAY)).toBe(0);
  });
});

describe('completion', () => {
  it('leaves an unticked today out', () => {
    const today = { days: [4], createdAt: new Date(2026, 10, 5).getTime() };
    expect(completion(today, set(), TODAY)).toEqual({ hit: 0, due: 0 });
    expect(completion(today, set(TODAY), TODAY)).toEqual({ hit: 1, due: 1 });
  });
  it('starts when the habit started', () => {
    const recent = { ...daily, createdAt: new Date(2026, 10, 3).getTime() };
    expect(completion(recent, set('2026-11-03'), TODAY)).toEqual({ hit: 1, due: 2 });
  });
  it('only looks at the window', () => {
    expect(completion(daily, set(), TODAY).due).toBe(29);
  });
  it('cannot pass 100% with bonus ticks', () => {
    const recent = { ...mwf, createdAt: new Date(2026, 10, 2).getTime() };
    expect(completion(recent, set('2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'), TODAY)).toEqual({ hit: 2, due: 2 });
  });
});

describe('scheduleLabel', () => {
  it.each([
    [[0, 1, 2, 3, 4, 5, 6], 'Every day'],
    [[5, 4, 3, 2, 1], 'Weekdays'],
    [[6, 0], 'Weekends'],
    [[5, 1, 0], 'Mon, Fri, Sun'],
  ])('%j is %s', (days, label) => {
    expect(scheduleLabel(days)).toBe(label);
  });
});
