import { useState } from 'react';
import { newId } from '../../../core/collection';
import { navigate } from '../../../core/router';
import { useRecords } from '../../../core/store';
import { addDays, relativeDay, toDay } from '../../../core/dates';
import { Button, ConfirmButton, ConfirmIconButton, Empty, Field, fmtNum, Icon, IconButton, NumberInput, PageHead, Segmented, Sheet } from '../../../core/ui';
import { dietSettings, foodLog, foods, plans, scaleFood, SETTINGS_ID, sumMacros, useDietSettings, type Food, type LogEntry, type Macros, type Plan, type PlanMeal } from '../data';
import { lookupFood, useFoods } from '../foods';

const round = (n: number) => Math.round(n);

export function MacroMeter({ name, swatch, value, target }: { name: string; swatch: string; value: number; target: number }) {
  const over = value - target;
  return (
    <div className="meter">
      <div className="meter-label">
        <span><i className="swatch" style={{ background: `var(${swatch})` }} />{name}</span>
        <span className="num"><strong>{round(value)}</strong> / {target} g</span>
      </div>
      <div className="meter-track" role="progressbar" aria-label={name} aria-valuemin={0} aria-valuemax={target} aria-valuenow={round(value)}>
        <div className="meter-fill" style={{ width: `${target > 0 ? Math.min(100, (value / target) * 100) : 0}%`, background: `var(${swatch})` }} />
      </div>
      {over > 0.5 && <span className="small muted">{round(over)} g over</span>}
    </div>
  );
}

export function DaySummary({ totals, target }: { totals: Macros; target: Macros }) {
  const left = target.kcal - totals.kcal;
  return (
    <section className="card day-summary">
      <div className="hero-num">
        <strong className="num">{round(totals.kcal)}</strong>
        <span className="muted">of {target.kcal} kcal</span>
        <span className="small muted">{left >= 0 ? `${round(left)} left` : `${round(-left)} over`}</span>
      </div>
      <div className="meters">
        <MacroMeter name="Protein" swatch="--series-1" value={totals.protein} target={target.protein} />
        <MacroMeter name="Carbs" swatch="--series-2" value={totals.carbs} target={target.carbs} />
        <MacroMeter name="Fat" swatch="--series-3" value={totals.fat} target={target.fat} />
      </div>
    </section>
  );
}

const macroLine = (m: Macros) => `${round(m.kcal)} kcal · P ${round(m.protein)} · C ${round(m.carbs)} · F ${round(m.fat)}`;

const logFood = (date: string, meal: string, food: Omit<Food, 'updatedAt'>, qty: number, planMealId?: string) => {
  foodLog.put({ id: newId(), date, meal, name: food.name, qty, unit: food.unit, ...scaleFood(food, qty), ...(planMealId ? { planMealId } : {}) });
};

