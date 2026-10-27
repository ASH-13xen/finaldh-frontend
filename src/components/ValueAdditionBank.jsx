import { useEffect, useMemo, useState } from 'react';
import LoadingSpinner from './LoadingSpinner';

// Searchable "notes bank" of a Toppers Copy value addition — parsed on the server from
// the admin's Word file (finaldh utils/valueAdditionDocx.js). Students search it, filter
// by note type (data, facts, examples…) and by section; notes are listed in the Word
// file's own order (section → Introduction, Quotes, Data, Facts…), like the document.

const TYPES = [
  ['intro', 'Intros', 'Intro'],
  ['quote', 'Quotes', 'Quote'],
  ['data', 'Data', 'Data'],
  ['fact', 'Facts', 'Fact'],
  ['example', 'Examples', 'Example'],
  ['case', 'Case studies', 'Case study'],
  ['now', 'Current affairs', 'Current affairs'],
  ['conclusion', 'Conclusions', 'Conclusion'],
  ['diagram', 'Diagrams', 'Diagram'],
];

const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Search-term highlight; "*text*" from the Word file renders as italics.
function Hl({ text, terms }) {
  const parts = String(text ?? '').split(/\*([^*]+)\*/);
  const re = terms.length ? new RegExp(`(${terms.map(escapeRe).join('|')})`, 'gi') : null;
  const mark = (s, k) => (re
    ? s.split(re).map((x, i) => (i % 2 ? <mark key={`${k}-${i}`} className="bg-status-warning-bg text-inherit rounded-sm px-px">{x}</mark> : x))
    : s);
  return parts.map((p, i) => (i % 2 ? <em key={i}>{mark(p, i)}</em> : <span key={i}>{mark(p, i)}</span>));
}

// One box per run of notes (e.g. all three intros of a section), each note a bullet:
// "Label: text". Section, type and sub-heading are the headings above the box (see sectionRuns).
function NoteBox({ notes, terms }) {
  return (
    <ul className="p-3 pl-7 bg-surface border border-border-default rounded-xl list-disc marker:text-brand space-y-2">
      {notes.map((note) => (
        <li key={note.id} className={`text-[15px] leading-relaxed font-reading ${note.type === 'quote' ? 'text-text-primary' : 'text-text-secondary'}`}>
          {note.title ? <b className="font-bold text-text-primary not-italic"><Hl text={note.title} terms={terms} />{note.text ? ': ' : ''}</b> : null}
          {note.cols?.length ? (
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 mt-1 text-sm">
              {note.cols.map(([k, v], i) => (
                <div key={i} className="contents">
                  <dt className="text-text-tertiary">{k}</dt>
                  <dd><Hl text={v} terms={terms} /></dd>
                </div>
              ))}
            </dl>
          ) : (
            <span className={note.type === 'quote' ? 'italic' : ''}><Hl text={note.text} terms={terms} /></span>
          )}
        </li>
      ))}
    </ul>
  );
}

