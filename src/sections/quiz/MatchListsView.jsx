// Renders a "Match List I with List II" question as two side-by-side columns instead of one
// flat text blob. `matchLists` = { left: {header, items:[{key,text}]}, right: {...} }.
export default function MatchListsView({ stem, matchLists }) {
  const { left, right } = matchLists;
  return (
    <div>
      {stem && <p className="leading-relaxed mb-3">{stem}</p>}
      <div className="grid grid-cols-2 gap-3">
        {[left, right].map((col, ci) => (
          <div key={ci} className="border border-border-default rounded-xl overflow-hidden">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-text-tertiary bg-sunken border-b border-border-default">
              {col.header}
            </div>
            <ul>
              {col.items.map((it) => (
                <li key={it.key} className="flex gap-2 px-3 py-2 text-sm border-t border-border-default first:border-t-0">
                  <span className="font-bold flex-none text-brand" style={{ minWidth: '1.4em' }}>{it.key}.</span>
                  <span className="leading-snug text-text-primary">{it.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-text-tertiary mt-2">
        Each option below gives the correct match for {left.items.map((i) => i.key).join(', ')}.
      </p>
    </div>
  );
}
