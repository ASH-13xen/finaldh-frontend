import { useState, useEffect, useMemo } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import Icon from '../components/mcq/Icon';
import { ActionButton, Chip, EmptyState, ErrorBanner, ModeBadge, ProgressBar } from '../components/mcq/ui';
import { mcq, errorMessage, formatClock } from '../lib/mcqApi';
import { displaySubjectName, shortSubjectName, subjectGroup } from '../lib/mcqSubjects';

const FILTERS = [
  { id: 'all', label: 'All subjects' },
  { id: 'gs', label: 'General Studies' },
  { id: 'optional', label: 'Optionals' },
  { id: 'owned', label: 'My subjects' },
  { id: 'free', label: 'Has free tests' }
];

const HOW_IT_WORKS = [
  { icon: 'layers', title: 'Pick a subject', text: 'Choose General Studies or your optional.' },
  { icon: 'clock', title: 'Test or Practice', text: 'A timed test, or untimed practice with instant answers.' },
  { icon: 'chart', title: 'Learn from the results', text: 'See weak topics, flag questions, and try again.' }
];

function timeLeft(serverDeadline) {
  if (!serverDeadline) return null;
  const secs = Math.floor((new Date(serverDeadline).getTime() - Date.now()) / 1000);
  return secs > 0 ? formatClock(secs) : null;
}

function SubjectCard({ s, onOpen }) {
  const price = s.useDiscount ? s.discountedPrice : s.price;
  const full = displaySubjectName(s.subject);
  const isGs = subjectGroup(s.subject) === 'gs';
  // General Studies papers are known by their code ("GS-2"), with the topic list as a subtitle.
  const title = isGs ? s.subject : shortSubjectName(s.subject);
  const detail = isGs && full.includes(':') ? full.split(':')[1].trim() : '';
  const allFree = s.lockedCount === 0;

  let status;
  if (allFree) status = <Chip tone="success"><Icon name="check" className="w-3 h-3" /> Free</Chip>;
  else if (s.isOwned) status = <Chip tone="success"><Icon name="check" className="w-3 h-3" /> Unlocked</Chip>;
  else status = <Chip tone="warning"><Icon name="lock" className="w-3 h-3" /> {price != null ? `₹${price}` : 'Locked'}</Chip>;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left bg-surface border border-border-default hover:border-brand rounded-2xl p-5 flex flex-col justify-between gap-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Chip tone="neutral">{subjectGroup(s.subject) === 'gs' ? 'General Studies' : 'Optional'}</Chip>
          {status}
        </div>
        <div>
          <h3 className="font-display font-extrabold text-lg text-text-primary leading-snug group-hover:text-brand transition-colors">{title}</h3>
          {detail && <p className="text-sm text-text-tertiary mt-1 leading-snug">{detail}</p>}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-text-secondary font-medium">{s.testCount} test{s.testCount !== 1 ? 's' : ''}{!allFree && s.freeCount > 0 ? ` · ${s.freeCount} free` : ''}</span>
            <span className="text-text-tertiary">{s.testsAttempted}/{s.testCount} tried</span>
          </div>
          <ProgressBar value={s.testsAttempted} max={s.testCount} />
        </div>
        <span className="flex items-center gap-1.5 text-sm font-bold text-brand group-hover:gap-2.5 transition-all">
          Open tests <Icon name="arrowRight" className="w-4 h-4" />
        </span>
      </div>
    </button>
  );
}

