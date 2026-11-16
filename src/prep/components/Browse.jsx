// Browse the bank by what candidates put in their DAF: optionals, states, subjects, colleges, jobs, hobbies.
// Each keyword shows how many interviews had it and how often the board asked about it.
import { useMemo, useRef, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import { useReveal } from '../lib/motion';
import { useT, fmt } from '../lib/i18n';

const KINDS = ['optional', 'state', 'discipline', 'college', 'job', 'hobby'];
const ICON = { optional: 'book', state: 'mapPin', discipline: 'graduation', college: 'graduation', job: 'briefcase', hobby: 'heart' };
const FIRST = 12;

export default function Browse({ keywords, onPick }) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState({});
  const root = useRef(null);
  const lists = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, (keywords?.[k] || []).filter((x) => !q || x.label.toLowerCase().includes(q.toLowerCase()))])), [keywords, q]);
  useReveal(root, { dependencies: [!!keywords, q] });
  if (!keywords) return <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }, (_, i) => <div key={i} className="iv-skeleton h-24 rounded-3xl" />)}</div>;
  return (
    <div ref={root}>
      <div className="relative max-w-md">
        <Icon name="search" className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('browse.filter')} aria-label={t('browse.filter')}
          className="prep-focus w-full h-14 rounded-full border border-border-default bg-surface pl-12 pr-4 text-[17px] outline-none focus:border-text-primary" />
      </div>
      <div className="mt-10 space-y-14">
        {KINDS.filter((k) => lists[k].length).map((k) => {
          const all = lists[k];
          const shown = open[k] || q ? all : all.slice(0, FIRST);
          return (
            <section key={k}>
              <div className="flex items-end justify-between gap-4 mb-5">
                <h3 className="font-display text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-3"><Icon name={ICON[k]} className="w-6 h-6 text-brand" />{t(`browse.kind.${k}`)}<span className="prep-num text-base font-sans font-semibold text-text-tertiary">{fmt(all.length)}</span></h3>
                {!q && all.length > FIRST && (
                  <button type="button" onClick={() => setOpen((o) => ({ ...o, [k]: !o[k] }))} className="prep-focus text-sm font-semibold text-brand hover:underline cursor-pointer">
                    {open[k] ? t('browse.showLess') : t('browse.showAll', { n: fmt(all.length) })}
                  </button>
                )}
              </div>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {shown.map((x) => (
                  <li key={x.label} data-reveal>
                    <button type="button" onClick={() => onPick(k, x.label)} className="prep-focus prep-card prep-card-hover group w-full h-full text-left px-5 py-4 cursor-pointer">
                      <span className="block font-display text-lg leading-snug font-medium group-hover:text-brand transition-colors">{x.label}</span>
                      <span className="mt-2 flex items-center justify-between gap-3 text-sm text-text-tertiary">
                        <span>{t('browse.interviews', { n: fmt(x.interviews) })}</span>
                        {x.askedPct != null && <span className="font-semibold text-brand">{t('browse.asked', { pct: x.askedPct })}</span>}
                      </span>
                      {x.askedPct != null && <span className="mt-2 block h-1.5 rounded-full bg-sunken overflow-hidden" aria-hidden="true"><span className="block h-full rounded-full bg-brand/70" style={{ width: `${x.askedPct}%` }} /></span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
