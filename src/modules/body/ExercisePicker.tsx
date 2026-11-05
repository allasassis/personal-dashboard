import { useMemo, useState } from 'react';
import { newId } from '../../core/collection';
import { Button, Empty, Field, Icon, Sheet } from '../../core/ui';
import { customExercises } from './data';
import { capitalize, EQUIPMENT, ExerciseMedia, MUSCLES, useExercises, type Exercise } from './library';

const PAGE = 40;

export function useFilteredExercises(query: string, muscle: string, equipment: string) {
  const { all, loading, error } = useExercises();
  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((e) => {
      if (muscle && !e.primary.includes(muscle)) return false;
      if (equipment && e.equipment !== equipment) return false;
      const name = e.name.toLowerCase();
      return words.every((w) => name.includes(w));
    });
  }, [all, query, muscle, equipment]);
  return { results, loading, error };
}

export function ExerciseFilters({ query, setQuery, muscle, setMuscle, equipment, setEquipment }: { query: string; setQuery: (s: string) => void; muscle: string; setMuscle: (s: string) => void; equipment: string; setEquipment: (s: string) => void }) {
  return (
    <div className="filters">
      <div className="search">
        <Icon name="search" size={18} />
        <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercises" aria-label="Search exercises" />
      </div>
      <select className="input" value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label="Filter by muscle">
        <option value="">All muscles</option>
        {MUSCLES.map((m) => (
          <option key={m} value={m}>
            {capitalize(m)}
          </option>
        ))}
      </select>
      <select className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)} aria-label="Filter by equipment">
        <option value="">All equipment</option>
        {EQUIPMENT.map((m) => (
          <option key={m} value={m}>
            {capitalize(m)}
          </option>
        ))}
      </select>
    </div>
  );
}

export const exerciseMeta = (e: Exercise) => [e.primary.map(capitalize).join(', '), capitalize(e.equipment)].filter(Boolean).join(' · ');

export function CustomExerciseForm({ initialName = '', onSaved, onCancel }: { initialName?: string; onSaved: (id: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState('chest');
  const [equipment, setEquipment] = useState('barbell');
  const [gifUrl, setGifUrl] = useState('');
  const validGif = !gifUrl.trim() || /^https:\/\//.test(gifUrl.trim());
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || !validGif) return;
        const id = `custom-${newId()}`;
        customExercises.put({ id, name: name.trim(), primary: [muscle], equipment, ...(gifUrl.trim() ? { gifUrl: gifUrl.trim() } : {}) });
        onSaved(id);
      }}
    >
      <Field label="Name">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <div className="grid-2">
        <Field label="Main muscle">
          <select className="input" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {capitalize(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Equipment">
          <select className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
            {EQUIPMENT.map((m) => (
              <option key={m} value={m}>
                {capitalize(m)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="GIF or image link (optional)" hint={validGif ? 'Any https:// link to a GIF or image.' : 'The link has to start with https://'}>
        <input className="input" value={gifUrl} onChange={(e) => setGifUrl(e.target.value)} placeholder="https://…/exercise.gif" inputMode="url" />
      </Field>
      <div className="row">
        <Button variant="primary" type="submit" disabled={!name.trim() || !validGif}>
          Create exercise
        </Button>
        <Button variant="plain" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ExercisePicker({ onPick, onClose, title = 'Add exercise' }: { onPick: (id: string) => void; onClose: () => void; title?: string }) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [creating, setCreating] = useState(false);
  const { results, loading, error } = useFilteredExercises(query, muscle, equipment);

  return (
    <Sheet title={creating ? 'New exercise' : title} onClose={onClose}>
      {creating ? (
        <CustomExerciseForm initialName={query} onSaved={onPick} onCancel={() => setCreating(false)} />
      ) : (
        <div className="stack">
          <ExerciseFilters {...{ query, setQuery, muscle, setMuscle, equipment, setEquipment }} />
          {loading && <p className="muted">Loading exercises…</p>}
          {error && <p className="notice notice-bad">Could not load the exercise library. You can still create your own.</p>}
          <ul className="list">
            {results.slice(0, limit).map((e) => (
              <li key={e.id}>
                <button type="button" className="list-row" onClick={() => onPick(e.id)}>
                  <ExerciseMedia exercise={e} className="media-thumb" />
                  <span className="list-main">
                    <strong>{e.name}</strong>
                    <small>{exerciseMeta(e)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!loading && !results.length && <Empty title="No exercises match" />}
          {results.length > limit && <Button onClick={() => setLimit(limit + PAGE)}>Show more ({results.length - limit} left)</Button>}
          <Button onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> Create your own exercise
          </Button>
        </div>
      )}
    </Sheet>
  );
}
