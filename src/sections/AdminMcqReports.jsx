import { useState, useEffect } from 'react';
import Icon from '../components/mcq/Icon';
import { ActionButton, Chip, EmptyState, ErrorBanner, Modal } from '../components/mcq/ui';
import { useToast } from '../components/Toast';
import { mcq, errorMessage, formatDate } from '../lib/mcqApi';
import { displaySubjectName } from '../lib/mcqSubjects';

const STATUSES = [['pending', 'Pending'], ['accepted', 'Accepted'], ['rejected', 'Ignored'], ['all', 'All']];
const REASON_LABELS = {
  'wrong-answer': 'Wrong answer',
  'wrong-question': 'Wrong question',
  typo: 'Typo',
  'wrong-explanation': 'Bad explanation',
  other: 'Other'
};
const STATUS_TONE = { pending: 'warning', accepted: 'success', rejected: 'neutral' };

// Confirmation panel for the one-click "apply the student's suggestion" action.
function ApplyDialog({ group, report, onClose, onDone }) {
  const toast = useToast();
  const q = group.question;
  const [option, setOption] = useState(report.suggestedOption || q.correctOption);
  const [applyExplanation, setApplyExplanation] = useState(!!report.suggestedExplanation);
  const [rescore, setRescore] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const changes = option !== q.correctOption;

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await mcq(`/admin/reports/${report._id}/resolve`, {
        method: 'POST',
        body: { action: 'accept', overrideOption: option, applyAnswer: changes, applyExplanation, rescore, adminNote: note }
      });
      toast.success(
        res.optionChanged
          ? `Answer changed ${q.correctOption} → ${option}. ${res.rescoredAttempts} attempt(s) re-scored${res.alsoClosed ? `, ${res.alsoClosed} matching report(s) closed` : ''}.`
          : 'Report accepted.'
      );
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Apply this correction?"
      onClose={onClose}
      footer={
        <>
          <ActionButton tone="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton tone="primary" icon="check" onClick={apply} disabled={busy}>{busy ? 'Applying…' : changes ? 'Change answer & accept' : 'Accept report'}</ActionButton>
        </>
      }
    >
      <div className="space-y-4 pb-3 text-sm text-text-secondary">
        <p className="line-clamp-3 text-text-tertiary">“{q.questionText}”</p>

        <div>
          <p className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">Correct answer</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Correct answer">
            {['A', 'B', 'C', 'D'].map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={option === o}
                onClick={() => setOption(o)}
                className={`relative w-14 h-14 rounded-xl border-2 text-lg font-extrabold cursor-pointer transition-all ${option === o ? 'border-brand bg-brand text-text-on-accent' : 'border-border-default bg-surface text-text-secondary hover:border-text-tertiary'}`}
              >
                {o}
                {o === q.correctOption && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-status-success-bg text-status-success-text border border-status-success-text/30 rounded px-1">now</span>}
                {o === report.suggestedOption && o !== q.correctOption && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-status-info-bg text-status-info-text border border-status-info-text/30 rounded px-1">asked</span>}
              </button>
            ))}
          </div>
          <p className="mt-3">{changes ? <>The answer will change from <b>{q.correctOption}</b> to <b>{option}</b>.</> : <>The answer stays <b>{q.correctOption}</b> — the report is just marked as accepted.</>}</p>
        </div>

        {report.suggestedExplanation && (
          <label className="flex items-start gap-2.5 bg-sunken border border-border-subtle rounded-xl px-4 py-3 cursor-pointer">
            <input type="checkbox" checked={applyExplanation} onChange={(e) => setApplyExplanation(e.target.checked)} className="w-4 h-4 mt-0.5 accent-brand cursor-pointer" />
            <span><b className="text-text-primary">Also replace the explanation with the student's:</b><br /><span className="whitespace-pre-wrap">{report.suggestedExplanation}</span></span>
          </label>
        )}

        {changes && (
          <label className="flex items-start gap-2.5 bg-status-warning-bg border border-status-warning-text/30 rounded-xl px-4 py-3 cursor-pointer">
            <input type="checkbox" checked={rescore} onChange={(e) => setRescore(e.target.checked)} className="w-4 h-4 mt-0.5 accent-brand cursor-pointer" />
            <span><b className="text-status-warning-text">Re-score past attempts</b> that contain this question, so students see the corrected answer and their marks, accuracy and ranks update. Untick to leave old scores untouched.</span>
          </label>
        )}

        <div>
          <label htmlFor="apply-note" className="text-xs font-bold text-text-tertiary uppercase tracking-wider">Note (optional, kept in the audit trail)</label>
          <input id="apply-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5 w-full bg-sunken border border-border-default focus:border-brand rounded-xl px-4 py-2.5 text-sm text-text-primary" />
        </div>
        {error && <p className="font-semibold text-status-danger-text" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

function ReportGroup({ group, onChanged, onEditQuestion }) {
  const toast = useToast();
  const [applyFor, setApplyFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const q = group.question;
  const tallyEntries = Object.entries(group.tally).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);

  const reject = async (report) => {
    setBusy(true);
    try {
      await mcq(`/admin/reports/${report._id}/resolve`, { method: 'POST', body: { action: 'reject' } });
      toast.success('Report ignored.');
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const rejectAll = async () => {
    setBusy(true);
    try {
      const res = await mcq(`/admin/questions/${q._id}/reports/reject-all`, { method: 'POST', body: {} });
      toast.success(`${res.closed} report(s) ignored.`);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="bg-surface border border-border-default rounded-2xl p-5 flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-text-tertiary">{q.testTitle || 'Unknown test'} · {q.subject ? displaySubjectName(q.subject) : ''}</p>
          <h3 className="text-base font-extrabold text-text-primary">Question {q.order ?? '?'}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {group.pendingCount > 0 && <Chip tone="warning"><Icon name="alert" className="w-3 h-3" /> {group.pendingCount} pending</Chip>}
          {q.isActive === false && <Chip tone="neutral">Retired</Chip>}
          {q.deleted && <Chip tone="danger">Deleted</Chip>}
        </div>
      </header>

      <p className="text-base text-text-primary font-semibold leading-relaxed whitespace-pre-wrap">{q.questionText}</p>

      <div className="grid md:grid-cols-2 gap-2">
        {q.options.map((o) => (
          <div key={o.label} className={`flex items-start gap-2.5 rounded-xl border-2 px-3.5 py-2.5 text-sm ${o.label === q.correctOption ? 'border-status-success-text/60 bg-status-success-bg' : 'border-border-default'}`}>
            <span className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-extrabold ${o.label === q.correctOption ? 'bg-status-success-text border-status-success-text text-white' : 'border-border-default text-text-tertiary'}`}>{o.label}</span>
            <span className="flex-1 text-text-secondary leading-snug">{o.text}</span>
            {o.label === q.correctOption && <span className="text-xs font-extrabold uppercase text-status-success-text">Current answer</span>}
          </div>
        ))}
      </div>

      {q.explanation && <p className="text-sm text-text-tertiary bg-sunken rounded-xl px-4 py-3 whitespace-pre-wrap"><b className="text-text-secondary">Explanation: </b>{q.explanation}</p>}

      {tallyEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold text-text-primary">What students say is correct:</span>
          {tallyEntries.map(([opt, n]) => (
            <Chip key={opt} tone={opt === q.correctOption ? 'success' : 'info'}>{opt} × {n}</Chip>
          ))}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {group.reports.map((r) => (
          <li key={r._id} className="rounded-xl border border-border-default bg-sunken/60 p-4 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Chip tone={STATUS_TONE[r.status]}>{r.status === 'rejected' ? 'ignored' : r.status}</Chip>
                <Chip>{REASON_LABELS[r.reason] || r.reason}</Chip>
                {r.suggestedOption && <Chip tone="info">Suggests {r.suggestedOption}</Chip>}
                <span className="text-text-tertiary">{r.reporter ? `${r.reporter.name} · ${r.reporter.email}` : 'Unknown student'} · {formatDate(r.createdAt)}</span>
              </div>
            </div>
            {r.suggestedExplanation && <p className="text-sm text-text-secondary whitespace-pre-wrap"><b className="text-text-primary">Their explanation: </b>{r.suggestedExplanation}</p>}
            {r.comment && <p className="text-sm text-text-secondary whitespace-pre-wrap"><b className="text-text-primary">Comment: </b>{r.comment}</p>}
            {r.status !== 'pending' && r.appliedChange?.newOption && r.appliedChange.previousOption !== r.appliedChange.newOption && (
              <p className="text-xs text-status-success-text font-semibold">Answer changed {r.appliedChange.previousOption} → {r.appliedChange.newOption}{r.appliedChange.rescoredAttempts ? ` · ${r.appliedChange.rescoredAttempts} attempt(s) re-scored` : ''}</p>
            )}
            {r.status === 'pending' && (
              <div className="flex flex-wrap gap-2 pt-1">
                <ActionButton size="sm" tone="primary" icon="check" disabled={busy || q.deleted} onClick={() => setApplyFor(r)} hint={r.suggestedOption ? `Change the answer to ${r.suggestedOption}` : 'Mark as accepted'}>
                  {r.suggestedOption && r.suggestedOption !== q.correctOption ? `Apply “${r.suggestedOption}” as the answer` : 'Accept'}
                </ActionButton>
                <ActionButton size="sm" tone="secondary" icon="x" disabled={busy} onClick={() => reject(r)}>Ignore</ActionButton>
              </div>
            )}
          </li>
        ))}
      </ul>

      <footer className="flex flex-wrap gap-2 pt-1 border-t border-border-default">
        {!q.deleted && <ActionButton size="sm" tone="soft" icon="edit" onClick={() => onEditQuestion(q)}>Edit question</ActionButton>}
        {group.pendingCount > 1 && <ActionButton size="sm" tone="ghost" icon="x" disabled={busy} onClick={rejectAll}>Ignore all {group.pendingCount}</ActionButton>}
      </footer>

      {applyFor && <ApplyDialog group={group} report={applyFor} onClose={() => setApplyFor(null)} onDone={() => { setApplyFor(null); onChanged(); }} />}
    </article>
  );
}

// Admin console: every question students reported, grouped per question, resolved in one click.
export default function AdminMcqReports({ onEditQuestion, onCountChange }) {
  const [status, setStatus] = useState('pending');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, count] = await Promise.all([mcq(`/admin/reports?status=${status}`), mcq('/admin/reports/count')]);
        if (cancelled) return;
        setGroups(data.groups || []);
        onCountChange?.(count.pending);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Failed to load reports.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status, reloadKey, onCountChange]);

  const reload = () => { setLoading(true); setError(''); setReloadKey((k) => k + 1); };
  const changeStatus = (s) => { setStatus(s); setLoading(true); setError(''); };

  return (
    <div className="space-y-5">
      <div className="bg-accent-soft-bg border border-accent-soft-border rounded-2xl p-4 text-sm text-text-secondary leading-relaxed">
        Students can report any question. Reports are grouped per question. When several students suggest the same answer, that is a strong signal. <b className="text-text-primary">Apply</b> changes the answer key in one click (and can re-score everyone who already took the test); <b className="text-text-primary">Ignore</b> keeps things as they are. Reporters are notified in their inbox either way.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="tablist" aria-label="Report status">
          {STATUSES.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={status === id} onClick={() => changeStatus(id)} className={`px-4 py-2 rounded-full text-sm font-bold cursor-pointer ${status === id ? 'bg-brand text-text-on-accent' : 'bg-surface border border-border-default text-text-secondary hover:border-text-tertiary'}`}>{label}</button>
          ))}
        </div>
        <ActionButton size="sm" tone="secondary" icon="refresh" onClick={reload}>Refresh</ActionButton>
      </div>

      {error && <ErrorBanner onRetry={reload}>{error}</ErrorBanner>}

      {loading ? (
        <p className="text-sm text-text-tertiary py-10 text-center">Loading reports…</p>
      ) : groups.length === 0 ? (
        <EmptyState icon="check" title={status === 'pending' ? 'No pending reports' : 'Nothing here'}>
          {status === 'pending' ? 'Nothing needs your attention. New reports from students will appear here.' : 'No reports match this filter.'}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => <ReportGroup key={String(g.question._id)} group={g} onChanged={reload} onEditQuestion={onEditQuestion} />)}
        </div>
      )}
    </div>
  );
}
