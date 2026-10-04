import { useLayoutEffect, useRef, useState } from 'react';

// The "enhancement layer" drawn over one page of a topper's answer copy.
//   works → green, LEFT margin: why these lines earn marks
//   addon → blue,  RIGHT margin: extra material to take the point further
// Each note is anchored to a vertical span of the page (yFrom..yTo, fractions of
// page height). Wide screens get Aspirants-Hub style margin notes with a bracket
// over the span and an arrow to it; narrow screens get numbered pins on the page
// edge that open the note on tap.

const GAP = 8;
const TONE = {
  works: { color: 'var(--color-status-success-text)', bg: 'var(--color-status-success-bg)', icon: '✨', label: 'Why this works' },
  addon: { color: 'var(--color-status-info-text)', bg: 'var(--color-status-info-bg)', icon: '➕', label: 'Value add' },
};

const ENHANCE_MARGIN_W = 190;

function NoteBody({ note }) {
  const t = TONE[note.kind];
  return (
    <>
      <p className="text-[11px] font-bold leading-snug" style={{ color: t.color }}>
        {t.icon} {note.title || t.label}
      </p>
      {note.text ? <p className="text-[11px] leading-snug text-text-secondary mt-0.5">{note.text}</p> : null}
      {note.points?.length ? (
        <ul className="mt-1 space-y-0.5">
          {note.points.map((p, i) => (
            <li key={i} className="text-[11px] leading-snug text-text-secondary flex gap-1">
              <span style={{ color: t.color }}>•</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

// Stack a side's notes near their anchors without overlapping: push down, then
// if the last one runs past the page, pull the stack back up.
const layoutSide = (items, pageH) => {
  const out = new Map();
  let prevBottom = -Infinity;
  const placed = items.map((it) => {
    const want = ((it.note.yFrom + it.note.yTo) / 2) * pageH - it.h / 2;
    const top = Math.max(0, want, prevBottom + GAP);
    prevBottom = top + it.h;
    return { ...it, top };
  });
  let nextTop = Math.max(pageH, prevBottom);
  for (let i = placed.length - 1; i >= 0; i--) {
    placed[i].top = Math.max(0, Math.min(placed[i].top, nextTop - placed[i].h - (i === placed.length - 1 ? 0 : GAP)));
    nextTop = placed[i].top;
  }
  placed.forEach((p) => out.set(p.key, p.top));
  return out;
};

export function EnhancementMargins({ notes, pageW, pageH, marginW = ENHANCE_MARGIN_W }) {
  const refs = useRef({});
  const [tops, setTops] = useState({});
  const [hot, setHot] = useState(null);

  const keyed = notes.map((n, i) => ({ key: n._id || `${n.page}-${i}`, note: n }));
  const sig = `${pageH}|${keyed.map((k) => k.key).join(',')}`;

  useLayoutEffect(() => {
    const next = {};
    for (const kind of ['works', 'addon']) {
      const items = keyed
        .filter((k) => k.note.kind === kind)
        .map((k) => ({ ...k, h: refs.current[k.key]?.offsetHeight || 40 }))
        .sort((a, b) => a.note.yFrom - b.note.yFrom);
      layoutSide(items, pageH).forEach((top, key) => { next[key] = top; });
    }
    setTops(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const totalW = pageW + marginW * 2;
  const pageL = marginW;
  const pageR = marginW + pageW;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ width: totalW }}>
      <svg className="absolute inset-0 overflow-visible" width={totalW} height={pageH} aria-hidden="true">
        <defs>
          {Object.entries(TONE).map(([k, t]) => (
            <marker key={k} id={`enh-arrow-${k}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" fill={t.color} />
            </marker>
          ))}
        </defs>
        {keyed.map(({ key, note }) => {
          const t = TONE[note.kind];
          const y1 = note.yFrom * pageH;
          const y2 = note.yTo * pageH;
          const mid = (y1 + y2) / 2;
          const top = tops[key];
          const noteY = top == null ? mid : top + 10;
          const left = note.kind === 'works';
          const bx = left ? pageL + 4 : pageR - 4;
          const tick = left ? 6 : -6;
          const fromX = left ? pageL - GAP - 2 : pageR + GAP + 2;
          const width = hot === key ? 2.5 : 1.5;
          return (
            <g key={key} opacity={hot && hot !== key ? 0.35 : 1}>
              {/* bracket over the lines */}
              <path
                d={`M${bx + tick},${y1} L${bx},${y1} L${bx},${y2} L${bx + tick},${y2}`}
                fill="none" stroke={t.color} strokeWidth={width} strokeLinejoin="round"
              />
              {/* arrow from the note to the bracket */}
              <path
                d={`M${fromX},${noteY} C${(fromX + bx) / 2},${noteY} ${(fromX + bx) / 2},${mid} ${bx - (left ? 3 : -3)},${mid}`}
                fill="none" stroke={t.color} strokeWidth={width} markerEnd={`url(#enh-arrow-${note.kind})`}
              />
            </g>
          );
        })}
      </svg>

      {keyed.map(({ key, note }) => {
        const left = note.kind === 'works';
        return (
          <div
            key={key}
            ref={(el) => { refs.current[key] = el; }}
            onMouseEnter={() => setHot(key)}
            onMouseLeave={() => setHot(null)}
            className="absolute pointer-events-auto rounded-md px-2 py-1.5 border shadow-sm transition-opacity"
            style={{
              top: tops[key] ?? -9999,
              width: marginW - GAP * 2,
              [left ? 'left' : 'right']: 4,
              background: 'var(--color-surface)',
              borderColor: TONE[note.kind].color,
              borderLeftWidth: left ? 3 : 1,
              borderRightWidth: left ? 1 : 3,
              opacity: hot && hot !== key ? 0.55 : 1,
            }}
          >
            <NoteBody note={note} />
          </div>
        );
      })}
    </div>
  );
}

// Narrow screens: a numbered pin on the page edge per note; tap to read it.
export function EnhancementPins({ notes, pageW, pageH }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="absolute inset-0" style={{ width: pageW, height: pageH }} onClick={() => setOpen(null)}>
      {notes.map((note, i) => {
        const t = TONE[note.kind];
        const left = note.kind === 'works';
        const key = note._id || i;
        const y1 = note.yFrom * pageH;
        const y2 = note.yTo * pageH;
        const mid = (y1 + y2) / 2;
        return (
          <div key={key}>
            <div
              className="absolute w-[3px] rounded-full"
              style={{ top: y1, height: Math.max(8, y2 - y1), [left ? 'left' : 'right']: 2, background: t.color, opacity: 0.7 }}
            />
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(open === key ? null : key); }}
              className="absolute w-6 h-6 -mt-3 rounded-full text-[11px] font-bold text-white shadow cursor-pointer flex items-center justify-center"
              style={{ top: mid, [left ? 'left' : 'right']: 6, background: t.color }}
              aria-label={`${t.label} note ${i + 1}`}
            >
              {i + 1}
            </button>
            {open === key && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute z-10 rounded-lg px-3 py-2 border shadow-lg"
                style={{
                  top: Math.min(mid + 16, Math.max(0, pageH - 140)),
                  [left ? 'left' : 'right']: 6,
                  width: Math.min(260, pageW - 12),
                  background: 'var(--color-surface)',
                  borderColor: t.color,
                }}
              >
                <NoteBody note={note} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// End-of-answer summary for the analysis panel.
export function TopperTakeaways({ enhancement, topper }) {
  const t = enhancement?.takeaways;
  if (!t || (!t.techniques?.length && !t.enrichment?.length && !t.keywords?.length)) return null;
  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-3 mb-4">
      <p className="text-xs font-bold text-text-primary uppercase tracking-wide">
        ✨ Takeaways{topper ? ` · ${topper}` : ''}
        {!enhancement.published && (
          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-status-warning-bg text-status-warning-text normal-case">Draft</span>
        )}
      </p>
      {t.techniques?.length ? (
        <div className="mt-2">
          <p className="text-[11px] font-bold" style={{ color: TONE.works.color }}>Techniques to copy</p>
          <ul className="mt-0.5 space-y-0.5">
            {t.techniques.map((s, i) => <li key={i} className="text-xs text-text-secondary">• {s}</li>)}
          </ul>
        </div>
      ) : null}
      {t.enrichment?.length ? (
        <div className="mt-2">
          <p className="text-[11px] font-bold" style={{ color: TONE.addon.color }}>Enrichment bank</p>
          <ul className="mt-0.5 space-y-0.5">
            {t.enrichment.map((s, i) => <li key={i} className="text-xs text-text-secondary">• {s}</li>)}
          </ul>
        </div>
      ) : null}
      {t.keywords?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {t.keywords.map((k, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-sunken text-text-secondary border border-border-default">{k}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
