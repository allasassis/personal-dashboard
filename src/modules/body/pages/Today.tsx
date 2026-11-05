import { useMemo } from 'react';
import { LineChart } from '../../../core/LineChart';
import { useRecords, useSyncStatus } from '../../../core/store';
import { addDays, longDate, parseDay, toDay, weekStart } from '../../../core/dates';
import { Button, fmtNum, Icon } from '../../../core/ui';
import { ConnectForm } from '../../../settings/SettingsPage';
import { activeSession, BUILTIN_METRICS, finishedSessions, foodLog, metricEntries, routines, sessions, sumMacros, useDietSettings } from '../data';
import { DaySummary } from './Diet';
import { QuickLog } from './Metrics';
import { startEmpty, startFromRoutine } from '../session-actions';
import { StudyTodayCard } from '../../studies/TodayCard';
import { TodoTodayCard } from '../../todo/TodayCard';

export function TodayPage() {
  const status = useSyncStatus();
  const today = toDay();
  const entries = useRecords(metricEntries);
  const log = useRecords(foodLog);
  const allRoutines = useRecords(routines);
  const allSessions = useRecords(sessions);
  const active = useRecords(activeSession).length > 0;
  const settings = useDietSettings();

  const weights = useMemo(() => entries.filter((e) => e.metricId === 'weight').sort((a, b) => (a.date < b.date ? -1 : 1)), [entries]);
  const recentWeights = weights.filter((w) => w.date >= addDays(today, -60));
  const latest = weights[weights.length - 1];
  const history = finishedSessions(allSessions);
  const monday = weekStart(today);
  const thisWeek = history.filter((s) => toDay(s.startedAt) >= monday);
  const trainedToday = history.find((s) => toDay(s.startedAt) === today);
  const totals = sumMacros(log.filter((e) => e.date === today));

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{longDate(new Date())}</h1>
          <p className="page-sub num">
            {thisWeek.length} {thisWeek.length === 1 ? 'workout' : 'workouts'} this week
            {latest ? ` · ${fmtNum(latest.value)} kg` : ''}
          </p>
        </div>
      </header>

      {status.state === 'local' && (
        <section className="card stack setup">
          <div>
            <h2>Back up to your private GitHub repo</h2>
            <p className="muted">Your data is only in this browser until you connect a repo. You only need to do this once per device.</p>
          </div>
          <ConnectForm />
        </section>
      )}

      <div className="today-grid">
        <section className="card stack">
          <h2>Weight</h2>
          <QuickLog metric={BUILTIN_METRICS[0]} compact />
          {recentWeights.length > 1 && <LineChart name="Weight, last 60 days" unit="kg" height={150} points={recentWeights.map((w) => ({ x: parseDay(w.date).getTime(), y: w.value }))} />}
        </section>

        <section className="card stack">
          <div className="row between">
            <h2>Train</h2>
            {trainedToday && <a className="tag" href={`#/workouts/history/${trainedToday.id}`}>Done today</a>}
          </div>
          {active ? (
            <a className="btn btn-primary" href="#/workouts/session">Resume workout</a>
          ) : allRoutines.length ? (
            <ul className="list">
              {[...allRoutines].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 5).map((r) => (
                <li className="list-row static" key={r.id}>
                  <span className="list-main">
                    <strong>{r.name}</strong>
                    <small>{r.exercises.length} exercises</small>
                  </span>
                  <Button small disabled={!r.exercises.length} onClick={() => startFromRoutine(r)}>Start</Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Build a routine once, and start it from here each time.</p>
          )}
          {!active && (
            <div className="row wrap">
              {!allRoutines.length && <a className="btn btn-primary" href="#/workouts/routine/new"><Icon name="plus" size={16} /> New routine</a>}
              <Button onClick={startEmpty}>Empty workout</Button>
            </div>
          )}
        </section>

        <TodoTodayCard />

        <StudyTodayCard />
      </div>

      <section className="stack">
        <div className="row between">
          <h2>Eaten today</h2>
          <a className="btn btn-ghost btn-small" href="#/diet">Log food</a>
        </div>
        <DaySummary totals={totals} target={settings} />
      </section>
    </>
  );
}
