import { useEffect, useMemo, useState } from 'react';
import { getPyqStats } from '../../lib/economyApi';

// "What UPSC asks": Economy Prelims PYQs per syllabus chapter as ranked bars, for all years or a
// recent window. One series, so one hue (indigo, the PYQ colour); the number and share sit beside
// every bar, so the chart doubles as its own table. Tap a chapter to open it.

const RANGES = [
  { key: 'all', label: 'All years' },
  { key: 10, label: 'Last 10 years' },
  { key: 5, label: 'Last 5 years' },
];
const COLLAPSED = 8;

export default function PyqTrends({ admin, onOpenTheme }) {
  const [stats, setStats] = useState(null);
  const [range, setRange] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const [hover, setHover] = useState(null);

  useEffect(() => { getPyqStats().then(setStats).catch(() => setStats(false)); }, []);

  const view = useMemo(() => {
    if (!stats) return null;
    const from = range === 'all' ? 0 : stats.lastYear - range + 1;
    const count = (c) => (range === 'all' ? c.total : Object.entries(c.years).reduce((a, [y, n]) => a + (Number(y) >= from ? n : 0), 0));
    const lastAsked = (c) => Math.max(0, ...Object.keys(c.years).map(Number));
    const rows = stats.chapters.map((c, i) => ({ ...c, n: count(c), last: lastAsked(c), order: i }));
    const placed = rows.filter((r) => r.key).sort((a, b) => b.n - a.n || a.order - b.order);
    const unplaced = rows.find((r) => !r.key);
    const total = rows.reduce((a, r) => a + r.n, 0);
    return { placed, unplaced, total, max: Math.max(1, ...placed.map((r) => r.n)), from: from || stats.firstYear };
  }, [stats, range]);

  if (stats === false || (stats && !stats.total)) return null;

  const rows = view ? (showAll ? view.placed : view.placed.slice(0, COLLAPSED)) : [];
  const pct = (n) => (view.total ? Math.round((n / view.total) * 100) : 0);

  return (
    <section className="mb-6 rounded-2xl border border-border-default bg-surface overflow-hidden">
      <header className="flex flex-col sm:flex-row sm:items-end gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-border-default">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">🎯 What UPSC asks</p>
          <h2 className="font-display text-lg font-semibold text-text-primary leading-snug">Prelims Economy questions by chapter</h2>
          {view && (
            <p className="text-[12px] text-text-tertiary mt-0.5">
              {view.total} questions · {view.from}–{stats.lastYear}
            </p>
          )}
        </div>
        <div className="self-start sm:self-auto flex rounded-lg border border-border-default overflow-hidden" role="group" aria-label="Years">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={`px-2.5 py-1.5 text-[11px] font-bold cursor-pointer border-r last:border-r-0 border-border-default transition-colors ${
                range === r.key ? 'bg-indigo-900 text-white dark:bg-indigo-500/30 dark:text-indigo-100' : 'bg-surface text-text-secondary hover:text-text-primary'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {!view ? (
        <div className="h-48 animate-pulse bg-surface-raised/50" />
      ) : (
        <div className="px-2 sm:px-3 py-3">
          <ol className="space-y-0.5">
            {rows.map((r, i) => (
              <li key={r.key}>
                <button
                  onClick={() => r.visible && onOpenTheme(r.key)}
                  onMouseEnter={() => setHover(r.key)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(r.key)}
                  onBlur={() => setHover(null)}
                  disabled={!r.visible}
                  className="group w-full grid grid-cols-[1.25rem_minmax(0,1fr)_auto] sm:grid-cols-[1.5rem_15rem_minmax(0,1fr)_5.5rem] items-center gap-x-2 gap-y-1 sm:gap-3 px-2 py-1.5 rounded-lg text-left enabled:cursor-pointer enabled:hover:bg-indigo-50/70 dark:enabled:hover:bg-indigo-500/10 transition-colors"
                >
                  <span className="text-[11px] font-bold text-text-tertiary tabular-nums text-right">{i + 1}</span>
                  <span className="text-[13px] font-semibold text-text-primary leading-tight truncate" title={r.title}>{r.title}</span>
                  <span className="relative h-5 flex items-center col-start-2 col-span-2 row-start-2 sm:col-start-auto sm:col-span-1 sm:row-start-auto">
                    <span
                      className={`block h-3.5 rounded-r-[4px] transition-all duration-500 ${r.n ? 'bg-indigo-600 dark:bg-indigo-400' : ''} ${hover === r.key ? 'bg-indigo-800 dark:bg-indigo-300' : ''}`}
                      style={{ width: r.n ? `max(4px, ${(r.n / view.max) * 100}%)` : 0 }}
                    />
                    {hover === r.key && (
                      <span role="tooltip" className="absolute z-20 left-0 top-6 sm:top-auto sm:-top-9 whitespace-nowrap rounded-md bg-ink-900 text-paper-0 dark:bg-paper-0 dark:text-ink-900 text-[11px] font-semibold px-2 py-1 shadow-lg pointer-events-none">
                        {r.n} question{r.n === 1 ? '' : 's'} · {pct(r.n)}% · {r.last ? `last asked ${r.last}` : 'never asked'}
                      </span>
                    )}
                  </span>
                  <span className="text-right tabular-nums whitespace-nowrap">
                    <span className="text-[13px] font-extrabold text-text-primary">{r.n}</span>
                    <span className="text-[11px] font-semibold text-text-tertiary ml-1.5">{pct(r.n)}%</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>

          {view.placed.length > COLLAPSED && (
            <button onClick={() => setShowAll((s) => !s)} className="mt-1 ml-2 text-[12px] font-bold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer">
              {showAll ? 'Show top chapters only' : `Show all ${view.placed.length} chapters`}
            </button>
          )}

          {view.unplaced?.n > 0 && (
            <p className="mt-3 mx-2 pt-3 border-t border-border-default text-[12px] text-text-tertiary leading-relaxed">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-text-tertiary/50 align-middle mr-1.5" aria-hidden="true" />
              <span className="font-bold text-text-secondary">{view.unplaced.n} more ({pct(view.unplaced.n)}%)</span> come from mixed sections and aren't on a chapter yet.
              {admin && ' Place them with AI in Admin → MCQ Test Data → Syllabus.'}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
