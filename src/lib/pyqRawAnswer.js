// A book answer that hasn't been through the reformat pass is plain text with the PDF's
// hard line breaks, but it still has a shape: opening lines, short headings, numbered
// points with "Eg-" examples, closing lines. Recover that shape for display only.
// Returns { openingLine, sections, closingLine }, or null if no sections can be found.

const POINT = /^\d+[.)]\s+/;
const ENDS_SENTENCE = /[.!?:;)"”’]$/;
const tidy = (s) => s.replace(/\s+([,.;:)])/g, '$1').replace(/\(\s+/g, '(').replace(/\s+/g, ' ').trim();

const toPoint = (text) => {
  const m = text.match(/^(.*?)\s*\bEg\s*[-:.–—]\s*(.+)$/is);
  return m ? { claim: tidy(m[1]), example: tidy(m[2]) } : { claim: tidy(text) };
};

export function parseRawAnswer(rawText) {
  const lines = String(rawText || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const opening = [];
  const sections = [];
  let text = null; // the point being joined back together across hard line breaks
  let section = null;
  let prev = '';

  const endPoint = () => {
    if (text !== null) section.points.push(text);
    text = null;
  };

  lines.forEach((line, i) => {
    const prevEnded = !prev || ENDS_SENTENCE.test(prev);
    const next = lines[i + 1] || '';
    const heading = !POINT.test(line) && line.length <= 80 && !ENDS_SENTENCE.test(line) && /^[A-Z]/.test(line)
      && prevEnded && !!next;
    if (heading) {
      if (section) endPoint();
      section = { heading: tidy(line), points: [] };
      sections.push(section);
    } else if (!section && !POINT.test(line)) {
      opening.push(line);
    } else if (!section) {
      // Numbered points before any heading: a section with no heading of its own.
      section = { heading: '', points: [] };
      sections.push(section);
      text = line.replace(POINT, '');
    } else if (POINT.test(line) || (prevEnded && text !== null) || text === null) {
      endPoint();
      text = line.replace(POINT, '');
    } else {
      text += ` ${line}`;
    }
    prev = line;
  });
  if (section) endPoint();
  if (!sections.length) return null;

  // Unnumbered text after the last section's numbered points is the closing line.
  const last = sections[sections.length - 1];
  const closingLine = last.points.length > 1 && !rawEndsInPoint(lines) ? last.points.pop() : '';
  return {
    openingLine: tidy(opening.join(' ')),
    sections: sections.map((s) => ({ heading: s.heading, points: s.points.map(toPoint) })),
    closingLine: tidy(closingLine),
  };
}

// True when the final paragraph of the text belongs to a numbered point.
function rawEndsInPoint(lines) {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (POINT.test(lines[i])) return true;
    if (i > 0 && ENDS_SENTENCE.test(lines[i - 1])) return false;
  }
  return false;
}
