// Insights: six years of interviews as a scroll story - DAF areas, themes by year, the questions that never
// go away, hobbies and optionals, every board's habits, and what was new in the latest year.
import { useEffect, useMemo, useRef, useState } from 'react';
import DeepDive from '../components/DeepDive';
import Fold from '../components/Fold';
import { SplitHeading, Highlight, CountUp } from '../components/motion';
import { gsap, ScrollTrigger, useGSAP, useReveal, prefersReducedMotion } from '../lib/motion';
import { useT, fmt, yearsRange } from '../lib/i18n';
import { usePrep } from '../lib/context';
import { api } from '../lib/api';

const AREAS = ['work', 'hobby', 'home', 'education', 'optional'];

// Each finding folds (the first starts open), so the page reads like a short list of what boards ask.
function Section({ id, title, sub, children, defaultOpen = false, tour }) {
  return (
    <Fold id={`in.${id}`} title={title} summary={sub} defaultOpen={defaultOpen} size="lg" className="pt-3" tour={tour}>
      <div className="pb-6">{children}</div>
    </Fold>
  );
}

function Bars({ rows, unit = '%', max = 100, onClick }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} data-reveal>
          <button type="button" disabled={!onClick || !r.id} onClick={() => onClick?.(r.id)} className="prep-focus w-full text-left grid grid-cols-[minmax(7rem,16rem)_1fr_auto] items-center gap-4 cursor-pointer disabled:cursor-default group">
            <span className="text-[15px] md:text-base font-semibold leading-snug group-enabled:group-hover:text-brand transition-colors">{r.label}</span>
            <span className="h-4 md:h-5 rounded-full bg-sunken overflow-hidden"><span data-bar className="block h-full rounded-full origin-left" style={{ width: `${(r.value / max) * 100}%`, background: 'linear-gradient(90deg, var(--prep-emerald), var(--prep-emerald-bright))' }} /></span>
            <span className="prep-num font-display text-xl md:text-2xl font-semibold w-16 text-right">{r.value}{unit}</span>
          </button>
          {r.note && <p className="mt-1 text-xs text-text-tertiary md:ml-[17rem]">{r.note}</p>}
        </li>
      ))}
    </ul>
  );
}