function FoodPicker({ onPick, onClose, title = 'Add food' }: { onPick: (food: Omit<Food, 'updatedAt'>, qty: number) => void; onClose: () => void; title?: string }) {
  const all = useFoods();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Omit<Food, 'updatedAt'> | null>(null);
  const [qty, setQty] = useState<number | null>(null);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = all.filter((f) => words.every((w) => f.name.toLowerCase().includes(w)));

  if (chosen) {
    const macros = scaleFood(chosen, qty ?? 0);
    return (
      <Sheet title={chosen.name} onClose={onClose} footer={<Button variant="primary" disabled={!qty} onClick={() => qty && onPick(chosen, qty)}>Add</Button>}>
        <div className="stack">
          <Field label={`Amount (${chosen.unit})`}>
            <NumberInput value={qty} onChange={setQty} />
          </Field>
          <p className="num muted">{macroLine(macros)}</p>
          <Button variant="plain" onClick={() => setChosen(null)}>Choose a different food</Button>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="stack">
        <div className="search">
          <Icon name="search" size={18} />
          <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods" aria-label="Search foods" />
        </div>
        <ul className="list">
          {results.map((f) => (
            <li key={f.id}>
              <button type="button" className="list-row" onClick={() => { setChosen(f); setQty(f.baseQty); }}>
                <span className="list-main"><strong>{f.name}</strong><small className="num">{f.baseQty} {f.unit}: {macroLine(f)}</small></span>
              </button>
            </li>
          ))}
        </ul>
        {!results.length && <Empty title="No food with that name"><a href="#/diet/foods/new">Add it to your foods</a></Empty>}
      </div>
    </Sheet>
  );
}

function PlanMealCard({ meal, date, entries }: { meal: PlanMeal; date: string; entries: LogEntry[] }) {
  const logged = entries.filter((e) => e.planMealId === meal.id);
  const eaten = logged.length > 0;
  const items = meal.items.map((i) => ({ ...i, food: lookupFood(i.foodId) }));
  const planned = sumMacros(items.map((i) => (i.food ? scaleFood(i.food, i.qty) : { kcal: 0, protein: 0, carbs: 0, fat: 0 })));
  const toggle = () => {
    if (eaten) logged.forEach((e) => foodLog.remove(e.id));
    else items.forEach((i) => i.food && logFood(date, meal.name, i.food, i.qty, meal.id));
  };
  return (
    <section className={`card meal ${eaten ? 'is-done' : ''}`}>
      <div className="row between top">
        <div>
          <h3>{meal.name}{meal.time && <span className="muted num"> · {meal.time}</span>}</h3>
          <p className="small muted num">{macroLine(planned)}</p>
        </div>
        <button type="button" className="set-check" aria-pressed={eaten} aria-label={`${meal.name} eaten`} disabled={!items.length} onClick={toggle}>
          <Icon name="check" size={18} />
        </button>
      </div>
      <ul className="plain small">
        {items.map((i, n) => (
          <li key={n} className="row between"><span>{i.food?.name ?? 'Removed food'}</span><span className="num muted">{i.qty} {i.food?.unit}</span></li>
        ))}
      </ul>
    </section>
  );
}

function DayView() {
  const [date, setDate] = useState(toDay());
  const [adding, setAdding] = useState(false);
  const settings = useDietSettings();
  const allPlans = useRecords(plans);
  const log = useRecords(foodLog);
  const entries = log.filter((e) => e.date === date);
  const plan = allPlans.find((p) => p.id === settings.activePlanId) ?? allPlans[0];
  const extras = entries.filter((e) => !e.planMealId || !plan?.meals.some((m) => m.id === e.planMealId));

  return (
    <>
      <div className="row between date-nav">
        <IconButton icon="left" label="Previous day" onClick={() => setDate(addDays(date, -1))} />
        <strong>{relativeDay(date)}</strong>
        <IconButton icon="right" label="Next day" onClick={() => setDate(addDays(date, 1))} />
      </div>
      <DaySummary totals={sumMacros(entries)} target={settings} />

      {allPlans.length > 1 && (
        <Field label="Plan">
          <select
            className="input"
            value={plan?.id}
            onChange={(e) => dietSettings.put({ ...settings, id: SETTINGS_ID, activePlanId: e.target.value })}
          >
            {allPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      )}
      <div className="stack">
        {plan?.meals.map((m) => <PlanMealCard key={m.id} meal={m} date={date} entries={entries} />)}
      </div>
      {!plan && (
        <Empty title="No diet plan yet">
          Set up your meals once, then tick them off each day.
          <div><a className="btn btn-primary" href="#/diet/plans/new">Create a plan</a></div>
        </Empty>
      )}

      <section className="card stack">
        <div className="row between">
          <h3>{plan ? 'Also ate' : 'Logged'}</h3>
          <Button small onClick={() => setAdding(true)}><Icon name="plus" size={14} /> Add food</Button>
        </div>
        {extras.length ? (
          <ul className="list">
            {extras.map((e) => (
              <li className="list-row static" key={e.id}>
                <span className="list-main"><strong>{e.name}</strong><small className="num">{fmtNum(e.qty)} {e.unit} · {macroLine(e)}</small></span>
                <ConfirmIconButton label={`Remove ${e.name}`} onConfirm={() => foodLog.remove(e.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Anything outside the plan goes here.</p>
        )}
      </section>
      {adding && <FoodPicker onClose={() => setAdding(false)} onPick={(food, qty) => { logFood(date, 'Extra', food, qty); setAdding(false); }} />}
    </>
  );
}

function PlansView() {
  const list = useRecords(plans);
  const settings = useDietSettings();
  const [draft, setDraft] = useState<Macros | null>(null);
  const t = draft ?? settings;
  const setT = (p: Partial<Macros>) => setDraft({ kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat, ...p });
  const fromMacros = round(t.protein * 4 + t.carbs * 4 + t.fat * 9);

  return (
    <>
      <div className="cards">
        {list.map((p) => {
          const total = planTotals(p);
          return (
            <a className="card link-card" key={p.id} href={`#/diet/plans/${p.id}`}>
              <strong>{p.name}</strong>
              <span className="small muted">{p.meals.length} meals</span>
              <span className="small muted num">{macroLine(total)}</span>
            </a>
          );
        })}
      </div>
      <div>
        <Button variant={list.length ? 'ghost' : 'primary'} onClick={() => navigate('/diet/plans/new')}><Icon name="plus" size={16} /> New plan</Button>
      </div>
      <section className="card stack">
        <h2>Daily targets</h2>
        <div className="grid-4">
          <Field label="Calories"><NumberInput integer value={t.kcal} onChange={(n) => setT({ kcal: n ?? 0 })} /></Field>
          <Field label="Protein g"><NumberInput integer value={t.protein} onChange={(n) => setT({ protein: n ?? 0 })} /></Field>
          <Field label="Carbs g"><NumberInput integer value={t.carbs} onChange={(n) => setT({ carbs: n ?? 0 })} /></Field>
          <Field label="Fat g"><NumberInput integer value={t.fat} onChange={(n) => setT({ fat: n ?? 0 })} /></Field>
        </div>
        <p className="small muted num">These macros add up to {fromMacros} kcal.</p>
        {draft && (
          <div className="row">
            <Button variant="primary" onClick={() => { dietSettings.put({ ...settings, ...draft, id: SETTINGS_ID }); setDraft(null); }}>Save targets</Button>
            <Button variant="plain" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        )}
      </section>
    </>
  );
}

const planTotals = (p: Pick<Plan, 'meals'>) =>
  sumMacros(p.meals.flatMap((m) => m.items.map((i) => { const f = lookupFood(i.foodId); return f ? scaleFood(f, i.qty) : { kcal: 0, protein: 0, carbs: 0, fat: 0 }; })));

function FoodsView() {
  const all = useFoods();
  const [query, setQuery] = useState('');
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = all.filter((f) => words.every((w) => f.name.toLowerCase().includes(w)));
  return (
    <>
      <div className="row">
        <div className="search grow">
          <Icon name="search" size={18} />
          <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods" aria-label="Search foods" />
        </div>
        <a className="btn btn-ghost" href="#/diet/foods/new"><Icon name="plus" size={16} /> New</a>
      </div>
      <ul className="list card flush">
        {results.map((f) => (
          <li key={f.id}>
            <a className="list-row" href={`#/diet/foods/${f.id}`}>
              <span className="list-main"><strong>{f.name}</strong><small className="num">{f.baseQty} {f.unit}: {macroLine(f)}</small></span>
            </a>
          </li>
        ))}
      </ul>
      {!results.length && <Empty title="No food with that name" />}
      <p className="small muted">The starting list uses typical values from USDA data. Edit any food to match the label of what you buy.</p>
    </>
  );
}

type Tab = 'day' | 'plans' | 'foods';

export function DietPage({ tab = 'day' }: { tab?: Tab }) {
  return (
    <>
      <PageHead title="Diet" />
      <Segmented
        label="View"
        value={tab}
        onChange={(t) => navigate(t === 'day' ? '/diet' : `/diet/${t}`)}
        options={[
          { value: 'day', label: 'Day' },
          { value: 'plans', label: 'Plans' },
          { value: 'foods', label: 'Foods' },
        ]}
      />
      {tab === 'day' && <DayView />}
      {tab === 'plans' && <PlansView />}
      {tab === 'foods' && <FoodsView />}
    </>
  );
}

export function PlanEditPage({ id }: { id: string }) {
  const existing = id === 'new' ? undefined : plans.get(id);
  const [name, setName] = useState(existing?.name ?? '');
  const [meals, setMeals] = useState<PlanMeal[]>(existing?.meals ?? [{ id: newId(), name: 'Breakfast', items: [] }, { id: newId(), name: 'Lunch', items: [] }, { id: newId(), name: 'Dinner', items: [] }]);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const settings = useDietSettings();

  if (id !== 'new' && (!existing || existing.deleted)) return <Empty title="This plan no longer exists"><a href="#/diet/plans">Back to plans</a></Empty>;

  const patch = (mealId: string, p: Partial<PlanMeal>) => setMeals(meals.map((m) => (m.id === mealId ? { ...m, ...p } : m)));
  const total = planTotals({ meals });

  const save = () => {
    const planId = existing?.id ?? newId();
    plans.put({ id: planId, name: name.trim() || 'My plan', meals });
    if (!settings.activePlanId) dietSettings.put({ ...settings, id: SETTINGS_ID, activePlanId: planId });
    navigate('/diet/plans');
  };

  return (
    <>
      <PageHead title={existing ? 'Edit plan' : 'New plan'} back="/diet/plans" actions={<Button variant="primary" onClick={save}>Save</Button>} />
      <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Training day" /></Field>
      <DaySummary totals={total} target={settings} />
      <div className="stack">
        {meals.map((m) => (
          <section className="card stack" key={m.id}>
            <div className="row">
              <input className="input grow" value={m.name} onChange={(e) => patch(m.id, { name: e.target.value })} aria-label="Meal name" />
              <input className="input time" type="time" value={m.time ?? ''} onChange={(e) => patch(m.id, { time: e.target.value })} aria-label={`${m.name} time`} />
              <IconButton icon="trash" label={`Remove ${m.name}`} onClick={() => setMeals(meals.filter((x) => x.id !== m.id))} />
            </div>
            <ul className="list">
              {m.items.map((item, i) => {
                const food = lookupFood(item.foodId);
                return (
                  <li className="list-row static" key={i}>
                    <span className="list-main">
                      <strong>{food?.name ?? 'Removed food'}</strong>
                      {food && <small className="num">{macroLine(scaleFood(food, item.qty))}</small>}
                    </span>
                    <span className="qty">
                      <NumberInput value={item.qty} aria-label={`Amount of ${food?.name}`} onChange={(n) => patch(m.id, { items: m.items.map((x, j) => (j === i ? { ...x, qty: n ?? 0 } : x)) })} />
                      <small className="muted">{food?.unit}</small>
                    </span>
                    <IconButton icon="close" label="Remove" onClick={() => patch(m.id, { items: m.items.filter((_, j) => j !== i) })} />
                  </li>
                );
              })}
            </ul>
            <div><Button small onClick={() => setAddingTo(m.id)}><Icon name="plus" size={14} /> Add food</Button></div>
          </section>
        ))}
      </div>
      <div className="row between wrap">
        <Button onClick={() => setMeals([...meals, { id: newId(), name: 'Snack', items: [] }])}><Icon name="plus" size={16} /> Add meal</Button>
        {existing && <ConfirmButton onConfirm={() => { plans.remove(existing.id); navigate('/diet/plans'); }}>Delete plan</ConfirmButton>}
      </div>
      {addingTo && (
        <FoodPicker
          onClose={() => setAddingTo(null)}
          onPick={(food, qty) => {
            const meal = meals.find((x) => x.id === addingTo)!;
            patch(addingTo, { items: [...meal.items, { foodId: food.id, qty }] });
            setAddingTo(null);
          }}
        />
      )}
    </>
  );
}

export function FoodEditPage({ id }: { id: string }) {
  const isNew = id === 'new';
  const existing = isNew ? undefined : lookupFood(id);
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    baseQty: existing?.baseQty ?? 100,
    unit: existing?.unit ?? 'g',
    kcal: existing?.kcal ?? 0,
    protein: existing?.protein ?? 0,
    carbs: existing?.carbs ?? 0,
    fat: existing?.fat ?? 0,
  });
  const set = (p: Partial<typeof form>) => setForm({ ...form, ...p });
  const valid = form.name.trim() && form.baseQty > 0;

  if (!isNew && !existing) return <Empty title="Food not found"><a href="#/diet/foods">Back to foods</a></Empty>;

  return (
    <>
      <PageHead title={isNew ? 'New food' : 'Edit food'} back="/diet/foods" actions={<Button variant="primary" disabled={!valid} onClick={() => { foods.put({ id: existing?.id ?? newId(), ...form, name: form.name.trim() }); navigate('/diet/foods'); }}>Save</Button>} />
      <section className="card stack">
        <Field label="Name"><input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <div className="grid-2">
          <Field label="Nutrition per"><NumberInput value={form.baseQty} onChange={(n) => set({ baseQty: n ?? 0 })} /></Field>
          <Field label="Unit">
            <select className="input" value={form.unit} onChange={(e) => set({ unit: e.target.value })}>
              {['g', 'ml', 'unit', 'scoop', 'slice', 'tbsp'].map((u) => <option key={u}>{u}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid-4">
          <Field label="Calories"><NumberInput value={form.kcal} onChange={(n) => set({ kcal: n ?? 0 })} /></Field>
          <Field label="Protein g"><NumberInput value={form.protein} onChange={(n) => set({ protein: n ?? 0 })} /></Field>
          <Field label="Carbs g"><NumberInput value={form.carbs} onChange={(n) => set({ carbs: n ?? 0 })} /></Field>
          <Field label="Fat g"><NumberInput value={form.fat} onChange={(n) => set({ fat: n ?? 0 })} /></Field>
        </div>
      </section>
      {existing && <div><ConfirmButton onConfirm={() => { foods.remove(existing.id); navigate('/diet/foods'); }}>Delete food</ConfirmButton></div>}
    </>
  );
}
