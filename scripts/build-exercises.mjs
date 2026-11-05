// Regenerates public/exercises.json from free-exercise-db (public domain).
// Trims fields the app does not use. Bump COMMIT here and in src/modules/body/library.ts together.
import { writeFileSync } from 'node:fs';

const COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
const url = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${COMMIT}/dist/exercises.json`;
const raw = await (await fetch(url)).json();
const out = raw
  .filter((e) => e.images.length > 0)
  .map((e) => ({
    id: e.id,
    name: e.name,
    equipment: e.equipment ?? 'other',
    level: e.level,
    category: e.category,
    primary: e.primaryMuscles,
    secondary: e.secondaryMuscles,
    instructions: e.instructions,
    images: e.images,
  }));
writeFileSync('public/exercises.json', JSON.stringify(out));
console.log(`wrote ${out.length} exercises`);
