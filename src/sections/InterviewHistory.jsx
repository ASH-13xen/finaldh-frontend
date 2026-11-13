import { useEffect, useState } from 'react';
import Icon from '../components/mcq/Icon';
import { ActionButton, EmptyState, ErrorBanner, Modal } from '../components/mcq/ui';
import { useToast } from '../components/Toast';
import { Shell, PageHeader, Panel, Skeleton } from '../components/interview/ui';
import { iv, errorMessage, formatDate } from '../lib/interviewApi';

export default function InterviewHistory({ go, onHome }) {
  const toast = useToast();
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    let cancelled = false;
    iv('/sessions').then((d) => { if (!cancelled) setSessions(d.sessions); }).catch((err) => { if (!cancelled) setError(errorMessage(err)); });
    return () => { cancelled = true; };
  }, []);

  const remove = async () => {
    try {
      await iv(`/sessions/${deleting.id}`, { method: 'DELETE' });
      setSessions((list) => list.filter((s) => s.id !== deleting.id));
      toast.success('Interview deleted.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  const scored = (sessions || []).filter((s) => s.overall != null);

  return (
    <Shell>
      <PageHeader
        onBack={onHome}
        title="My interviews"
        subtitle={scored.length >= 2 ? `Average score ${(scored.reduce((a, s) => a + s.overall, 0) / scored.length).toFixed(1)} across ${scored.length} scored interviews.` : 'Every mock interview you have taken, with its report.'}
        actions={<ActionButton tone="primary" icon="mic" onClick={() => go({ screen: 'setup' })}>New interview</ActionButton>}
      />
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {!sessions && !error && <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>}
      {sessions?.length === 0 && (
        <EmptyState icon="mic" title="No interviews yet" action={<ActionButton tone="primary" icon="mic" onClick={() => go({ screen: 'setup' })}>Start one</ActionButton>}>
          Your reports will be listed here.
        </EmptyState>
      )}
      {sessions?.length > 0 && (
        <Panel className="divide-y divide-border-subtle">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-4 px-5 py-4">
              <span className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${s.marks != null || s.overall != null ? 'bg-accent-soft-bg text-brand' : 'bg-sunken text-text-tertiary'}`} title={s.marks != null ? `${s.marks} of ${s.marksOutOf} marks` : undefined}>
                {s.marks != null ? s.marks : s.overall != null ? s.overall.toFixed(1) : <Icon name={s.inputMode === 'voice' ? 'mic' : 'keyboard'} className="w-5 h-5" />}
              </span>
              <button onClick={() => go(s.status === 'in-progress' ? { screen: 'room', sessionId: s.id } : { screen: 'report', sessionId: s.id })} className="flex-1 text-left cursor-pointer group">
                <span className="block text-sm font-bold text-text-primary group-hover:text-brand">{s.formatLabel || `${s.durationMinutes} min`} · {s.mode === 'real' ? 'Real interview' : 'Practice'} · {s.inputMode === 'voice' ? 'Voice' : 'Text'}</span>
                <span className="block text-xs text-text-tertiary mt-0.5">{formatDate(s.startedAt)} · {s.status === 'in-progress' ? 'In progress — resume' : `${s.answered ?? 0} of ${s.questions} answered`}{s.aiUsed ? ' · AI feedback' : ''}</span>
              </button>
              <button onClick={() => setDeleting(s)} className="p-2 rounded-xl text-text-tertiary hover:text-status-danger-text hover:bg-status-danger-bg cursor-pointer" aria-label="Delete interview">
                <Icon name="trash" className="w-4 h-4" />
              </button>
            </div>
          ))}
        </Panel>
      )}
      {deleting && (
        <Modal title="Delete this interview?" onClose={() => setDeleting(null)} footer={<><ActionButton onClick={() => setDeleting(null)}>Cancel</ActionButton><ActionButton tone="danger" icon="trash" onClick={remove}>Delete</ActionButton></>}>
          <p className="text-sm text-text-secondary pb-3">Its questions, your answers and the report are removed for good.</p>
        </Modal>
      )}
    </Shell>
  );
}
