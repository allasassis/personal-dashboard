import { useMemo, useState } from 'react';
import { useRecords } from '../../../core/store';
import { fullDate } from '../../../core/dates';
import { Button, ConfirmButton, Empty, Icon, PageHead } from '../../../core/ui';
import { BookCover, CoverImage, NotebookSheet } from '../covers';
import { deleteNotebook, excerpt, notebooks, notes, type Note } from '../data';
import { TaskSheet } from '../tasks';

const matches = (n: Note, words: string[]) => {
  const text = `${n.title} ${n.body}`.toLowerCase();
  return words.every((w) => text.includes(w));
};

const sortNotes = (list: Note[]) => [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);

function NoteRow({ note, showBook }: { note: Note; showBook?: boolean }) {
  const book = notebooks.get(note.notebookId);
  const text = excerpt(note.body);
  return (
    <li>
      <a className="note-row" href={`#/studies/notebooks/${note.notebookId}/${note.id}`}>
        <strong>{note.pinned && <><Icon name="pin" size={14} /><span className="sr">Pinned: </span></>}{note.title || 'Untitled'}</strong>
        {text && <span>{text}</span>}
        <small className="num">{showBook && book ? `${book.name} · ` : ''}{fullDate(note.updatedAt)}</small>
      </a>
    </li>
  );
}

const SearchBox = ({ value, onChange, label }: { value: string; onChange: (s: string) => void; label: string }) => (
  <div className="search">
    <Icon name="search" size={18} />
    <input className="input" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={label} aria-label={label} />
  </div>
);

export function NotebooksPage() {
  const books = useRecords(notebooks);
  const allNotes = useRecords(notes);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const live = useMemo(() => allNotes.filter((n) => books.some((b) => b.id === n.notebookId)), [allNotes, books]);
  const found = words.length ? sortNotes(live.filter((n) => matches(n, words))) : [];
  const count = (id: string) => live.filter((n) => n.notebookId === id).length;

  return (
    <>
      <PageHead title="Notebooks" actions={<Button variant={books.length ? 'ghost' : 'primary'} onClick={() => setAdding(true)}><Icon name="plus" size={16} /> New notebook</Button>} />
      {books.length > 0 && <SearchBox value={query} onChange={setQuery} label="Search all notes" />}
      {words.length ? (
        found.length ? <ul className="list card flush">{found.map((n) => <NoteRow key={n.id} note={n} showBook />)}</ul> : <Empty title="No notes match" />
      ) : (
        <div className="notebook-grid">
          {[...books].sort((a, b) => a.name.localeCompare(b.name)).map((b) => (
            <a key={b.id} className="notebook-tile" href={`#/studies/notebooks/${b.id}`}>
              <BookCover notebook={b} />
              <small className="num">{count(b.id)} {count(b.id) === 1 ? 'note' : 'notes'}</small>
            </a>
          ))}
        </div>
      )}
      {!books.length && <Empty title="No notebooks yet">Make one per subject, and pick a cover for it.</Empty>}
      {adding && <NotebookSheet onClose={() => setAdding(false)} />}
    </>
  );
}

export function NotebookPage({ id }: { id: string }) {
  const books = useRecords(notebooks);
  const allNotes = useRecords(notes);
  const book = books.find((b) => b.id === id);
  const [editing, setEditing] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [query, setQuery] = useState('');
  if (!book) return <Empty title="This notebook no longer exists"><a href="#/studies/notebooks">All notebooks</a></Empty>;

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const own = allNotes.filter((n) => n.notebookId === id);
  const shown = sortNotes(own.filter((n) => matches(n, words)));

  return (
    <>
      <div className="cover cover-banner"><CoverImage notebook={book} /></div>
      <PageHead
        title={book.name}
        sub={book.description}
        back="/studies/notebooks"
        actions={<a className="btn btn-primary" href={`#/studies/notebooks/${id}/new`}><Icon name="plus" size={16} /> New note</a>}
      />
      <div className="row wrap">
        <Button small onClick={() => setPlanning(true)}><Icon name="calendar" size={14} /> Plan study</Button>
        <Button small onClick={() => setEditing(true)}><Icon name="image" size={14} /> Edit & cover</Button>
      </div>
      {own.length > 2 && <SearchBox value={query} onChange={setQuery} label="Search this notebook" />}
      {shown.length ? (
        <ul className="list card flush">{shown.map((n) => <NoteRow key={n.id} note={n} />)}</ul>
      ) : (
        <Empty title={own.length ? 'No notes match' : 'No notes yet'} />
      )}
      <div>
        <ConfirmButton confirmLabel={own.length ? `Tap again: deletes ${own.length} ${own.length === 1 ? 'note' : 'notes'}` : 'Tap again to delete'} onConfirm={() => { deleteNotebook(id); window.location.hash = '/studies/notebooks'; }}>
          Delete notebook
        </ConfirmButton>
      </div>
      {editing && <NotebookSheet notebook={book} onClose={() => setEditing(false)} />}
      {planning && <TaskSheet notebookId={id} onClose={() => setPlanning(false)} />}
    </>
  );
}
