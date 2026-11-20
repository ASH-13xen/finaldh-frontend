// Everything about one question: how often and when it was asked, what the board asked next, how to approach
// it (AI, shared and cached), where it was asked (no names, no full transcripts), and related questions.
// Related questions and follow-ups open inside the same panel, with a back button.
import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import Sheet from './Sheet';
import Button from './Button';
import { YearSpark } from './badges';
import { StatusPicker, SaveToggle, NoteEditor } from './PrepControls';
import AnswerDraft from './AnswerDraft';
import { useDafCheck } from '../lib/useDafCheck';
import { useT, fmt } from '../lib/i18n';
import { api } from '../lib/api';
import { errorMessage } from '../../lib/interviewApi';
import { usePrep } from '../lib/context';
import { SignInSheet } from './Gate';

const askerLabel = (t, a) => (a === 'chairman' ? t('asker.chairman') : /^m(\d)$/.test(a || '') ? t('asker.m', { n: a.slice(1) }) : t('asker.member'));

function Section({ title, sub, children }) {
  return (
    <section className="px-5 md:px-10 py-8 border-t border-border-subtle">
      <h3 className="font-display text-2xl md:text-[1.7rem] font-semibold tracking-tight">{title}</h3>
      {sub && <p className="mt-1 text-sm text-text-tertiary">{sub}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Approach({ familyId, onLeave }) {
  const { t, lang } = useT();
  const { refreshCredits, openCredits, go } = usePrep();
  const check = useDafCheck();
  const [state, setState] = useState({ status: 'idle' });
  const [reveal, setReveal] = useState(false);
  const load = useCallback(() => {
    setState({ status: 'loading' });
    api.approach(familyId, lang)
      .then((d) => { setState({ status: 'ready', data: d.approach }); refreshCredits(); })
      .catch((err) => {
        if (err?.status === 402) { setState({ status: 'idle' }); openCredits(); return; }
        setState({ status: 'error', message: err?.data?.aiUnavailable ? t('dd.aiOff') : errorMessage(err) });
      });
  }, [familyId, lang, t, refreshCredits, openCredits]);

  if (state.status === 'idle' && !check.loading && !check.verified) {
    return (
      <button type="button" onClick={() => { onLeave?.(); go({ screen: 'daf' }); }} className="prep-focus inline-flex items-center gap-2 h-12 px-5 rounded-full border border-dashed border-border-default text-[15px] font-semibold text-text-secondary hover:text-text-primary hover:border-text-primary cursor-pointer">
        <Icon name="lock" className="w-4 h-4" />{t(check.status === 'pending' ? 'dd.approachPending' : 'dd.approachLocked')}
      </button>
    );
  }
  if (state.status === 'idle') return <Button tone="soft" size="lg" icon="sparkles" onClick={load}>{t('dd.loadApproach')}</Button>;
  if (state.status === 'loading') return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="iv-skeleton h-5 rounded-full" style={{ width: `${90 - i * 18}%` }} />)}</div>;
  if (state.status === 'error') return <p className="text-sm text-text-secondary">{state.message}</p>;
  const a = state.data;
  return (
    <div className="space-y-7">
      {a.gist && (
        <div className="rounded-2xl bg-accent-soft-bg border border-accent-soft-border px-5 py-4">
          <p className="prep-eyebrow text-brand mb-1.5">{t('dd.gist')}</p>
          <p className="text-[17px] leading-relaxed text-text-primary">{a.gist}</p>
        </div>
      )}
      {a.structure?.length > 0 && (
        <div>
          <p className="prep-eyebrow text-text-tertiary mb-3">{t('dd.structure')}</p>
          <ol className="space-y-3">
            {a.structure.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="prep-num shrink-0 w-8 h-8 rounded-full bg-text-primary text-page font-display font-semibold flex items-center justify-center">{i + 1}</span>
                <span className="pt-1 text-[16px] leading-relaxed text-text-primary">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        {a.include?.length > 0 && (
          <div className="rounded-2xl border border-border-default p-5">
            <p className="prep-eyebrow text-brand mb-3">{t('dd.include')}</p>
            <ul className="space-y-2">{a.include.map((s, i) => <li key={i} className="flex gap-2 text-[15px] leading-relaxed"><Icon name="check" className="w-4 h-4 mt-1 shrink-0 text-brand" />{s}</li>)}</ul>
          </div>
        )}
        {a.avoid?.length > 0 && (
          <div className="rounded-2xl border border-border-default p-5">
            <p className="prep-eyebrow text-status-danger-text mb-3">{t('dd.avoid')}</p>
            <ul className="space-y-2">{a.avoid.map((s, i) => <li key={i} className="flex gap-2 text-[15px] leading-relaxed"><Icon name="x" className="w-4 h-4 mt-1 shrink-0 text-status-danger-text" />{s}</li>)}</ul>
          </div>
        )}
      </div>
      {a.personal ? (
        <p className="text-sm text-text-secondary flex gap-2"><Icon name="user" className="w-4 h-4 mt-0.5 shrink-0" />{t('dd.personal')}</p>
      ) : a.sample ? (
        <div className="rounded-2xl border border-border-default overflow-hidden">
          <div className="px-5 py-3 bg-sunken/70 flex items-center justify-between gap-3">
            <p className="prep-eyebrow text-text-secondary">{t('dd.sample')}</p>
            {!reveal && <Button tone="ink" size="sm" icon="eye" onClick={() => setReveal(true)}>{t('dd.reveal')}</Button>}
          </div>
          {reveal
            ? <p className="px-5 py-5 text-[16px] leading-[1.75] text-text-primary font-display">{a.sample}</p>
            : <p className="px-5 py-5 text-sm text-text-tertiary">{t('dd.sampleHidden')}</p>}
        </div>
      ) : null}
      <p className="text-xs text-text-tertiary flex items-center gap-1.5"><Icon name="sparkles" className="w-3.5 h-3.5" />{t('dd.aiNote')}</p>
    </div>
  );
}

function Body({ familyId, onOpen, canBack, onBack, onClose }) {
  const { t, tn } = useT();
  const { go } = usePrep();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [more, setMore] = useState(false);
  const [notes, setNotes] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.family(familyId).then((d) => { if (!cancelled) setData(d); }).catch((err) => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
  }, [familyId]);

  if (error) return <p className="px-6 py-20 text-center text-text-secondary">{errorMessage(error)}</p>;
  if (!data) {
    return (
      <div className="px-5 md:px-10 pt-16 space-y-4">
        <div className="iv-skeleton h-4 w-40 rounded-full" />
        <div className="iv-skeleton h-10 w-11/12 rounded-2xl" />
        <div className="iv-skeleton h-10 w-8/12 rounded-2xl" />
      </div>
    );
  }
  const f = data.family;
  const info = { text: f.text, familyId: f.id, source: 'bank' };
  const asked = more ? data.asked : data.asked.slice(0, 5);
  return (
    <div>
      <header className="px-5 md:px-10 pt-6 md:pt-10 pb-8 pr-16 md:pr-20">
        {canBack && (
          <button type="button" onClick={onBack} className="prep-focus mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary cursor-pointer">
            <Icon name="arrowLeft" className="w-4 h-4" /> {t('common.back')}
          </button>
        )}
        <p className="prep-eyebrow text-brand">{tn('common.askedTimes', f.timesAsked)}{(f.boardCount || f.boards?.length) ? ` · ${t('dd.boards', { n: f.boardCount || f.boards.length })}` : ''}</p>
        <h2 className="mt-4 font-display text-[1.9rem] leading-[1.18] md:text-[2.5rem] md:leading-[1.12] font-semibold tracking-tight">{f.text}</h2>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className="flex items-center gap-3 text-sm text-text-tertiary"><YearSpark yearCounts={f.yearCounts} className="h-6" /> {t('dd.timeline')}</span>
          {(f.topicLabels || []).map((x) => <span key={x} className="text-xs font-semibold text-text-secondary rounded-full border border-border-default px-3 py-1">{x}</span>)}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface border border-border-subtle px-4 py-3">
          <StatusPicker qkey={f.key} info={info} />
          <div className="flex items-center gap-2">
            <Button tone="ghost" size="sm" icon="mic" onClick={() => { onClose(); go({ screen: 'practice', question: f.text, key: f.key }); }}>{t('action.practise')}</Button>
            <Button tone={notes ? 'soft' : 'ghost'} size="sm" icon="edit" onClick={() => setNotes((o) => !o)}>{t('action.notes')}</Button>
            <SaveToggle qkey={f.key} info={info} />
          </div>
        </div>
        {notes && <NoteEditor qkey={f.key} info={info} autoFocus />}
        <AnswerDraft className="mt-4" question={f.text} qkey={f.key} familyId={f.id} source="bank" />
      </header>

      {data.followUps?.length > 0 && (
        <Section title={t('dd.next')} sub={t('dd.nextSub')}>
          <ol className="relative space-y-3 before:absolute before:left-[1.15rem] before:top-2 before:bottom-2 before:w-px before:bg-border-default">
            {data.followUps.map((fu, i) => (
              <li key={i} className="relative pl-12">
                <span className="absolute left-0 top-1 w-9 h-9 rounded-full bg-surface border border-border-default flex items-center justify-center text-brand" aria-hidden="true"><Icon name="arrowRight" className="w-4 h-4 rotate-90" /></span>
                <button
                  type="button"
                  disabled={!fu.familyId}
                  onClick={() => fu.familyId && onOpen(fu.familyId)}
                  className="prep-focus w-full text-left rounded-2xl border border-border-subtle bg-surface hover:border-text-primary px-4 py-3 transition-colors cursor-pointer disabled:cursor-default flex items-start justify-between gap-3"
                >
                  <span className="text-[16px] leading-snug">{fu.text}</span>
                  {fu.n > 1 && <span className="prep-num shrink-0 text-xs font-bold text-brand bg-accent-soft-bg rounded-full px-2 py-0.5">{fu.n}×</span>}
                </button>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section title={t('dd.approach')}>
        <Approach familyId={f.id} onLeave={onClose} />
      </Section>

      <Section title={t('dd.where')}>
        <ul className="space-y-4">
          {asked.map((a) => (
            <li key={a.id} className="rounded-2xl border border-border-subtle bg-surface p-4 md:p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="prep-num rounded-full bg-text-primary text-page px-2.5 py-1">{a.year}</span>
                <span className="rounded-full border border-border-default px-2.5 py-1 text-text-secondary">{a.board ? t('dd.byBoard', { board: a.board }) : t('dd.noBoard')}</span>
                <span className="text-text-tertiary">{askerLabel(t, a.asker)}</span>
              </div>
              {a.text !== f.text && <p className="mt-3 text-[15px] text-text-primary">“{a.text}”</p>}
              {a.candidate && <p className="mt-2 text-sm text-text-tertiary">{a.candidate}</p>}
              {a.note && (
                <p className="mt-3 pl-4 border-l-2 border-amber-400 text-[15px] leading-relaxed text-text-secondary">
                  <span className="sr-only">{t('dd.answered')}: </span>{a.note}
                </p>
              )}
              {a.ladder?.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {a.ladder.map((l, i) => (
                    <p key={i} className="text-sm text-text-secondary flex gap-2" style={{ paddingLeft: `${i * 14}px` }}>
                      <Icon name="repeat" className="w-3.5 h-3.5 mt-1 shrink-0 text-brand" />
                      <span><span className="font-semibold">{t('dd.followedWith')}:</span> {l.text}</span>
                    </p>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
        {!more && data.asked.length > 5 && (
          <Button tone="ghost" size="md" className="mt-4" onClick={() => setMore(true)}>{t('dd.more', { n: fmt(data.asked.length - 5) })}</Button>
        )}
      </Section>

      {data.related?.length > 0 && (
        <Section title={t('dd.related')}>
          <ul className="grid gap-2">
            {data.related.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpen(r.id)} className="prep-focus w-full text-left rounded-2xl border border-border-subtle bg-surface hover:border-text-primary px-4 py-3 transition-colors cursor-pointer flex items-center justify-between gap-3">
                  <span className="text-[15px] leading-snug">{r.text}</span>
                  <span className="prep-num shrink-0 text-xs font-bold text-text-tertiary">{r.timesAsked}×</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <div className="h-10" />
    </div>
  );
}

// A visitor who hasn't signed in is asked to sign in instead of opening the question.
export default function DeepDive(props) {
  const { guest } = usePrep();
  if (guest) return <SignInSheet reason="deepDive" onClose={props.onClose} />;
  return <QuestionDeepDive {...props} />;
}

function QuestionDeepDive({ familyId, onClose }) {
  const { t } = useT();
  const [stack, setStack] = useState([familyId]);
  const current = stack[stack.length - 1];
  return (
    <Sheet onClose={onClose} label={t('action.deepDive')}>
      <Body
        key={current}
        familyId={current}
        canBack={stack.length > 1}
        onBack={() => setStack((s) => s.slice(0, -1))}
        onOpen={(id) => setStack((s) => [...s, id])}
        onClose={onClose}
      />
    </Sheet>
  );
}
