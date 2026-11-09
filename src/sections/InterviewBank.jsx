import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Icon from '../components/mcq/Icon';
import { ActionButton, Chip, ErrorBanner, EmptyState } from '../components/mcq/ui';
import { Shell, PageHeader, Panel, Segmented, Skeleton, TimesAsked, YearBars, SourcesCredit } from '../components/interview/ui';
import FamilyDrawer from '../components/interview/FamilyDrawer';
import { iv, qs, errorMessage, cseLabel, ASKER_LABEL } from '../lib/interviewApi';

const SORTS = [{ value: 'relevance', label: 'Best match' }, { value: 'asked', label: 'Most asked' }, { value: 'recent', label: 'Most recent' }];
const SUGGESTIONS = ['net neutrality', 'women empowerment', 'India China', 'AI', 'online gaming', 'farm laws', 'cooperative federalism', 'your hobby', 'as a DM'];

const selectCls = 'rounded-xl border border-border-default bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand/40 cursor-pointer';

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function ResultCard({ f, years, onOpen }) {
  return (
    <li>
      <button onClick={() => onOpen(f.id)} className="w-full text-left rounded-2xl border border-border-default bg-surface hover:border-brand hover:shadow-md px-4 py-3.5 transition-all cursor-pointer group">
        <div className="flex items-start gap-4">
          <span className={`shrink-0 mt-0.5 w-12 text-center rounded-xl py-1.5 ${f.timesAsked >= 3 ? 'bg-accent-soft-bg text-brand' : 'bg-sunken text-text-secondary'}`}>
            <span className="block text-lg font-bold leading-none">{f.timesAsked}</span>
            <span className="block text-[10px] font-semibold mt-0.5">asked</span>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] text-text-primary group-hover:text-brand leading-relaxed">{f.text}</span>
            <span className="flex flex-wrap items-center gap-2 mt-2">
              <YearBars yearCounts={f.yearCounts} allYears={years} />
              <span className="text-xs text-text-tertiary">last {cseLabel(f.lastYear)}</span>
              {f.topicLabels.slice(0, 2).map((t) => <Chip key={t}>{t}</Chip>)}
              {f.hookTypes[0] && <Chip tone="brand">DAF · {f.hookTypes[0]}</Chip>}
              {f.boards.filter(Boolean).slice(0, 2).map((b) => <span key={b} className="text-xs text-text-tertiary">{b}</span>)}
            </span>
          </span>
        </div>
      </button>
    </li>
  );
}

