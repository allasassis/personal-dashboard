import { useState } from 'react';
import { navigate } from '../../../core/router';
import { useRecords } from '../../../core/store';
import { fullDate, duration } from '../../../core/dates';
import { Button, Empty, fmtNum, Icon, PageHead, Segmented } from '../../../core/ui';
import { activeSession, finishedSessions, routines, sessions, sessionSetCount, sessionVolume, type Routine } from '../data';
import { ExerciseMedia, useExercises } from '../library';
import { startEmpty, startFromRoutine } from '../session-actions';

export function RoutineCard({ routine }: { routine: Routine }) {
  const { byId } = useExercises();
  const active = useRecords(activeSession).length > 0;
  return (
    <article className="card routine-card">
      <div className="routine-thumbs" aria-hidden="true">
        {routine.exercises.slice(0, 4).map((e) => (
          <ExerciseMedia key={e.exerciseId} exercise={byId.get(e.exerciseId)} className="media-thumb" />
        ))}
      </div>
      <div className="routine-info">
        <a href={`#/workouts/routine/${routine.id}`} className="routine-name">
          {routine.name || 'Untitled'}
        </a>
        <p className="muted small">{routine.exercises.map((e) => byId.get(e.exerciseId)?.name ?? '…').join(', ') || 'No exercises yet'}</p>
      </div>
      <div className="row">
        <Button variant="primary" small disabled={active || !routine.exercises.length} onClick={() => startFromRoutine(routine)}>
          Start
        </Button>
        <a className="btn btn-ghost btn-small" href={`#/workouts/routine/${routine.id}`}>
          Edit
        </a>
      </div>
    </article>
  );
}

export function WorkoutsPage() {
  const [tab, setTab] = useState<'routines' | 'history'>('routines');
  const list = useRecords(routines);
  const history = finishedSessions(useRecords(sessions));
  const active = useRecords(activeSession).length > 0;
  const { byId } = useExercises();

  return (
    <>
      <PageHead
        title="Workouts"
        actions={
          <>
            <a className="btn btn-ghost" href="#/workouts/exercises">
              Exercises
            </a>
            {!active && <Button onClick={startEmpty}>Empty workout</Button>}
          </>
        }
      />
      <Segmented
        label="View"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'routines', label: 'Routines' },
          { value: 'history', label: `History${history.length ? ` (${history.length})` : ''}` },
        ]}
      />
      {tab === 'routines' ? (
        <>
          <div className="cards">{[...list].sort((a, b) => a.name.localeCompare(b.name)).map((r) => <RoutineCard key={r.id} routine={r} />)}</div>
          {!list.length && <Empty title="No routines yet">A routine is a saved list of exercises, like “Push A”. Build one, then start it whenever you train.</Empty>}
          <div>
            <Button variant={list.length ? 'ghost' : 'primary'} onClick={() => navigate('/workouts/routine/new')}>
              <Icon name="plus" size={16} /> New routine
            </Button>
          </div>
        </>
      ) : history.length ? (
        <ul className="list card flush">
          {history.map((s) => (
            <li key={s.id}>
              <a className="list-row" href={`#/workouts/history/${s.id}`}>
                <span className="list-main">
                  <strong>{s.name}</strong>
                  <small>{s.exercises.map((e) => byId.get(e.exerciseId)?.name ?? '…').join(', ')}</small>
                </span>
                <span className="list-side num">
                  <span>{fullDate(s.startedAt)}</span>
                  <small>
                    {duration(s.finishedAt! - s.startedAt)} · {sessionSetCount(s)} sets · {fmtNum(sessionVolume(s), 0)} kg
                  </small>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No workouts logged yet">Finished workouts show up here.</Empty>
      )}
    </>
  );
}
