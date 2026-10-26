// Builds the admin "question PDF" for Toppers Copy with pdf-lib:
//   cover (the question) → per topper: the handwritten pages with the green
//   "Done well" / blue "Make it stronger" margin notes, then that copy's
//   takeaways → the question's AI analysis (model answer, diagram, learnings,
//   keyword bank).
// Pure data-in / bytes-out (no DOM), so it also runs under Node for checks.
// The browser side — fetching pages, rasterising the SVG diagram, saving the
// file — lives in exportQuestionPdf.js.
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Light-theme values of the CSS tokens (src/index.css). The PDF is always light,
// whatever theme the admin is browsing in. Also used to resolve var(--…) inside
// the captured diagram SVG.
export const LIGHT_VARS = {
  '--bg-surface': '#ffffff',
  '--bg-sunken': '#f3ecdf',
  '--border-default': '#d8c9a8',
  '--text-primary': '#1f1a14',
  '--text-secondary': '#5c5447',
  '--text-tertiary': '#8c8270',
  '--accent': '#0d7a56',
  '--accent-soft-bg': '#ecfdf5',
  '--color-surface': '#ffffff',
  '--color-border-default': '#d8c9a8',
  '--color-border-subtle': '#e8ddc8',
  '--color-text-primary': '#1f1a14',
  '--color-text-secondary': '#5c5447',
  '--color-text-tertiary': '#8c8270',
  '--color-brand': '#0d7a56',
  '--color-status-success-text': '#047857',
  '--color-status-danger-text': '#b91c1c',
  '--color-status-info-text': '#4338ca',
  '--color-status-warning-text': '#b45309',
};

// Same categorical order as AnswerDiagram's CAT (for the chart legend).
const CHART_CAT = ['#0d7a56', '#b91c1c', '#4338ca', '#b45309', '#5c5447', '#8c8270'];

const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const C = {
  ink: hex('#1f1a14'),
  secondary: hex('#5c5447'),
  tertiary: hex('#6b6150'),
  border: hex('#d8c9a8'),
  borderSoft: hex('#e8ddc8'),
  sunken: hex('#f3ecdf'),
  raised: hex('#f9f5ee'),
  white: hex('#ffffff'),
  brand: hex('#0d7a56'),
  brandSoft: hex('#ecfdf5'),
  brandSoftBorder: hex('#a7f3d0'),
  green: hex('#047857'),
  greenBg: hex('#ecfdf5'),
  blue: hex('#4338ca'),
  blueBg: hex('#eef2ff'),
};

const TONE = {
  works: { color: C.green, bg: C.greenBg, label: 'Done well' },
  addon: { color: C.blue, bg: C.blueBg, label: 'Make it stronger' },
};

// Sheet geometry (points). Every page is SHEET_W wide; heights vary — a marked
// page grows to hold its notes, text pages are cropped to their content.
const SHEET_W = 900;
const PAGE_W = 460;                         // the scanned page, as drawn
const MARGIN_W = (SHEET_W - PAGE_W) / 2;    // note margin on each side
const NOTE_X = 8;
const NOTE_W = MARGIN_W - 22;
const NOTE_GAP = 7;
const MARK_HEAD_H = 58;
const FOOT_H = 30;
const TEXT_H = 800;
const MX = 44;
const GUT = 30;
const COL_W = (SHEET_W - MX * 2 - GUT) / 2;
const TEXT_BOTTOM = TEXT_H - FOOT_H - 16;

// Characters the font lacks → readable stand-ins (anything else unsupported is dropped).
const FALLBACK = { ' ': ' ', ' ': ' ', ' ': ' ', '‑': '-', '\t': ' ', '₹': 'Rs ' };

