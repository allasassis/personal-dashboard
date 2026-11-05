import { useEffect, useRef, useState } from 'react';
import { newId } from '../../../core/collection';
import { navigate } from '../../../core/router';
import { useRecords } from '../../../core/store';
import { fullDate } from '../../../core/dates';
import { Button, ConfirmButton, Empty, Icon, PageHead } from '../../../core/ui';
import { notebooks, notes } from '../data';
import { Markdown } from '../markdown';

const SAVE_DELAY = 500;

const TOOLS: { label: string; aria: string; wrap?: [string, string]; line?: string }[] = [
  { label: 'H', aria: 'Heading', line: '## ' },
  { label: 'B', aria: 'Bold', wrap: ['**', '**'] },
  { label: 'I', aria: 'Italic', wrap: ['*', '*'] },
  { label: '•', aria: 'Bulleted list', line: '- ' },
  { label: '1.', aria: 'Numbered list', line: '1. ' },
  { label: '☐', aria: 'Checklist', line: '- [ ] ' },
  { label: '“', aria: 'Quote', line: '> ' },
  { label: '</>', aria: 'Code', wrap: ['`', '`'] },
];

export function NotePage({ notebookId, noteId }: { notebookId: string; noteId: string }) {
  const isNew = noteId === 'new';
  const [id] = useState(() => (isNew ? newId() : noteId));
  const books = useRecords(notebooks);
  const allNotes = useRecords(notes);
  const stored = allNotes.find((n) => n.id === id);
  const missing = !isNew && !stored;

  const [title, setTitle] = useState(stored?.title ?? '');
  const [body, setBody] = useState(stored?.body ?? '');
  const [editing, setEditing] = useState(isNew || !(stored?.body || stored?.title));
  const textarea = useRef<HTMLTextAreaElement>(null);

  // While reading, show changes that arrive from another device. While typing, your text stays.
  if (!editing && stored && (stored.title !== title || stored.body !== body)) {
    setTitle(stored.title);
    setBody(stored.body);
  }
  const backTo = `/studies/notebooks/${notebookId}`;

  // Always holds the latest text, for saving when leaving the page.
  const latest = useRef({ title, body });
  latest.current = { title, body };

  const save = () => {
    const { title: t, body: b } = latest.current;
    const current = notes.get(id);
    const unchanged = current ? current.title === t && current.body === b && !current.deleted : !t.trim() && !b.trim();
    if (unchanged || current?.deleted) return;
    notes.put({ id, notebookId, title: t, body: b, pinned: current?.pinned ?? false, createdAt: current?.createdAt ?? Date.now() });
    // Make a reload open this note instead of starting another blank one.
    if (isNew) window.history.replaceState(null, '', `#${backTo}/${id}`);
  };

  useEffect(() => {
    const t = setTimeout(save, SAVE_DELAY);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') save();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      save();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (missing || !books.some((b) => b.id === notebookId)) {
    return <Empty title="This note no longer exists"><a href={`#${backTo}`}>Back to the notebook</a></Empty>;
  }

  const apply = (tool: (typeof TOOLS)[number]) => {
    const el = textarea.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    let next: string;
    let caretStart: number;
    let caretEnd: number;
    if (tool.wrap) {
      const [a, b] = tool.wrap;
      next = body.slice(0, start) + a + body.slice(start, end) + b + body.slice(end);
      caretStart = start + a.length;
      caretEnd = end + a.length;
    } else {
      const lineStart = body.lastIndexOf('\n', start - 1) + 1;
      next = body.slice(0, lineStart) + tool.line + body.slice(lineStart);
      caretStart = start + tool.line!.length;
      caretEnd = end + tool.line!.length;
    }
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caretStart, caretEnd);
    });
  };

  return (
    <>
      <PageHead
        title={<span className="sr">{title || 'Note'}</span>}
        back={backTo}
        actions={
          <>
            {stored && (
              <Button aria-pressed={!!stored.pinned} onClick={() => notes.put({ ...stored, pinned: !stored.pinned })}>
                <Icon name="pin" size={16} /> {stored.pinned ? 'Pinned' : 'Pin'}
              </Button>
            )}
            <Button variant={editing ? 'primary' : 'ghost'} onClick={() => { save(); setEditing(!editing); }}>{editing ? 'Done' : 'Edit'}</Button>
          </>
        }
      />
      {editing ? (
        <>
          <input className="note-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" autoFocus={!title} />
          <div className="note-bar" role="toolbar" aria-label="Formatting">
            {TOOLS.map((t) => (
              // Keep the text selected while tapping the button.
              <button type="button" key={t.aria} aria-label={t.aria} title={t.aria} onMouseDown={(e) => e.preventDefault()} onClick={() => apply(t)}>{t.label}</button>
            ))}
          </div>
          <textarea ref={textarea} className="note-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your notes. Markdown works: # heading, **bold**, - lists, | tables |" aria-label="Note text" />
        </>
      ) : (
        <>
          <div>
            <p className="note-title" role="heading" aria-level={1}>{title || 'Untitled'}</p>
            {stored && <p className="small muted num">Edited {fullDate(stored.updatedAt)}</p>}
          </div>
          <Markdown source={body} />
          <div>
            <ConfirmButton onConfirm={() => { notes.remove(id); navigate(backTo); }}>Delete note</ConfirmButton>
          </div>
        </>
      )}
    </>
  );
}
