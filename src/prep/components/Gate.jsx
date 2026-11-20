// What a visitor who hasn't signed in sees where something needs an account (a whole screen, or a sheet
// over the one they're on), and the fade that ends a preview (the question bank before the DAF is verified,
// the 100-question guide for visitors).
import Icon from '../../components/mcq/Icon';
import Button from './Button';
import Sheet from './Sheet';
import { useT } from '../lib/i18n';
import { usePrep, SCREENS } from '../lib/context';

// A whole screen that needs an account (Predicted Questions, My DAF, Practice Studio, My Prep).
export function GuestGate({ screen }) {
  const { t } = useT();
  const { signIn } = usePrep();
  const s = SCREENS.find((x) => x.key === screen);
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 pt-12 md:pt-20 pb-16">
      <p className="prep-eyebrow text-brand mb-5">{t(s?.long || s?.label || 'section.title')}</p>
      <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-tight text-text-primary">{t('gate.title')}</h1>
      <p className="mt-5 text-lg md:text-xl text-text-secondary leading-relaxed">{t(`gate.${screen}`)}</p>
      <Button className="mt-8" tone="primary" size="xl" iconRight="arrowRight" onClick={signIn}>{t('acct.signIn')}</Button>
    </div>
  );
}

// Something on the screen needs an account (opening a question, saving one, downloading the guide).
export function SignInSheet({ reason, vars, onClose }) {
  const { t } = useT();
  const { signIn } = usePrep();
  return (
    <Sheet onClose={onClose} label={t('gate.title')}>
      <div className="px-5 md:px-10 pt-8 md:pt-12 pb-12 pr-16">
        <span className="w-14 h-14 rounded-2xl bg-accent-soft-bg text-brand flex items-center justify-center"><Icon name="lock" className="w-7 h-7" /></span>
        <h2 className="mt-6 font-display text-3xl md:text-4xl font-semibold tracking-tight">{t('gate.title')}</h2>
        <p className="mt-3 text-lg text-text-secondary leading-relaxed">{t(`gate.${reason}`, vars)}</p>
        <Button className="mt-8" tone="primary" size="lg" iconRight="arrowRight" onClick={signIn}>{t('acct.signIn')}</Button>
      </div>
    </Sheet>
  );
}

// The end of a preview: the last items fade into the page under a card saying how to see the rest.
export function PreviewEnd({ title, body, children, innerRef }) {
  return (
    <div ref={innerRef} className="relative z-10 -mt-80 md:-mt-96 pt-56 md:pt-72 pb-4 scroll-mt-24"
      style={{ background: 'linear-gradient(to bottom, transparent 0%, var(--bg-page) 55%)' }}>
      <div className="prep-card mx-auto max-w-2xl px-6 py-8 md:px-10 md:py-10 text-center">
        <span className="mx-auto w-14 h-14 rounded-2xl bg-accent-soft-bg text-brand flex items-center justify-center"><Icon name="lock" className="w-7 h-7" /></span>
        <p className="mt-5 font-display text-2xl md:text-3xl font-semibold tracking-tight text-text-primary">{title}</p>
        <p className="mt-3 text-text-secondary leading-relaxed">{body}</p>
        {children && <div className="mt-6 flex justify-center">{children}</div>}
      </div>
    </div>
  );
}
