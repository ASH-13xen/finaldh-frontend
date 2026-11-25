// One question in the bank: how often it was asked (the big stamp), when, by how many boards, what it was
// about, and a save toggle. The whole card opens the deep dive.
import { YearSpark } from './badges';
import { SaveToggle } from './PrepControls';
import { useT, fmt } from '../lib/i18n';
import { usePrep } from '../lib/context';

export default function BankCard({ f, onOpen }) {
  const { t } = useT();
  const { prep } = usePrep();
  const status = prep.items.get(f.key)?.status;
  const labels = (f.hookLabels || []).map((l) => l.split(':').slice(1).join(':')).filter(Boolean).slice(0, 3);
  return (
    <article data-card data-tour="bank-card" className="prep-card prep-card-hover relative grid grid-cols-[auto_1fr] gap-4 md:gap-6 p-4 md:p-6">
      <div className={`prep-num self-start w-14 h-16 md:w-20 md:h-20 shrink-0 rounded-2xl flex flex-col items-center justify-center ${f.timesAsked >= 10 ? 'bg-brand text-text-on-accent' : f.timesAsked >= 2 ? 'bg-accent-soft-bg text-brand' : 'bg-sunken text-text-tertiary'}`}>
        <span className="font-display text-2xl md:text-3xl font-semibold leading-none">{fmt(f.timesAsked)}</span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-80">×</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => onOpen(f.id)} className="prep-focus flex-1 text-left cursor-pointer rounded-lg after:absolute after:inset-0 after:content-['']">
            <h3 className="font-display text-[1.2rem] leading-snug md:text-[1.45rem] font-medium tracking-tight text-text-primary">{f.text}</h3>
          </button>
          <span className="relative z-10 shrink-0"><SaveToggle qkey={f.key} info={{ text: f.text, familyId: f.id, source: 'bank' }} /></span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-tertiary">
          <span className="flex items-center gap-2"><YearSpark yearCounts={f.yearCounts} /></span>
          {(f.boardCount || f.boards?.length) > 0 && <span>{t('dd.boards', { n: f.boardCount || f.boards.length })}</span>}
          {(f.topics || []).slice(0, 2).map((x) => <span key={x} className="rounded-full border border-border-default px-2.5 py-0.5 text-xs font-semibold text-text-secondary">{t(`topic.${x}`)}</span>)}
          {labels.map((x) => <span key={x} className="rounded-full bg-amber-100 dark:bg-amber-400/15 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">{x}</span>)}
          {status && status !== 'todo' && <span className="text-xs font-bold text-brand">{t(`status.${status}`)}</span>}
        </div>
      </div>
    </article>
  );
}
