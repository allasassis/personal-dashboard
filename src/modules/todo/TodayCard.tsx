import { useRecords } from '../../core/store';
import { toDay } from '../../core/dates';
import { useShortList } from '../../core/ui';
import { QuickAdd, TodoRow } from './components';
import { sortTodos, todos, type Todo } from './data';

const isDone = (t: Todo) => t.done;

export function TodoTodayCard() {
  const today = toDay();
  const all = useRecords(todos);
  // Items ticked today stay visible, so a mistaken tick is easy to undo.
  const items = sortTodos(all.filter((t) => t.due && t.due <= today && (!t.done || (t.doneAt && toDay(t.doneAt) === today))));
  const left = items.filter((t) => !t.done).length;
  const { shown, more } = useShortList(items, 6, isDone);
  return (
    <section className="card stack">
      <div className="row between">
        <h2>To-do</h2>
        <a className="small muted" href="#/todo">{left ? `${left} left · ` : ''}See all</a>
      </div>
      {items.length ? <div>{shown.map((t) => <TodoRow key={t.id} todo={t} hideToday />)}</div> : <p className="muted">Nothing due today.</p>}
      {more}
      <QuickAdd due={today} placeholder="Add for today, or say when" />
    </section>
  );
}
