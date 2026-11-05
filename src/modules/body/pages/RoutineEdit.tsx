import { useState } from 'react';
import { newId } from '../../../core/collection';
import { navigate } from '../../../core/router';
import { Button, ConfirmButton, Empty, Field, Icon, IconButton, NumberInput, PageHead } from '../../../core/ui';
import { routines, type RoutineExercise } from '../data';
import { ExerciseMedia, useExercises } from '../library';
import { exerciseMeta, ExercisePicker } from '../ExercisePicker';
import { DEFAULT_REST } from '../session-actions';

export function RoutineEditPage({ id }: { id: string }) {
  const isNew = id === 'new';
  const existing = isNew ? undefined : routines.get(id);
  const [name, setName] = useState(existing?.name ?? '');
  const [items, setItems] = useState<RoutineExercise[]>(existing?.exercises ?? []);
  const [picking, setPicking] = useState(false);
  const { byId } = useExercises();

  if (!isNew && (!existing || existing.deleted)) return <Empty title="This routine no longer exists"><a href="#/workouts">Back to workouts</a></Empty>;

  const patch = (i: number, p: Partial<RoutineExercise>) => setItems(items.map((e, j) => (j === i ? { ...e, ...p } : e)));
  const move = (i: number, d: number) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setItems(next);
  };

  const save = () => {
    routines.put({ id: existing?.id ?? newId(), name: name.trim() || 'Untitled', exercises: items });
    navigate('/workouts');
  };

  return (
    <>
      <PageHead title={isNew ? 'New routine' : 'Edit routine'} back="/workouts" actions={<Button variant="primary" onClick={save}>Save</Button>} />
      <Field label="Name">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Push A" />
      </Field>
      <div className="stack">
        {items.map((item, i) => {
          const ex = byId.get(item.exerciseId);
          return (
            <section className="card stack" key={`${item.exerciseId}-${i}`}>
              <div className="row between top">
                <div className="row">
                  <ExerciseMedia exercise={ex} animate className="media-thumb" />
                  <div>
                    <a className="strong" href={`#/workouts/exercises/${encodeURIComponent(item.exerciseId)}`}>{ex?.name ?? 'Loading…'}</a>
                    {ex && <p className="muted small">{exerciseMeta(ex)}</p>}
                  </div>
                </div>
                <div className="row tight">
                  <IconButton icon="up" label="Move up" disabled={i === 0} onClick={() => move(i, -1)} />
                  <IconButton icon="down" label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)} />
                  <IconButton icon="trash" label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))} />
                </div>
              </div>
              <div className="grid-4">
                <Field label="Sets"><NumberInput integer value={item.sets} onChange={(n) => patch(i, { sets: n ?? 1 })} /></Field>
                <Field label="Reps"><input className="input num" value={item.reps} onChange={(e) => patch(i, { reps: e.target.value })} placeholder="8-12" /></Field>
                <Field label="Start kg"><NumberInput value={item.weight} onChange={(n) => patch(i, { weight: n })} placeholder="Optional" /></Field>
                <Field label="Rest sec"><NumberInput integer value={item.restSec} onChange={(n) => patch(i, { restSec: n ?? 0 })} /></Field>
              </div>
              <Field label="Notes">
                <input className="input" value={item.notes ?? ''} onChange={(e) => patch(i, { notes: e.target.value })} placeholder="Seat height 4, pause at the bottom…" />
              </Field>
            </section>
          );
        })}
      </div>
      {!items.length && <Empty title="No exercises yet" />}
      <div className="row between wrap">
        <Button onClick={() => setPicking(true)}><Icon name="plus" size={16} /> Add exercise</Button>
        {existing && (
          <ConfirmButton onConfirm={() => { routines.remove(existing.id); navigate('/workouts'); }}>Delete routine</ConfirmButton>
        )}
      </div>
      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(exerciseId) => {
            setItems([...items, { exerciseId, sets: 3, reps: '8-12', weight: null, restSec: DEFAULT_REST }]);
            setPicking(false);
          }}
        />
      )}
    </>
  );
}
