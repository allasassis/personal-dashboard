import { useState, type FormEvent } from 'react';
import { newId } from '../../core/collection';
import { addDays, longDate, parseDay, toDay } from '../../core/dates';
import { navigate } from '../../core/router';
import { Button, ConfirmButton, Field, Icon, Sheet } from '../../core/ui';
import { currentStreak, DAY_NAMES, deleteHabit, EVERY_DAY, habits, isScheduled, scheduleLabel, toggleCheck, WEEK_ORDER, WEEKDAYS, type Habit } from './data';

export function HabitSheet({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const [name, setName] = useState(habit?.name ?? '');
  const [days, setDays] = useState(habit?.days ?? EVERY_DAY);
  const valid = name.trim() !== '' && days.length > 0;
  const same = (list: number[]) => days.length === list.length && list.every((d) => days.includes(d));

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    habits.put({ id: habit?.id ?? newId(), name: name.trim(), days: [...days].sort(), createdAt: habit?.createdAt ?? Date.now() });
    onClose();
  };

  return (
    <Sheet
      title={habit ? 'Edit habit' : 'New habit'}
      onClose={onClose}
      footer={
        <>
          {habit && (
            <ConfirmButton className="push-right" confirmLabel="Tap again: deletes its history" onConfirm={() => { deleteHabit(habit.id); onClose(); navigate('/habits'); }}>
              Delete
            </ConfirmButton>
          )}
          <Button variant="primary" type="submit" form="habit-form" disabled={!valid}>Save</Button>
        </>
      }
    >
      <form id="habit-form" className="stack" onSubmit={save}>
        <Field label="Habit">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Read 20 minutes" autoFocus={!habit} />
        </Field>
        <div className="field">
          <span className="field-label">Repeat on</span>
          <div className="stack">
            <div className="chips">
              <button type="button" className="chip" aria-pressed={same(EVERY_DAY)} onClick={() => setDays(EVERY_DAY)}>Every day</button>
              <button type="button" className="chip" aria-pressed={same(WEEKDAYS)} onClick={() => setDays(WEEKDAYS)}>Weekdays</button>
            </div>
            <div className="day-chips" role="group" aria-label="Days">
              {WEEK_ORDER.map((d) => (
                <button type="button" key={d} className="chip" aria-pressed={days.includes(d)} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}>
                  {DAY_NAMES[d]}
                </button>
              ))}
            </div>
          </div>
          {!days.length && <span className="field-hint">Pick at least one day.</span>}
        </div>
      </form>
    </Sheet>
  );
}

export function habitMeta(habit: Habit, done: Set<string>, today: string) {
  const streak = currentStreak(habit, done, today);
  return streak ? `${streak} in a row · ${scheduleLabel(habit.days)}` : scheduleLabel(habit.days);
}

export function DayButton({ habit, done, day, label, today }: { habit: Habit; done: Set<string>; day: string; label: string; today: string }) {
  const on = done.has(day);
  const off = !isScheduled(habit, day);
  return (
    <button
      type="button"
      className={`habit-day ${off ? 'is-off' : ''} ${day === today ? 'is-today' : ''}`}
      aria-pressed={on}
      aria-label={`${habit.name}, ${longDate(parseDay(day))}${off ? ', not scheduled' : ''}`}
      title={longDate(parseDay(day))}
      disabled={day > today}
      onClick={() => toggleCheck(habit.id, day, on)}
    >
      {label}
    </button>
  );
}

/** The last seven days, ending today, so a day you forgot is one tap away. */
export function WeekStrip({ habit, done }: { habit: Habit; done: Set<string> }) {
  const today = toDay();
  return (
    <div className="week-strip" role="group" aria-label={`${habit.name}, last 7 days`}>
      {Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((day) => (
        <DayButton key={day} habit={habit} done={done} day={day} today={today} label={DAY_NAMES[parseDay(day).getDay()][0]} />
      ))}
    </div>
  );
}

/** A compact row for the Today page: just today's tick. */
export function HabitTick({ habit, done }: { habit: Habit; done: Set<string> }) {
  const today = toDay();
  const on = done.has(today);
  return (
    <div className={`task ${on ? 'is-done' : ''}`}>
      <button type="button" className="set-check" aria-pressed={on} aria-label={`${habit.name} done`} onClick={() => toggleCheck(habit.id, today, on)}>
        <Icon name="check" size={18} />
      </button>
      <a className="task-main" href={`#/habits/${habit.id}`}>
        <strong>{habit.name}</strong>
        <small className="num">{habitMeta(habit, done, today)}</small>
      </a>
    </div>
  );
}
