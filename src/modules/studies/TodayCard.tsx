import { useState } from 'react';
import { useRecords } from '../../core/store';
import { toDay } from '../../core/dates';
import { Button, Icon } from '../../core/ui';
import { dayTasks, fmtMinutes, studyTasks, sumMinutes } from './data';
import { TaskRow, TaskSheet } from './tasks';

export function StudyTodayCard() {
  const today = toDay();
  const tasks = dayTasks(useRecords(studyTasks), today);
  const [adding, setAdding] = useState(false);
  const left = sumMinutes(tasks.filter((t) => !t.done));
  return (
    <section className="card stack">
      <div className="row between">
        <h2>Study</h2>
        {tasks.length > 0 && <span className="small muted num">{left ? `${fmtMinutes(left)} left` : 'All done'}</span>}
      </div>
      {tasks.length ? (
        <div>{tasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>
      ) : (
        <p className="muted">Nothing planned for today.</p>
      )}
      <div className="row wrap">
        <Button onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Plan study</Button>
        <a className="btn btn-ghost" href="#/studies">See the week</a>
      </div>
      {adding && <TaskSheet day={today} onClose={() => setAdding(false)} />}
    </section>
  );
}
