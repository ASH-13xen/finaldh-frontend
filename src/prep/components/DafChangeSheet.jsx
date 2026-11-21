// Changing a verified DAF: Rs 50 for one re-upload, which our team verifies again. The student's current DAF
// and predictions stay until then, and their credits are untouched. Shown only when a verified student taps
// "Reupload DAF".
import { useState } from 'react';
import Icon from '../../components/mcq/Icon';
import { useToast } from '../../components/Toast';
import { payWithRazorpay } from '../../lib/razorpay';
import Sheet from './Sheet';
import Button from './Button';
import { useT } from '../lib/i18n';

export default function DafChangeSheet({ price = 50, onClose, onPaid }) {
  const { t } = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');

  const pay = async () => {
    setBusy(true);
    setStage('starting');
    try {
      const out = await payWithRazorpay({ kind: 'daf_change' }, { onStage: setStage });
      if (out.status === 'paid') {
        toast.success(t('dc.paid'));
        onPaid?.();
      } else if (out.status === 'processing') {
        toast.info(t('dc.processing'));
        onPaid?.();
      } else if (out.status === 'failed') {
        toast.error(out.reason || t('cr.failed'));
      }
    } catch (err) {
      toast.error(err?.message || t('cr.failed'));
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  return (
    <Sheet onClose={onClose} label={t('dc.title')}>
      <div className="px-5 md:px-10 pt-6 md:pt-10 pb-10 pr-16">
        <p className="prep-eyebrow text-brand">{t('daf.eyebrow')}</p>
        <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight">{t('dc.title')}</h2>
        <ul className="mt-6 space-y-3">
          {['dc.body1', 'dc.body2', 'dc.body3'].map((k) => (
            <li key={k} className="flex gap-3 text-[15px] leading-relaxed"><Icon name="check" className="w-5 h-5 mt-0.5 text-brand shrink-0" />{t(k)}</li>
          ))}
        </ul>
        <div className="mt-8 rounded-[1.5rem] border border-brand bg-accent-soft-bg p-5 max-w-sm">
          <p className="prep-num font-display text-4xl font-semibold">₹{price}</p>
          <p className="mt-1 text-text-secondary">{t('dc.price')}</p>
          <Button tone="primary" size="md" className="mt-4 w-full" disabled={busy} onClick={pay}>
            {busy ? t(`cr.stage.${stage || 'starting'}`) : t('dc.pay', { price })}
          </Button>
        </div>
        <p className="mt-4 text-xs text-text-tertiary leading-relaxed">{t('dc.terms')}</p>
      </div>
    </Sheet>
  );
}
