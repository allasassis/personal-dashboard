import { useState } from 'react';
import { useRecords } from '../../core/store';
import { toDay } from '../../core/dates';
import { Button, Empty, IconButton, PageHead } from '../../core/ui';
import { DayButton, HabitSheet } from './components';
import { bestStreak, completion, currentStreak, DAY_NAMES, habits, scheduleLabel, useChecks, WEEK_ORDER, type Habit } from './data';

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const pad = (n: number) => String(n).padStart(2, '0');

function Month({ habit, done }: { habit: Habit; done: Set<string> }) {
  const today = toDay();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const first = new Date(cursor.year, cursor.month, 1);
  const length = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const blanks = (first.getDay() + 6) % 7;
  const prefix = `${cursor.year}-${pad(cursor.month + 1)}`;
  const move = (by: number) => {
    const d = new Date(cursor.year, cursor.month + by, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <section className="card stack month">
      <div className="row between date-nav">
        <IconButton icon="left" label="Previous month" onClick={() => move(-1)} />
        <strong>{monthFormat.format(first)}</strong>
        <IconButton icon="right" label="Next month" disabled={prefix >= today.slice(0, 7)} onClick={() => move(1)} />
      </div>
      <div className="month-grid">
        {WEEK_ORDER.map((d) => <span className="month-head" key={d}>{DAY_NAMES[d]}</span>)}
        {Array.from({ length: blanks }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length }, (_, i) => (
          <DayButton key={i} habit={habit} done={done} day={`${prefix}-${pad(i + 1)}`} today={today} label={String(i + 1)} />
        ))}
      </div>
      <p className="small muted">Tap a day to mark or unmark it. Days with no outline aren't on the schedule, but still count if you tick them.</p>
    </section>
  );
}

export function HabitDetailPage({ id }: { id: string }) {
  const habit = useRecords(habits).find((h) => h.id === id);
  const checksFor = useChecks();
  const [editing, setEditing] = useState(false);
  if (!habit) return <Empty title="Habit not found"><a href="#/habits">All habits</a></Empty>;

  const today = toDay();
  const done = checksFor(habit.id);
  const { hit, due } = completion(habit, done, today);

  return (
    <>
      <PageHead title={habit.name} back="/habits" sub={scheduleLabel(habit.days)} actions={<Button onClick={() => setEditing(true)}>Edit</Button>} />
      <section className="card stats num">
        <div className="stat"><span>Current streak</span><strong>{currentStreak(habit, done, today)}</strong></div>
        <div className="stat"><span>Best streak</span><strong>{bestStreak(habit, done, today)}</strong></div>
        <div className="stat">
          <span>Last 30 days</span>
          <strong>{due ? `${Math.round((hit / due) * 100)}%` : '–'}</strong>
          {due > 0 && <small className="muted">{hit} of {due} scheduled days</small>}
        </div>
      </section>
      <Month habit={habit} done={done} />
      {editing && <HabitSheet habit={habit} onClose={() => setEditing(false)} />}
    </>
  );
}
