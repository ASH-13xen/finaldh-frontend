// One predicted (or bank) question, big and readable: how likely it is, where it comes from, how often it
// was asked, the tip, and the student's progress, notes and a deep dive.
import { useState } from 'react';
import Icon from '../../components/mcq/Icon';
import Button from './Button';
import { TierBadge, SourceBadge, AskedLine } from './badges';
import { StatusPicker, SaveToggle, NoteEditor } from './PrepControls';
import { useT } from '../lib/i18n';
import { usePrep } from '../lib/context';

export default function QuestionCard({ p, itemLabel, onOpen, className = '' }) {
  const { t } = useT();
  const { go } = usePrep();
  const [notes, setNotes] = useState(false);
  const ev = p.evidence;
  const info = { text: p.questionEn || p.question, familyId: ev?.familyId || '', source: p.source };
  return (
    <article data-reveal className={`prep-card p-5 md:p-7 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {p.tier && <TierBadge tier={p.tier} />}
        {p.source && <SourceBadge source={p.source} />}
        {itemLabel && <span className="text-xs font-semibold text-text-tertiary px-1">{itemLabel}</span>}
        <span className="ml-auto"><SaveToggle qkey={p.key} info={info} /></span>
      </div>
      <h3 className="mt-4 font-display text-[1.3rem] leading-[1.32] md:text-[1.65rem] md:leading-[1.28] font-medium tracking-tight text-text-primary">{p.question}</h3>
      {p.questionEn && p.questionEn !== p.question && <p className="mt-1.5 text-sm text-text-tertiary" lang="en">{p.questionEn}</p>}
      {ev?.timesAsked > 0 && p.source !== 'new' && <AskedLine n={ev.timesAsked} years={ev.years} className="block mt-2" />}
      {p.tip && (
        <p className="mt-3 flex items-start gap-2 text-[15px] text-text-secondary leading-relaxed">
          <Icon name="zap" className="w-4 h-4 mt-1 shrink-0 text-amber-500" />
          <span>{p.tip}</span>
        </p>
      )}
      <div className="mt-5 pt-4 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
        <StatusPicker qkey={p.key} info={info} />
        <div className="flex items-center gap-2">
          <Button tone="ghost" size="sm" icon="mic" onClick={() => go({ screen: 'practice', question: p.question, key: p.key })}>{t('action.practise')}</Button>
          <Button tone={notes ? 'soft' : 'ghost'} size="sm" icon="edit" onClick={() => setNotes((o) => !o)} aria-expanded={notes}>{t('action.notes')}</Button>
          {ev?.familyId && <Button tone="ink" size="sm" iconRight="arrowRight" onClick={() => onOpen(ev.familyId)}>{t('action.deepDive')}</Button>}
        </div>
      </div>
      {notes && <NoteEditor qkey={p.key} info={info} autoFocus />}
    </article>
  );
}
