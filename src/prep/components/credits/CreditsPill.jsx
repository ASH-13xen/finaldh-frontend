// The AI-credit balance in the header; opens the credits sheet.
import { useT } from '../../lib/i18n';
import { usePrep } from '../../lib/context';

export default function CreditsPill() {
  const { t } = useT();
  const { credits, openCredits } = usePrep();
  if (!credits || credits.admin) return null;
  if (credits.daf?.status !== 'verified') {
    return (
      <button type="button" onClick={openCredits} title={t('cr.lockedTitle')}
        className="prep-focus shrink-0 h-10 px-3 md:px-4 rounded-full border border-dashed border-border-default bg-surface flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:border-text-primary cursor-pointer">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
        <span className="hidden sm:inline">{t('cr.locked')}</span>
      </button>
    );
  }
  const low = credits.total <= 3;
  return (
    <button
      type="button"
      onClick={openCredits}
      title={t('cr.pillTitle', { n: credits.total })}
      className={`prep-focus shrink-0 h-10 px-3 md:px-4 rounded-full border flex items-center gap-1.5 text-sm font-semibold cursor-pointer transition-colors ${low ? 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300' : 'border-border-default bg-surface text-text-primary hover:border-text-primary'}`}
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4 text-brand" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5l-1.9-5.6L4.5 9l5.6-1.4L12 2zm7 12 .9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z" /></svg>
      <span className="prep-num">{credits.total}</span>
      <span className="hidden sm:inline text-text-secondary font-medium">{t('cr.pill')}</span>
    </button>
  );
}
