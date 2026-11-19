// "Write my answer": an answer AI drafts from the student's own DAF, with [gaps] for what only they can say,
// three ways to make it their own and the follow-ups to expect. One AI credit; the draft is kept on the
// question, so opening it again is free.
import { useState } from 'react';
import Icon from '../../components/mcq/Icon';
import { useToast } from '../../components/Toast';
import { errorMessage } from '../../lib/interviewApi';
import Button from './Button';
import { useT } from '../lib/i18n';
import { usePrep } from '../lib/context';
import { api } from '../lib/api';
import { useDafCheck } from '../lib/useDafCheck';

export default function AnswerDraft({ question, qkey, familyId = '', source = 'bank', className = '' }) {
  const { t } = useT();
  const toast = useToast();
  const { prep, credits, refreshCredits, openCredits, daf, go } = usePrep();
  const check = useDafCheck();
  const saved = qkey ? prep.items.get(qkey)?.draft : null;
  const [draft, setDraft] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const shown = draft || saved;
  const hasDaf = !!daf?.profile && !daf.profile.empty;

  const write = async () => {
    if (credits && !credits.admin && credits.total < 1) { openCredits(); return; }
    setBusy(true);
    try {
      const d = await api.draftAnswer({ question, key: qkey, familyId, source });
      setDraft(d.draft);
      setOpen(true);
      if (qkey) prep.merge(qkey, { draft: d.draft, text: question });
      refreshCredits();
    } catch (err) {
      if (err.status === 402) openCredits();
      else toast.error(errorMessage(err, t('common.error')));
    } finally {
      setBusy(false);
    }
  };

  const copyToNotes = async () => {
    if (!qkey || !shown) return;
    const before = prep.items.get(qkey)?.note || '';
    const ok = await prep.update(qkey, { note: [before, shown.text].filter(Boolean).join('\n\n').slice(0, 2000) }, { text: question, familyId, source });
    if (ok) toast.success(t('ad.copied'));
  };

  if (!shown && !check.loading && !check.verified) {
    return (
      <div className={className}>
        <button type="button" onClick={() => go({ screen: 'daf' })} className="prep-focus inline-flex items-center gap-2 h-9 px-4 rounded-full border border-dashed border-border-default text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-text-primary cursor-pointer">
          <Icon name="lock" className="w-4 h-4" />{t(check.status === 'pending' ? 'ad.lockedPending' : 'ad.locked')}
        </button>
      </div>
    );
  }
  if (!shown) {
    return (
      <div className={className}>
        <Button tone="soft" size="sm" icon="sparkles" disabled={busy} onClick={write}>
          {busy ? t('ad.writing') : t('ad.write')}
        </Button>
        {!hasDaf && <p className="mt-2 text-xs text-text-tertiary">{t('ad.noDaf')}</p>}
      </div>
    );
  }
  return (
    <div className={className}>
      {!open ? (
        <Button tone="soft" size="sm" icon="eye" onClick={() => setOpen(true)}>{t('ad.show')}</Button>
      ) : (
        <div className="rounded-2xl border border-accent-soft-border bg-accent-soft-bg/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="prep-eyebrow text-brand flex items-center gap-1.5"><Icon name="sparkles" className="w-4 h-4" />{t('ad.title')}</p>
            <button type="button" onClick={() => setOpen(false)} className="prep-focus text-sm font-semibold text-text-secondary hover:text-text-primary cursor-pointer">{t('ad.hide')}</button>
          </div>
          <p className="mt-3 text-[16px] leading-relaxed text-text-primary whitespace-pre-line">{shown.text}</p>
          {shown.pointers?.length > 0 && (
            <>
              <p className="mt-4 text-sm font-semibold text-text-secondary">{t('ad.pointers')}</p>
              <ul className="mt-1.5 space-y-1.5">{shown.pointers.map((x, i) => <li key={i} className="flex gap-2 text-sm leading-relaxed"><Icon name="check" className="w-4 h-4 mt-0.5 text-brand shrink-0" />{x}</li>)}</ul>
            </>
          )}
          {shown.followUps?.length > 0 && (
            <>
              <p className="mt-4 text-sm font-semibold text-text-secondary">{t('ad.followUps')}</p>
              <ul className="mt-1.5 space-y-1.5">{shown.followUps.map((x, i) => <li key={i} className="flex gap-2 text-sm leading-relaxed"><Icon name="arrowRight" className="w-4 h-4 mt-0.5 text-text-tertiary shrink-0" />{x}</li>)}</ul>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {qkey && <Button tone="ghost" size="sm" icon="edit" onClick={copyToNotes}>{t('ad.toNotes')}</Button>}
            <Button tone="ghost" size="sm" icon="refresh" disabled={busy} onClick={write}>{busy ? t('ad.writing') : t('ad.again')}</Button>
          </div>
          <p className="mt-3 text-xs text-text-tertiary">{t('ad.disclaimer')}</p>
        </div>
      )}
    </div>
  );
}
