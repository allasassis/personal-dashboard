import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from './markdown';

const html = (s: string) => renderToStaticMarkup(<Markdown source={s} />);

describe('markdown', () => {
  it('renders the common blocks', () => {
    const out = html('# T\n\nPara **b** *i* `c` ~~s~~\nline two\n\n- a\n- b\n\n1. x\n2. y\n\n> q\n\n---\n\n```\nlet a = 1;\n```');
    for (const tag of ['<h1>T</h1>', '<strong>b</strong>', '<em>i</em>', '<code>c</code>', '<s>s</s>', '<br/>', '<ul><li>a</li>', '<ol><li>x</li>', '<blockquote>q', '<hr/>', '<pre><code>let a = 1;']) {
      expect(out).toContain(tag);
    }
  });

  it('renders tables and task lists', () => {
    const out = html('| A | B |\n|---|---|\n| 1 | **2** |\n\n- [x] done\n- [ ] todo');
    expect(out).toContain('<th>A</th>');
    expect(out).toContain('<td><strong>2</strong></td>');
    expect(out).toContain('class="tasks"');
    expect(out).toContain('☑');
    expect(out).toContain('☐');
  });

  it('never produces live HTML or script URLs', () => {
    const out = html('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))\n\n![y](javascript:alert(1))\n\n![z](http://insecure/a.png)\n\n[d](data:text/html,hi)');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img src="x"');
    expect(out).not.toMatch(/href="(javascript|data):/);
    expect(out).not.toMatch(/src="(javascript|http:)/);
    expect(out).toContain('&lt;script&gt;');
  });

  it('allows https links and images', () => {
    const out = html('[site](https://a.dev/x) ![pic](https://a.dev/y.png)');
    expect(out).toContain('href="https://a.dev/x"');
    expect(out).toContain('src="https://a.dev/y.png"');
  });

  it('keeps markup inside code literal, and survives unterminated input', () => {
    expect(html('`**not bold**`')).toContain('<code>**not bold**</code>');
    expect(html('```\nnever closed')).toContain('never closed');
    expect(html('**open and [broken](')).toContain('**open and [broken](');
    expect(html('')).toBe('<div class="prose"></div>');
  });

  it('does not hang on a line that looks like a block but is not', () => {
    expect(html('a | b\nplain')).toContain('a | b');
    expect(html('>')).toContain('blockquote');
    expect(html('####### seven')).toContain('seven');
  });
});