// Rows from one Word table, redrawn as that table (header row from the file). Rows hidden by
// the search / filters simply drop out. A row's cells are matched to the header by label.
function NoteTable({ table, rows, terms }) {
  const [first, ...rest] = table.head;
  return (
    <div className="overflow-x-auto border border-border-default rounded-xl bg-surface">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-sunken text-left">
            {[first, ...rest].map((h, i) => (
              <th key={i} className="px-3 py-2 font-bold text-text-primary border-b border-border-default align-bottom">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => (
            <tr key={n.id} className="border-t border-border-default first:border-t-0 align-top">
              <td className="px-3 py-2 font-semibold text-text-primary"><Hl text={n.title} terms={terms} /></td>
              {rest.map((h, i) => (
                <td key={i} className="px-3 py-2 font-reading text-text-secondary">
                  <Hl text={n.cols?.find(([k]) => k === h)?.[1] || ''} terms={terms} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ValueAdditionBank({ entryId }) {
  const [bank, setBank] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [section, setSection] = useState('all');
  const [showPyqs, setShowPyqs] = useState(false);

  useEffect(() => {
    // The parent remounts this component per entry (key), so state starts fresh.
    let live = true;
    fetch(`/api/toppers-copy/value-additions/${entryId}/bank`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not load these notes');
        return data.bank;
      })
      .then((b) => live && setBank(b))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [entryId]);

  const sectionsById = useMemo(() => Object.fromEntries((bank?.sections || []).map((s) => [s.id, s])), [bank]);
  const tablesById = useMemo(() => Object.fromEntries((bank?.tables || []).map((t) => [t.id, t])), [bank]);
  const sectionNo = useMemo(() => Object.fromEntries((bank?.sections || []).map((s, i) => [s.id, i + 1])), [bank]);
  const hay = useMemo(() => (bank?.notes || []).map((n) => fold([
    n.title, n.text, n.sub, (n.cols || []).flat().join(' '), sectionsById[n.section]?.name,
  ].join(' '))), [bank, sectionsById]);

  const terms = useMemo(() => fold(q).split(/\s+/).filter((t) => t.length > 1), [q]);
  // Notes matching search + section, before the type filter (for the chip counts).
  const pool = useMemo(() => (bank?.notes || []).filter((n, i) =>
    (section === 'all' || n.section === section) && terms.every((t) => hay[i].includes(t))), [bank, hay, section, terms]);
  const counts = useMemo(() => pool.reduce((c, n) => ({ ...c, [n.type]: (c[n.type] || 0) + 1 }), {}), [pool]);
  const shown = type === 'all' ? pool : pool.filter((n) => n.type === type);
  // Notes keep the Word file's order: section → Introduction, Quotes, Data… → sub-heading,
  // so a section reads top to bottom like the document.
  const sectionRuns = [];
  shown.forEach((n) => {
    let sr = sectionRuns[sectionRuns.length - 1];
    if (sr?.id !== n.section) sectionRuns.push(sr = { id: n.section, runs: [] });
    const run = sr.runs[sr.runs.length - 1];
    const sameHead = run && run.type === n.type && run.sub === n.sub;
    // Rows of one Word table stay together as a table run.
    if (sameHead && run.tbl === n.tbl) run.notes.push(n);
    else sr.runs.push({ type: n.type, sub: n.sub, tbl: n.tbl, head: !sameHead, notes: [n] });
  });

  if (error) return <p className="px-5 py-4 text-sm text-status-danger-text">{error}</p>;
  if (!bank) return <div className="px-5 py-6"><LoadingSpinner text="Loading notes…" /></div>;

  const sec = sectionsById[section];
  const multi = bank.sections.length > 1;
  const chip = (active) => `px-2.5 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default ${
    active ? 'bg-text-primary text-surface border-text-primary' : 'bg-surface text-text-secondary border-border-default hover:border-brand/60'
  }`;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 bg-surface border-b border-border-default px-5 py-3 space-y-2.5">
        <div className="flex flex-wrap gap-2">
          <input
            id="va-bank-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search facts, data, examples… e.g. UNESCO, inscription, 2023"
            className="flex-1 min-w-[180px] bg-sunken border border-border-default focus:border-brand text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none"
          />
          {multi && (
            <select
              id="va-bank-section"
              value={section}
              onChange={(e) => { setSection(e.target.value); setShowPyqs(false); }}
              className="max-w-full bg-sunken border border-border-default text-text-primary rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-brand"
            >
              <option value="all">All sections ({bank.sections.length})</option>
              {bank.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button className={chip(type === 'all')} onClick={() => setType('all')}>
            All <span className="opacity-60 tabular-nums">{pool.length}</span>
          </button>
          {TYPES.filter(([k]) => bank.notes.some((n) => n.type === k)).map(([k, label]) => (
            <button key={k} className={chip(type === k)} disabled={!counts[k]} onClick={() => setType(k)}>
              {label} <span className="opacity-60 tabular-nums">{counts[k] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {(sec || !multi) && (() => {
          const s = sec || bank.sections[0];
          return (s.pyqs.length > 0 || s.keywords.length > 0) && (
            <div className="space-y-2">
              {s.pyqs.length > 0 && (
                <div>
                  <button className="text-xs font-bold text-brand cursor-pointer" onClick={() => setShowPyqs((v) => !v)}>
                    {showPyqs ? '▾' : '▸'} PYQs these notes cover ({s.pyqs.length})
                  </button>
                  {showPyqs && (
                    <ul className="mt-2 space-y-1.5">
                      {s.pyqs.map((p, i) => (
                        <li key={i} className="flex gap-2 text-[13px] text-text-secondary">
                          <span className="font-bold text-brand tabular-nums flex-shrink-0">{p.year}</span>
                          <span className="font-reading">{p.question}{p.map ? <span className="block text-[11px] text-text-tertiary">Notes: {p.map}</span> : null}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {s.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {s.keywords.map((k) => (
                    <button key={k} onClick={() => setQ(k)} className="text-[11px] px-2 py-0.5 rounded-md bg-sunken text-text-secondary hover:text-brand cursor-pointer">{k}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        <p className="text-xs text-text-tertiary">
          {shown.length} note{shown.length === 1 ? '' : 's'}
          {sec ? ` in ${sec.name}` : ''}
          {q.trim() ? ` matching “${q.trim()}”` : ''}
        </p>

        {!shown.length && (
          <p className="text-sm text-text-tertiary italic py-6 text-center">No notes match. Try a shorter word, another section, or clear the type filter.</p>
        )}

        {sectionRuns.map((sr) => (
          <section key={sr.id} className="space-y-3">
            {multi && (
              <h3 className="text-base font-bold text-text-primary border-b border-border-default pb-1.5">
                {sectionNo[sr.id]}. {sectionsById[sr.id]?.name}
              </h3>
            )}
            {sr.runs.map((run) => (
              <div key={run.notes[0].id} className="space-y-2">
                {run.head && (
                  <h4 className="text-xs font-bold uppercase tracking-wide text-text-tertiary">
                    {TYPES.find(([k]) => k === run.type)?.[1] || 'Notes'}
                    {run.sub ? <span className="normal-case font-semibold"> · <Hl text={run.sub} terms={terms} /></span> : null}
                  </h4>
                )}
                {tablesById[run.tbl]
                  ? <NoteTable table={tablesById[run.tbl]} rows={run.notes} terms={terms} />
                  : <NoteBox notes={run.notes} terms={terms} />}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
