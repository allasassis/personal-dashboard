import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

const ICONS = {
  today: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  dumbbell: 'M5 8v8M2.5 10v4M9 6v12M15 6v12M19 8v8M21.5 10v4M9 12h6',
  fork: 'M7 3v7a2 2 0 0 0 2 2v9M5 3v5M9 3v5M13 3v5M17 3c-2 1-3 4-3 7 0 2 1 3 3 3v8V3Z',
  chart: 'M4 4v16h16M8 15l3-4 3 2 5-7',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6 6 18',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  info: 'M12 8v.01M12 11v5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  sync: 'M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5',
  alert: 'M12 4 2.5 20h19L12 4ZM12 10v4M12 17v.01',
  calendar: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM4 10h16M8 3v4M16 3v4',
  book: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM9 3v18M12 8h4',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8L12 3.5Z',
  pin: 'M9 3h6l-1 7 4 4H6l4-4-1-7ZM12 14v7',
  repeat: 'M17 3l4 4-4 4M21 7H8a4 4 0 0 0-4 4v1M7 21l-4-4 4-4M3 17h13a4 4 0 0 0 4-4v-1',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15 9.5v.01',
} as const;

export type IconName = keyof typeof ICONS;

export const Icon = ({ name, size = 20 }: { name: IconName; size?: number }) => (
  <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ICONS[name]} />
  </svg>
);

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'plain'; small?: boolean };

export const Button = ({ variant = 'ghost', small, className = '', ...rest }: BtnProps) => (
  <button type="button" {...rest} className={`btn btn-${variant} ${small ? 'btn-small' : ''} ${className}`} />
);

export const IconButton = ({ icon, label, ...rest }: { icon: IconName; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" {...rest} className={`icon-btn ${rest.className ?? ''}`} aria-label={label} title={label}>
    <Icon name={icon} size={18} />
  </button>
);

/** Destructive action that takes a second tap, so a thumb slip at the gym can't delete anything. */
export function ConfirmButton({ children, confirmLabel = 'Tap again to confirm', onConfirm, ...rest }: { children: ReactNode; confirmLabel?: string; onConfirm: () => void } & Omit<BtnProps, 'onClick'>) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      variant="danger"
      {...rest}
      onClick={() => {
        if (armed) onConfirm();
        setArmed(!armed);
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}

/** Same two-tap safety for small icon buttons. */
export function ConfirmIconButton({ icon = 'trash', label, onConfirm }: { icon?: IconName; label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <IconButton
      icon={armed ? 'alert' : icon}
      label={armed ? `Tap again: ${label}` : label}
      className={armed ? 'is-armed' : ''}
      onClick={() => {
        if (armed) onConfirm();
        setArmed(!armed);
      }}
    />
  );
}

export const parseNumber = (text: string): number | null => {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(n) ? null : n;
};

/** Text input with a numeric keyboard. Accepts both "75.5" and "75,5". */
export function NumberInput({ value, onChange, placeholder, className, id, 'aria-label': ariaLabel, integer }: { value: number | null | undefined; onChange: (n: number | null) => void; placeholder?: string; className?: string; id?: string; 'aria-label'?: string; integer?: boolean }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  // Pick up outside changes, but leave half-typed text like "75," alone.
  useEffect(() => {
    if (parseNumber(text) !== (value ?? null)) setText(value == null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      id={id}
      className={`input num ${className ?? ''}`}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const next = e.target.value;
        if (!/^[\d.,]*$/.test(next)) return;
        setText(next);
        const n = parseNumber(next);
        if (n !== null || next === '') onChange(n);
      }}
    />
  );
}

export const Field = ({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) => (
  <label className="field">
    <span className="field-label">{label}</span>
    {children}
    {hint && <span className="field-hint">{hint}</span>}
  </label>
);

export const Empty = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="empty">
    <p className="empty-title">{title}</p>
    {children}
  </div>
);

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Modal built on <dialog>, which brings focus trapping and Esc. Bottom sheet on phones. */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="sheet-body">
        <header className="sheet-head">
          <h2>{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </header>
        <div className="sheet-content">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </dialog>
  );
}

export const PageHead = ({ title, back, sub, actions }: { title: ReactNode; back?: string; sub?: ReactNode; actions?: ReactNode }) => (
  <header className="page-head">
    <div className="page-title">
      {back && (
        <a className="icon-btn" href={`#${back}`} aria-label="Back">
          <Icon name="left" size={18} />
        </a>
      )}
      <div>
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>
);

/**
 * Keeps a long list on a card from pushing everything else down the page. Items already done
 * when the card opened go last, while one ticked just now stays put, so a slip is easy to undo.
 */
export function useShortList<T extends { id: string }>(items: T[], limit: number, isDone?: (item: T) => boolean) {
  const [expanded, setExpanded] = useState(false);
  const [settled] = useState(() => new Set(isDone ? items.filter(isDone).map((i) => i.id) : []));
  const ordered = [...items.filter((i) => !settled.has(i.id)), ...items.filter((i) => settled.has(i.id))];
  // Hiding a single row would only swap it for a button of the same size.
  const hidden = ordered.length > limit + 1 ? ordered.length - limit : 0;
  return {
    shown: hidden && !expanded ? ordered.slice(0, limit) : ordered,
    more: hidden ? (
      <Button small variant="plain" className="short-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Show less' : `Show ${hidden} more`}
      </Button>
    ) : null,
  };
}

export const fmtNum = (n: number, digits = 1) => (Number.isInteger(n) ? String(n) : n.toFixed(digits));
