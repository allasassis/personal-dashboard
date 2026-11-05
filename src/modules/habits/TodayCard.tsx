import { useState } from 'react';
import { useRecords } from '../../core/store';
import { toDay } from '../../core/dates';
import { Button, Icon, useShortList } from '../../core/ui';
import { HabitSheet, HabitTick } from './components';
import { habits, isScheduled, sortHabits, useChecks, type Habit } from './data';

export function HabitsTodayCard() {
  const today = toDay();
  const all = useRecords(habits);
  const checksFor = useChecks();
  const [adding, setAdding] = useState(false);
  const items = sortHabits(all).filter((h) => isScheduled(h, today) || checksFor(h.id).has(today));
  const left = items.filter((h) => !checksFor(h.id).has(today)).length;
  const { shown, more } = useShortList(items, 5, (h: Habit) => checksFor(h.id).has(today));
  return (
    <section className="card stack">
      <div className="row between">
        <h2>Habits</h2>
        <a className="small muted" href="#/habits">{left ? `${left} left · ` : items.length ? 'All done · ' : ''}See all</a>
      </div>
      {items.length ? (
        <div>{shown.map((h) => <HabitTick key={h.id} habit={h} done={checksFor(h.id)} />)}</div>
      ) : (
        <p className="muted">{all.length ? 'Nothing scheduled today.' : 'Tick off the small things you want to do regularly.'}</p>
      )}
      {more}
      {!all.length && (
        <div className="row wrap">
          <Button onClick={() => setAdding(true)}><Icon name="plus" size={16} /> New habit</Button>
        </div>
      )}
      {adding && <HabitSheet onClose={() => setAdding(false)} />}
    </section>
  );
}
