import { navigate } from '../../core/router';
import { newId } from '../../core/collection';
import { activeSession, ACTIVE_ID, lastPerformance, sessions, type Routine, type Session, type SessionExercise, type SetLog } from './data';

export const DEFAULT_REST = 90;

/** New rows start from what you did last time, then from the routine's target. */
export function buildSets(exerciseId: string, count: number, targetWeight: number | null, targetReps: string): SetLog[] {
  const prev = lastPerformance(sessions.list(), exerciseId);
  const fixedReps = /^\d+$/.test(targetReps.trim()) ? Number(targetReps) : null;
  return Array.from({ length: count }, (_, i) => {
    const p = prev[i] ?? prev[prev.length - 1];
    return { weight: p?.weight ?? targetWeight, reps: p?.reps ?? fixedReps, done: false };
  });
}

const start = (name: string, routineId: string | null, exercises: SessionExercise[]) => {
  activeSession.put({ id: ACTIVE_ID, name, routineId, startedAt: Date.now(), finishedAt: null, exercises });
  navigate('/workouts/session');
};

export const startFromRoutine = (r: Routine) =>
  start(
    r.name,
    r.id,
    r.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      restSec: e.restSec,
      targetReps: e.reps,
      notes: e.notes,
      sets: buildSets(e.exerciseId, e.sets, e.weight, e.reps),
    })),
  );

export const startEmpty = () => start('Workout', null, []);

export const startFromSession = (s: Session) =>
  start(
    s.name,
    s.routineId,
    s.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      restSec: e.restSec,
      targetReps: e.targetReps,
      notes: e.notes,
      sets: buildSets(e.exerciseId, e.sets.length, null, e.targetReps ?? ''),
    })),
  );

/** Saves the finished sets to history. Unticked sets are dropped. Returns the saved id. */
export function finishActive(session: Session, notes: string): string | null {
  const exercises = session.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
    .filter((e) => e.sets.length);
  activeSession.remove(ACTIVE_ID);
  if (!exercises.length) return null;
  const id = newId();
  sessions.put({ ...session, id, finishedAt: Date.now(), exercises, ...(notes ? { notes } : {}) });
  return id;
}
