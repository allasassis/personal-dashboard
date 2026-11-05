import { useMemo } from 'react';
import { useRecords } from '../../core/store';
import { foods, type Food } from './data';

type Builtin = Omit<Food, 'updatedAt'>;

const f = (id: string, name: string, baseQty: number, unit: string, kcal: number, protein: number, carbs: number, fat: number): Builtin => ({
  id: `builtin-${id}`, name, baseQty, unit, kcal, protein, carbs, fat,
});

/** Typical values rounded from USDA data, as a starting point. Brands differ, and all of these can be edited. */
export const BUILTIN_FOODS: Builtin[] = [
  f('chicken', 'Chicken breast, cooked', 100, 'g', 165, 31, 0, 3.6),
  f('beef', 'Lean ground beef, cooked', 100, 'g', 217, 26, 0, 12),
  f('salmon', 'Salmon, cooked', 100, 'g', 206, 22, 0, 12),
  f('tuna', 'Tuna, canned in water', 100, 'g', 116, 26, 0, 0.8),
  f('egg', 'Egg, whole', 1, 'unit', 72, 6.3, 0.4, 4.8),
  f('eggwhite', 'Egg white', 100, 'g', 52, 11, 0.7, 0.2),
  f('whey', 'Whey protein', 30, 'g', 120, 24, 3, 1.5),
  f('yogurt', 'Greek yogurt, nonfat', 100, 'g', 59, 10, 3.6, 0.4),
  f('cottage', 'Cottage cheese', 100, 'g', 98, 11, 3.4, 4.3),
  f('milk', 'Whole milk', 100, 'ml', 61, 3.2, 4.8, 3.3),
  f('rice', 'White rice, cooked', 100, 'g', 130, 2.7, 28, 0.3),
  f('brownrice', 'Brown rice, cooked', 100, 'g', 123, 2.7, 26, 1),
  f('beans', 'Black beans, cooked', 100, 'g', 132, 8.9, 24, 0.5),
  f('pasta', 'Pasta, cooked', 100, 'g', 158, 5.8, 31, 0.9),
  f('oats', 'Rolled oats, dry', 100, 'g', 389, 17, 66, 6.9),
  f('bread', 'Whole wheat bread', 100, 'g', 247, 13, 41, 3.4),
  f('potato', 'Potato, boiled', 100, 'g', 87, 1.9, 20, 0.1),
  f('sweetpotato', 'Sweet potato, boiled', 100, 'g', 76, 1.4, 18, 0.1),
  f('banana', 'Banana', 100, 'g', 89, 1.1, 23, 0.3),
  f('apple', 'Apple', 100, 'g', 52, 0.3, 14, 0.2),
  f('broccoli', 'Broccoli, cooked', 100, 'g', 35, 2.4, 7.2, 0.4),
  f('avocado', 'Avocado', 100, 'g', 160, 2, 8.5, 15),
  f('oliveoil', 'Olive oil', 100, 'ml', 884, 0, 0, 100),
  f('peanutbutter', 'Peanut butter', 100, 'g', 598, 22, 22, 51),
  f('almonds', 'Almonds', 100, 'g', 579, 21, 22, 50),
];

const builtinById = new Map(BUILTIN_FOODS.map((x) => [x.id, x]));

/** Saving a built-in food stores your edit under its id. Deleting one hides it. */
export function useFoods() {
  useRecords(foods);
  const list = foods.list();
  return useMemo(() => {
    const merged = new Map<string, Food | Builtin>(BUILTIN_FOODS.map((x) => [x.id, x]));
    for (const id of builtinById.keys()) if (foods.get(id)?.deleted) merged.delete(id);
    for (const r of list) merged.set(r.id, r);
    return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [list]);
}

export const lookupFood = (id: string) => {
  const rec = foods.get(id);
  return rec && rec.name ? rec : builtinById.get(id);
};
