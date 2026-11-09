import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/mcq/Icon';
import { ActionButton, ErrorBanner, EmptyState } from '../components/mcq/ui';
import { useToast } from '../components/Toast';
import { Shell, PageHeader, Panel, LikelihoodPill, AiBadge, Segmented, Skeleton, TimesAsked, SourcesCredit } from '../components/interview/ui';
import FamilyDrawer from '../components/interview/FamilyDrawer';
import { iv, errorMessage, formatDate, yearsRange } from '../lib/interviewApi';

const TYPE_ICON = { intro: 'user', motivation: 'target', home: 'mapPin', education: 'graduation', work: 'briefcase', optional: 'book', hobby: 'heart', eca: 'award', service: 'layers', name: 'user' };
const KIND_LABEL = { direct: 'Asked to candidates with this in their DAF', pattern: 'Asked about similar DAF items', related: 'Similar past question', area: 'Common in this area', ai: 'Tailored to your DAF from past questions', new: 'New angle' };

function Prediction({ p, onOpenFamily }) {
  const [open, setOpen] = useState(false);
  const evidence = p.evidence || [];
  return (
    <li className="rounded-2xl border border-border-subtle bg-surface px-4 py-3.5 hover:border-border-default transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
        <p className="flex-1 text-[15px] text-text-primary leading-relaxed font-medium">{p.question}</p>
        <LikelihoodPill level={p.likelihood} />
      </div>
      <p className="text-xs text-text-tertiary mt-1.5 leading-relaxed">{p.basisNote}</p>
      {p.tip && (
        <p className="text-sm text-text-secondary mt-2 flex items-start gap-1.5 leading-relaxed">
          <Icon name="zap" className="w-4 h-4 mt-0.5 text-brand shrink-0" /> {p.tip}
        </p>
      )}
      {evidence.length > 0 && (
        <>
          <button onClick={() => setOpen((o) => !o)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline cursor-pointer" aria-expanded={open}>
            {open ? 'Hide' : 'Show'} the evidence ({evidence.length}) <Icon name="chevronDown" className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <ul className="mt-2 space-y-1.5 iv-rise">
              {evidence.map((e, i) => (
                <li key={i} className="rounded-xl bg-sunken/70 border border-border-subtle px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-text-tertiary">{KIND_LABEL[e.kind] || 'Past question'}</span>
                    <TimesAsked n={e.timesAsked} years={e.years} />
                  </div>
                  {e.familyId ? (
                    <button onClick={() => onOpenFamily(e.familyId)} className="text-left text-sm text-text-primary hover:text-brand mt-1 cursor-pointer">“{e.template || e.text}”</button>
                  ) : (
                    <p className="text-sm text-text-primary mt-1">“{e.template || e.text}”</p>
                  )}
                  {e.values?.length > 0 && <p className="text-xs text-text-tertiary mt-1">Asked about: {e.values.join(', ')}</p>}
                  {e.boards?.length > 0 && <p className="text-xs text-text-tertiary mt-1">Boards: {e.boards.join(', ')}</p>}
                  {e.familyIds?.length > 0 && (
                    <button onClick={() => onOpenFamily(e.familyIds[0])} className="text-xs font-bold text-brand hover:underline mt-1 cursor-pointer">See where it was asked</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}

export default function InterviewPredictions({ status, go, onHome }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [familyId, setFamilyId] = useState(null);

  const load = async (refresh = false) => {
    try {
      const d = await iv(`/predictions${refresh ? '?refresh=1' : ''}`);
      setData(d);
      setError(null);
      if (d.limited) toast.info('Daily refresh limit reached — showing your saved predictions.');
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    iv('/predictions').then((d) => { if (!cancelled) setData(d); }).catch((err) => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
  }, []);

  const refresh = async () => { setRefreshing(true); await load(true); setRefreshing(false); };

  const groups = useMemo(() => (data?.groups || []).filter((g) => g.predictions.length), [data]);
  const filters = useMemo(() => {
    const seen = new Map();
    for (const g of groups) if (!seen.has(g.type)) seen.set(g.type, g.typeLabel);
    return [{ value: 'all', label: 'All' }, ...[...seen].map(([value, label]) => ({ value, label }))];
  }, [groups]);
  const shown = filter === 'all' ? groups : groups.filter((g) => g.type === filter);
  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0, new: 0 };
    for (const g of groups) for (const p of g.predictions) c[p.likelihood] = (c[p.likelihood] || 0) + 1;
    return c;
  }, [groups]);

  if (error?.data?.needsProfile) {
    return (
      <Shell>
        <PageHeader onBack={onHome} eyebrow="Step 2" title="Predicted questions" />
        <EmptyState icon="edit" title="Add your DAF first" action={<ActionButton tone="primary" icon="edit" onClick={() => go({ screen: 'profile' })}>Add DAF details</ActionButton>}>
          Predictions are built from what boards asked candidates with the same home state, subject, job and hobbies as you.
        </EmptyState>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <PageHeader
        onBack={onHome}
        eyebrow="Step 2"
        title="Predicted questions"
        subtitle={`For each item in your DAF: what boards asked candidates who had the same thing in theirs${data ? `, across ${data.corpus.transcripts.toLocaleString('en-IN')} interviews (CSE ${yearsRange(data.corpus.years)})` : ''}.`}
        actions={
          <>
            <AiBadge ai={status.ai} />
            {status.ai?.available && <ActionButton size="sm" icon="refresh" onClick={refresh} disabled={refreshing}>{refreshing ? 'Updating…' : 'Refresh'}</ActionButton>}
            <ActionButton size="sm" icon="edit" onClick={() => go({ screen: 'profile' })}>Edit DAF</ActionButton>
            <ActionButton size="sm" tone="primary" icon="mic" onClick={() => go({ screen: 'setup' })}>Mock interview</ActionButton>
          </>
        }
      />

      {error && !error.data?.needsProfile && <ErrorBanner onRetry={() => load()}>{errorMessage(error)}</ErrorBanner>}

      {!data && !error && (
        <div className="grid lg:grid-cols-2 gap-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72 rounded-3xl" />)}</div>
      )}

      {data && (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="overflow-x-auto -mx-1 px-1"><Segmented size="sm" value={filter} onChange={setFilter} options={filters} ariaLabel="Filter by DAF area" /></div>
            <p className="text-xs text-text-tertiary">
              {counts.high} high · {counts.medium} medium · {counts.low} low{counts.new ? ` · ${counts.new} new angles` : ''} · updated {formatDate(data.generatedAt)}
              {!data.aiUsed && ' · straight from past transcripts'}
            </p>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-surface-raised px-4 py-3 mb-6 text-sm text-text-secondary leading-relaxed flex items-start gap-2.5">
            <Icon name="info" className="w-4 h-4 mt-0.5 text-brand shrink-0" />
            <span>
              Likelihood comes only from how often similar questions were asked to similar candidates — it is a guide, not a promise.
              {data.aiUsed ? ' Questions marked “New angle” are about recent developments and have no past evidence.' : ' With AI switched on, these are also rewritten for your exact DAF and add recent-news angles.'}
            </span>
          </div>

          <div className="grid lg:grid-cols-2 gap-5 items-start">
            {shown.map((g) => (
              <Panel key={g.key} className="p-5 iv-rise">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-2xl bg-accent-soft-bg border border-accent-soft-border text-brand flex items-center justify-center shrink-0">
                      <Icon name={TYPE_ICON[g.type] || 'info'} className="w-5 h-5" />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary">{g.typeLabel}</p>
                      <h2 className="text-lg font-bold text-text-primary leading-snug">{g.label}</h2>
                    </div>
                  </div>
                  {!['intro', 'motivation'].includes(g.type) && (
                    <ActionButton size="sm" icon="mic" onClick={() => go({ screen: 'setup', focus: [g.key] })} hint="Start a mock interview that drills this">Practise</ActionButton>
                  )}
                </div>
                <ol className="space-y-2.5">
                  {g.predictions.map((p) => <Prediction key={p.id} p={p} onOpenFamily={setFamilyId} />)}
                </ol>
              </Panel>
            ))}
          </div>

          {data.general?.length > 0 && filter === 'all' && (
            <Panel className="p-5 md:p-6 mt-8">
              <h2 className="text-lg font-bold text-text-primary">Asked to almost everyone</h2>
              <p className="text-sm text-text-tertiary mt-1 mb-4">The questions that come up across boards and years, whatever the DAF.</p>
              <ul className="grid md:grid-cols-2 gap-2">
                {data.general.map((f) => (
                  <li key={f.id}>
                    <button onClick={() => setFamilyId(f.id)} className="w-full text-left rounded-2xl border border-border-subtle bg-surface hover:border-brand px-4 py-3 cursor-pointer group">
                      <span className="block text-sm text-text-primary group-hover:text-brand">{f.text}</span>
                      <span className="block mt-1"><TimesAsked n={f.timesAsked} years={f.years} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      <SourcesCredit sources={status.sources} />
      {familyId && <FamilyDrawer key={familyId} familyId={familyId} onClose={() => setFamilyId(null)} />}
    </Shell>
  );
}
