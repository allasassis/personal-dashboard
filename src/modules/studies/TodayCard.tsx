import { useState } from 'react';
import { useRecords } from '../../core/store';
import { toDay } from '../../core/dates';
import { Button, Icon, useShortList } from '../../core/ui';
import { dayTasks, fmtMinutes, studyTasks, sumMinutes, type StudyTask } from './data';
import { TaskRow, TaskSheet } from './tasks';

const isDone = (t: StudyTask) => t.done;

export function StudyTodayCard() {
  const today = toDay();
  const tasks = dayTasks(useRecords(studyTasks), today);
  const [adding, setAdding] = useState(false);
  const left = sumMinutes(tasks.filter((t) => !t.done));
  const { shown, more } = useShortList(tasks, 4, isDone);
  return (
    <section className="card stack">
      <div className="row between">
        <h2>Study</h2>
        <a className="small muted num" href="#/studies">
          {tasks.length ? `${left ? `${fmtMinutes(left)} left` : 'All done'} · ` : ''}See the week
        </a>
      </div>
      {tasks.length ? <div>{shown.map((t) => <TaskRow key={t.id} task={t} />)}</div> : <p className="muted">Nothing planned for today.</p>}
      {more}
      <div className="row wrap">
        <Button onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Plan study</Button>
      </div>
      {adding && <TaskSheet day={today} onClose={() => setAdding(false)} />}
    </section>
  );
}
