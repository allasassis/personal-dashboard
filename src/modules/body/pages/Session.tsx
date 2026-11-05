import { useEffect, useState } from 'react';
import { navigate } from '../../../core/router';
import { useRecords } from '../../../core/store';
import { duration } from '../../../core/dates';
import { Button, ConfirmButton, ConfirmIconButton, Empty, Field, fmtNum, Icon, NumberInput, Sheet } from '../../../core/ui';
import { activeSession, ACTIVE_ID, lastPerformance, sessions, type Session, type SessionExercise, type SetLog } from '../data';
import { ExerciseMedia, useExercises, type Exercise } from '../library';
import { exerciseMeta, ExercisePicker } from '../ExercisePicker';
import { buildSets, DEFAULT_REST, finishActive } from '../session-actions';

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Works from an end time rather than counting ticks, so it stays right when the phone locks. */
function RestTimer({ endsAt, total, onChange, onDone }: { endsAt: number; total: number; onChange: (endsAt: number) => void; onDone: () => void }) {
  const now = useNow(250);
  const left = endsAt - now;
  useEffect(() => {
    if (left <= 0) {
      navigator.vibrate?.([200, 100, 200]);
      onDone();
    }
  }, [left, onDone]);
  return (
    <div className="rest" role="timer" aria-label="Rest timer">
      <div className="rest-bar" style={{ transform: `scaleX(${Math.max(0, left / total)})` }} />
      <span className="rest-time num">{duration(left + 999)}</span>
      <span className="muted small">Rest</span>
      <div className="row tight push">
        <Button small onClick={() => onChange(endsAt - 15000)}>−15</Button>
        <Button small onClick={() => onChange(endsAt + 15000)}>+15</Button>
        <Button small onClick={onDone}>Skip</Button>
      </div>
    </div>
  );
}

