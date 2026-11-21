// The credits button in the header. Interview Prep should feel free, so it stays out of sight while a
// student still has free credits: it appears as "Get more credits" once they've all been used, and as the
// balance for students who have bought a pack. A visitor who hasn't signed in gets "Sign in" here instead.
import { useT } from '../../lib/i18n';
import { usePrep } from '../../lib/context';

export default function CreditsPill() {
  const { t } = useT();
  const { credits, openCredits, guest, signIn } = usePrep();
  if (guest) {
    return (
      <button type="button" onClick={signIn}
        className="prep-focus shrink-0 h-10 px-4 md:px-5 rounded-full bg-brand text-text-on-accent text-sm font-semibold hover:bg-brand-hover cursor-pointer">
        {t('acct.signIn')}
      </button>
    );
  }
  if (!credits || credits.admin || credits.daf?.status !== 'verified') return null;
  const total = credits.total || 0;
  const bought = (credits.paid || 0) > 0;
  if (total > 0 && !bought) return null; // free credits left: nothing to show

  const spark = <svg viewBox="0 0 24 24" className="w-4 h-4 text-brand" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5l-1.9-5.6L4.5 9l5.6-1.4L12 2zm7 12 .9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z" /></svg>;
  if (total < 1) {
    return (
      <button type="button" onClick={openCredits}
        className="prep-focus shrink-0 h-10 px-3 md:px-4 rounded-full border border-brand bg-accent-soft-bg flex items-center gap-1.5 text-sm font-semibold text-brand hover:bg-surface cursor-pointer">
        {spark}<span className="hidden sm:inline">{t('cr.getMore')}</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={openCredits} title={t('cr.pillTitle', { n: total })}
      className="prep-focus shrink-0 h-10 px-3 md:px-4 rounded-full border border-border-default bg-surface flex items-center gap-1.5 text-sm font-semibold text-text-primary hover:border-text-primary cursor-pointer">
      {spark}
      <span className="prep-num">{total}</span>
      <span className="hidden sm:inline text-text-secondary font-medium">{t(total === 1 ? 'cr.pillOne' : 'cr.pill')}</span>
    </button>
  );
}
