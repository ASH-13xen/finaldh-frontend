import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import Icon from '../components/mcq/Icon';
import ReportModal from '../components/mcq/ReportModal';
import { ActionButton, Chip, EmptyState, ErrorBanner, ToolButton } from '../components/mcq/ui';
import { useToast } from '../components/Toast';
import { mcq, errorMessage, formatDate } from '../lib/mcqApi';
import { displaySubjectName } from '../lib/mcqSubjects';

function FlaggedCard({ f, onUnflag, onReport }) {
  const [show, setShow] = useState(false);
  return (
    <article className="bg-surface border border-border-default rounded-2xl p-5 flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-tertiary">
          <Chip tone="brand">{f.testTitle || displaySubjectName(f.subject)}</Chip>
          <span>Q{f.order}</span>
          <span>· flagged {formatDate(f.flaggedAt)}</span>
          {!f.isActive && <Chip tone="warning">Retired question</Chip>}
        </div>
        <div className="flex gap-2">
          <ToolButton icon="bookmark" label="Remove flag" active onClick={onUnflag} hint="Take this off your Flagged list" />
          <ToolButton icon="alert" label="Report" onClick={onReport} hint="Tell us if this question or answer is wrong" />
        </div>
      </header>

      <p className="text-base md:text-lg font-semibold text-text-primary leading-relaxed whitespace-pre-wrap">{f.questionText}</p>

      <div className="flex flex-col gap-2">
        {f.options.map((opt) => {
          const correct = show && f.answerVisible && opt.label === f.correctOption;
          return (
            <div key={opt.label} className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-base leading-relaxed ${correct ? 'border-status-success-text/60 bg-status-success-bg text-text-primary' : 'border-border-default text-text-secondary'}`}>
              <span className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-extrabold ${correct ? 'bg-status-success-text border-status-success-text text-white' : 'border-border-default text-text-tertiary'}`}>{opt.label}</span>
              <span className="flex-1 pt-0.5">{opt.text}</span>
              {correct && <span className="text-xs font-extrabold uppercase text-status-success-text pt-1">Correct answer</span>}
            </div>
          );
        })}
      </div>

      {f.answerVisible ? (
        <div>
          <ActionButton tone="soft" size="sm" icon={show ? 'eyeOff' : 'eye'} onClick={() => setShow((v) => !v)}>{show ? 'Hide answer & explanation' : 'Show answer & explanation'}</ActionButton>
          {show && (
            <div className="mt-3 rounded-xl bg-sunken border border-border-default px-5 py-4">
              <p className="text-sm font-extrabold text-status-success-text mb-1.5">Correct answer: {f.correctOption}</p>
              <p className="text-base text-text-secondary leading-relaxed whitespace-pre-wrap">{f.explanation || 'No explanation has been added for this question yet.'}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="flex items-start gap-2 text-sm text-text-tertiary bg-sunken rounded-xl px-4 py-3 leading-relaxed">
          <Icon name="lock" className="w-4 h-4 mt-0.5 shrink-0" />
          The answer unlocks once you finish an attempt of this test (or check it in Practice mode).
        </p>
      )}

      {f.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{f.tags.map((t, i) => <Chip key={i}>{t.section}</Chip>)}</div>}
    </article>
  );
}

// Everything the student bookmarked, in one place - with a button to practise them all together.
export default function McqFlagged({ onBack, onPractice }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('');
  const [reportTarget, setReportTarget] = useState(null);

  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await mcq(`/flags${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Failed to load your flagged questions.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [subject, reloadKey]);

  // Filter changes and retries go through here (an event handler), not through an effect
  const reload = (subj) => { setSubject(subj); setLoading(true); setError(''); setReloadKey((k) => k + 1); };

  const unflag = async (f) => {
    try {
      await mcq(`/flags/${f.questionId}`, { method: 'DELETE' });
      setData((prev) => ({
        ...prev,
        flags: prev.flags.filter((x) => x.questionId !== f.questionId),
        subjects: prev.subjects.map((s) => (s.subject === f.subject ? { ...s, count: s.count - 1 } : s)).filter((s) => s.count > 0)
      }));
      toast.success('Removed from your Flagged list.', 2200);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const total = data ? data.subjects.reduce((n, s) => n + s.count, 0) : 0;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-10 flex flex-col gap-6">
      <div>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-text-secondary hover:text-brand mb-3 cursor-pointer">
          <Icon name="arrowLeft" className="w-4 h-4" /> Back
        </button>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight flex items-center gap-3"><Icon name="bookmark" filled className="w-7 h-7 text-brand" /> Flagged questions</h1>
            <p className="text-base text-text-secondary mt-1.5">Questions you saved to come back to — all in one place.</p>
          </div>
          {data && data.flags.length > 0 && (
            <ActionButton tone="primary" size="lg" icon="play" onClick={() => onPractice(subject)} hint="A practice session made only of these questions. It does not use up any test attempts.">
              Practise these {data.flags.length}
            </ActionButton>
          )}
        </div>
      </div>

      {error && <ErrorBanner onRetry={() => reload(subject)}>{error}</ErrorBanner>}

      {data && data.subjects.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Subject filter">
          <button role="tab" aria-selected={!subject} onClick={() => reload('')} className={`px-4 py-2 rounded-full text-sm font-bold cursor-pointer ${!subject ? 'bg-brand text-text-on-accent' : 'bg-surface border border-border-default text-text-secondary hover:border-text-tertiary'}`}>All ({total})</button>
          {data.subjects.map((s) => (
            <button key={s.subject} role="tab" aria-selected={subject === s.subject} onClick={() => reload(s.subject)} className={`px-4 py-2 rounded-full text-sm font-bold cursor-pointer ${subject === s.subject ? 'bg-brand text-text-on-accent' : 'bg-surface border border-border-default text-text-secondary hover:border-text-tertiary'}`}>{displaySubjectName(s.subject)} ({s.count})</button>
          ))}
        </div>
      )}

      {loading && !data ? (
        <div className="py-16 flex justify-center"><LoadingSpinner text="Loading…" /></div>
      ) : data && data.flags.length === 0 ? (
        <EmptyState icon="bookmark" title="Nothing flagged yet" action={<ActionButton tone="secondary" icon="arrowLeft" onClick={onBack}>Go to tests</ActionButton>}>
          While answering (or reviewing results), tap the <b>Flag</b> bookmark on any question you want to revisit. They will all appear here so you can practise them together.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          {data?.flags.map((f) => <FlaggedCard key={f.questionId} f={f} onUnflag={() => unflag(f)} onReport={() => setReportTarget(f)} />)}
        </div>
      )}

      {reportTarget && (
        <ReportModal
          question={{ _id: reportTarget.questionId, order: reportTarget.order, questionText: reportTarget.questionText }}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}
