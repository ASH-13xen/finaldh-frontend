// AI credits: what's left (free first, then bought), what a credit buys, and the two packs - paid through
// Razorpay and added the moment the payment is confirmed.
import { useState } from 'react';
import Icon from '../../../components/mcq/Icon';
import { useToast } from '../../../components/Toast';
import { payWithRazorpay } from '../../../lib/razorpay';
import Sheet from '../Sheet';
import Button from '../Button';
import { useT } from '../../lib/i18n';
import { DafCheckCard } from '../DafCheck';

export default function CreditsSheet({ credits, onClose, onPaid }) {
  const { t } = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(null); // pack id being bought
  const [stage, setStage] = useState('');
  const packs = credits?.packs || [];
  const verified = !!credits?.admin || credits?.daf?.status === 'verified';

  const buy = async (pack) => {
    setBusy(pack.id);
    setStage('starting');
    try {
      const out = await payWithRazorpay({ kind: 'ai_credits', pack: pack.id }, { onStage: setStage });
      if (out.status === 'paid') {
        toast.success(t('cr.added', { n: pack.credits }));
        onPaid?.();
      } else if (out.status === 'processing') {
        toast.info(t('cr.processing'));
        onPaid?.();
      } else if (out.status === 'failed') {
        toast.error(out.reason || t('cr.failed'));
      }
    } catch (err) {
      toast.error(err?.message || t('cr.failed'));
    } finally {
      setBusy(null);
      setStage('');
    }
  };

  return (
    <Sheet onClose={onClose} label={t('cr.title')}>
      <div className="px-5 md:px-10 pt-6 md:pt-10 pb-10 pr-16">
        <p className="prep-eyebrow text-brand">{t('cr.eyebrow')}</p>
        <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight">{t('cr.title')}</h2>
        {credits?.admin ? (
          <p className="mt-4 text-text-secondary">{t('cr.admin')}</p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border-subtle bg-surface px-5 py-4">
              <p className="prep-num font-display text-4xl font-semibold">{credits?.free ?? '—'}<span className="text-lg text-text-tertiary">/{credits?.freeTotal ?? 15}</span></p>
              <p className="mt-1 text-sm text-text-tertiary">{t('cr.freeLeft')}</p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-surface px-5 py-4">
              <p className="prep-num font-display text-4xl font-semibold">{credits?.paid ?? 0}</p>
              <p className="mt-1 text-sm text-text-tertiary">{t('cr.paidLeft')}</p>
            </div>
          </div>
        )}

        {!verified && <DafCheckCard className="mt-6" />}
        <h3 className="mt-8 prep-eyebrow text-text-tertiary">{t('cr.usesTitle')}</h3>
        <ul className="mt-3 space-y-2.5">
          {[['answer', 'edit'], ['approach', 'target'], ['feedback', 'mic']].map(([k, icon]) => (
            <li key={k} className="flex gap-3 text-[15px] leading-relaxed"><Icon name={icon} className="w-5 h-5 mt-0.5 text-brand shrink-0" />{t(`cr.use.${k}`)}</li>
          ))}
          <li className="flex gap-3 text-[15px] leading-relaxed text-text-secondary"><Icon name="check" className="w-5 h-5 mt-0.5 text-brand shrink-0" />{t('cr.freeAlways')}</li>
        </ul>

        {!credits?.admin && (
          <>
            <h3 className="mt-8 prep-eyebrow text-text-tertiary">{t('cr.packs')}</h3>
            <div className="mt-3 grid sm:grid-cols-2 gap-3">
              {packs.map((p, i) => (
                <div key={p.id} className={`relative rounded-[1.5rem] border p-5 ${i === packs.length - 1 ? 'border-brand bg-accent-soft-bg' : 'border-border-default bg-surface'}`}>
                  {i === packs.length - 1 && <span className="absolute -top-3 left-5 rounded-full bg-brand text-text-on-accent text-[11px] font-bold px-2.5 py-1">{t('cr.best')}</span>}
                  <p className="prep-num font-display text-4xl font-semibold">₹{p.price}</p>
                  <p className="mt-1 text-text-secondary">{t('cr.packUses', { n: p.credits })}</p>
                  <p className="mt-0.5 text-xs text-text-tertiary">{t('cr.perUse', { v: Math.round((p.price / p.credits) * 10) / 10 })}</p>
                  <Button tone={i === packs.length - 1 ? 'primary' : 'ink'} size="md" className="mt-4 w-full" disabled={!!busy || !verified} onClick={() => buy(p)}>
                    {busy === p.id ? t(`cr.stage.${stage || 'starting'}`) : t('cr.buy')}
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-text-tertiary leading-relaxed">{t('cr.terms')}</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
