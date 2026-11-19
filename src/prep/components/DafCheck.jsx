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
  verified: 'border-accent-soft-border bg-accent-soft-bg'
};
const ICON = { none: 'upload', pending: 'clock', rejected: 'alert', verified: 'check' };

export function DafCheckCard({ onUpload, showVerified = false, className = '' }) {
  const { t } = useT();
  const { go, screen } = usePrep();
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
      </div>
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