function SearchTab({ facets, years, initialQuery, onOpen }) {
  const [q, setQ] = useState(initialQuery || '');
  const dq = useDebounced(q, 280);
  const [filters, setFilters] = useState({ year: '', board: '', topic: '', hookType: '', asker: '', qtype: '', shelfLife: '', minAsked: '' });
  const [sort, setSort] = useState('relevance');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ key: '', total: 0, items: [], loading: true, error: '' });
  const inputRef = useRef(null);

  const key = JSON.stringify({ dq, filters, sort });
  // A new query or filter starts again from page 1 (page is part of the request, not of the key).
  const [pageKey, setPageKey] = useState(key);
  if (pageKey !== key) { setPageKey(key); setPage(1); }

  useEffect(() => {
    let cancelled = false;
    iv(`/bank/search${qs({ q: dq, ...filters, sort, page, limit: 20 })}`)
      .then((d) => {
        if (cancelled) return;
        setResult((r) => ({ key, total: d.total, items: page === 1 ? d.items : [...r.items, ...d.items], loading: false, error: '', semantic: d.semantic }));
      })
      .catch((err) => { if (!cancelled) setResult((r) => ({ ...r, loading: false, error: errorMessage(err) })); });
    return () => { cancelled = true; };
  }, [key, page, dq, filters, sort]);

  const loading = result.key !== key || result.loading;
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const active = Object.values(filters).filter(Boolean).length;

  return (
    <>
      <div className="relative">
        <Icon name="search" className="w-5 h-5 text-text-tertiary absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a topic, a hobby, a place — e.g. “net neutrality”, “kabaddi”, “Bihar”"
          className="w-full rounded-2xl border border-border-default bg-surface pl-12 pr-12 py-4 text-base text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand shadow-sm"
          aria-label="Search past interview questions"
        />
        {q && (
          <button onClick={() => { setQ(''); inputRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-text-tertiary hover:text-text-primary cursor-pointer" aria-label="Clear search">
            <Icon name="x" className="w-4 h-4" />
          </button>
        )}
      </div>
      {!q && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => setQ(s)} className="rounded-full border border-border-default bg-surface px-3 py-1 text-xs font-semibold text-text-secondary hover:border-brand hover:text-brand cursor-pointer">{s}</button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-5">
        <select value={filters.year} onChange={(e) => setF('year', e.target.value)} className={selectCls} aria-label="Year">
          <option value="">All years</option>
          {facets?.years.map((y) => <option key={y.value} value={y.value}>{cseLabel(y.value)}</option>)}
        </select>
        <select value={filters.board} onChange={(e) => setF('board', e.target.value)} className={selectCls} aria-label="Board">
          <option value="">All boards</option>
          {facets?.boards.map((b) => <option key={b.value} value={b.value}>{b.value}</option>)}
        </select>
        <select value={filters.topic} onChange={(e) => setF('topic', e.target.value)} className={selectCls} aria-label="Topic">
          <option value="">All topics</option>
          {facets?.topics.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filters.hookType} onChange={(e) => setF('hookType', e.target.value)} className={selectCls} aria-label="DAF area">
          <option value="">Any DAF area</option>
          {facets?.hookTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filters.asker} onChange={(e) => setF('asker', e.target.value)} className={selectCls} aria-label="Asked by">
          <option value="">Asked by anyone</option>
          {['chairman', 'm1', 'm2', 'm3', 'm4'].map((a) => <option key={a} value={a}>{ASKER_LABEL[a]}</option>)}
        </select>
        <select value={filters.qtype} onChange={(e) => setF('qtype', e.target.value)} className={selectCls} aria-label="Question type">
          <option value="">Any type</option>
          {facets?.qtypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface px-3 py-2 text-sm text-text-secondary cursor-pointer">
          <input type="checkbox" checked={filters.minAsked === '2'} onChange={(e) => setF('minAsked', e.target.checked ? '2' : '')} className="accent-[var(--accent)]" />
          Asked 2+ times
        </label>
        {active > 0 && (
          <button onClick={() => setFilters({ year: '', board: '', topic: '', hookType: '', asker: '', qtype: '', shelfLife: '', minAsked: '' })} className="text-sm font-semibold text-brand hover:underline cursor-pointer">
            Clear filters
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-6 mb-3">
        <p className="text-sm text-text-secondary">
          {loading && result.key !== key ? 'Searching…' : <><span className="font-bold text-text-primary">{result.total.toLocaleString('en-IN')}</span> question{result.total === 1 ? '' : 's'}{result.semantic ? ' · matched by meaning too' : ''}</>}
        </p>
        <Segmented size="sm" value={sort} onChange={setSort} options={SORTS} ariaLabel="Sort" />
      </div>

      {result.error && <ErrorBanner>{result.error}</ErrorBanner>}
      {loading && result.key !== key ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : result.items.length === 0 ? (
        <EmptyState icon="search" title="No questions match">Try fewer words or clear a filter.</EmptyState>
      ) : (
        <>
          <ul className="space-y-2">
            {result.items.map((f) => <ResultCard key={f.id} f={f} years={years} onOpen={onOpen} />)}
          </ul>
          {result.items.length < result.total && (
            <div className="text-center mt-5">
              <ActionButton onClick={() => { setResult((r) => ({ ...r, loading: true })); setPage((p) => p + 1); }} disabled={result.loading}>{result.loading ? 'Loading…' : 'Show more'}</ActionButton>
            </div>
          )}
        </>
      )}
    </>
  );
}

// Topic share per year as a heat table: each cell is that topic's share of the year's questions
// (years have different numbers of transcripts, so raw counts would mislead). One hue, light -> dark.
function TopicHeat({ trends }) {
  const years = trends.years;
  const yearTotals = Object.fromEntries(years.map((y) => [y, trends.topics.reduce((s, t) => s + (t.byYear[y] || 0), 0)]));
  const rows = trends.topics.filter((t) => t.topic !== 'general').slice(0, 12);
  const share = (t, y) => (yearTotals[y] ? (t.byYear[y] || 0) / yearTotals[y] : 0);
  const max = Math.max(0.01, ...rows.flatMap((t) => years.map((y) => share(t, y))));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="text-left text-xs font-semibold text-text-tertiary pb-2 pr-3">Topic</th>
            {years.map((y) => <th key={y} className="text-xs font-semibold text-text-tertiary pb-2 tabular-nums">{cseLabel(y)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.topic}>
              <td className="pr-3 py-0.5 text-text-secondary whitespace-nowrap">{t.label}</td>
              {years.map((y) => {
                const s = share(t, y);
                const k = s / max;
                return (
                  <td
                    key={y}
                    title={`${t.label}, ${cseLabel(y)}: ${(s * 100).toFixed(1)}% of questions (${t.byYear[y] || 0})`}
                    className={`text-center rounded-[4px] py-2 tabular-nums font-semibold ${k > 0.55 ? 'text-text-on-accent' : 'text-text-primary'}`}
                    style={{ background: `color-mix(in oklab, var(--accent) ${Math.round(8 + k * 82)}%, var(--bg-surface))` }}
                  >
                    {(s * 100).toFixed(1)}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-text-tertiary mt-2">Share of each year’s questions; darker = larger share. Questions with no clear topic are left out.</p>
    </div>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border-default bg-surface px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-text-primary">{d.board}</p>
      <p className="text-text-secondary mt-0.5">{d.questions.toLocaleString('en-IN')} questions</p>
    </div>
  );
}

function TrendsTab({ trends, onOpen }) {
  if (!trends) return <div className="grid lg:grid-cols-2 gap-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-80 rounded-3xl" />)}</div>;
  const boards = trends.boards.filter((b) => b.board).slice(0, 12);
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Panel className="p-5 md:p-6 lg:col-span-2">
        <h2 className="text-lg font-bold text-text-primary">What boards asked about, year by year</h2>
        <p className="text-sm text-text-tertiary mt-1 mb-4">Topics of the questions in each year’s transcripts.</p>
        <TopicHeat trends={trends} />
      </Panel>

      <Panel className="p-5 md:p-6">
        <h2 className="text-lg font-bold text-text-primary">Questions per board</h2>
        <p className="text-sm text-text-tertiary mt-1 mb-4">How many questions in the library come from each chairperson’s board.</p>
        <div style={{ height: Math.max(220, boards.length * 30) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={boards} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barCategoryGap={6}>
              <CartesianGrid horizontal={false} stroke="var(--border-subtle)" />
              <XAxis type="number" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="board" width={140} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-sunken)' }} />
              <Bar dataKey="questions" fill="var(--accent)" radius={[0, 4, 4, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel className="p-5 md:p-6">
        <h2 className="text-lg font-bold text-text-primary">Questions boards reuse</h2>
        <p className="text-sm text-text-tertiary mt-1 mb-4">The same question asked about different candidates’ DAF items — expect yours in place of {'{X}'}.</p>
        {trends.templates.length === 0 ? (
          <p className="text-sm text-text-tertiary">None found yet.</p>
        ) : (
          <ul className="space-y-2">
            {trends.templates.map((t, i) => (
              <li key={i} className="rounded-2xl border border-border-subtle bg-surface px-4 py-3">
                <p className="text-sm font-medium text-text-primary">{t.text.replace('{X}', '…')}</p>
                <p className="text-xs text-text-tertiary mt-1">{t.typeLabel}: {t.values.join(', ')} · <TimesAsked n={t.timesAsked} years={t.years} /></p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="p-5 md:p-6 lg:col-span-2">
        <h2 className="text-lg font-bold text-text-primary mb-4">Most asked overall</h2>
        <ol className="grid md:grid-cols-2 gap-x-6 divide-y divide-border-subtle md:divide-y-0">
          {trends.mostAsked.map((f, i) => (
            <li key={f.id} className="md:border-b md:border-border-subtle">
              <button onClick={() => onOpen(f.id)} className="w-full text-left flex items-center gap-3 py-3 group cursor-pointer">
                <span className="w-6 text-sm font-bold text-text-tertiary tabular-nums">{i + 1}</span>
                <span className="flex-1 text-sm text-text-primary group-hover:text-brand">{f.text}</span>
                <TimesAsked n={f.timesAsked} />
              </button>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

export default function InterviewBank({ status, onHome, initialQuery }) {
  const [tab, setTab] = useState('search');
  const [facets, setFacets] = useState(null);
  const [trends, setTrends] = useState(null);
  const [familyId, setFamilyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    iv('/bank/facets').then((d) => { if (!cancelled) setFacets(d); }).catch(() => {});
    iv('/bank/trends').then((d) => { if (!cancelled) setTrends(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const years = useMemo(() => status.corpus.years, [status]);

  return (
    <Shell wide>
      <PageHeader
        onBack={onHome}
        eyebrow="Step 3"
        title="Question bank"
        subtitle={`Every question from ${status.corpus.transcripts.toLocaleString('en-IN')} interview transcripts, grouped so you can see how often each was asked, by which board, and how they followed up.`}
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: 'search', label: 'Search', icon: 'search' }, { value: 'trends', label: 'Trends', icon: 'chart' }]} ariaLabel="View" />}
      />
      {tab === 'search' ? <SearchTab facets={facets} years={years} initialQuery={initialQuery} onOpen={setFamilyId} /> : <TrendsTab trends={trends} onOpen={setFamilyId} />}
      <SourcesCredit sources={status.sources} />
      {familyId && <FamilyDrawer key={familyId} familyId={familyId} onClose={() => setFamilyId(null)} />}
    </Shell>
  );
}
