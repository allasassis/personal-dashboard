import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { newId } from '../../core/collection';
import { addDays, parseDay, shortDate, toDay } from '../../core/dates';
import { Button, ConfirmButton, Field, Icon, IconButton, Sheet } from '../../core/ui';
import { setDone, todos, type Todo } from './data';
import { parseDue } from './parseDate';

function dueOptions() {
  const today = toDay();
  return [
    { label: 'No date', value: null },
    { label: 'Today', value: today },
    { label: 'Tomorrow', value: addDays(today, 1) },
    { label: 'Next week', value: addDays(today, 7) },
  ];
}

const DueChips = ({ value, onChange, options }: { value: string | null; onChange: (d: string | null) => void; options: ReturnType<typeof dueOptions> }) => (
  <div className="quick-mins" role="group" aria-label="Due date">
    {options.map((o) => (
      <button type="button" key={o.label} className="chip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
        {o.label}
      </button>
    ))}
  </div>
);

const previewFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function dueLabelLong(due: string, today: string) {
  if (due === today) return 'Today';
  if (due === addDays(today, 1)) return 'Tomorrow';
  return previewFormat.format(parseDay(due));
}

/**
 * Stays focused after adding, so a list can be typed in one go. Dates written in the text are
 * picked up as you type and highlighted. Choosing a date by hand, or dismissing the suggestion,
 * keeps those words in the title.
 */
export function QuickAdd({ due: fixedDue, placeholder = 'Try "Call Ana friday"' }: { due?: string; placeholder?: string }) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [ignored, setIgnored] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const mirror = useRef<HTMLDivElement>(null);

  const today = toDay();
  const parsed = parseDue(text, today, { ignore: ignored });
  const due = parsed?.due ?? fixedDue ?? picked;
  const title = parsed?.title ?? text.trim();

  const syncScroll = () => {
    if (mirror.current && input.current) mirror.current.scrollLeft = input.current.scrollLeft;
  };
  useLayoutEffect(syncScroll);

  const choose = (date: string | null) => {
    if (parsed) setIgnored([...ignored, parsed.phrase]);
    setPicked(date);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title) return;
    todos.put({ id: newId(), title, due, priority: false, done: false, doneAt: null, createdAt: Date.now() });
    setText('');
    setIgnored([]);
    input.current?.focus();
  };

  return (
    <form className="stack todo-add" onSubmit={submit}>
      <div className="row">
        <div className="todo-input grow">
          <div className="todo-mirror input" ref={mirror} aria-hidden="true">
            {parsed ? (
              <>
                {text.slice(0, parsed.start)}
                <mark>{text.slice(parsed.start, parsed.end)}</mark>
                {text.slice(parsed.end)}
              </>
            ) : (
              text
            )}
          </div>
          <input ref={input} className="input" value={text} onChange={(e) => setText(e.target.value)} onScroll={syncScroll} placeholder={placeholder} aria-label="New to-do" enterKeyHint="done" autoComplete="off" />
        </div>
        <Button variant="primary" type="submit" disabled={!title}>Add</Button>
      </div>
      <div aria-live="polite">
        {parsed && (
          <p className="due-found">
            <Icon name="calendar" size={15} />
            <span>Due <strong>{dueLabelLong(parsed.due, today)}</strong></span>
            <button type="button" aria-label={`Keep "${parsed.phrase}" as text, not a date`} title="Keep as text, not a date" onClick={() => setIgnored([...ignored, parsed.phrase])}>
              <Icon name="close" size={14} />
            </button>
          </p>
        )}
      </div>
      {fixedDue === undefined && (
        <div className="due-pick">
          <DueChips value={due} onChange={choose} options={dueOptions().slice(0, 3)} />
          <input className="input due-input" type="date" value={due ?? ''} aria-label="Pick a due date" onChange={(e) => choose(e.target.value || null)} />
        </div>
      )}
    </form>
  );
}

function TodoSheet({ todo, onClose }: { todo: Todo; onClose: () => void }) {
  const [title, setTitle] = useState(todo.title);
  const [due, setDue] = useState(todo.due);
  const [notes, setNotes] = useState(todo.notes ?? '');
  const [priority, setPriority] = useState(todo.priority);

  const save = () => {
    if (!title.trim()) return;
    const { notes: _old, updatedAt: _stamp, ...rest } = todo;
    todos.put({ ...rest, title: title.trim(), due, priority, ...(notes.trim() ? { notes: notes.trim() } : {}) });
    onClose();
  };

  return (
    <Sheet
      title="Edit to-do"
      onClose={onClose}
      footer={
        <>
          <ConfirmButton className="push-right" onConfirm={() => { todos.remove(todo.id); onClose(); }}>Delete</ConfirmButton>
          <Button variant="primary" disabled={!title.trim()} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="stack">
        <Field label="To-do">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="field">
          <span className="field-label">Due date</span>
          <DueChips value={due} onChange={setDue} options={dueOptions()} />
        </div>
        <Field label="Pick a date">
          <input className="input" type="date" value={due ?? ''} onChange={(e) => setDue(e.target.value || null)} />
        </Field>
        <label className="row check-row">
          <input type="checkbox" checked={priority} onChange={(e) => setPriority(e.target.checked)} />
          High priority
        </label>
        <Field label="Notes (optional)">
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

function dueLabel(due: string, today: string) {
  if (due === today) return 'Today';
  if (due === addDays(today, 1)) return 'Tomorrow';
  if (due === addDays(today, -1)) return 'Yesterday';
  return shortDate(parseDay(due));
}

export function TodoRow({ todo, hideToday }: { todo: Todo; hideToday?: boolean }) {
  const [editing, setEditing] = useState(false);
  const today = toDay();
  const overdue = !todo.done && !!todo.due && todo.due < today;
  const meta = [todo.due && !overdue && !(hideToday && todo.due === today) ? dueLabel(todo.due, today) : null, todo.notes].filter(Boolean).join(' · ');
  return (
    <div className={`task ${todo.done ? 'is-done' : ''}`}>
      <button type="button" className="set-check" aria-pressed={todo.done} aria-label={`${todo.title} done`} onClick={() => setDone(todo, !todo.done)}>
        <Icon name="check" size={18} />
      </button>
      <button type="button" className="task-main" onClick={() => setEditing(true)}>
        <strong>{todo.title}</strong>
        {(overdue || meta) && (
          <small className="num">
            {overdue && <span className="task-late">Overdue, {dueLabel(todo.due!, today)}</span>}
            {overdue && meta ? ' · ' : ''}
            {meta}
          </small>
        )}
      </button>
      {!todo.done && (
        <IconButton
          icon="star"
          className="star"
          label={`High priority: ${todo.title}`}
          aria-pressed={todo.priority}
          onClick={() => todos.put({ ...todo, priority: !todo.priority })}
        />
      )}
      {editing && <TodoSheet todo={todo} onClose={() => setEditing(false)} />}
    </div>
  );
}