export default function Insights() {
  const { status } = usePrep();
  const { t, hi } = useT();
  const [trends, setTrends] = useState(null);
  const [kw, setKw] = useState(null);
  const [familyId, setFamilyId] = useState(null);
  const root = useRef(null);
  const corpus = status.corpus || {};

  useEffect(() => {
    let cancelled = false;
    api.trends().then((d) => { if (!cancelled) setTrends(d); }).catch(() => {});
    api.keywords().then((d) => { if (!cancelled) setKw(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useReveal(root, { dependencies: [!!trends, !!kw] });
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    const bars = gsap.utils.toArray('[data-bar]', root.current);
    if (!bars.length) return;
    gsap.set(bars, { scaleX: 0 });
    ScrollTrigger.batch(bars, { start: 'top 92%', once: true, onEnter: (b) => gsap.to(b, { scaleX: 1, duration: 1.2, ease: 'power3.out', stagger: 0.06 }) });
  }, { scope: root, dependencies: [!!trends, !!kw], revertOnUpdate: true });

  const years = useMemo(() => trends?.years || corpus.years || [], [trends, corpus.years]);
  const heat = useMemo(() => {
    if (!trends) return null;
    const totals = Object.fromEntries(years.map((y) => [y, trends.topics.reduce((a, tp) => a + (tp.byYear[y] || 0), 0)]));
    const rows = trends.topics.filter((tp) => !['general', 'personal'].includes(tp.topic)).slice(0, 8).map((tp) => ({ topic: tp.topic, cells: years.map((y) => (totals[y] ? Math.round(((tp.byYear[y] || 0) / totals[y]) * 1000) / 10 : 0)) }));
    const max = Math.max(1, ...rows.flatMap((r) => r.cells));
    return { rows, max };
  }, [trends, years]);

  const hobbies = (kw?.keywords?.hobby || []).filter((h) => h.interviews >= 30 && h.askedPct != null).sort((a, b) => b.askedPct - a.askedPct).slice(0, 10);
  const optionals = (kw?.keywords?.optional || []).filter((o) => o.interviews >= 20 && o.askedPct != null).sort((a, b) => b.askedPct - a.askedPct).slice(0, 10);
  const boards = (kw?.boards || []).filter((b) => b.interviews >= 20);
  const maxAsked = Math.max(1, ...(trends?.mostAsked || []).map((f) => f.timesAsked));

  const titleCls = `font-display font-semibold text-text-primary ${hi ? 'text-[1.9rem] leading-[1.3] md:text-5xl md:leading-[1.25]' : 'tracking-[-0.02em] text-[2.1rem] leading-[1.1] md:text-5xl md:leading-[1.06]'}`;

  return (
    <div ref={root} className="max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-16">
      <p className="prep-eyebrow text-brand mb-5">{t('in.eyebrow', { years: yearsRange(years) })}</p>
      <SplitHeading className={titleCls}>{t('in.titleA')}<Highlight still>{t('in.titleHl')}</Highlight></SplitHeading>
      <p className="mt-6 text-lg md:text-xl text-text-secondary">{t('in.sub', { n: fmt(corpus.transcripts) })}</p>
      <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[[corpus.transcripts, t('home.stat.interviews')], [corpus.questions, t('home.stat.questions')], [corpus.followUps, t('home.stat.followUps')], [status.boardCount, t('bank.tab.boards')]].filter(([n]) => n).map(([n, label]) => (
          <div key={label} data-reveal className="prep-card px-5 py-5"><CountUp value={n} className="prep-num block font-display text-4xl md:text-5xl font-semibold" /><span className="text-sm text-text-tertiary">{label}</span></div>
        ))}
      </div>

      {kw?.areas && (
        <Section id="areas" tour="in-first" defaultOpen title={t('in.areas')} sub={t('in.areasSub')}>
          <Bars rows={AREAS.filter((a) => kw.areas[a]).map((a) => ({ label: t(`area.${a}`), value: kw.areas[a].pct, note: t('heat.questions', { q: kw.areas[a].avgQuestions }) }))} />
        </Section>
      )}

      {heat && (
        <Section id="topics" title={t('in.topics')} sub={t('in.topicsSub')}>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[34rem] border-separate border-spacing-1.5">
              <thead><tr><th />{years.map((y) => <th key={y} className="prep-num text-sm font-semibold text-text-tertiary pb-2">{y}</th>)}</tr></thead>
              <tbody>
                {heat.rows.map((r) => (
                  <tr key={r.topic} data-reveal>
                    <th className="text-left text-[15px] font-semibold pr-4 whitespace-nowrap">{t(`topic.${r.topic}`)}</th>
                    {r.cells.map((v, i) => (
                      <td key={i} className="h-12 rounded-xl text-center prep-num text-sm font-semibold" style={{ background: `rgba(13,122,86,${0.08 + (v / heat.max) * 0.82})`, color: v / heat.max > 0.5 ? '#fff' : 'var(--text-primary)' }}>{v}%</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {trends?.mostAsked?.length > 0 && (
        <Section id="mostAsked" title={t('in.mostAsked')}>
          <Bars rows={trends.mostAsked.slice(0, 10).map((f) => ({ id: f.id, label: f.text, value: f.timesAsked }))} unit="×" max={maxAsked} onClick={setFamilyId} />
        </Section>
      )}

      {hobbies.length > 0 && (
        <Section id="hobbies" title={t('in.hobbies')} sub={t('in.hobbiesSub')}>
          <Bars rows={hobbies.map((h) => ({ label: h.label, value: h.askedPct, note: t('in.interviews', { n: fmt(h.interviews) }) }))} />
        </Section>
      )}

      {optionals.length > 0 && (
        <Section id="optionals" title={t('in.optionals')} sub={t('in.optionalsSub')}>
          <Bars rows={optionals.map((o) => ({ label: o.label, value: o.askedPct, note: t('in.interviews', { n: fmt(o.interviews) }) }))} />
        </Section>
      )}

      {boards.length > 0 && (
        <Section id="boards" title={t('in.boards')} sub={t('in.boardsSub')}>
          <div data-reveal className="prep-card p-4 md:p-8">
            <svg viewBox="0 0 640 380" className="w-full h-auto" role="img" aria-label={t('in.boards')}>
              {(() => {
                const xs = boards.map((b) => b.dafPct);
                const ys = boards.map((b) => b.followUpPct);
                const x0 = Math.min(...xs) - 4; const x1 = Math.max(...xs) + 4;
                const y0 = Math.min(...ys) - 4; const y1 = Math.max(...ys) + 4;
                const X = (v) => 50 + ((v - x0) / (x1 - x0)) * 560;
                const Y = (v) => 330 - ((v - y0) / (y1 - y0)) * 300;
                return (
                  <>
                    <line x1="50" y1="330" x2="620" y2="330" stroke="var(--border-default)" />
                    <line x1="50" y1="20" x2="50" y2="330" stroke="var(--border-default)" />
                    <text x="620" y="358" textAnchor="end" fontSize="13" fill="var(--text-tertiary)">{t('in.axisDaf')}</text>
                    <text x="14" y="24" fontSize="13" fill="var(--text-tertiary)" transform="rotate(-90 14 24)" textAnchor="end">{t('in.axisFollow')}</text>
                    {boards.map((b) => {
                      const r = 14 + Math.sqrt(b.interviews) * 0.9;
                      return (
                        <g key={b.name}>
                          <circle cx={X(b.dafPct)} cy={Y(b.followUpPct)} r={r} fill="var(--prep-ink)" fillOpacity="0.88" stroke="var(--accent-soft-border)" strokeWidth="3" className="dark:fill-[#f3ede2]" />
                          <text x={X(b.dafPct)} y={Y(b.followUpPct) + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fdfbf7">{b.initials}</text>
                          <title>{`${b.name}: ${b.dafPct}% DAF, ${b.followUpPct}% follow-ups, ${b.interviews} interviews`}</title>
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          </div>
        </Section>
      )}

      {trends?.newInLatest?.length > 0 && (
        <Section id="new" title={t('in.new', { year: trends.latestYear })} sub={t('in.newSub', { year: trends.latestYear })}>
          <ul className="grid md:grid-cols-2 gap-3">
            {trends.newInLatest.map((f) => (
              <li key={f.id} data-reveal>
                <button type="button" onClick={() => setFamilyId(f.id)} className="prep-focus w-full text-left prep-card prep-card-hover px-5 py-4 flex items-center gap-4 cursor-pointer">
                  <span className="prep-num shrink-0 w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-400/15 text-amber-800 dark:text-amber-300 font-display text-lg font-semibold flex items-center justify-center">{f.timesAsked}×</span>
                  <span className="text-[16px] leading-snug">{f.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {familyId && <DeepDive familyId={familyId} onClose={() => setFamilyId(null)} />}
    </div>
  );
}
