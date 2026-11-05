import { useState } from 'react';
import { useRecords } from '../../core/store';
import { toDay } from '../../core/dates';
import { Button, Empty, Icon, PageHead } from '../../core/ui';
import { habitMeta, HabitSheet, WeekStrip } from './components';
import { habits, isScheduled, sortHabits, useChecks } from './data';

export function HabitsPage() {
  const all = sortHabits(useRecords(habits));
  const checksFor = useChecks();
  const [adding, setAdding] = useState(false);
  const today = toDay();
  const dueToday = all.filter((h) => isScheduled(h, today) || checksFor(h.id).has(today));
  const doneToday = dueToday.filter((h) => checksFor(h.id).has(today)).length;

  return (
    <>
      <PageHead
        title="Habits"
        sub={dueToday.length ? `${doneToday} of ${dueToday.length} done today` : undefined}
        actions={<Button variant={all.length ? 'ghost' : 'primary'} onClick={() => setAdding(true)}><Icon name="plus" size={16} /> New habit</Button>}
      />
      {all.length ? (
        <section className="card flush">
          {all.map((h) => (
            <div className="habit-row" key={h.id}>
              <a className="habit-main" href={`#/habits/${h.id}`}>
                <strong>{h.name}</strong>
                <small className="num">{habitMeta(h, checksFor(h.id), today)}</small>
              </a>
              <WeekStrip habit={h} done={checksFor(h.id)} />
            </div>
          ))}
        </section>
      ) : (
        <Empty title="No habits yet">Add something small you want to do regularly, then tick it off each day.</Empty>
      )}
      {adding && <HabitSheet onClose={() => setAdding(false)} />}
    </>
  );
}
