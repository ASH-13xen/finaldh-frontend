// One predicted (or bank) question, big and readable: how likely it is, where it comes from, how often it
// was asked, the tip, the follow-ups the board would likely ask next, and the student's progress, notes and a
// deep dive. With `collapsible` (Predicted Questions) it starts closed - just the question, how many follow-ups
// it has, and the deep dive - so a long list stays easy to scan; tapping it opens the rest.
import { useState } from 'react';
import Icon from '../../components/mcq/Icon';
import Button from './Button';
import { TierBadge, SourceBadge, AskedLine } from './badges';
import { StatusPicker, SaveToggle, NoteEditor } from './PrepControls';
import AnswerDraft from './AnswerDraft';
import SpeakButton from './SpeakButton';
import { useT } from '../lib/i18n';
import { usePrep } from '../lib/context';

export default function QuestionCard({ p, itemLabel, onOpen, collapsible = false, className = '' }) {
  const { t, tn } = useT();
  const { go } = usePrep();
  const [open, setOpen] = useState(!collapsible);
  const [notes, setNotes] = useState(false);
  const ev = p.evidence;
  const info = { text: p.questionEn || p.question, familyId: ev?.familyId || '', source: p.source };
  const followUps = (p.followUps || []).filter(Boolean);
  const deepDive = ev?.familyId ? <Button tone="ink" size="sm" iconRight="arrowRight" onClick={() => onOpen(ev.familyId)} data-tour="pred-deepdive">{t('action.deepDive')}</Button> : null;
  const title = <h3 className="font-display text-[1.3rem] leading-[1.32] md:text-[1.6rem] md:leading-[1.28] font-medium tracking-tight text-text-primary">{p.question}</h3>;
  return (
    <article data-reveal data-tour="pred-card" className={`prep-card p-5 md:p-7 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {p.tier && <TierBadge tier={p.tier} />}
        {p.source && <SourceBadge source={p.source} />}
        {itemLabel && <span className="text-xs font-semibold text-text-tertiary px-1">{itemLabel}</span>}
        <span className="ml-auto flex items-center gap-2"><SpeakButton text={p.question} id={`q:${p.id}`} /><SaveToggle qkey={p.key} info={info} /></span>
      </div>
      {collapsible
        ? (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="prep-focus mt-4 block w-full text-left cursor-pointer rounded-xl hover:[&_h3]:text-brand">
            {title}
          </button>
        )
        : <div className="mt-4">{title}</div>}
      {p.questionEn && p.questionEn !== p.question && <p className="mt-1.5 text-sm text-text-tertiary" lang="en">{p.questionEn}</p>}

      {!open && (
        // Closed: what's inside, at a glance - the follow-ups are easy to miss otherwise.
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {followUps.length > 0 && (
            <button type="button" onClick={() => setOpen(true)} data-tour="pred-followups"
              className="prep-focus inline-flex items-center gap-1.5 rounded-full border border-accent-soft-border bg-accent-soft-bg px-3 py-1.5 text-sm font-semibold text-brand cursor-pointer hover:brightness-95">
              <Icon name="message" className="w-4 h-4" />{tn('pred.followUps.count', followUps.length, { n: followUps.length })}
            </button>
          )}
          <button type="button" onClick={() => setOpen(true)} className="prep-focus inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary cursor-pointer">
            {t('pred.card.open')}<Icon name="chevronDown" className="w-4 h-4" />
          </button>
          {deepDive && <span className="ml-auto">{deepDive}</span>}
        </div>
      )}

      {open && (
        <>
          {ev?.timesAsked > 0 && p.source !== 'new' && <AskedLine n={ev.timesAsked} years={ev.years} className="block mt-2" />}
          {p.tip && (
            <p className="mt-3 flex items-start gap-2 text-[15px] text-text-secondary leading-relaxed">
              <Icon name="zap" className="w-4 h-4 mt-1 shrink-0 text-amber-500" />
              <span>{p.tip}</span>
            </p>
          )}
          {followUps.length > 0 && (
            // What the board would likely ask next, written for this student's DAF - each can be practised.
            <div className="mt-4 rounded-2xl border border-accent-soft-border bg-accent-soft-bg/50 px-4 py-3" data-tour="pred-followups-open">
              <p className="text-xs font-bold uppercase tracking-wider text-brand">{t('pred.followUps')}</p>
              <ul className="mt-2 space-y-2">
                {followUps.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[15px] text-text-primary leading-relaxed">
                    <Icon name="arrowRight" className="w-3.5 h-3.5 mt-1.5 shrink-0 text-brand" />
                    <div className="flex-1 min-w-0">
                      <p>{f}</p>
                      <div className="mt-1 flex items-center gap-3">
                        <SpeakButton text={f} id={`f:${p.id}:${f}`} label={t('speak.hearFollowUp')} className="w-8 h-8" />
                        <button type="button" onClick={() => go({ screen: 'practice', question: f, followUp: true })} className="prep-focus inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline cursor-pointer">
                          <Icon name="mic" className="w-3.5 h-3.5" />{t('action.practise')}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-5 pt-4 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
            <span data-tour="pred-status"><StatusPicker qkey={p.key} info={info} /></span>
            <div className="flex flex-wrap items-center gap-2">
              <Button tone="ghost" size="sm" icon="mic" onClick={() => go({ screen: 'practice', question: p.question, key: p.key })}>{t('action.practise')}</Button>
              <Button tone={notes ? 'soft' : 'ghost'} size="sm" icon="edit" onClick={() => setNotes((o) => !o)} aria-expanded={notes}>{t('action.notes')}</Button>
              {deepDive}
            </div>
          </div>
          {notes && <NoteEditor qkey={p.key} info={info} autoFocus />}
          <AnswerDraft className="mt-4" question={p.questionEn || p.question} qkey={p.key} familyId={ev?.familyId || ''} source={p.source} />
          {collapsible && (
            <button type="button" onClick={() => { setOpen(false); setNotes(false); }} className="prep-focus mt-4 inline-flex items-center gap-1 text-sm font-semibold text-text-tertiary hover:text-text-primary cursor-pointer">
              <Icon name="chevronDown" className="w-4 h-4 rotate-180" />{t('pred.card.close')}
            </button>
          )}
        </>
      )}
    </article>
  );
}
