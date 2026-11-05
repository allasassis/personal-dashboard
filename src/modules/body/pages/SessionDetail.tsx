import { navigate } from '../../../core/router';
import { useRecords } from '../../../core/store';
import { duration, longDate } from '../../../core/dates';
import { Button, ConfirmButton, Empty, fmtNum, PageHead } from '../../../core/ui';
import { activeSession, isRecord, sessions, sessionSetCount, sessionVolume } from '../data';
import { ExerciseMedia, useExercises } from '../library';
import { startFromSession } from '../session-actions';

export function SessionDetailPage({ id }: { id: string }) {
  const all = useRecords(sessions);
  const hasActive = useRecords(activeSession).length > 0;
  const session = all.find((s) => s.id === id);
  const { byId } = useExercises();
  if (!session) return <Empty title="This workout no longer exists"><a href="#/workouts">Back to workouts</a></Empty>;

  return (
    <>
      <PageHead title={session.name} sub={longDate(session.startedAt)} back="/workouts" actions={<Button disabled={hasActive} onClick={() => startFromSession(session)}>Repeat</Button>} />
      <div className="stats">
        <div className="stat"><span>Duration</span><strong className="num">{duration(session.finishedAt! - session.startedAt)}</strong></div>
        <div className="stat"><span>Sets</span><strong className="num">{sessionSetCount(session)}</strong></div>
        <div className="stat"><span>Volume</span><strong className="num">{fmtNum(sessionVolume(session), 0)} kg</strong></div>
      </div>
      {session.notes && <p className="card">{session.notes}</p>}
      <div className="stack">
        {session.exercises.map((e, i) => {
          const ex = byId.get(e.exerciseId);
          return (
            <section className="card stack" key={i}>
              <div className="row">
                <ExerciseMedia exercise={ex} className="media-thumb" />
                <div>
                  <a className="strong" href={`#/workouts/exercises/${encodeURIComponent(e.exerciseId)}`}>{ex?.name ?? 'Loading…'}</a>
                  {isRecord(all, session, e.exerciseId) && <span className="tag">New best</span>}
                </div>
              </div>
              <table className="table">
                <thead><tr><th>Set</th><th>kg</th><th>Reps</th></tr></thead>
                <tbody>
                  {e.sets.map((s, j) => (
                    <tr key={j}><td className="num">{j + 1}</td><td className="num">{s.weight ?? '–'}</td><td className="num">{s.reps ?? '–'}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
      <div>
        <ConfirmButton onConfirm={() => { sessions.remove(session.id); navigate('/workouts'); }}>Delete workout</ConfirmButton>
      </div>
    </>
  );
}
