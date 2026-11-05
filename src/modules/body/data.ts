import type { Rec } from '../../core/collection';
import { defineCollection, useRecords } from '../../core/store';

// ---- Workouts -------------------------------------------------------------

export interface RoutineExercise {
  exerciseId: string;
  sets: number;
  reps: string; // "8-12" or "10"
  weight: number | null;
  restSec: number;
  notes?: string;
}

export interface Routine extends Rec {
  name: string;
  exercises: RoutineExercise[];
}

export interface SetLog {
  weight: number | null;
  reps: number | null;
  done: boolean;
}

export interface SessionExercise {
  exerciseId: string;
  restSec: number;
  targetReps?: string;
  notes?: string;
  sets: SetLog[];
}

export interface Session extends Rec {
  name: string;
  routineId: string | null;
  startedAt: number;
  finishedAt: number | null;
  notes?: string;
  exercises: SessionExercise[];
}

/** Your own exercise, or your own GIF and notes on a library exercise (same id). */
export interface CustomExercise extends Rec {
  name: string;
  equipment: string;
  primary: string[];
  gifUrl?: string;
  notes?: string;
}

export const routines = defineCollection<Routine>('gym/routines');
export const sessions = defineCollection<Session>('gym/sessions');
export const customExercises = defineCollection<CustomExercise>('gym/exercises');
/** The workout in progress stays local until finished, so each logged set isn't a commit. */
export const activeSession = defineCollection<Session>('gym/active', { localOnly: true });

export const ACTIVE_ID = 'current';

// ---- Diet -----------------------------------------------------------------

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Food extends Rec, Macros {
  name: string;
  /** The macros are for this amount: 100 g, 1 unit, and so on. */
  baseQty: number;
  unit: string;
}

export interface PlanItem {
  foodId: string;
  qty: number;
}

export interface PlanMeal {
  id: string;
  name: string;
  time?: string;
  items: PlanItem[];
}

export interface Plan extends Rec {
  name: string;
  meals: PlanMeal[];
}

/** Holds a copy of the macros, so editing a food later doesn't rewrite past days. */
export interface LogEntry extends Rec, Macros {
  date: string;
  meal: string;
  planMealId?: string;
  name: string;
  qty: number;
  unit: string;
}

export interface DietSettings extends Rec, Macros {
  activePlanId: string | null;
}

export const foods = defineCollection<Food>('diet/foods');
export const plans = defineCollection<Plan>('diet/plans');
export const foodLog = defineCollection<LogEntry>('diet/log');
export const dietSettings = defineCollection<DietSettings>('diet/settings');

export const SETTINGS_ID = 'current';

export const DEFAULT_SETTINGS: Omit<DietSettings, 'updatedAt'> = {
  id: SETTINGS_ID,
  kcal: 2400,
  protein: 160,
  carbs: 270,
  fat: 70,
  activePlanId: null,
};

export function useDietSettings() {
  const list = useRecords(dietSettings);
  return list.find((s) => s.id === SETTINGS_ID) ?? DEFAULT_SETTINGS;
}

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export const addMacros = (a: Macros, b: Macros): Macros => ({
  kcal: a.kcal + b.kcal,
  protein: a.protein + b.protein,
  carbs: a.carbs + b.carbs,
  fat: a.fat + b.fat,
});

export const sumMacros = (list: Macros[]) => list.reduce(addMacros, ZERO);

export function scaleFood(food: Food | Omit<Food, 'updatedAt'>, qty: number): Macros {
  const k = qty / food.baseQty;
  return { kcal: food.kcal * k, protein: food.protein * k, carbs: food.carbs * k, fat: food.fat * k };
}

// ---- Metrics --------------------------------------------------------------

export interface MetricDef extends Rec {
  name: string;
  unit: string;
}

/** One value per metric per day: the id is "<metric>:<date>", so re-logging updates it. */
export interface MetricEntry extends Rec {
  metricId: string;
  date: string;
  value: number;
  note?: string;
}

export const metricDefs = defineCollection<MetricDef>('metrics/definitions');
export const metricEntries = defineCollection<MetricEntry>('metrics/entries');

export const BUILTIN_METRICS: Omit<MetricDef, 'updatedAt'>[] = [
  { id: 'weight', name: 'Weight', unit: 'kg' },
  { id: 'bodyfat', name: 'Body fat', unit: '%' },
  { id: 'waist', name: 'Waist', unit: 'cm' },
  { id: 'chest', name: 'Chest', unit: 'cm' },
  { id: 'arm', name: 'Arm', unit: 'cm' },
  { id: 'thigh', name: 'Thigh', unit: 'cm' },
];

export const logMetric = (metricId: string, date: string, value: number, note?: string) =>
  metricEntries.put({ id: `${metricId}:${date}`, metricId, date, value, ...(note ? { note } : {}) });

// ---- Training calculations ------------------------------------------------

/** Epley estimate of a one-rep max. Lets sets with different reps be compared. */
export const estimate1RM = (weight: number, reps: number) => (reps === 1 ? weight : weight * (1 + reps / 30));

export const setVolume = (s: SetLog) => (s.weight ?? 0) * (s.reps ?? 0);

export const sessionVolume = (s: Session) => s.exercises.reduce((sum, e) => sum + e.sets.reduce((v, x) => v + setVolume(x), 0), 0);

export const sessionSetCount = (s: Session) => s.exercises.reduce((n, e) => n + e.sets.length, 0);

export const finishedSessions = (list: Session[]) => list.filter((s) => s.finishedAt).sort((a, b) => b.startedAt - a.startedAt);

/** Sets from the latest finished session containing this exercise. */
export function lastPerformance(list: Session[], exerciseId: string): SetLog[] {
  for (const s of finishedSessions(list)) {
    const match = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (match?.sets.length) return match.sets;
  }
  return [];
}

export const bestE1RM = (sets: SetLog[]) => Math.max(0, ...sets.filter((s) => s.weight && s.reps).map((s) => estimate1RM(s.weight!, s.reps!)));

/** Whether this exercise beat every earlier session's estimated max. */
export function isRecord(list: Session[], session: Session, exerciseId: string) {
  const here = session.exercises.find((e) => e.exerciseId === exerciseId);
  const best = bestE1RM(here?.sets ?? []);
  if (!best) return false;
  let earlier = 0;
  let hasEarlier = false;
  for (const s of list) {
    if (!s.finishedAt || s.startedAt >= session.startedAt) continue;
    for (const e of s.exercises) {
      if (e.exerciseId !== exerciseId || !e.sets.length) continue;
      hasEarlier = true;
      earlier = Math.max(earlier, bestE1RM(e.sets));
    }
  }
  return hasEarlier && best > earlier;
}
