import { useMemo, useState } from 'react';
import { navigate } from '../../../core/router';
import { LineChart } from '../../../core/LineChart';
import { useRecords } from '../../../core/store';
import { fullDate } from '../../../core/dates';
import { Button, ConfirmButton, Empty, Field, fmtNum, Icon, PageHead, Sheet } from '../../../core/ui';
import { bestE1RM, customExercises, finishedSessions, sessions } from '../data';
import { ExerciseMedia, useExercises, capitalize } from '../library';
import { CustomExerciseForm, ExerciseFilters, exerciseMeta, useFilteredExercises } from '../ExercisePicker';

const PAGE = 48;

export function ExercisesPage() {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [creating, setCreating] = useState(false);
  const { results, loading, error } = useFilteredExercises(query, muscle, equipment);

  return (
    <>
      <PageHead title="Exercises" sub={loading ? undefined : `${results.length} exercises`} back="/workouts" actions={<Button onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New</Button>} />
      <ExerciseFilters {...{ query, setQuery, muscle, setMuscle, equipment, setEquipment }} />
      {error && <p className="notice notice-bad">Could not load the exercise library. Check your connection and reload.</p>}
      <div className="exercise-grid">
        {results.slice(0, limit).map((e) => (
          <a key={e.id} className="exercise-tile" href={`#/workouts/exercises/${encodeURIComponent(e.id)}`}>
            <ExerciseMedia exercise={e} className="media-tile" />
            <strong>{e.name}</strong>
            <small className="muted">{exerciseMeta(e)}</small>
          </a>
        ))}
      </div>
      {!loading && !results.length && <Empty title="No exercises match" />}
      {results.length > limit && <Button onClick={() => setLimit(limit + PAGE)}>Show more ({results.length - limit} left)</Button>}
      {creating && (
        <Sheet title="New exercise" onClose={() => setCreating(false)}>
          <CustomExerciseForm initialName={query} onCancel={() => setCreating(false)} onSaved={(id) => navigate(`/workouts/exercises/${encodeURIComponent(id)}`)} />
        </Sheet>
      )}
    </>
  );
}

export function ExerciseDetailPage({ id }: { id: string }) {
  const { byId, loading } = useExercises();
  const allSessions = useRecords(sessions);
  useRecords(customExercises);
  const ex = byId.get(id);
  const [editing, setEditing] = useState(false);
  const [gif, setGif] = useState('');
  const [notes, setNotes] = useState('');

  const history = useMemo(
    () =>
      finishedSessions(allSessions)
        .map((s) => {
          const match = s.exercises.find((e) => e.exerciseId === id);
          return match ? { date: s.startedAt, session: s, sets: match.sets, best: bestE1RM(match.sets) } : null;
        })
        .filter((x) => x !== null),
    [allSessions, id],
  );

  if (!ex) return loading ? <p className="muted">Loading…</p> : <Empty title="Exercise not found"><a href="#/workouts/exercises">All exercises</a></Empty>;

  const points = history.filter((h) => h.best > 0).map((h) => ({ x: h.date, y: Math.round(h.best * 10) / 10 })).reverse();
  const validGif = !gif.trim() || /^https:\/\//.test(gif.trim());

  const saveEdit = () => {
    if (!validGif) return;
    customExercises.put({ id, name: ex.name, equipment: ex.equipment, primary: ex.primary, ...(gif.trim() ? { gifUrl: gif.trim() } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) });
    setEditing(false);
  };

  return (
    <>
      <PageHead
        title={ex.name}
        sub={exerciseMeta(ex)}
        back="/workouts/exercises"
        actions={<Button onClick={() => { setGif(ex.gifUrl ?? ''); setNotes(ex.notes ?? ''); setEditing(true); }}>GIF & notes</Button>}
      />
      <div className="exercise-detail">
        <ExerciseMedia exercise={ex} animate className="media-hero" />
        <div className="stack">
          {ex.notes && <p className="card">{ex.notes}</p>}
          {ex.secondary && ex.secondary.length > 0 && <p className="muted small">Also works: {ex.secondary.map(capitalize).join(', ')}</p>}
          {ex.instructions && <ol className="steps">{ex.instructions.map((s) => <li key={s}>{s}</li>)}</ol>}
        </div>
      </div>

      {points.length > 0 && (
        <section className="card stack">
          <div>
            <h2>Estimated one-rep max</h2>
            <p className="muted small">Your best set each session, using the Epley formula.</p>
          </div>
          <LineChart points={points} unit="kg" name="Estimated one-rep max" />
        </section>
      )}

      {history.length > 0 && (
        <section className="card stack">
          <h2>History</h2>
          <ul className="list">
            {history.slice(0, 15).map((h) => (
              <li key={h.session.id}>
                <a className="list-row" href={`#/workouts/history/${h.session.id}`}>
                  <span className="list-main"><strong>{fullDate(h.date)}</strong><small>{h.session.name}</small></span>
                  <span className="list-side num small">{h.sets.map((s) => `${s.weight != null ? `${fmtNum(s.weight)}×` : ''}${s.reps ?? '–'}`).join('  ')}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ex.custom && (
        <div>
          <ConfirmButton onConfirm={() => { customExercises.remove(id); navigate('/workouts/exercises'); }}>Delete exercise</ConfirmButton>
        </div>
      )}

      {editing && (
        <Sheet title="GIF & notes" onClose={() => setEditing(false)} footer={<Button variant="primary" disabled={!validGif} onClick={saveEdit}>Save</Button>}>
          <div className="stack">
            <Field label="GIF or image link" hint={validGif ? 'Replaces the photos for this exercise. Leave empty to use the photos.' : 'The link has to start with https://'}>
              <input className="input" value={gif} onChange={(e) => setGif(e.target.value)} placeholder="https://…/exercise.gif" inputMode="url" />
            </Field>
            <Field label="Your notes">
              <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Grip width, machine settings…" />
            </Field>
          </div>
        </Sheet>
      )}
    </>
  );
}
