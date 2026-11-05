import { useMemo } from 'react';
import type { Rec } from '../../core/collection';
import { addDays, parseDay, toDay } from '../../core/dates';
import { defineCollection, useRecords } from '../../core/store';

export interface Habit extends Rec {
  name: string;
  /** Days it's due, as in Date.getDay(): 0 is Sunday, 6 is Saturday. */
  days: number[];
  createdAt: number;
}

/** One per habit per day: the id is "<habit>:<date>". Unticking a day deletes it. */
export interface HabitCheck extends Rec {
  habitId: string;
  date: string;
}

export const habits = defineCollection<Habit>('habits/habits');
export const habitChecks = defineCollection<HabitCheck>('habits/checks');

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS = [1, 2, 3, 4, 5];
/** Monday first, the same as the study week. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const sortHabits = (list: Habit[]) => [...list].sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name));

export const isScheduled = (habit: Pick<Habit, 'days'>, day: string) => habit.days.includes(parseDay(day).getDay());

export const scheduleLabel = (days: number[]) => {
  const has = (list: number[]) => days.length === list.length && list.every((d) => days.includes(d));
  if (has(EVERY_DAY)) return 'Every day';
  if (has(WEEKDAYS)) return 'Weekdays';
  if (has([0, 6])) return 'Weekends';
  return WEEK_ORDER.filter((d) => days.includes(d)).map((d) => DAY_NAMES[d]).join(', ');
};

/** History can be filled in from before the habit was created, so the earliest tick counts too. */
function firstDay(habit: Pick<Habit, 'createdAt'>, done: Set<string>) {
  let first = toDay(habit.createdAt);
  for (const d of done) if (d < first) first = d;
  return first;
}

/**
 * Scheduled days in a row, ending today. Today doesn't break it until the day is over, days off
 * don't break it, and a tick on a day off counts as a bonus.
 */
export function currentStreak(habit: Pick<Habit, 'days' | 'createdAt'>, done: Set<string>, today: string) {
  const first = firstDay(habit, done);
  let streak = 0;
  for (let d = today; d >= first; d = addDays(d, -1)) {
    if (done.has(d)) streak++;
    else if (d !== today && isScheduled(habit, d)) break;
  }
  return streak;
}

export function bestStreak(habit: Pick<Habit, 'days' | 'createdAt'>, done: Set<string>, today: string) {
  let best = 0;
  let run = 0;
  for (let d = firstDay(habit, done); d <= today; d = addDays(d, 1)) {
    if (done.has(d)) best = Math.max(best, ++run);
    else if (d !== today && isScheduled(habit, d)) run = 0;
  }
  return best;
}

/**
 * Scheduled days done in the last `window` days. Today only counts once it's ticked, days before
 * the habit started don't count, and bonus ticks are left out so this can't pass 100%.
 */
export function completion(habit: Pick<Habit, 'days' | 'createdAt'>, done: Set<string>, today: string, window = 30) {
  const first = firstDay(habit, done);
  let hit = 0;
  let due = 0;
  for (let i = 0; i < window; i++) {
    const d = addDays(today, -i);
    if (d < first) break;
    if (!isScheduled(habit, d)) continue;
    if (done.has(d)) {
      hit++;
      due++;
    } else if (d !== today) due++;
  }
  return { hit, due };
}

export const checkId = (habitId: string, date: string) => `${habitId}:${date}`;

export function toggleCheck(habitId: string, date: string, done: boolean) {
  const id = checkId(habitId, date);
  if (done) habitChecks.remove(id);
  else habitChecks.put({ id, habitId, date });
}

export function deleteHabit(id: string) {
  habitChecks.list().filter((c) => c.habitId === id).forEach((c) => habitChecks.remove(c.id));
  habits.remove(id);
}

const NONE: ReadonlySet<string> = new Set();

/** Ticked days for each habit. */
export function useChecks() {
  const all = useRecords(habitChecks);
  return useMemo(() => {
    const byHabit = new Map<string, Set<string>>();
    for (const c of all) {
      const days = byHabit.get(c.habitId);
      if (days) days.add(c.date);
      else byHabit.set(c.habitId, new Set([c.date]));
    }
    return (habitId: string) => (byHabit.get(habitId) ?? NONE) as Set<string>;
  }, [all]);
}
