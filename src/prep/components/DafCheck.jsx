// Where a student's DAF verification stands. Practice, the free AI uses and buying credits unlock only after
// an admin has verified the uploaded DAF (Admin -> DAF Checks); until then these explain what to do or that
// it is waiting. Admins are never gated.
import Icon from '../../components/mcq/Icon';
import Button from './Button';
import { useT } from '../lib/i18n';
import { usePrep } from '../lib/context';
import { useDafCheck } from '../lib/useDafCheck';

const TONE = {
  none: 'border-amber-300 bg-amber-50 dark:bg-amber-400/10 dark:border-amber-400/30',
  pending: 'border-sky-300 bg-sky-50 dark:bg-sky-400/10 dark:border-sky-400/30',
  rejected: 'border-rose-300 bg-rose-50 dark:bg-rose-400/10 dark:border-rose-400/30',
  verified: 'border-accent-soft-border bg-accent-soft-bg',
  guest: 'border-accent-soft-border bg-accent-soft-bg'
};
const ICON = { none: 'upload', pending: 'clock', rejected: 'alert', verified: 'check', guest: 'user' };
export const ADMIN_TELEGRAM = 'https://t.me/tdhadmin';

// While something waits for our team: how to reach the admin (as on the courses pages).
export function AdminContact({ className = '' }) {
  const { t } = useT();
  return (
    <p className={`text-sm text-text-secondary ${className}`}>
      {t('dv.contact')}{' '}
      <a href={ADMIN_TELEGRAM} target="_blank" rel="noopener noreferrer" className="font-bold text-brand hover:underline">{t('dv.contactLink')}</a>
    </p>
  );
}

// A verified student's new DAF (a paid re-upload) still with our team - being verified, or verified and being
// read: a highlighted line at the top of every screen, since everything uses the current DAF until then.
export function DafChangeBanner() {
  const { t } = useT();
  const check = useDafCheck();
  if (check.loading || check.admin || !check.verified) return null;
  const c = check.change?.status;
  const key = c === 'pending' ? 'verifying' : c === 'verified' && check.reading ? 'reading' : null;
  if (!key) return null;
  return (
    <div role="status" className="border-b-2 border-amber-400 bg-amber-100 dark:bg-amber-400/15 dark:border-amber-400/50">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3.5 md:py-4">
        <p className="flex items-start gap-2.5 font-display text-lg md:text-xl font-semibold text-text-primary">
          <Icon name="clock" className="w-5 h-5 md:w-6 md:h-6 mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
          <span>{t(`dcb.${key}.title`)}</span>
        </p>
        <p className="mt-0.5 md:ml-8 text-sm md:text-[15px] text-text-secondary">
          {t(`dcb.${key}.body`)}{' '}
          <a href={ADMIN_TELEGRAM} target="_blank" rel="noopener noreferrer" className="font-bold text-brand hover:underline">{t('dv.contactLink')}</a>
        </p>
      </div>
    </div>
  );
}

export function DafCheckCard({ onUpload, showVerified = false, className = '' }) {
  const { t } = useT();
  const { go, screen, signIn } = usePrep();
  const check = useDafCheck();
  if (check.loading || check.admin) return null;
  if (check.verified && !showVerified) return null;
  const s = check.status || 'none';
  return (
    <div className={`rounded-[1.5rem] border px-5 py-5 md:px-7 md:py-6 flex flex-col md:flex-row md:items-center gap-4 ${TONE[s]} ${className}`} role="status">
      <span className="w-12 h-12 rounded-full bg-surface border border-border-default flex items-center justify-center shrink-0">
        <Icon name={ICON[s]} className="w-6 h-6 text-text-primary" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-display text-xl md:text-2xl font-semibold text-text-primary">{t(`dv.${s}.title`)}</p>
        <p className="mt-1 text-[15px] text-text-secondary leading-relaxed">{t(`dv.${s}.body`, { reason: check.reason || '' })}</p>
        {s === 'pending' && <AdminContact className="mt-2" />}
      </div>
      {s === 'guest' && <Button tone="primary" size="md" iconRight="arrowRight" onClick={signIn}>{t('acct.signIn')}</Button>}
      {(s === 'none' || s === 'rejected') && (
        onUpload
          ? <Button tone="primary" size="md" icon="upload" onClick={onUpload}>{t(s === 'rejected' ? 'dv.uploadAgain' : 'dv.upload')}</Button>
          : screen !== 'daf' && <Button tone="primary" size="md" iconRight="arrowRight" onClick={() => go({ screen: 'daf', upload: true })}>{t('dv.goDaf')}</Button>
      )}
    </div>
  );
}

// Shows `children` once the DAF is verified; otherwise a full explanation for the screen (Practice).
export function DafGate({ children }) {
  const check = useDafCheck();
  if (check.loading) return <div className="mt-10 h-40 rounded-[1.75rem] bg-sunken animate-pulse" />;
  if (check.verified) return children;
  return <DafCheckCard className="mt-10" />;
}
