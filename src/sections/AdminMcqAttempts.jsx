import { useState } from 'react';
import { ActionButton, AttemptDots, EmptyState } from '../components/mcq/ui';
import { useToast } from '../components/Toast';
import { mcq, errorMessage } from '../lib/mcqApi';
import { displaySubjectName } from '../lib/mcqSubjects';

// Support tool: see how many attempts a student has used on each test, grant extra attempts, or reset.
// (Every test allows 2 attempts, Test and Practice combined, unless its own limit says otherwise.)
export default function AdminMcqAttempts({ tests }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pickTest, setPickTest] = useState('');

  const lookup = async (e) => {
    e?.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    try {
      setData(await mcq(`/admin/quota?email=${encodeURIComponent(email.trim())}`));
    } catch (err) {
      setData(null);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const change = async (testId, action) => {
    setBusy(true);
    try {
      await mcq('/admin/quota', { method: 'POST', body: { email: data.student.email, testId, action, amount: 1 } });
      toast.success(action === 'grant' ? 'Granted 1 extra attempt.' : 'Used attempts reset to 0.');
      setData(await mcq(`/admin/quota?email=${encodeURIComponent(data.student.email)}`));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-sm font-semibold transition-all';

  return (
    <div className="space-y-5">
      <div className="bg-accent-soft-bg border border-accent-soft-border rounded-2xl p-4 text-sm text-text-secondary leading-relaxed">
        A student who lost an attempt to a technical problem will ask you for another. Look them up by email to see how many attempts they have used on each test, then grant an extra one or reset the count.
      </div>

      <form onSubmit={lookup} className="flex flex-col sm:flex-row gap-3">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@email.com" className={`${inputCls} flex-1`} aria-label="Student email" />
        <ActionButton type="submit" tone="primary" icon="search" disabled={busy || !email.trim()}>Look up</ActionButton>
      </form>

      {error && <p className="text-sm font-semibold text-status-danger-text" role="alert">{error}</p>}

      {data && (
        <div className="space-y-4">
          <p className="text-base font-bold text-text-primary">{data.student.name} <span className="font-normal text-text-tertiary">· {data.student.email}</span></p>

          {data.tests.length === 0 ? (
            <EmptyState icon="list" title="No attempts used yet">This student has not started any test. You can still grant attempts below.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.tests.map((t) => (
                <li key={t.testId} className="bg-surface border border-border-default rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">{t.title}</p>
                    <p className="text-xs text-text-tertiary">{displaySubjectName(t.subject)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-2 text-sm text-text-secondary"><AttemptDots used={t.used} max={t.max} /> {t.used}/{t.max} used{t.extra > 0 ? ` (+${t.extra} granted)` : ''}</span>
                    <ActionButton size="sm" tone="soft" icon="zap" disabled={busy} onClick={() => change(t.testId, 'grant')}>Grant +1</ActionButton>
                    <ActionButton size="sm" tone="secondary" icon="undo" disabled={busy || t.used === 0} onClick={() => change(t.testId, 'reset')}>Reset used to 0</ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="bg-surface border border-border-default rounded-xl p-4">
            <p className="text-sm font-bold text-text-primary mb-2">Grant an attempt on another test</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <select value={pickTest} onChange={(e) => setPickTest(e.target.value)} className={`${inputCls} flex-1`} aria-label="Test">
                <option value="">Select a test…</option>
                {tests.map((t) => <option key={t._id} value={t._id}>{t.title} ({displaySubjectName(t.subject)})</option>)}
              </select>
              <ActionButton tone="soft" icon="zap" disabled={busy || !pickTest} onClick={() => change(pickTest, 'grant')}>Grant +1</ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
