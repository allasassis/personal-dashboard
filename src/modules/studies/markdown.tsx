import { Fragment, type ReactNode } from 'react';

// A small Markdown renderer that builds React elements and never injects raw HTML, since
// this page holds the GitHub token. Links and images only accept https (links: also http).

const safeLink = (url: string) => /^https?:\/\//i.test(url);
const safeImage = (url: string) => /^https:\/\//i.test(url);

const INLINE = /(`[^`]+`)|(!\[[^\]]*\]\([^)\s]+\))|(\[[^\]]+\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(~~[^~]+~~)/g;

export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = key++;
    if (m[1]) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (m[2]) {
      const [, alt, src] = t.match(/^!\[([^\]]*)\]\((.+)\)$/)!;
      out.push(safeImage(src) ? <img key={k} src={src} alt={alt} loading="lazy" /> : t);
    } else if (m[3]) {
      const [, label, href] = t.match(/^\[([^\]]+)\]\((.+)\)$/)!;
      out.push(safeLink(href) ? <a key={k} href={href} target="_blank" rel="noreferrer">{inline(label)}</a> : label);
    } else if (m[4]) out.push(<strong key={k}>{inline(t.slice(2, -2))}</strong>);
    else if (m[5]) out.push(<em key={k}>{inline(t.slice(1, -1))}</em>);
    else if (m[6]) out.push(<s key={k}>{inline(t.slice(2, -2))}</s>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const isDivider = (row: string) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(row) && row.includes('-');

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const k = blocks.length;

    if (!line.trim()) {
      i++;
    } else if (line.startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={k}><code>{code.join('\n')}</code></pre>);
    } else if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length;
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
      blocks.push(<Tag key={k}>{inline(line.slice(level).trim())}</Tag>);
      i++;
    } else if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push(<hr key={k} />);
      i++;
    } else if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={k}>{quote.map((q, n) => <Fragment key={n}>{n > 0 && <br />}{inline(q)}</Fragment>)}</blockquote>);
    } else if (line.includes('|') && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      blocks.push(
        <div className="table-wrap" key={k}>
          <table className="table">
            <thead><tr>{head.map((c, n) => <th key={n}>{inline(c)}</th>)}</tr></thead>
            <tbody>{rows.map((r, n) => <tr key={n}>{r.map((c, m) => <td key={m}>{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
    } else if (/^\s*[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s/, ''));
      const isTask = items.every((t) => /^\[[ xX]\]\s/.test(t));
      blocks.push(
        <ul key={k} className={isTask ? 'tasks' : undefined}>
          {items.map((t, n) =>
            isTask ? (
              <li key={n}><span aria-hidden="true">{/^\[ \]/.test(t) ? '☐' : '☑'}</span><span>{/^\[ \]/.test(t) ? <span className="sr">To do: </span> : <span className="sr">Done: </span>}{inline(t.slice(4))}</span></li>
            ) : (
              <li key={n}>{inline(t)}</li>
            ),
          )}
        </ul>,
      );
    } else if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s/, ''));
      blocks.push(<ol key={k}>{items.map((t, n) => <li key={n}>{inline(t)}</li>)}</ol>);
    } else {
      const para: string[] = [];
      const blockStart = /^(```|#{1,3}\s|>|\s*[-*]\s|\s*\d+\.\s|-{3,}\s*$)/;
      while (i < lines.length && lines[i].trim() && !blockStart.test(lines[i])) para.push(lines[i++]);
      if (!para.length) para.push(lines[i++]);
      blocks.push(<p key={k}>{para.map((p, n) => <Fragment key={n}>{n > 0 && <br />}{inline(p)}</Fragment>)}</p>);
    }
  }
  return <div className="prose">{blocks}</div>;
}
