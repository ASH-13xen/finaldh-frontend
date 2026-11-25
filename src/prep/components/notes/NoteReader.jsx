// One current-topic note: why it's in the news, the notes, then the questions a board may ask - each with a
// model answer kept hidden until the student has tried it aloud - and a branded PDF of the whole note.
import { useEffect, useRef, useState } from 'react';
import Icon from '../../../components/mcq/Icon';
import { ErrorBanner } from '../../../components/mcq/ui';
import { errorMessage } from '../../../lib/interviewApi';
import Button from '../Button';
import { SplitHeading } from '../motion';
import { gsap, useGSAP, useReveal, prefersReducedMotion } from '../../lib/motion';
import { useT } from '../../lib/i18n';
import { usePrep } from '../../lib/context';
import { api } from '../../lib/api';
import { BRAND, toneOf, noteDate } from '../../lib/notes';
import PrintView, { NoteDoc } from './Print';

function NoteQuestion({ q, n }) {
  const { t } = useT();
  const { go } = usePrep();
  const [open, setOpen] = useState(false);
  const ans = useRef(null);
  useGSAP(() => {
    if (!open || !ans.current || prefersReducedMotion()) return;
    gsap.from(ans.current, { height: 0, autoAlpha: 0, duration: 0.55, ease: 'power3.out' });
  }, { dependencies: [open] });
  return (
    <li data-reveal className="prep-card p-6 md:p-8">
      <div className="flex items-start gap-4 md:gap-7">
        <span className="prep-num font-display text-3xl md:text-5xl font-semibold text-brand leading-none pt-1">{String(n).padStart(2, '0')}</span>
        <div className="flex-1 min-w-0">
          <span className="inline-block text-xs font-semibold rounded-full bg-sunken px-3 py-1 text-text-secondary">{t(`nt.qtype.${q.type}`)}</span>
          <p className="mt-3 font-display text-xl md:text-[1.7rem] leading-snug text-text-primary">{q.q}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button tone="soft" size="sm" icon="mic" onClick={() => go({ screen: 'practice', question: q.q })}>{t('action.practise')}</Button>
            {q.answer && (
              <Button tone="ghost" size="sm" icon={open ? 'eyeOff' : 'eye'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                {open ? t('nt.hideAnswer') : t('nt.showAnswer')}
              </Button>
            )}
          </div>
          {open && (
            <div ref={ans} className="overflow-hidden">
              <p className="mt-5 pl-5 border-l-[3px] border-brand text-[17px] leading-relaxed text-text-secondary">{q.answer}</p>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function SideCard({ title, children }) {
  return (
    <div data-reveal className="prep-card p-6">
      <p className="prep-eyebrow text-text-tertiary">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function NoteReader({ slug }) {
  const { t, lang, hi } = useT();
  const { go } = usePrep();
  const [res, setRes] = useState({ key: null, note: null, error: null });
  // The note's sections fold (the first starts open) so a long note reads like a list of contents. The PDF
  // (PrintView) always has every section.
  const [openSec, setOpenSec] = useState(() => new Set([0]));
  const toggleSec = (i) => setOpenSec((cur) => { const n = new Set(cur); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const [tick, setTick] = useState(0);
  const [printing, setPrinting] = useState(false);
  const root = useRef(null);
  const questions = useRef(null);
  const reqKey = `${slug}:${lang}:${tick}`;

  useEffect(() => {
    let cancelled = false;
    api.note(slug, lang)
      .then((d) => { if (!cancelled) setRes({ key: reqKey, note: d.note, error: null }); })
      .catch((err) => { if (!cancelled) setRes({ key: reqKey, note: null, error: err }); });
    return () => { cancelled = true; };
  }, [slug, lang, reqKey]);

  const loading = res.key !== reqKey;
  const note = loading ? null : res.note;
  useReveal(root, { dependencies: [!!note] });

  const titleCls = `mt-5 font-display font-semibold text-text-primary max-w-5xl ${hi ? 'text-[2.1rem] leading-[1.3] md:text-6xl md:leading-[1.25]' : 'tracking-[-0.02em] text-[2.4rem] leading-[1.04] md:text-7xl md:leading-[1]'}`;
  const back = (
    <button type="button" onClick={() => go({ screen: 'notes' })} className="prep-focus inline-flex items-center gap-2 h-11 px-4 -ml-4 rounded-full text-text-secondary hover:text-text-primary font-semibold cursor-pointer">
      <Icon name="arrowLeft" className="w-5 h-5" />{t('nt.back')}
    </button>
  );

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-8 md:pt-12" aria-busy="true">
        {back}
        <div className="mt-10 space-y-5 animate-pulse">
          <div className="h-4 w-40 rounded-full bg-sunken" />
          <div className="h-14 w-4/5 rounded-2xl bg-sunken" />
          <div className="h-14 w-3/5 rounded-2xl bg-sunken" />
          <div className="h-28 w-full rounded-[1.5rem] bg-sunken mt-8" />
        </div>
      </div>
    );
  }
  if (!note) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-8 pt-8 md:pt-12">
        {back}
        <div className="mt-8">
          {res.error?.status === 404
            ? <p className="font-display text-3xl text-text-primary">{t('nt.notFound')}</p>
            : <ErrorBanner onRetry={() => setTick((k) => k + 1)}>{errorMessage(res.error, t('common.error'))}</ErrorBanner>}
        </div>
      </div>
    );
  }

  const tone = toneOf(note.category);
  return (
    <div ref={root} className="max-w-6xl mx-auto px-4 md:px-8 pt-8 md:pt-12">
      {back}
      {note.status !== 'published' && (
        <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-400/10 dark:border-amber-400/30 text-amber-900 dark:text-amber-200 px-5 py-3 text-sm font-semibold">{t('nt.draftBanner')}</p>
      )}

      <header className="mt-8 md:mt-12">
        <p className="prep-eyebrow flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="flex items-center gap-2" style={{ color: tone }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: tone }} aria-hidden="true" />{t(`cat.${note.category}`)}</span>
          <span className="text-text-tertiary">· {t('nt.updated', { date: noteDate(note.date, lang, true) })}</span>
        </p>
        <SplitHeading key={note.title} className={titleCls}>{note.title}</SplitHeading>
        {note.why && (
          <div data-reveal className="mt-8 md:mt-10 max-w-4xl relative rounded-[1.5rem] bg-[#fdf3dc] dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 px-6 py-5 md:px-8 md:py-7">
            <p className="prep-eyebrow text-amber-800 dark:text-amber-300">{t('nt.why')}</p>
            <p className="mt-2 text-lg md:text-xl leading-relaxed text-text-primary">{note.why}</p>
          </div>
        )}
        <div data-reveal className="mt-7 flex flex-wrap gap-3">
          <Button tone="ink" size="lg" icon="download" onClick={() => setPrinting(true)}>{t('nt.pdf')}</Button>
          {note.questions?.length > 0 && (
            <Button tone="ghost" size="lg" icon="mic" onClick={() => questions.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })}>
              {t('nt.questionsN', { n: note.questions.length })}
            </Button>
          )}
        </div>
      </header>

      <div className="mt-14 md:mt-20 grid lg:grid-cols-[1fr_19rem] gap-10 lg:gap-16 items-start">
        <div data-tour="note-sections">
          {note.sections.length > 2 && (
            <div className="mb-4 flex justify-end">
              <button type="button" onClick={() => setOpenSec(openSec.size === note.sections.length ? new Set() : new Set(note.sections.map((_, i) => i)))}
                className="prep-focus inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary cursor-pointer">
                <Icon name={openSec.size === note.sections.length ? 'minimize' : 'maximize'} className="w-4 h-4" />{t(openSec.size === note.sections.length ? 'nt.closeAll' : 'nt.openAll')}
              </button>
            </div>
          )}
          {note.sections.map((s, i) => (
            <section key={i} data-reveal className="py-5 md:py-7 border-t border-border-subtle first:border-t-0 first:pt-0">
              <button type="button" onClick={() => toggleSec(i)} aria-expanded={openSec.has(i)} className="prep-focus group w-full flex items-baseline gap-4 md:gap-6 text-left cursor-pointer">
                <span className={`prep-num font-display text-4xl md:text-5xl font-semibold transition-colors ${openSec.has(i) ? 'text-brand' : 'text-border-default'}`}>{String(i + 1).padStart(2, '0')}</span>
                <h2 className="flex-1 font-display text-2xl md:text-[2rem] font-semibold tracking-tight text-text-primary group-hover:text-brand transition-colors">{s.heading}</h2>
                <Icon name="chevronDown" className={`w-6 h-6 shrink-0 self-center text-text-tertiary transition-transform ${openSec.has(i) ? 'rotate-180' : ''}`} />
              </button>
              {openSec.has(i) && <ul className="mt-5 space-y-3.5 md:pl-[4.6rem]">
                {s.points.map((p, j) => (
                  <li key={j} className="flex gap-3.5 text-[17px] md:text-lg leading-relaxed text-text-primary">
                    <span className="mt-[0.7em] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tone }} aria-hidden="true" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>}
            </section>
          ))}
        </div>
        <aside className="lg:sticky lg:top-24 space-y-4">
          {note.likelyFor?.length > 0 && (
            <SideCard title={t('nt.likelyFor')}>
              <div className="flex flex-wrap gap-2">{note.likelyFor.map((x) => <span key={x} className="rounded-full bg-accent-soft-bg border border-accent-soft-border text-brand text-sm font-semibold px-3 py-1.5">{x}</span>)}</div>
            </SideCard>
          )}
          {note.keywords?.length > 0 && (
            <SideCard title={t('nt.keywords')}>
              <div className="flex flex-wrap gap-2">{note.keywords.map((x) => <span key={x} className="rounded-full border border-border-default text-sm px-3 py-1.5 text-text-secondary">{x}</span>)}</div>
            </SideCard>
          )}
          {note.sources?.length > 0 && (
            <SideCard title={t('nt.sources')}>
              <ul className="space-y-2.5">
                {note.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="prep-focus group flex items-start gap-2 text-sm text-text-secondary hover:text-brand">
                      <Icon name="external" className="w-4 h-4 mt-0.5 shrink-0" /><span className="underline decoration-border-default underline-offset-4 group-hover:decoration-brand">{s.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </SideCard>
          )}
          <p data-reveal className="text-xs text-text-tertiary leading-relaxed px-1">{t('nt.aiNote')}</p>
        </aside>
      </div>

      {note.questions?.length > 0 && (
        <section ref={questions} className="mt-16 md:mt-24 scroll-mt-24">
          <h2 data-reveal className="font-display text-3xl md:text-5xl font-semibold tracking-tight text-text-primary">{t('nt.questions')}</h2>
          <p data-reveal className="mt-3 text-lg text-text-secondary flex items-center gap-2"><Icon name="mic" className="w-5 h-5 text-brand" />{t('nt.answerFirst')}</p>
          <ol className="mt-8 space-y-4">
            {note.questions.map((q, i) => <NoteQuestion key={`${lang}-${i}`} q={q} n={i + 1} />)}
          </ol>
        </section>
      )}

      <button
        type="button"
        data-reveal
        onClick={() => go({ screen: 'notes', tab: 'guide' })}
        className="prep-focus group mt-16 md:mt-24 w-full text-left relative overflow-hidden rounded-[2rem] bg-[#14110d] text-[#f3ede2] px-7 py-9 md:px-12 md:py-12 flex items-center gap-6 cursor-pointer"
      >
        <span className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(60% 90% at 100% 0%, rgba(18,155,110,0.4), transparent 70%)' }} aria-hidden="true" />
        <span className="relative flex-1 font-display text-2xl md:text-4xl leading-tight">{t('nt.guideCta')}</span>
        <span className="relative w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300"><Icon name="arrowRight" className="w-6 h-6" /></span>
      </button>

      {printing && (
        <PrintView title={note.title} fileName={`${BRAND} - ${note.title}`} onClose={() => setPrinting(false)}>
          <NoteDoc note={note} categoryLabel={t(`cat.${note.category}`)} date={noteDate(note.date, lang, true)} />
        </PrintView>
      )}
    </div>
  );
}
