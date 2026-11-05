import { useRecords } from '../../core/store';
import { toDay } from '../../core/dates';
import { ConfirmButton, Empty, PageHead } from '../../core/ui';
import { QuickAdd, TodoRow } from './components';
import { groupTodos, todos } from './data';

const COMPLETED_SHOWN = 50;

export function TodoPage() {
  const all = useRecords(todos);
  const today = toDay();
  const groups = groupTodos(all, today);
  const open = all.filter((t) => !t.done).length;
  const completed = all.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));

  return (
    <>
      <PageHead title="To-do" sub={open ? `${open} left` : undefined} />
      <section className="card"><QuickAdd /></section>

      {groups.map((g) => (
        <section className="card" key={g.title} aria-label={g.title}>
          <div className="day-head">
            <h3>{g.title}</h3>
            <span className="day-total num">{g.items.length}</span>
          </div>
          {g.items.map((t) => <TodoRow key={t.id} todo={t} />)}
        </section>
      ))}

      {!open && <Empty title={completed.length ? 'All done' : 'Nothing to do yet'}>{completed.length ? undefined : 'Add your first to-do above.'}</Empty>}

      {completed.length > 0 && (
        <details className="card completed">
          <summary>Completed ({completed.length})</summary>
          <div className="stack">
            <div>{completed.slice(0, COMPLETED_SHOWN).map((t) => <TodoRow key={t.id} todo={t} />)}</div>
            {completed.length > COMPLETED_SHOWN && <p className="small muted">Showing the latest {COMPLETED_SHOWN}.</p>}
            <div>
              <ConfirmButton small confirmLabel={`Tap again: deletes ${completed.length}`} onConfirm={() => completed.forEach((t) => todos.remove(t.id))}>Clear completed</ConfirmButton>
            </div>
          </div>
        </details>
      )}
    </>
  );
}
