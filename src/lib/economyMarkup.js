// Plain-text form of an Economy topic body, for the admin editor. One line per block:
//
//   - text            bullet (2 spaces of indent per level before the dash)
//   text              paragraph
//   # text            sub-heading
//
// Inside a line:  **bold**   {g:green highlight}  {c:cyan}  {y:yellow}   [ok] ✅   [no] ❌
// Bold can sit inside a highlight: {g:**SDF** is collateral-free}

const HL = new Set(['g', 'c', 'y']);

const spanToText = (s) => {
  if (s.m === 'ok') return '[ok]';
  if (s.m === 'no') return '[no]';
  let t = s.t || '';
  if (s.b) t = `**${t}**`;
  if (s.hl) t = `{${s.hl}:${t}}`;
  return t;
};

export const blocksToText = (blocks = []) => blocks
  .map((b) => {
    const body = b.spans.map(spanToText).join('');
    if (b.heading) return `# ${body}`;
    return `${'  '.repeat(b.level || 0)}${b.glyph ? '- ' : ''}${body}`;
  })
  .join('\n');

// Parse one line's inline markup into spans.
const parseInline = (line) => {
  const spans = [];
  const push = (s) => {
    if (!s.t && !s.m) return;
    const last = spans[spans.length - 1];
    if (last && !s.m && !last.m && !!last.b === !!s.b && last.hl === s.hl) { last.t += s.t; return; }
    spans.push(s);
  };
  const bold = (text, hl) => {
    text.split(/(\*\*[^*]+\*\*)/).forEach((part) => {
      if (!part) return;
      const m = part.match(/^\*\*([^*]+)\*\*$/);
      const s = { t: m ? m[1] : part };
      if (m) s.b = 1;
      if (hl) s.hl = hl;
      push(s);
    });
  };
  const re = /\[(ok|no)\]|\{([gcy]):([^}]*)\}/g;
  let last = 0;
  let m;
  while ((m = re.exec(line))) {
    if (m.index > last) bold(line.slice(last, m.index));
    if (m[1]) push({ t: '', m: m[1] });
    else if (HL.has(m[2])) bold(m[3], m[2]);
    last = re.lastIndex;
  }
  if (last < line.length) bold(line.slice(last));
  return spans;
};

export const textToBlocks = (text = '') => text
  .split('\n')
  .filter((l) => l.trim())
  .map((raw) => {
    if (/^\s*#\s+/.test(raw)) return { level: 0, glyph: null, heading: true, spans: parseInline(raw.replace(/^\s*#\s+/, '')) };
    const indent = raw.match(/^ */)[0].length;
    const rest = raw.slice(indent);
    const bullet = /^[-•]\s+/.test(rest);
    return {
      level: Math.min(3, Math.floor(indent / 2)),
      glyph: bullet ? '•' : null,
      heading: false,
      spans: parseInline(bullet ? rest.replace(/^[-•]\s+/, '') : rest),
    };
  })
  .filter((b) => b.spans.length);

export const blocksPlainText = (blocks = []) => blocks
  .map((b) => b.spans.map((s) => (s.m === 'ok' ? '✅' : s.m === 'no' ? '❌' : s.t)).join(''))
  .join('\n');
