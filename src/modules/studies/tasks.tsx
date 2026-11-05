import { useState } from 'react';
import { newId } from '../../core/collection';
import { useRecords } from '../../core/store';
import { addDays, parseDay, toDay, weekStart } from '../../core/dates';
import { Button, ConfirmButton, Field, Icon, NumberInput, Sheet } from '../../core/ui';
import { fmtMinutes, notebooks, studyTasks, weekDays, type StudyTask } from './data';

const QUICK = [25, 45, 60, 90, 120];
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

export function TaskSheet({ task, day, notebookId = null, onClose }: { task?: StudyTask; day?: string; notebookId?: string | null; onClose: () => void }) {
  const books = useRecords(notebooks);
  const start = task?.date ?? day ?? toDay();
  const [title, setTitle] = useState(task?.title ?? '');
  const [book, setBook] = useState<string | null>(task?.notebookId ?? notebookId);
  const [minutes, setMinutes] = useState<number | null>(task?.minutes ?? 60);
  const [time, setTime] = useState(task?.time ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [date, setDate] = useState(start);
  const [days, setDays] = useState<string[]>([start]); // new tasks can repeat across the week
  const week = weekDays(weekStart(start));
  const canSave = !!title.trim() && !!minutes && (task ? true : days.length > 0);

  const save = () => {
    if (!canSave) return;
    const fields = {
      title: title.trim(),
      minutes: minutes!,
      notebookId: book,
      ...(time ? { time } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    if (task) studyTasks.put({ id: task.id, done: task.done, date, ...fields });
    else for (const d of days) studyTasks.put({ id: newId(), done: false, date: d, ...fields });
    onClose();
  };

  return (
    <Sheet
      title={task ? 'Edit study block' : 'Plan study'}
      onClose={onClose}
      footer={
        <>
          {task && <ConfirmButton className="push-right" onConfirm={() => { studyTasks.remove(task.id); onClose(); }}>Delete</ConfirmButton>}
          <Button variant="primary" disabled={!canSave} onClick={save}>{task ? 'Save' : days.length > 1 ? `Add ${days.length} blocks` : 'Add'}</Button>
        </>
      }
    >
      <div className="stack">
        <Field label="What will you study?">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chapter 4 exercises" autoFocus={!task} />
        </Field>
        <Field label="Notebook (optional)">
          <select className="input" value={book ?? ''} onChange={(e) => setBook(e.target.value || null)}>
            <option value="">None</option>
            {[...books].sort((a, b) => a.name.localeCompare(b.name)).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        {task ? (
          <Field label="Day">
            <input className="input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
        ) : (
          <div className="field">
            <span className="field-label">Days</span>
            <div className="day-chips" role="group" aria-label="Days">
              {week.map((d) => (
                <button type="button" key={d} className="chip" aria-pressed={days.includes(d)} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}>
                  {weekday.format(parseDay(d))}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid-2">
          <Field label="Minutes">
            <NumberInput integer value={minutes} onChange={setMinutes} />
          </Field>
          <Field label="Time (optional)">
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <div className="quick-mins" role="group" aria-label="Common durations">
          {QUICK.map((m) => <button type="button" key={m} className="chip" aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{fmtMinutes(m)}</button>)}
        </div>
        <Field label="Notes (optional)">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pages 80 to 95" />
        </Field>
      </div>
    </Sheet>
  );
}

export function TaskRow({ task, late, action }: { task: StudyTask; late?: boolean; action?: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  useRecords(notebooks);
  const book = task.notebookId ? notebooks.get(task.notebookId) : undefined;
  const meta = [task.time, fmtMinutes(task.minutes), book && !book.deleted ? book.name : null, task.notes].filter(Boolean).join(' · ');
  return (
    <div className={`task ${task.done ? 'is-done' : ''}`}>
      <button
        type="button"
        className="set-check"
        aria-pressed={task.done}
        aria-label={`${task.title} done`}
        onClick={() => studyTasks.put({ ...task, done: !task.done })}
      >
        <Icon name="check" size={18} />
      </button>
      <button type="button" className="task-main" onClick={() => setEditing(true)}>
        <strong>{task.title}</strong>
        <small className="num">{late && !task.done && <span className="task-late">Missed · </span>}{meta}</small>
      </button>
      {action}
      {editing && <TaskSheet task={task} onClose={() => setEditing(false)} />}
    </div>
  );
}

export const moveToToday = (task: StudyTask) => studyTasks.put({ ...task, date: toDay() });

export function copyWeek(fromMonday: string, toMonday: string) {
  const offset = Math.round((parseDay(toMonday).getTime() - parseDay(fromMonday).getTime()) / 864e5);
  const end = addDays(fromMonday, 6);
  for (const t of studyTasks.list()) {
    if (t.date < fromMonday || t.date > end) continue;
    studyTasks.put({ ...t, id: newId(), date: addDays(t.date, offset), done: false });
  }
}
