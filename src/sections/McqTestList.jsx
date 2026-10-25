import { useState, useEffect, useMemo, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import PurchaseModal from '../components/PurchaseModal';
import Icon from '../components/mcq/Icon';
import { ActionButton, AttemptDots, Chip, EmptyState, ErrorBanner, ModeBadge } from '../components/mcq/ui';
import { mcq, errorMessage, formatDate } from '../lib/mcqApi';
import { displaySubjectName } from '../lib/mcqSubjects';

const FILTERS = [
  { id: 'all', label: 'All tests' },
  { id: 'new', label: 'Not started' },
  { id: 'progress', label: 'In progress' },
  { id: 'done', label: 'Completed' },
  { id: 'free', label: 'Free' }
];

const stateOf = (t) => {
  if (!t.isOwned) return 'locked';
  if (t.inProgress) return 'progress';
  if (t.history.length > 0) return 'done';
  return 'new';
};

function TestCard({ test, onStart, onResume, onReview, onUnlock }) {
  const [showHistory, setShowHistory] = useState(false);
  const locked = !test.isOwned;
  const { attempts, inProgress, history } = test;
  const limitReached = !locked && !inProgress && attempts.remaining <= 0;
  const state = stateOf(test);

  const statusChip = {
    locked: <Chip tone="warning"><Icon name="lock" className="w-3 h-3" /> Locked</Chip>,
    progress: <Chip tone="info"><Icon name="play" className="w-3 h-3" filled /> In progress</Chip>,
    done: limitReached ? <Chip tone="neutral">Attempts used up</Chip> : <Chip tone="success"><Icon name="check" className="w-3 h-3" /> Attempted</Chip>,
    new: <Chip tone="brand">Not started</Chip>
  }[state];

  return (
    <article className={`bg-surface border rounded-2xl p-5 flex flex-col gap-4 transition-all ${locked ? 'border-border-default opacity-80' : 'border-border-default hover:border-brand/60 hover:shadow-md'}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display font-extrabold text-lg text-text-primary leading-snug">{test.title}</h3>
        <div className="shrink-0">{statusChip}</div>
      </div>

      {test.description && <p className="text-sm text-text-tertiary leading-relaxed line-clamp-2">{test.description}</p>}

      <div className="flex flex-wrap gap-1.5">
        <Chip><Icon name="clock" className="w-3 h-3" /> {test.durationMinutes} min</Chip>
        <Chip><Icon name="list" className="w-3 h-3" /> {test.questionCount} questions</Chip>
        <Chip>{test.totalMarks} marks</Chip>
        {test.negativeMarkingRatio > 0 && <Chip tone="danger">−{test.negativeMarkingRatio} per wrong</Chip>}
        {!test.requiresPurchase && <Chip tone="success">Free</Chip>}
      </div>

      {!locked && (
        <div className="flex items-center justify-between gap-3 text-sm text-text-secondary bg-sunken rounded-xl px-3.5 py-2.5">
          <span className="flex items-center gap-2.5">
            <AttemptDots used={attempts.used} max={attempts.max} />
            <span><b className="text-text-primary">{attempts.remaining}</b> of {attempts.max} attempts left</span>
          </span>
          {test.lastAttempt && (
            <span className="text-text-tertiary hidden sm:inline">Last: <b className="text-text-primary">{test.lastAttempt.score}</b>/{test.lastAttempt.totalMarks || test.totalMarks}</span>
          )}
        </div>
      )}

      <div className="mt-auto pt-1 flex flex-col gap-2.5">
        {locked ? (
          <>
            <p className="text-sm text-text-tertiary">Unlock this subject to attempt its tests.</p>
            <ActionButton tone="soft" icon="lock" onClick={onUnlock}>See how to unlock</ActionButton>
          </>
        ) : inProgress ? (
          <>
            <p className="text-sm text-text-secondary flex items-center gap-2">
              <ModeBadge mode={inProgress.mode} /> {inProgress.answered} of {inProgress.total} answered
            </p>
            <ActionButton tone="primary" icon="play" onClick={() => onResume(inProgress.attemptId)} hint="Continue the attempt you left — this does not use another attempt">
              Resume {inProgress.mode === 'practice' ? 'practice' : 'test'}
            </ActionButton>
          </>
        ) : limitReached ? (
          <>
            <p className="text-sm text-text-secondary">You have used all {attempts.max} attempts. Your results and explanations stay available.</p>
            <ActionButton tone="primary" icon="eye" onClick={() => onReview(history[0].attemptId)}>Review answers</ActionButton>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <ActionButton tone="primary" icon="clock" onClick={() => onStart(test, 'test')} hint="Timed and scored like the real exam. Answers appear after you submit.">Take Test</ActionButton>
            <ActionButton tone="secondary" icon="book" onClick={() => onStart(test, 'practice')} hint="No time limit. Check the answer after every question.">Practice</ActionButton>
          </div>
        )}

        {!locked && history.length > 0 && (
          <div>
            <button onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-1.5 text-sm font-bold text-text-secondary hover:text-brand cursor-pointer" aria-expanded={showHistory}>
              <Icon name="chevronDown" className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
              Past attempts ({history.length})
            </button>
            {showHistory && (
              <ul className="mt-2 space-y-1.5">
                {history.map((h) => (
                  <li key={h.attemptId}>
                    <button onClick={() => onReview(h.attemptId)} className="w-full flex items-center justify-between gap-3 rounded-lg border border-border-default hover:border-brand px-3 py-2 text-left cursor-pointer">
                      <span className="flex items-center gap-2 min-w-0"><ModeBadge mode={h.mode} /><span className="text-xs text-text-tertiary">{formatDate(h.submittedAt)}</span></span>
                      <span className="text-sm font-bold text-text-primary whitespace-nowrap">{h.score}/{h.totalMarks || test.totalMarks} <span className="font-normal text-text-tertiary">· {h.accuracyPercent}%</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default function McqTestList({ subject, user, onBack, onStart, onResume, onReview, onOpenFlagged, onHelp }) {
  const [tests, setTests] = useState([]);
  const [subjectAccess, setSubjectAccess] = useState(null);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSubjectPurchase, setShowSubjectPurchase] = useState(false);
  const [filter, setFilter] = useState('all');
  const bannerRef = useRef(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [testsData, requests] = await Promise.all([
          mcq(`/tests?subject=${encodeURIComponent(subject)}`),
          mcq('/purchase-requests').catch(() => [])
        ]);
        if (cancelled) return;
        setTests(testsData.tests || []);
        setSubjectAccess(testsData.subjectAccess || null);
        setPurchaseRequests(Array.isArray(requests) ? requests : []);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Failed to load tests.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [subject, reloadKey]);

  const reload = () => { setLoading(true); setError(''); setReloadKey((k) => k + 1); };

  const name = displaySubjectName(subject);
  const subjectPending = purchaseRequests.find((r) => r.purchaseType === 'subject' && r.subject === subject && r.status === 'pending');
  const subjectRejected = purchaseRequests.find((r) => r.purchaseType === 'subject' && r.subject === subject && r.status === 'rejected');
  const subjectPrice = subjectAccess?.useDiscount ? subjectAccess.discountedPrice : subjectAccess?.price;
  const pricingConfigured = subjectAccess?.price !== null && subjectAccess?.price !== undefined;

  const counts = useMemo(() => {
    const c = { all: tests.length, new: 0, progress: 0, done: 0, free: 0 };
    tests.forEach((t) => {
      const s = stateOf(t);
      if (s === 'new') c.new += 1;
      if (s === 'progress') c.progress += 1;
      if (s === 'done') c.done += 1;
      if (!t.requiresPurchase) c.free += 1;
    });
    return c;
  }, [tests]);

  const shown = tests.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'free') return !t.requiresPurchase;
    return stateOf(t) === filter;
  });

  const openUnlock = () => {
    bannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (pricingConfigured && !subjectPending) setShowSubjectPurchase(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-page">
        <LoadingSpinner text="Loading tests..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex flex-col gap-6">
      <div>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-text-secondary hover:text-brand mb-3 cursor-pointer">
          <Icon name="arrowLeft" className="w-4 h-4" /> All subjects
        </button>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-default pb-5">
          <div>
            <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">{name}</h1>
            <p className="text-base text-text-secondary mt-1.5">{tests.length} test{tests.length !== 1 ? 's' : ''} · choose <b>Take Test</b> for the real exam feel or <b>Practice</b> to learn as you go.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton icon="bookmark" tone="secondary" onClick={onOpenFlagged}>Flagged questions</ActionButton>
            <ActionButton icon="help" tone="soft" onClick={onHelp}>How it works</ActionButton>
          </div>
        </div>
      </div>

      {error && <ErrorBanner onRetry={reload}>{error}</ErrorBanner>}

      {/* Subject-level unlock banner - buying here unlocks every locked test in this subject, including ones added later. */}
      <div ref={bannerRef}>
        {subjectAccess?.hasLockedTests && !subjectAccess.isOwned && (
          <div className="bg-accent-soft-bg border border-accent-soft-border rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand mb-1">Unlock everything in this subject</p>
              <p className="text-base text-text-primary font-semibold leading-snug">
                {subjectPending
                  ? 'Your purchase request is waiting for admin approval — usually within a few hours.'
                  : subjectRejected
                    ? 'Your last request was rejected — you can submit a new one.'
                    : pricingConfigured
                      ? 'One purchase unlocks every test in this subject, including tests added in future.'
                      : 'Pricing for this subject is being set up — check back soon.'}
              </p>
            </div>
            {subjectPending ? (
              <Chip tone="warning" className="whitespace-nowrap text-sm px-4 py-2">Pending approval</Chip>
            ) : pricingConfigured ? (
              <ActionButton tone="primary" size="lg" icon="lock" onClick={() => setShowSubjectPurchase(true)} className="whitespace-nowrap">Unlock all — ₹{subjectPrice}</ActionButton>
            ) : null}
          </div>
        )}
        {subjectAccess?.hasLockedTests && subjectAccess.isOwned && (
          <div className="bg-status-success-bg border border-status-success-text/30 rounded-2xl px-5 py-3.5 text-status-success-text text-sm font-bold flex items-center gap-2">
            <Icon name="check" className="w-5 h-5" /> You have full access to every test in this subject.
          </div>
        )}
      </div>

      {/* The attempt rule, stated once, clearly */}
      <div className="flex items-start gap-3 bg-surface border border-border-default rounded-2xl px-5 py-4 text-sm text-text-secondary leading-relaxed">
        <Icon name="info" className="w-5 h-5 text-brand shrink-0 mt-0.5" />
        <p>
          <b className="text-text-primary">Attempts:</b> each test can be started <b>2 times in total</b> — Test and Practice share the same attempts, so pick the mode carefully. Leaving mid-way never wastes an attempt: you can resume it. Reviewing answers is <b>always unlimited</b>.
        </p>
      </div>

      {tests.length > 0 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Test filter">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer ${filter === f.id ? 'bg-brand text-text-on-accent' : 'bg-surface border border-border-default text-text-secondary hover:border-text-tertiary'}`}
            >
              {f.label} <span className="opacity-70">({counts[f.id]})</span>
            </button>
          ))}
        </div>
      )}

      {!error && tests.length === 0 ? (
        <EmptyState icon="layers" title="No tests available yet">Tests for this subject are on their way.</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState icon="filter" title="Nothing here" action={<ActionButton tone="secondary" onClick={() => setFilter('all')}>Show all tests</ActionButton>}>
          No tests match this filter.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {shown.map((t) => (
            <TestCard key={t._id} test={t} onStart={onStart} onResume={onResume} onReview={onReview} onUnlock={openUnlock} />
          ))}
        </div>
      )}

      {showSubjectPurchase && (
        <PurchaseModal
          title={`Unlock: ${name} (all tests)`}
          price={subjectPrice}
          submitEndpoint="/api/mcq/purchase-requests"
          formFields={{ subject }}
          onClose={() => setShowSubjectPurchase(false)}
          onSubmitted={() => { setShowSubjectPurchase(false); reload(); }}
          telegramMessage={`I am ${user?.fullName || user?.name || 'Student'}, requesting confirmation for full subject access: ${name}`}
          telegramTrackEndpointBase="/api/mcq/purchase-requests"
        />
      )}
    </div>
  );
}
