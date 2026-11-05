import { useMemo, useState } from 'react';
import { useRecords } from '../../../core/store';
import { addDays, parseDay, shortDate, toDay, weekStart } from '../../../core/dates';
import { Button, Empty, Icon, IconButton, PageHead } from '../../../core/ui';
import { dayTasks, fmtMinutes, notebooks, studyTasks, sumMinutes, weekDays, type StudyTask } from '../data';
import { copyWeek, moveToToday, TaskRow, TaskSheet } from '../tasks';

const dayName = new Intl.DateTimeFormat(undefined, { weekday: 'long' });
const LEFTOVER_DAYS = 28;

function ByNotebook({ tasks }: { tasks: StudyTask[] }) {
  useRecords(notebooks);
  const rows = useMemo(() => {
    const groups = new Map<string, { planned: number; done: number }>();
    for (const t of tasks) {
      const book = t.notebookId ? notebooks.get(t.notebookId) : undefined;
      const name = book && !book.deleted ? book.name : 'No notebook';
      const g = groups.get(name) ?? { planned: 0, done: 0 };
      g.planned += t.minutes;
      if (t.done) g.done += t.minutes;
      groups.set(name, g);
    }
    return [...groups.entries()].sort((a, b) => b[1].planned - a[1].planned);
  }, [tasks]);
  const max = Math.max(...rows.map(([, g]) => g.planned));
  if (rows.length < 2) return null;
  return (
    <div className="stack" role="list" aria-label="Time by notebook">
      {rows.map(([name, g]) => (
        <div className="bar-row" role="listitem" key={name}>
          <span title={name}>{name}</span>
          <div className="bar-track" aria-hidden="true">
            <div className="bar-planned" style={{ width: `${(g.planned / max) * 100}%` }} />
            <div className="bar-done" style={{ width: `${(g.done / max) * 100}%` }} />
          </div>
          <span className="num muted">{fmtMinutes(g.done)} / {fmtMinutes(g.planned)}</span>
        </div>
      ))}
    </div>
  );
}

export function WeekPage() {
  const today = toDay();
  const thisWeek = weekStart(today);
  const [monday, setMonday] = useState(thisWeek);
  const [addingOn, setAddingOn] = useState<string | null>(null);
  const all = useRecords(studyTasks);

  const days = weekDays(monday);
  const sunday = days[6];
  const inWeek = all.filter((t) => t.date >= monday && t.date <= sunday);
  const planned = sumMinutes(inWeek);
  const done = sumMinutes(inWeek.filter((t) => t.done));
  const previous = addDays(monday, -7);
  const canCopy = !inWeek.length && all.some((t) => t.date >= previous && t.date < monday);
  const leftovers = monday === thisWeek ? all.filter((t) => !t.done && t.date < thisWeek && t.date >= addDays(today, -LEFTOVER_DAYS)).sort((a, b) => a.date.localeCompare(b.date)) : [];

  return (
    <>
      <PageHead
        title="Study week"
        actions={<Button variant="primary" onClick={() => setAddingOn(today >= monday && today <= sunday ? today : monday)}><Icon name="plus" size={16} /> Plan study</Button>}
      />
      <div className="row week-nav">
        <IconButton icon="left" label="Previous week" onClick={() => setMonday(addDays(monday, -7))} />
        <strong className="num">{shortDate(parseDay(monday))} – {shortDate(parseDay(sunday))}</strong>
        <IconButton icon="right" label="Next week" onClick={() => setMonday(addDays(monday, 7))} />
        {monday !== thisWeek && <Button small onClick={() => setMonday(thisWeek)}>This week</Button>}
      </div>

      {inWeek.length > 0 && (
        <section className="card stack">
          <div className="stats">
            <div className="stat"><span>Done</span><strong className="num">{fmtMinutes(done)}</strong></div>
            <div className="stat"><span>Planned</span><strong className="num">{fmtMinutes(planned)}</strong></div>
            <div className="stat"><span>Blocks</span><strong className="num">{inWeek.filter((t) => t.done).length} of {inWeek.length}</strong></div>
          </div>
          <div className="meter-track" role="progressbar" aria-label="Planned time completed" aria-valuemin={0} aria-valuemax={planned} aria-valuenow={done}>
            <div className="meter-fill" style={{ width: `${planned ? (done / planned) * 100 : 0}%`, background: 'var(--series-1)' }} />
          </div>
          <ByNotebook tasks={inWeek} />
        </section>
      )}

      {canCopy && (
        <Empty title="Nothing planned this week yet">
          <Button onClick={() => copyWeek(previous, monday)}>Copy the previous week's plan</Button>
        </Empty>
      )}

      {leftovers.length > 0 && (
        <section className="card">
          <h3>Left over from earlier</h3>
          {leftovers.map((t) => (
            <TaskRow key={t.id} task={t} late action={<Button small onClick={() => moveToToday(t)}>Move to today</Button>} />
          ))}
        </section>
      )}

      <div className="stack">
        {days.map((d) => {
          const tasks = dayTasks(all, d);
          return (
            <section key={d} className={`card day ${d === today ? 'is-today' : ''} ${tasks.length ? '' : 'is-empty'}`} aria-label={dayName.format(parseDay(d))}>
              <div className="day-head">
                <h3>{dayName.format(parseDay(d))} <span className="muted num">{shortDate(parseDay(d))}</span></h3>
                {tasks.length > 0 && <span className="day-total num">{fmtMinutes(sumMinutes(tasks))}</span>}
                <IconButton icon="plus" label={`Plan study on ${dayName.format(parseDay(d))}`} className={tasks.length ? '' : 'push'} onClick={() => setAddingOn(d)} />
              </div>
              {tasks.map((t) => <TaskRow key={t.id} task={t} late={d < today} />)}
            </section>
          );
        })}
      </div>

      {addingOn && <TaskSheet day={addingOn} onClose={() => setAddingOn(null)} />}
    </>
  );
}