export default function McqSubjectsLanding({ onOpenSubject, onSelectPractice, onResume, onOpenFlagged, onOpenHistory, onHelp, onTour }) {
  const [subjects, setSubjects] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const [reloadKey, setReloadKey] = useState(0);
  const [practiceMeta, setPracticeMeta] = useState(null); // { total, topics } from /api/quiz/topics

  // The Geography practice pool — optional; the card still shows if this fails.
  useEffect(() => {
    if (!onSelectPractice) return;
    fetch('/api/quiz/topics?subject=Geography', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.total > 0) setPracticeMeta({ total: data.total, topics: (data.topics || []).length }); })
      .catch(() => { /* ignore — card renders without counts */ });
  }, [onSelectPractice]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [subjectsRes, overviewRes] = await Promise.allSettled([mcq('/subjects'), mcq('/overview')]);
      if (cancelled) return;
      if (subjectsRes.status === 'fulfilled') setSubjects(subjectsRes.value.subjects || []);
      else setError(errorMessage(subjectsRes.reason, 'Could not load subjects.'));
      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value); // the summary is optional - never block on it
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const retry = () => { setLoading(true); setError(''); setReloadKey((k) => k + 1); };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subjects.filter((s) => {
      if (q && !displaySubjectName(s.subject).toLowerCase().includes(q)) return false;
      if (filter === 'gs') return subjectGroup(s.subject) === 'gs';
      if (filter === 'optional') return subjectGroup(s.subject) === 'optional';
      if (filter === 'owned') return s.isOwned && s.lockedCount > 0;
      if (filter === 'free') return s.freeCount > 0;
      return true;
    }).sort((a, b) => {
      const g = (subjectGroup(a.subject) === 'gs' ? 0 : 1) - (subjectGroup(b.subject) === 'gs' ? 0 : 1);
      return g || displaySubjectName(a.subject).localeCompare(displaySubjectName(b.subject));
    });
  }, [subjects, query, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-page">
        <LoadingSpinner text="Loading subjects..." />
      </div>
    );
  }

  const stats = overview?.stats;
  const isNewStudent = !stats || stats.attemptsTaken === 0;
  const resumable = overview?.inProgress || [];
  const flaggedCount = overview?.flaggedCount || 0;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-default pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-text-primary tracking-tight">MCQ Practice &amp; Tests</h1>
          <p className="text-base text-text-secondary mt-2 max-w-2xl leading-relaxed">
            Pick a subject to take timed mock tests or practise question by question — and see exactly which topics need more work.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton icon="bookmark" tone="secondary" onClick={onOpenFlagged} hint="Questions you bookmarked to revisit">
            Flagged{flaggedCount > 0 && <span className="ml-1 rounded-full bg-brand text-text-on-accent text-xs px-2 py-0.5">{flaggedCount}</span>}
          </ActionButton>
          <ActionButton icon="chart" tone="secondary" onClick={onOpenHistory} hint="Your past attempts and progress">My progress</ActionButton>
          <ActionButton icon="help" tone="soft" onClick={onHelp} hint="How Test, Practice, attempts and flags work">How it works</ActionButton>
        </div>
      </div>

      {error && <ErrorBanner onRetry={retry}>{error}</ErrorBanner>}

      {onSelectPractice && (
        <button
          onClick={onSelectPractice}
          className="w-full text-left bg-accent-soft-bg border border-accent-soft-border rounded-2xl p-6 flex items-center justify-between gap-4 hover:border-brand transition-colors cursor-pointer group"
        >
          <div>
            <span className="text-[9px] font-bold text-brand uppercase tracking-wide">Practice · untimed</span>
            <h3 className="font-bold text-lg text-text-primary mt-1">Geography — Question Bank</h3>
            <p className="text-xs text-text-secondary mt-1">
              {practiceMeta
                ? `${practiceMeta.total.toLocaleString()} questions · ${practiceMeta.topics} topics · learn by topic, random test, or all`
                : 'Learn by topic, take a random test, or work through every question'}
            </p>
          </div>
          <span className="w-9 h-9 rounded-lg bg-surface border border-accent-soft-border flex items-center justify-center text-brand group-hover:bg-brand group-hover:text-text-on-accent transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </span>
        </button>
      )}

      {/* First-time guidance */}
      {isNewStudent && (
        <section aria-label="How it works" className="bg-accent-soft-bg border border-accent-soft-border rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-extrabold text-text-primary flex items-center gap-2"><Icon name="sparkles" className="w-5 h-5 text-brand" /> New here? Start in 3 steps</h2>
            <button onClick={onTour} className="text-sm font-bold text-brand hover:underline cursor-pointer">Take the quick tour</button>
          </div>
          <ol className="grid md:grid-cols-3 gap-4">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step.title} className="flex items-start gap-3">
                <span className="shrink-0 w-9 h-9 rounded-full bg-brand text-text-on-accent font-extrabold flex items-center justify-center">{i + 1}</span>
                <span>
                  <span className="block font-bold text-text-primary">{step.title}</span>
                  <span className="block text-sm text-text-secondary leading-snug mt-0.5">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Resume */}
      {resumable.length > 0 && (
        <section aria-label="Continue where you left off">
          <h2 className="text-lg font-extrabold text-text-primary mb-3 flex items-center gap-2"><Icon name="play" className="w-5 h-5 text-brand" filled /> Continue where you left off</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {resumable.map((a) => {
              const left = a.mode === 'test' ? timeLeft(a.serverDeadline) : null;
              return (
                <div key={a.attemptId} className="bg-surface border border-brand/40 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-text-primary text-base truncate">{a.title}</p>
                      <p className="text-sm text-text-tertiary truncate">{shortSubjectName(a.subject)}</p>
                    </div>
                    <ModeBadge mode={a.mode} source={a.source} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm text-text-secondary mb-1.5">
                      <span>{a.answered} of {a.total} answered</span>
                      {left && <span className="font-mono font-bold text-status-warning-text">⏱ {left} left</span>}
                    </div>
                    <ProgressBar value={a.answered} max={a.total} />
                  </div>
                  <ActionButton tone="primary" icon="play" onClick={() => onResume(a.attemptId)}>Resume</ActionButton>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick stats for returning students */}
      {!isNewStudent && (
        <section aria-label="Your stats" className="grid grid-cols-3 gap-3">
          {[
            ['Attempts finished', stats.attemptsTaken, 'target'],
            ['Average accuracy', `${stats.avgAccuracy}%`, 'chart'],
            ['Questions answered', stats.questionsAnswered, 'check']
          ].map(([label, value, icon]) => (
            <div key={label} className="bg-surface border border-border-default rounded-2xl p-4 flex items-center gap-3">
              <span className="hidden sm:flex w-10 h-10 rounded-xl bg-accent-soft-bg text-brand items-center justify-center"><Icon name={icon} className="w-5 h-5" /></span>
              <div>
                <p className="text-xl md:text-2xl font-extrabold text-text-primary leading-none">{value}</p>
                <p className="text-xs md:text-sm text-text-tertiary mt-1">{label}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Subjects */}
      <section aria-label="Subjects" className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-text-primary">Choose a subject</h2>
          <label className="relative md:w-72">
            <span className="sr-only">Search subjects</span>
            <Icon name="search" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subjects…"
              className="w-full bg-surface border border-border-default focus:border-brand rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Subject filter">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer ${filter === f.id ? 'bg-brand text-text-on-accent' : 'bg-surface border border-border-default text-text-secondary hover:border-text-tertiary'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {!error && subjects.length === 0 ? (
          <EmptyState icon="layers" title="No tests have been published yet">Check back soon — new MCQ tests are added regularly.</EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState icon="search" title="No subjects match" action={<ActionButton tone="secondary" onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</ActionButton>}>
            Try a different search or filter.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((s) => <SubjectCard key={s.subject} s={s} onOpen={() => onOpenSubject(s.subject)} />)}
          </div>
        )}
      </section>
    </div>
  );
}