function ExerciseInfo({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  return (
    <Sheet title={exercise.name} onClose={onClose}>
      <div className="stack">
        <ExerciseMedia exercise={exercise} animate className="media-hero" />
        <p className="muted small">{exerciseMeta(exercise)}</p>
        {exercise.notes && <p>{exercise.notes}</p>}
        {exercise.instructions && <ol className="steps">{exercise.instructions.map((s) => <li key={s}>{s}</li>)}</ol>}
      </div>
    </Sheet>
  );
}

function ExerciseBlock({ item, exercise, update, remove, onSetDone }: { item: SessionExercise; exercise: Exercise | undefined; update: (p: Partial<SessionExercise>) => void; remove: () => void; onSetDone: (rest: number) => void }) {
  const [info, setInfo] = useState(false);
  const all = useRecords(sessions);
  const prev = lastPerformance(all, item.exerciseId);

  const patchSet = (i: number, p: Partial<SetLog>) => update({ sets: item.sets.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const prevLabel = (i: number) => (prev[i] ? `${prev[i].weight != null ? `${fmtNum(prev[i].weight!)} × ` : ''}${prev[i].reps ?? '–'}` : '–');

  return (
    <section className="card stack" aria-label={exercise?.name}>
      <div className="row between top">
        <button type="button" className="row exercise-head" onClick={() => setInfo(true)}>
          <ExerciseMedia exercise={exercise} animate className="media-thumb" />
          <span>
            <strong>{exercise?.name ?? 'Loading…'}</strong>
            <small className="muted">
              {item.targetReps ? `${item.targetReps} reps · ` : ''}{item.restSec}s rest
            </small>
          </span>
        </button>
        <ConfirmIconButton label={`Remove ${exercise?.name ?? 'exercise'}`} onConfirm={remove} />
      </div>
      {item.notes && <p className="small muted">{item.notes}</p>}
      <div className="sets" role="table" aria-label={`Sets for ${exercise?.name ?? 'exercise'}`}>
        <div className="set-row set-head" role="row">
          <span role="columnheader">Set</span>
          <span role="columnheader">Previous</span>
          <span role="columnheader">kg</span>
          <span role="columnheader">Reps</span>
          <span role="columnheader"><span className="sr">Done</span></span>
        </div>
        {item.sets.map((s, i) => (
          <div className={`set-row ${s.done ? 'is-done' : ''}`} role="row" key={i}>
            <span className="num set-n" role="cell">{i + 1}</span>
            <span className="num muted small" role="cell">{prevLabel(i)}</span>
            <span role="cell"><NumberInput value={s.weight} placeholder="–" aria-label={`Set ${i + 1} weight in kg`} onChange={(weight) => patchSet(i, { weight })} /></span>
            <span role="cell"><NumberInput integer value={s.reps} placeholder="–" aria-label={`Set ${i + 1} reps`} onChange={(reps) => patchSet(i, { reps })} /></span>
            <span role="cell">
              <button
                type="button"
                className="set-check"
                aria-pressed={s.done}
                aria-label={`Set ${i + 1} done`}
                onClick={() => {
                  patchSet(i, { done: !s.done });
                  if (!s.done && item.restSec > 0) onSetDone(item.restSec);
                }}
              >
                <Icon name="check" size={18} />
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="row">
        <Button
          small
          onClick={() => {
            const last = item.sets[item.sets.length - 1];
            update({ sets: [...item.sets, { weight: last?.weight ?? null, reps: last?.reps ?? null, done: false }] });
          }}
        >
          <Icon name="plus" size={14} /> Add set
        </Button>
        {item.sets.length > 1 && <Button small variant="plain" onClick={() => update({ sets: item.sets.slice(0, -1) })}>Remove last</Button>}
      </div>
      {info && exercise && <ExerciseInfo exercise={exercise} onClose={() => setInfo(false)} />}
    </section>
  );
}

export function SessionPage() {
  const list = useRecords(activeSession);
  const session = list.find((s) => s.id === ACTIVE_ID);
  const { byId } = useExercises();
  const now = useNow();
  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [notes, setNotes] = useState('');
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);

  if (!session) {
    return (
      <Empty title="No workout in progress">
        <a href="#/workouts">Pick a routine</a>
      </Empty>
    );
  }

  const save = (p: Partial<Session>) => activeSession.put({ ...session, ...p });
  const setExercise = (i: number, p: Partial<SessionExercise>) => save({ exercises: session.exercises.map((e, j) => (j === i ? { ...e, ...p } : e)) });
  const done = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const total = session.exercises.reduce((n, e) => n + e.sets.length, 0);

  return (
    <>
      <header className="page-head session-head">
        <div>
          <input className="title-input" value={session.name} onChange={(e) => save({ name: e.target.value })} aria-label="Workout name" />
          <p className="page-sub num">{duration(now - session.startedAt)} · {done} of {total} sets</p>
        </div>
        <Button variant="primary" onClick={() => setFinishing(true)}>Finish</Button>
      </header>

      <div className="stack">
        {session.exercises.map((item, i) => (
          <ExerciseBlock
            key={`${item.exerciseId}-${i}`}
            item={item}
            exercise={byId.get(item.exerciseId)}
            update={(p) => setExercise(i, p)}
            remove={() => save({ exercises: session.exercises.filter((_, j) => j !== i) })}
            onSetDone={(sec) => setRest({ endsAt: Date.now() + sec * 1000, total: sec * 1000 })}
          />
        ))}
      </div>

      <div className="row between wrap">
        <Button onClick={() => setPicking(true)}><Icon name="plus" size={16} /> Add exercise</Button>
        <ConfirmButton
          confirmLabel="Tap again to discard"
          onConfirm={() => {
            activeSession.remove(ACTIVE_ID);
            navigate('/workouts');
          }}
        >
          Discard workout
        </ConfirmButton>
      </div>

      {rest && <RestTimer endsAt={rest.endsAt} total={rest.total} onChange={(endsAt) => setRest({ ...rest, endsAt })} onDone={() => setRest(null)} />}

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(exerciseId) => {
            save({ exercises: [...session.exercises, { exerciseId, restSec: DEFAULT_REST, sets: buildSets(exerciseId, 3, null, '') }] });
            setPicking(false);
          }}
        />
      )}

      {finishing && (
        <Sheet
          title="Finish workout?"
          onClose={() => setFinishing(false)}
          footer={
            <Button
              variant="primary"
              onClick={() => {
                const id = finishActive(session, notes.trim());
                navigate(id ? `/workouts/history/${id}` : '/workouts');
              }}
            >
              {done ? 'Save workout' : 'Close without saving'}
            </Button>
          }
        >
          <div className="stack">
            {done === 0 ? (
              <p>No sets are ticked, so nothing would be saved.</p>
            ) : (
              <p>
                {done} completed {done === 1 ? 'set' : 'sets'} will be saved.
                {total > done ? ` ${total - done} unticked ${total - done === 1 ? 'set' : 'sets'} will be dropped.` : ''}
              </p>
            )}
            {done > 0 && (
              <Field label="Notes (optional)">
                <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}

export function SessionBanner() {
  const list = useRecords(activeSession);
  const session = list.find((s) => s.id === ACTIVE_ID);
  const now = useNow();
  if (!session || window.location.hash === '#/workouts/session') return null;
  return (
    <a className="banner" href="#/workouts/session">
      <Icon name="dumbbell" size={18} />
      <span><strong>{session.name}</strong> in progress</span>
      <span className="num push">{duration(now - session.startedAt)}</span>
    </a>
  );
}
