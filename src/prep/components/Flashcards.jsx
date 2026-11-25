// Predicted questions as a deck: drag (or swipe) right for "I've got this" (marks it confident), left for
// "needs work" (saves it to revisit); tap to flip for the tip. Arrow keys work too.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import Icon from '../../components/mcq/Icon';
import Button from './Button';
import { TierBadge, SourceBadge, AskedLine } from './badges';
import { gsap, useGSAP, prefersReducedMotion } from '../lib/motion';
import { useT } from '../lib/i18n';
import { usePrep } from '../lib/context';

gsap.registerPlugin(Draggable, InertiaPlugin);

export default function Flashcards({ cards }) {
  const { t } = useT();
  const { prep } = usePrep();
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = useRef(null);
  const busy = useRef(false);
  const total = cards.length;
  const p = cards[i];

  const decide = useCallback((dir) => {
    if (!p || busy.current) return;
    busy.current = true;
    const info = { text: p.questionEn || p.question, familyId: p.evidence?.familyId || '', source: p.source };
    if (dir > 0) prep.update(p.key, { status: 'confident' }, info);
    else prep.update(p.key, { saved: true }, info);
    const next = () => { setFlipped(false); setI((x) => x + 1); busy.current = false; };
    if (prefersReducedMotion() || !card.current) { next(); return; }
    gsap.to(card.current, { x: dir * window.innerWidth * 0.9, rotate: dir * 14, autoAlpha: 0, duration: 0.45, ease: 'power2.in', onComplete: next });
  }, [p, prep]);

  // A fresh card comes up from below the deck.
  useGSAP(() => {
    if (!card.current) return;
    gsap.set(card.current, { x: 0, rotate: 0, autoAlpha: 1 });
    if (!prefersReducedMotion()) gsap.from(card.current, { y: 30, scale: 0.96, autoAlpha: 0, duration: 0.5 });
    const d = Draggable.create(card.current, {
      type: 'x',
      inertia: true,
      onDrag() { gsap.set(this.target, { rotate: this.x / 22 }); },
      onDragEnd() {
        if (Math.abs(this.x) > 120) decide(this.x > 0 ? 1 : -1);
        else gsap.to(this.target, { x: 0, rotate: 0, duration: 0.5, ease: 'elastic.out(1, 0.6)' });
      },
      onClick() { setFlipped((f) => !f); }
    })[0];
    return () => d.kill();
  }, { dependencies: [i, total] });

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if (e.key === 'ArrowRight') decide(1);
      else if (e.key === 'ArrowLeft') decide(-1);
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((f) => !f); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide]);

  if (!total) return <p className="text-center text-text-secondary py-16">{t('pred.empty')}</p>;
  if (i >= total) {
    return (
      <div className="prep-card mx-auto max-w-xl px-8 py-14 text-center">
        <Icon name="trophy" className="w-10 h-10 mx-auto text-brand" />
        <p className="mt-4 font-display text-2xl">{t('pred.cards.done', { n: total })}</p>
        <Button tone="ink" size="lg" icon="refresh" className="mt-6" onClick={() => setI(0)}>{t('pred.cards.again')}</Button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between mb-4 text-sm text-text-tertiary">
        <span className="prep-num font-semibold">{t('pred.cards.count', { i: i + 1, n: total })}</span>
        <span>{t('pred.cards.flip')}</span>
      </div>
      <div className="relative h-[24rem] md:h-[26rem]">
        {i + 1 < total && <div className="absolute inset-x-6 top-4 bottom-[-0.5rem] prep-card opacity-60" aria-hidden="true" />}
        {i + 2 < total && <div className="absolute inset-x-12 top-8 bottom-[-1rem] prep-card opacity-30" aria-hidden="true" />}
        <div ref={card} className="absolute inset-0 prep-card prep-card-hover cursor-grab active:cursor-grabbing select-none touch-pan-y px-6 py-7 md:px-10 md:py-10 flex flex-col" role="group" aria-roledescription="flashcard">
          <div className="flex flex-wrap items-center gap-2">
            <TierBadge tier={p.tier} size="sm" />
            <SourceBadge source={p.source} />
          </div>
          {!flipped ? (
            <p className="flex-1 flex items-center font-display text-[1.6rem] leading-[1.25] md:text-[2.1rem] md:leading-[1.2] tracking-tight">{p.question}</p>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col justify-center gap-4 overflow-y-auto">
              {p.tip ? <p className="text-lg leading-relaxed text-text-primary flex gap-3"><Icon name="zap" className="w-5 h-5 mt-1 shrink-0 text-amber-500" />{p.tip}</p> : <p className="text-text-tertiary">—</p>}
              {p.evidence?.timesAsked > 0 && p.source !== 'new' && <AskedLine n={p.evidence.timesAsked} years={p.evidence.years} />}
              {p.followUps?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand">{t('pred.followUps')}</p>
                  <ul className="mt-1.5 space-y-1">{p.followUps.map((f) => <li key={f} className="flex items-start gap-2 text-[15px] md:text-base text-text-secondary leading-relaxed"><Icon name="arrowRight" className="w-3.5 h-3.5 mt-1.5 shrink-0 text-brand" />{f}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3">
        <Button tone="ghost" size="xl" icon="arrowLeft" onClick={() => decide(-1)}>{t('pred.cards.work')}</Button>
        <Button tone="primary" size="xl" iconRight="arrowRight" onClick={() => decide(1)}>{t('pred.cards.got')}</Button>
      </div>
    </div>
  );
}
