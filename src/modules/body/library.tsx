import { useEffect, useMemo, useState } from 'react';
import { useRecords } from '../../core/store';
import { Icon } from '../../core/ui';
import { customExercises } from './data';

// Photos come from free-exercise-db (public domain), pinned to one commit so links stay valid.
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/';

export interface Exercise {
  id: string;
  name: string;
  equipment: string;
  level?: string;
  category?: string;
  primary: string[];
  secondary?: string[];
  instructions?: string[];
  images?: string[];
  gifUrl?: string;
  notes?: string;
  custom?: boolean;
}

let cache: Promise<Exercise[]> | null = null;

const loadLibrary = () => {
  cache ??= fetch(`${import.meta.env.BASE_URL}exercises.json`).then((r) => {
    if (!r.ok) throw new Error('Could not load the exercise library');
    return r.json();
  });
  cache.catch(() => (cache = null));
  return cache;
};

/** The library with your own exercises and overrides applied, plus an id lookup. */
export function useExercises() {
  const custom = useRecords(customExercises);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    loadLibrary().then(
      (l) => live && setLibrary(l),
      () => live && setError(true),
    );
    return () => {
      live = false;
    };
  }, []);

  return useMemo(() => {
    const byId = new Map<string, Exercise>(library.map((e) => [e.id, e]));
    for (const c of custom) {
      const base = byId.get(c.id);
      byId.set(c.id, { ...base, ...c, custom: !base });
    }
    const all = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    return { all, byId, loading: !library.length && !error, error };
  }, [library, custom, error]);
}

export const MUSCLES = ['abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes', 'hamstrings', 'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps'];
export const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'kettlebells', 'body only', 'bands', 'e-z curl bar', 'medicine ball', 'exercise ball', 'foam roll', 'other'];

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Shows the exercise as a moving picture: your own GIF if set, otherwise the library's
 * start and end photos in alternation. Stays still for people who prefer reduced motion.
 */
export function ExerciseMedia({ exercise, animate = false, className = '' }: { exercise: Exercise | undefined; animate?: boolean; className?: string }) {
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  const images = exercise?.images ?? [];
  const flip = animate && !exercise?.gifUrl && images.length > 1;

  useEffect(() => {
    if (!flip || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % images.length), 900);
    return () => clearInterval(t);
  }, [flip, images.length]);

  const box = `media ${className}`;
  if (!exercise || failed || (!exercise.gifUrl && !images.length)) {
    return (
      <div className={`${box} media-empty`} aria-hidden="true">
        <Icon name="dumbbell" />
      </div>
    );
  }
  if (exercise.gifUrl) {
    return (
      <div className={box}>
        <img src={exercise.gifUrl} alt={exercise.name} loading="lazy" onError={() => setFailed(true)} />
      </div>
    );
  }
  const shown = flip ? images : images.slice(0, 1);
  return (
    <div className={box}>
      {shown.map((path, i) => (
        <img key={path} src={IMAGE_BASE + path} alt={i === 0 ? exercise.name : ''} loading="lazy" style={{ opacity: i === frame ? 1 : 0 }} onError={() => setFailed(true)} />
      ))}
    </div>
  );
}