const rrPath = (w, h, r) => {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M ${q},0 H ${w - q} Q ${w},0 ${w},${q} V ${h - q} Q ${w},${h} ${w - q},${h} H ${q} Q 0,${h} 0,${h - q} V ${q} Q 0,0 ${q},0 Z`;
};

export const topperLine = (a) =>
  [a.name || 'Topper', a.rank ? `AIR ${a.rank}${a.year ? ` (${a.year})` : ''}` : (a.year ? String(a.year) : ''), a.marks ? `${a.marks} marks` : '']
    .filter(Boolean)
    .join(' · ');

/**
 * @param {object} o
 * @param {{subject,syllabusSection,topic}} o.topic
 * @param {object} o.question            { questionText, year, marks, aiAnalysis }
 * @param {object[]} o.answers           the toppers to include, each with .enhancement (or null)
 * @param {Uint8Array} o.pagesPdf        PDF holding just the answer pages
 * @param {number[]} o.pageNumbers       absolute page number of each page in pagesPdf
 * @param {{regular,bold,italic}} o.fonts  TTF bytes
 * @param {Uint8Array} [o.logoJpg]
 * @param {{png:Uint8Array,width:number,height:number}} [o.diagramImage]  rasterised SVG diagram
 * @returns {Promise<Uint8Array>}
 */
export async function buildQuestionPdf({ topic, question, answers, pagesPdf, pageNumbers, fonts, logoJpg, diagramImage }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const F = {
    r: await pdf.embedFont(fonts.regular, { subset: true }),
    b: await pdf.embedFont(fonts.bold, { subset: true }),
    i: await pdf.embedFont(fonts.italic, { subset: true }),
  };
  pdf.setTitle(`Toppers Copy — ${question.questionText || 'Question'}`.slice(0, 200));
  pdf.setAuthor('The Dark Horse UPSC');
  if (diagramImage?.png) diagramImage = { ...diagramImage, embedded: await pdf.embedPng(diagramImage.png) };

  const sets = [F.r, F.b, F.i].map((f) => new Set(f.getCharacterSet()));
  const supported = (cp) => sets.every((s) => s.has(cp));
  // The AI sometimes writes formulas TeX-style ("$CO_2$") — print them as CO₂.
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const untex = (s) =>
    s.replace(/\$([A-Za-z0-9_^{}]*[_^][A-Za-z0-9_^{}]*)\$/g, (_, m) =>
      m.replace(/[{}^]/g, '').replace(/_(\d+)/g, (__, d) => [...d].map((c) => SUB[c]).join('')).replace(/_/g, ''));
  const clean = (v) => {
    let out = '';
    for (const ch of untex(String(v ?? '').replace(/\r/g, ''))) {
      if (ch === '\n') out += '\n';
      else if (supported(ch.codePointAt(0))) out += ch;
      else if (FALLBACK[ch] != null) out += FALLBACK[ch];
    }
    return out;
  };

  // ---- text layout ---------------------------------------------------------
  const toRuns = (runs, base) =>
    (Array.isArray(runs) ? runs : [runs])
      .map((r) => (typeof r === 'string' || typeof r === 'number' ? { text: String(r) } : r))
      .filter((r) => r && r.text != null)
      .map((r) => ({ font: base.font || F.r, color: base.color || C.secondary, ...r, text: clean(r.text) }));

  // Word-wrap styled runs into lines of positioned segments.
  const layoutRuns = (runs, size, maxW) => {
    const lines = [];
    let segs = [];
    let x = 0;
    let space = null; // pending space (its run) — dropped at a line break
    const push = (text, run) => {
      const w = run.font.widthOfTextAtSize(text, size);
      const last = segs[segs.length - 1];
      if (last && last.font === run.font && last.color === run.color) last.text += text;
      else segs.push({ text, font: run.font, color: run.color, x });
      x += w;
    };
    const newline = () => { lines.push({ segs, w: x }); segs = []; x = 0; space = null; };
    for (const run of runs) {
      for (const tok of run.text.split(/(\n|[ ]+)/)) {
        if (!tok) continue;
        if (tok === '\n') { newline(); continue; }
        if (tok[0] === ' ') { if (x > 0) space = run; continue; }
        let word = tok;
        const spaceW = space ? space.font.widthOfTextAtSize(' ', size) : 0;
        if (x > 0 && x + spaceW + run.font.widthOfTextAtSize(word, size) > maxW) newline();
        else if (space) push(' ', space);
        space = null;
        // a single word wider than the line: break it by characters
        while (run.font.widthOfTextAtSize(word, size) > maxW && word.length > 1) {
          let n = word.length - 1;
          while (n > 1 && run.font.widthOfTextAtSize(word.slice(0, n), size) > maxW - x) n--;
          push(word.slice(0, n), run);
          newline();
          word = word.slice(n);
        }
        push(word, run);
      }
    }
    if (segs.length || !lines.length) lines.push({ segs, w: x });
    return lines;
  };

  const fit = (text, font, size, maxW) => {
    let s = clean(text).replace(/\s+/g, ' ').trim();
    if (font.widthOfTextAtSize(s, size) <= maxW) return s;
    while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, size) > maxW) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  };

  // ---- boxes: lay out first (top-based coords), paint later ----------------
  const makeBox = (width) => {
    const ops = [];
    let y = 0;
    const api = {
      width,
      ops,
      get h() { return y; },
      gap(n) { y += n; return api; },
      text(runs, o = {}) {
        const { size = 9.5, lead = 1.42, x = 0, w = width - x, align = 'left' } = o;
        const lineH = size * lead;
        for (const ln of layoutRuns(toRuns(runs, o), size, w)) {
          const dx = align === 'center' ? (w - ln.w) / 2 : align === 'right' ? w - ln.w : 0;
          ops.push({ k: 'line', x: x + dx, y: y + (lineH - size) / 2 + size * 0.78, size, segs: ln.segs });
          y += lineH;
        }
        return api;
      },
      bullet(runs, o = {}) {
        const { size = 9.5, lead = 1.42, x = 0, indent = 11, marker = '•', markerColor = C.tertiary, markerFont = F.b } = o;
        const lineH = size * lead;
        ops.push({ k: 'line', x, y: y + (lineH - size) / 2 + size * 0.78, size, segs: [{ text: clean(marker), font: markerFont, color: markerColor, x: 0 }] });
        return api.text(runs, { ...o, x: x + indent, w: width - x - indent });
      },
      chips(items, o = {}) {
        const { size = 8.5, bg = C.sunken, color = C.secondary, border = C.border, padX = 5, padY = 3, gapX = 4, gapY = 4 } = o;
        const list = (items || []).map((t) => clean(t).trim()).filter(Boolean);
        if (!list.length) return api;
        const h = size + padY * 2;
        let cx = 0;
        for (const raw of list) {
          const t = fit(raw, F.r, size, width - padX * 2);
          const w = F.r.widthOfTextAtSize(t, size) + padX * 2;
          if (cx > 0 && cx + w > width) { cx = 0; y += h + gapY; }
          ops.push({ k: 'rrect', x: cx, y, w, h, r: 3, fill: bg, stroke: border, sw: 0.5 });
          ops.push({ k: 'line', x: cx + padX, y: y + padY + size * 0.78, size, segs: [{ text: t, font: F.r, color, x: 0 }] });
          cx += w + gapX;
        }
        y += h;
        return api;
      },
      rect(o) { ops.push({ k: 'rect', ...o }); return api; },
      rrect(o) { ops.push({ k: 'rrect', ...o }); return api; },
      path(o) { ops.push({ k: 'path', ...o }); return api; },
      image(img, w, h, x = 0) { ops.push({ k: 'image', img, x, y, w, h }); y += h; return api; },
      child(box, x = 0) { ops.push({ k: 'box', child: box, x, y }); y += box.h; return api; },
    };
    return api;
  };

  // A padded, bordered card around content built by fill(inner).
  const card = (width, { pad = 8, bg = C.white, border = C.border, sw = 0.6, r = 5, bar, barColor } = {}, fill) => {
    const inner = makeBox(width - pad * 2);
    fill(inner);
    const h = inner.h + pad * 2;
    const box = makeBox(width);
    box.rrect({ x: 0, y: 0, w: width, h, r, fill: bg, stroke: border, sw });
    if (bar) box.rect({ x: bar === 'left' ? 0 : width - 2.6, y: 1, w: 2.6, h: h - 2, fill: barColor || border });
    box.gap(pad).child(inner, pad).gap(pad);
    return box;
  };

  const paint = (page, H, box, x0, y0) => {
    for (const op of box.ops) {
      const x = x0 + op.x;
      const y = y0 + op.y;
      if (op.k === 'line') {
        for (const s of op.segs) {
          if (s.text) page.drawText(s.text, { x: x + s.x, y: H - y, size: op.size, font: s.font, color: s.color });
        }
      } else if (op.k === 'rrect' || op.k === 'path') {
        const opts = { x, y: H - y };
        if (op.fill) opts.color = op.fill;
        if (op.stroke) { opts.borderColor = op.stroke; opts.borderWidth = op.sw ?? 1; }
        page.drawSvgPath(op.k === 'path' ? op.d : rrPath(op.w, op.h, op.r ?? 4), opts);
      } else if (op.k === 'rect') {
        page.drawRectangle({ x, y: H - y - op.h, width: op.w, height: op.h, color: op.fill });
      } else if (op.k === 'image') {
        page.drawImage(op.img, { x, y: H - y - op.h, width: op.w, height: op.h });
      } else if (op.k === 'box') {
        paint(page, H, op.child, x, y);
      }
    }
  };

  // Crop a fixed-height page to the part that was actually used.
  const crop = (page, H, used) => {
    const h = Math.min(H, Math.max(used, 260));
    page.setMediaBox(0, H - h, SHEET_W, h);
  };

  // ---- two-column flow for the text pages ----------------------------------
  const makeFlow = ({ kicker, kickerColor = C.brand, title, sub }) => {
    let page;
    let col = 0;
    let y = 0;
    let topY = 0;
    let maxY = 0;
    let first = true;

    const start = () => {
      page = pdf.addPage([SHEET_W, TEXT_H]);
      const head = makeBox(SHEET_W - MX * 2);
      if (first) {
        head.gap(26);
        if (kicker) head.text(kicker.toUpperCase(), { size: 8.5, font: F.b, color: kickerColor });
        head.gap(2).text(title, { size: 16, font: F.b, color: C.ink, lead: 1.25 });
        if (sub) head.gap(1).text(sub, { size: 9.5, color: C.secondary });
        head.gap(9);
      } else {
        head.gap(22).text(`${title} (continued)`, { size: 8.5, font: F.b, color: C.tertiary }).gap(6);
      }
      head.rect({ x: 0, y: head.h, w: SHEET_W - MX * 2, h: 0.8, fill: C.border });
      paint(page, TEXT_H, head, MX, 0);
      topY = head.h + 14;
      col = 0;
      y = topY;
      maxY = y;
    };
    const finish = () => crop(page, TEXT_H, maxY + 18 + FOOT_H);
    const nextCol = () => {
      if (col === 0) { col = 1; y = topY; } else { finish(); first = false; start(); }
    };
    start();

    return {
      colW: COL_W,
      place(box, { reserve = 0 } = {}) {
        if (y + box.h + reserve > TEXT_BOTTOM && y > topY + 1) nextCol();
        paint(page, TEXT_H, box, MX + col * (COL_W + GUT), y);
        y += box.h;
        maxY = Math.max(maxY, y);
      },
      gap(n) { if (y > topY) y += n; },
      breakCol() { if (col === 0 && y > topY) { col = 1; y = topY; } },
      get col() { return col; },
      get fill() { return (y - topY) / (TEXT_BOTTOM - topY); },
      end: finish,
    };
  };

  const heading = (text, color = C.ink) => {
    const b = makeBox(COL_W);
    b.text(text.toUpperCase(), { size: 8.5, font: F.b, color, lead: 1.3 }).gap(2);
    b.rect({ x: 0, y: b.h, w: 26, h: 1.6, fill: color });
    return b.gap(7);
  };
  const para = (runs, o = {}) => makeBox(COL_W).text(runs, { color: C.ink, ...o }).gap(o.after ?? 5);
  const bulletBox = (runs, o = {}) => makeBox(COL_W).bullet(runs, { color: C.ink, ...o }).gap(o.after ?? 4);

  // ---- 1. cover: the question ----------------------------------------------
  // Same gate as the on-screen ModelAnswerView: only the current analysis shape.
  const ai = question.aiAnalysis;
  const analysis = ai?.generatedAt && typeof ai.modelAnswer === 'object'
    && (ai.modelAnswer?.introduction?.text || ai.modelAnswer?.body?.length || ai.learnings?.length)
    ? ai
    : null;
  const anyNotes = answers.some((a) => a.enhancement?.notes?.length);
  const anyTakeaways = answers.some((a) => hasTakeaways(a.enhancement?.takeaways));
  {
    const W = SHEET_W - 140;
    const b = makeBox(W);
    b.gap(40);
    const brandRow = makeBox(W);
    let logo = null;
    if (logoJpg) {
      try { logo = await pdf.embedJpg(logoJpg); } catch { logo = null; }
    }
    if (logo) brandRow.ops.push({ k: 'image', img: logo, x: 0, y: 0, w: 40, h: 40 });
    const tx = logo ? 52 : 0;
    brandRow.gap(5)
      .text('The Dark Horse UPSC', { size: 13, font: F.b, color: C.ink, x: tx, lead: 1.25 })
      .text('TOPPERS COPY  ·  ANSWER ANALYSIS', { size: 7.5, font: F.b, color: C.brand, x: tx });
    if (brandRow.h < 40) brandRow.gap(40 - brandRow.h);
    b.child(brandRow).gap(26);
    b.text([topic.subject, topic.syllabusSection, topic.topic].filter(Boolean).join('  ›  '), { size: 9, font: F.b, color: C.tertiary });
    b.gap(8).text(question.questionText || 'Untitled question', { size: 17, font: F.b, color: C.ink, lead: 1.36 });
    const meta = [question.year ? `UPSC ${question.year}` : '', question.marks ? `${question.marks} marks` : ''].filter(Boolean).join('  ·  ');
    if (meta) b.gap(6).text(meta, { size: 10, color: C.secondary });
    b.gap(24);

    b.child(card(W, { pad: 16, bg: C.raised, border: C.borderSoft, r: 8 }, (c) => {
      c.text('INSIDE THIS PDF', { size: 8.5, font: F.b, color: C.tertiary }).gap(8);
      const row = (color, title, text) => {
        c.rrect({ x: 0, y: c.h + 3, w: 8, h: 8, r: 2, fill: color });
        c.text([{ text: `${title}  `, font: F.b, color: C.ink }, { text, color: C.secondary }], { size: 9.5, x: 18 }).gap(6);
      };
      row(C.ink, `Toppers' handwritten answers`, `${answers.length} ${answers.length === 1 ? 'copy' : 'copies'} of this question, exactly as written in the exam.`);
      if (anyNotes) {
        row(C.green, 'Done well (green, left margin)', 'what the topper did well on those lines, and how to reuse it in your own answer.');
        row(C.blue, 'Make it stronger (blue, right margin)', 'extra data, reports, cases and diagrams that would lift the same point further.');
      }
      if (anyTakeaways) row(C.brand, 'What we learn from each copy', 'techniques, presentation, an enrichment bank and an alternate introduction and conclusion.');
      if (analysis) row(C.secondary, 'AI analysis', 'a fresh model answer, a diagram you can draw, the key learnings and a keyword bank.');
      c.gap(8).text('TOPPERS IN THIS PDF', { size: 8.5, font: F.b, color: C.tertiary }).gap(6);
      answers.forEach((a, i) => {
        const n = Math.max(0, (a.endPage || 0) - (a.startPage || 0) + 1);
        c.text([
          { text: `${i + 1}.  ${topperLine(a)}`, font: F.b, color: C.ink },
          { text: `   ${n} ${n === 1 ? 'page' : 'pages'}${a.source ? `  ·  ${a.source}` : ''}`, color: C.tertiary },
        ], { size: 9.5 }).gap(3);
      });
    }));
    b.gap(30);

    const H = b.h + FOOT_H;
    const page = pdf.addPage([SHEET_W, H]);
    page.drawRectangle({ x: 0, y: H - 6, width: SHEET_W, height: 6, color: C.brand });
    paint(page, H, b, 70, 0);
  }

  // ---- 2. per topper: marked pages, then takeaways -------------------------
  const src = await PDFDocument.load(pagesPdf);
  const embedded = await pdf.embedPdf(src, src.getPageIndices());
  const pageByNumber = new Map(pageNumbers.map((n, i) => [n, embedded[i]]));

  const noteBox = (note) => {
    const t = TONE[note.kind];
    const left = note.kind === 'works';
    const size = 10;
    return card(NOTE_W, { pad: 8, bg: C.white, border: t.color, sw: 0.7, r: 4, bar: left ? 'left' : 'right', barColor: t.color }, (c) => {
      c.text(note.title || t.label, { size, font: F.b, color: t.color, lead: 1.3 });
      if (note.text) c.gap(2).text(note.text, { size, lead: 1.36, color: C.ink });
      if (note.use) c.gap(4).text([{ text: 'Use it: ', font: F.b, color: t.color }, note.use], { size, lead: 1.36, color: C.ink });
      (note.points || []).filter(Boolean).forEach((p) => c.gap(3).bullet(p, { size, lead: 1.36, indent: 9, markerColor: t.color, color: C.ink }));
      if (note.diagram) c.gap(4).text([{ text: 'Draw: ', font: F.b, color: t.color }, note.diagram], { size, lead: 1.36, color: C.ink });
    });
  };

  // Stack a side's notes near their anchors without overlapping: push down, then
  // pull the stack back up if it ran past the page (same as the on-screen layer).
  const layoutSide = (items, pageH) => {
    let prevBottom = -Infinity;
    const placed = items.map((it) => {
      const want = ((it.note.yFrom + it.note.yTo) / 2) * pageH - it.box.h / 2;
      const top = Math.max(0, want, prevBottom + NOTE_GAP);
      prevBottom = top + it.box.h;
      return { ...it, top };
    });
    let nextTop = Math.max(pageH, prevBottom);
    for (let i = placed.length - 1; i >= 0; i--) {
      placed[i].top = Math.max(0, Math.min(placed[i].top, nextTop - placed[i].box.h - (i === placed.length - 1 ? 0 : NOTE_GAP)));
      nextTop = placed[i].top;
    }
    // a stack taller than the page starts at 0 and simply runs longer
    let floor = 0;
    for (const p of placed) { p.top = Math.max(p.top, floor); floor = p.top + p.box.h + NOTE_GAP; }
    return placed;
  };

  const qShort = (question.questionText || '').replace(/\s+/g, ' ').trim();

  for (const answer of answers) {
    const enh = answer.enhancement || null;
    const label = topperLine(answer);
    const nums = [];
    for (let p = answer.startPage; p <= answer.endPage; p++) if (pageByNumber.has(p)) nums.push(p);

    nums.forEach((num, idx) => {
      const ep = pageByNumber.get(num);
      const scale = PAGE_W / ep.width;
      const ph = ep.height * scale;
      const notes = (enh?.notes || []).filter((n) => n.page === num);
      const sides = ['works', 'addon'].map((kind) =>
        layoutSide(
          notes.filter((n) => n.kind === kind).sort((a, b) => a.yFrom - b.yFrom).map((note) => ({ note, box: noteBox(note) })),
          ph
        )
      );
      const bodyH = Math.max(ph, ...sides.flat().map((p) => p.top + p.box.h));
      const H = MARK_HEAD_H + bodyH + 14 + FOOT_H;
      const page = pdf.addPage([SHEET_W, H]);
      const top = MARK_HEAD_H;
      const pageL = MARGIN_W;
      const pageR = MARGIN_W + PAGE_W;

      // header: topper + page count, then the two margin titles over their columns
      page.drawText(fit(label, F.b, 11, SHEET_W - 220), { x: 24, y: H - 24, size: 11, font: F.b, color: C.ink });
      const pg = `Answer copy  ·  page ${idx + 1} of ${nums.length}`;
      page.drawText(pg, { x: SHEET_W - 24 - F.r.widthOfTextAtSize(pg, 9.5), y: H - 23, size: 9.5, font: F.r, color: C.tertiary });
      page.drawRectangle({ x: 24, y: H - 33, width: SHEET_W - 48, height: 0.7, color: C.border });
      if (notes.length) {
        page.drawRectangle({ x: NOTE_X, y: H - 51, width: 8, height: 8, color: C.green });
        page.drawText('DONE WELL', { x: NOTE_X + 12, y: H - 50.5, size: 9, font: F.b, color: C.green });
        const mk = 'MAKE IT STRONGER';
        const mkW = F.b.widthOfTextAtSize(mk, 9);
        page.drawRectangle({ x: SHEET_W - NOTE_X - 8, y: H - 51, width: 8, height: 8, color: C.blue });
        page.drawText(mk, { x: SHEET_W - NOTE_X - 12 - mkW, y: H - 50.5, size: 9, font: F.b, color: C.blue });
      }
      if (qShort) {
        const q = fit(qShort, F.i, 9, PAGE_W);
        page.drawText(q, { x: pageL + (PAGE_W - F.i.widthOfTextAtSize(q, 9)) / 2, y: H - 50.5, size: 9, font: F.i, color: C.secondary });
      }

      // the scanned page
      page.drawPage(ep, { x: pageL, y: H - top - ph, width: PAGE_W, height: ph });
      page.drawRectangle({ x: pageL, y: H - top - ph, width: PAGE_W, height: ph, borderColor: C.border, borderWidth: 0.6 });

      sides.flat().forEach(({ note, box, top: nTop }) => {
        const t = TONE[note.kind];
        const left = note.kind === 'works';
        const y1 = top + note.yFrom * ph;
        const y2 = top + Math.max(note.yTo, note.yFrom) * ph;
        const mid = (y1 + y2) / 2;
        const bx = left ? pageL + 4 : pageR - 4;
        const tick = left ? 6 : -6;
        const fromX = left ? pageL - 12 : pageR + 12;
        const tipX = left ? bx - 3 : bx + 3;
        const noteY = top + nTop + 11;
        const cx = (fromX + tipX) / 2;
        const stroke = { x: 0, y: H, borderColor: t.color, borderWidth: 1.3 };
        page.drawSvgPath(`M ${bx + tick},${y1} L ${bx},${y1} L ${bx},${y2} L ${bx + tick},${y2}`, stroke);
        page.drawSvgPath(`M ${fromX},${noteY} C ${cx},${noteY} ${cx},${mid} ${tipX - (left ? 5 : -5)},${mid}`, stroke);
        const back = tipX - (left ? 6 : -6);
        page.drawSvgPath(`M ${tipX},${mid} L ${back},${mid - 3.2} L ${back},${mid + 3.2} Z`, { x: 0, y: H, color: t.color });
        paint(page, H, box, left ? NOTE_X : pageR + 14, top + nTop);
      });
    });

    // what we learn from this copy — green on the left column, blue on the right
    const t = enh?.takeaways;
    if (hasTakeaways(t)) {
      const flow = makeFlow({ kicker: 'What we learn from this copy', title: label });
      const list = (title, items, color) => {
        const rows = (items || []).filter(Boolean);
        if (!rows.length) return;
        flow.place(heading(title, color), { reserve: 30 });
        rows.forEach((s) => flow.place(bulletBox(s, { markerColor: color })));
        flow.gap(10);
      };
      list('Techniques to copy', t.techniques, C.green);
      list('Presentation · spacing & diagrams', t.presentation, C.green);
      if (t.enrichment?.length || t.altIntro?.text || t.altConclusion?.text) flow.breakCol();
      list('Enrichment bank', t.enrichment, C.blue);
      const alt = (title, a) => {
        if (!a?.text) return;
        flow.place(heading(title, C.blue), { reserve: 40 });
        flow.place(card(COL_W, { pad: 10, bg: C.blueBg, border: C.blueBg, r: 6 }, (c) => {
          c.text(highlight(a.text, a.keywords), { size: 9.5, color: C.ink });
          if (a.keywords?.length) c.gap(7).chips(a.keywords, { bg: C.white, color: C.blue, border: C.blueBg });
        }));
        flow.gap(12);
      };
      alt('Alternate introduction', t.altIntro);
      alt('Alternate conclusion', t.altConclusion);
      if (t.keywords?.length) {
        flow.place(heading('Keywords', C.ink), { reserve: 24 });
        flow.place(makeBox(COL_W).chips(t.keywords));
      }
      flow.end();
    }
  }

  // ---- 3. AI analysis ------------------------------------------------------
  if (analysis) {
    const ma = analysis.modelAnswer || {};
    const flow = makeFlow({ kicker: 'AI analysis', title: 'Model answer, diagram and learnings', sub: qShort });
    const words = (n) => (n ? [{ text: `   ${n} words`, font: F.r, color: C.tertiary }] : []);
    const labelled = (label, part, opts, extra) => {
      if (!part?.text) return;
      flow.place(card(COL_W, { pad: 10, r: 6, ...opts }, (c) => {
        c.text([{ text: label.toUpperCase(), font: F.b, color: C.brand }, ...words(part.wordCount)], { size: 8.5 }).gap(4);
        c.text(part.text, { size: 9.5, color: C.ink });
        extra?.(c);
      }));
      flow.gap(9);
    };

    flow.place(heading(`Model answer${ma.totalWordCount ? ` · ~${ma.totalWordCount} words` : ''}`), { reserve: 60 });
    labelled('Introduction', ma.introduction, { bg: C.sunken, border: C.border }, (c) => {
      if (ma.introduction.keywords?.length) c.gap(6).chips(ma.introduction.keywords, { bg: C.white });
    });
    (ma.body || []).forEach((part, i) => {
      if (!part?.part && !part?.points?.length) return;
      flow.place(makeBox(COL_W).text([{ text: `Body ${i + 1} — `, font: F.b, color: C.tertiary }, { text: part.part || '', font: F.b, color: C.ink }], { size: 9.5 }).gap(4), { reserve: 30 });
      (part.points || []).forEach((p) => {
        if (!p?.text) return;
        const b = makeBox(COL_W).bullet([p.text, ...(p.tag ? [{ text: `  [${String(p.tag).toUpperCase()}]`, font: F.b, color: C.tertiary }] : [])], { color: C.ink });
        if (p.unconventionalBecause) b.text(`Why it stands out: ${p.unconventionalBecause}`, { size: 9.5, font: F.i, color: C.secondary, x: 11 });
        flow.place(b.gap(5));
      });
      flow.gap(5);
    });
    labelled('Way forward', ma.wayForward, { bg: C.brandSoft, border: C.brandSoftBorder }, (c) => {
      if (ma.wayForward.sources?.length) c.gap(4).text(`Sources: ${ma.wayForward.sources.join(' · ')}`, { size: 9, font: F.b, color: C.secondary });
    });
    labelled('Conclusion', ma.conclusion, { bg: C.sunken, border: C.border }, (c) => {
      if (ma.conclusion.quote) {
        const q = makeBox(c.width - 9).text(ma.conclusion.quote, { size: 8.5, font: F.i, color: C.brand });
        c.gap(5).rect({ x: 0, y: c.h, w: 1.6, h: q.h, fill: C.brand }).child(q, 9);
      }
    });

    // diagram
    const d = analysis.diagram;
    const dBoxes = d ? diagramBoxes(d) : [];
    if (d && (dBoxes.length || d.howToDraw)) {
      if (flow.col === 0 && flow.fill > 0.55) flow.breakCol();
      flow.gap(6);
      flow.place(heading(d.title ? `Diagram — ${d.title}` : 'Diagram'), { reserve: Math.min(260, (dBoxes[0]?.h || 0) + 10) });
      dBoxes.forEach((b) => flow.place(b));
      if (d.howToDraw) { flow.gap(7); flow.place(para(d.howToDraw)); }
      if (d.keywords?.length) flow.place(makeBox(COL_W).chips(d.keywords).gap(4));
      flow.gap(10);
    }

    if (analysis.learnings?.length) {
      flow.place(heading('What to learn from this answer'), { reserve: 80 });
      analysis.learnings.forEach((l, i) => {
        if (!l?.lesson) return;
        const b = makeBox(COL_W).bullet(l.lesson, { marker: `${i + 1}.`, indent: 15, color: C.ink });
        const dot = (v) => String(v).trim().replace(/[.\s]+$/, '');
        const tail = `${l.seenIn ? `Seen in: ${dot(l.seenIn)}. ` : ''}${l.applyElsewhere ? `Use it on: ${dot(l.applyElsewhere)}.` : ''}`;
        if (tail) b.text(tail, { size: 9.5, font: F.i, color: C.secondary, x: 15 });
        flow.place(b.gap(6));
      });
      flow.gap(8);
    }

    if (analysis.keywords?.length) {
      flow.place(heading('Keyword bank'), { reserve: 24 });
      flow.place(makeBox(COL_W).chips(analysis.keywords));
    }
    flow.end();
  }

  // ---- footer on every page ------------------------------------------------
  const pages = pdf.getPages();
  pages.forEach((page, i) => {
    const mb = page.getMediaBox();
    const y = mb.y + 12;
    page.drawRectangle({ x: 24, y: y + 11, width: SHEET_W - 48, height: 0.5, color: C.borderSoft });
    page.drawText('The Dark Horse UPSC  ·  Toppers Copy', { x: 24, y, size: 8.5, font: F.b, color: C.tertiary });
    const n = `${i + 1} / ${pages.length}`;
    page.drawText(n, { x: SHEET_W - 24 - F.r.widthOfTextAtSize(n, 8.5), y, size: 8.5, font: F.r, color: C.tertiary });
  });

  return pdf.save();

  // ---- helpers that need the fonts (hoisted) -------------------------------
  // Bold every keyword inside an alternate intro / conclusion.
  function highlight(text, keywords) {
    const ks = (keywords || []).filter((k) => k && k.trim()).sort((a, b) => b.length - a.length);
    if (!ks.length) return text;
    const re = new RegExp(`(${ks.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return String(text).split(re).map((part, i) => (i % 2 ? { text: part, font: F.b, color: C.ink } : { text: part }));
  }

  // The diagram as a list of boxes: table and timeline are drawn natively; the
  // SVG kinds (flow, chart, quadrant, pyramid) arrive rasterised as diagramImage.
  function diagramBoxes(d) {
    const out = [];
    if (d.kind === 'table') {
      const columns = (d.columns || []).map(String);
      const rows = (d.rows || []).map((r) => (Array.isArray(r) ? r : r.cells || [])).filter((c) => c.length);
      if (columns.length < 2 || !rows.length) return out;
      const n = columns.length;
      const w = COL_W / n;
      const size = n > 4 ? 7.2 : 8;
      const rowBox = (cells, header) => {
        const cellBoxes = columns.map((_, ci) =>
          makeBox(w - 10).text(String(cells[ci] ?? ''), {
            size, lead: 1.34,
            font: header || ci === 0 ? F.b : F.r,
            color: header || ci === 0 ? C.ink : C.secondary,
          })
        );
        const h = Math.max(...cellBoxes.map((b) => b.h)) + 9;
        const row = makeBox(COL_W);
        if (header) row.rect({ x: 0, y: 0, w: COL_W, h, fill: C.raised });
        cellBoxes.forEach((b, ci) => {
          row.ops.push({ k: 'box', child: b, x: ci * w + 5, y: 4.5 });
          row.path({ x: ci * w, y: 0, d: `M 0,0 H ${w} V ${h} H 0 Z`, stroke: C.border, sw: 0.5 });
        });
        return row.gap(h);
      };
      out.push(rowBox(columns, true));
      rows.forEach((cells) => out.push(rowBox(cells, false)));
      return out;
    }
    if (d.kind === 'timeline') {
      const events = (d.events || []).filter((e) => e.when || e.label).slice(0, 8);
      if (events.length < 2) return out;
      events.forEach((e, i) => {
        const b = makeBox(COL_W);
        if (e.when) b.text(e.when, { size: 8, font: F.b, color: C.brand, x: 18, lead: 1.3 });
        b.text(e.label || '', { size: 9, color: C.ink, x: 18 }).gap(9);
        if (i < events.length - 1) b.ops.unshift({ k: 'rect', x: 5.2, y: 6, w: 1.4, h: b.h, fill: C.border });
        b.rrect({ x: 2.4, y: 2.6, w: 7, h: 7, r: 3.5, fill: C.brand });
        out.push(b);
      });
      return out;
    }
    if (!diagramImage?.embedded) return out;
    const maxW = COL_W - 20;
    const s = Math.min(maxW / diagramImage.width, 300 / diagramImage.height, 1.15);
    const w = diagramImage.width * s;
    const h = diagramImage.height * s;
    out.push(card(COL_W, { pad: 10, bg: C.white, border: C.border, r: 6 }, (c) => {
      c.image(diagramImage.embedded, w, h, (c.width - w) / 2);
      if (d.kind === 'chart') {
        const series = (d.series || []).filter((x) => (x.points || []).length);
        if (series.length > 1) {
          c.gap(6);
          series.forEach((sr, i) => {
            c.rrect({ x: 0, y: c.h + 2.5, w: 7, h: 7, r: 1.5, fill: hex(CHART_CAT[i % CHART_CAT.length]) });
            c.text(sr.label || `Series ${i + 1}`, { size: 8, x: 12 });
          });
        }
        if (d.unit || d.source) {
          c.gap(4).text(`${d.unit ? `Figures in ${d.unit}. ` : ''}${d.source ? `Source: ${d.source}` : ''}`, { size: 8.5, color: C.secondary });
        }
      }
    }));
    return out;
  }
}

function hasTakeaways(t) {
  return !!t && !!(t.techniques?.length || t.enrichment?.length || t.keywords?.length || t.presentation?.length || t.altIntro?.text || t.altConclusion?.text);
}
