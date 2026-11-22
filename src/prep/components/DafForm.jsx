// The DAF form. mode "steps": one short section per screen with a progress bar (filling it in by hand);
// mode "review": every section on one page, with what AI was unsure of highlighted (after an upload).
import { useRef, useState } from 'react';
import Icon from '../../components/mcq/Icon';
import Button from './Button';
import { TextField, SelectField, ChipsField, RowsField, FieldShell } from './DafFields';
import { gsap, useGSAP, prefersReducedMotion } from '../lib/motion';
import { useT } from '../lib/i18n';
import { STATES, LANGUAGES } from '../lib/india';

const labels = (list, n = 60) => (list || []).slice(0, n).map((k) => k.label);

// The proof that goes with a roll number typed into a DAF filled in by hand.
function ProofPicker({ file, onFile }) {
  const { t } = useT();
  const input = useRef(null);
  return (
    <div className="mt-6">
      <FieldShell label={t('f.rollProof')}>
        <button type="button" onClick={() => input.current?.click()}
          className="prep-focus w-full h-14 rounded-2xl border-2 border-dashed border-border-default hover:border-brand bg-surface px-4 flex items-center gap-3 text-left cursor-pointer transition-colors">
          <Icon name={file ? 'check' : 'upload'} className={`w-5 h-5 shrink-0 ${file ? 'text-brand' : 'text-text-tertiary'}`} />
          <span className={`truncate ${file ? 'text-text-primary' : 'text-text-tertiary'}`}>{file ? file.name : t('rc.choose')}</span>
        </button>
      </FieldShell>
      <input ref={input} type="file" accept="application/pdf,image/png,image/jpeg,image/webp,image/heic" className="sr-only" onChange={(e) => onFile(e.target.files?.[0] || null)} />
    </div>
  );
}

// roll.locked: the roll number can't be typed - it comes from the official DAF upload (checked by our team);
// roll.hint says which applies. roll.proof (a DAF filled in by hand): it can be typed, optionally, and then
// needs a proof file.
function useSections(keywords, services, roll) {
  const { t } = useT();
  const hint = roll.locked ? roll.hint : roll.proof ? 'f.rollNoOptional' : 'f.rollNoHint';
  return [
    {
      key: 'home', title: t('daf.s.home'), fields: ['rollNo', 'homeState', 'homeDistrict', 'hometown'],
      render: (d, set, u) => (
        <>
          <div className="grid sm:grid-cols-2 gap-6">
            <TextField label={t('f.rollNo')} hint={t(hint)} value={d.rollNo} onChange={(v) => { if (!roll.locked) set('rollNo', v.replace(/\D/g, '').slice(0, 7)); }} placeholder={roll.proof ? '7 digits' : '0811049'} maxLength={7} unsure={!roll.locked && u.has('rollNo')} readOnly={roll.locked} />
            <SelectField label={t('f.homeState')} value={d.homeState} onChange={(v) => set('homeState', v)} options={STATES} unsure={u.has('homeState')} />
            <TextField label={t('f.homeDistrict')} value={d.homeDistrict} onChange={(v) => set('homeDistrict', v)} unsure={u.has('homeDistrict')} />
            <TextField label={t('f.hometown')} value={d.hometown} onChange={(v) => set('hometown', v)} unsure={u.has('hometown')} />
          </div>
          {roll.proof && d.rollNo && <ProofPicker file={roll.proof.file} onFile={roll.proof.setFile} />}
        </>
      )
    },
    {
      key: 'education', title: t('daf.s.education'), fields: ['education'],
      render: (d, set, u) => (
        <RowsField label={t('daf.s.education')} rows={d.education} onChange={(v) => set('education', v)} unsure={u.has('education')} addLabel={t('f.addEducation')}
          fields={[
            { key: 'degree', label: t('f.degree'), suggestions: labels(keywords?.degree) },
            { key: 'discipline', label: t('f.discipline'), suggestions: labels(keywords?.discipline) },
            { key: 'institution', label: t('f.institution'), suggestions: labels(keywords?.college, 80) },
            { key: 'year', label: t('f.year'), max: 10 }
          ]} />
      )
    },
    {
      key: 'work', title: t('daf.s.work'), fields: ['work'],
      render: (d, set, u) => (
        <>
          <RowsField label={t('daf.s.work')} rows={d.work} onChange={(v) => set('work', v)} unsure={u.has('work')} addLabel={t('f.addWork')}
            fields={[
              { key: 'role', label: t('f.role'), suggestions: labels(keywords?.job) },
              { key: 'organization', label: t('f.organization') },
              { key: 'duration', label: t('f.duration'), max: 40 }
            ]} />
          {!d.work?.length && <p className="mt-4 text-text-tertiary">{t('f.noWork')}</p>}
        </>
      )
    },
    {
      key: 'optional', title: t('daf.s.optional'), fields: ['optional'],
      render: (d, set, u) => <TextField label={t('f.optional')} value={d.optional} onChange={(v) => set('optional', v)} suggestions={labels(keywords?.optional)} unsure={u.has('optional')} />
    },
    {
      key: 'hobbies', title: t('daf.s.hobbies'), fields: ['hobbies', 'achievements'],
      render: (d, set, u) => (
        <div className="space-y-8">
          <ChipsField label={t('f.hobbies')} value={d.hobbies} onChange={(v) => set('hobbies', v)} suggestions={labels(keywords?.hobby, 24)} unsure={u.has('hobbies')} />
          <ChipsField label={t('f.achievements')} value={d.achievements} onChange={(v) => set('achievements', v)} unsure={u.has('achievements')} />
        </div>
      )
    },
    {
      key: 'services', title: t('daf.s.services'), fields: ['servicePreference'],
      render: (d, set, u) => <ChipsField label={t('f.services')} value={d.servicePreference} onChange={(v) => set('servicePreference', v)} suggestions={services || []} unsure={u.has('servicePreference')} ordered max={25} />
    },
    {
      key: 'family', title: t('daf.s.family'), fields: ['familyBackground', 'languages', 'otherNotes'],
      render: (d, set, u) => (
        <div className="space-y-8">
          <TextField label={t('f.family')} hint={t('f.familyHint')} value={d.familyBackground} onChange={(v) => set('familyBackground', v)} unsure={u.has('familyBackground')} maxLength={300} />
          <ChipsField label={t('f.languages')} value={d.languages} onChange={(v) => set('languages', v)} suggestions={LANGUAGES} unsure={u.has('languages')} />
          <TextField label={t('f.notes')} value={d.otherNotes} onChange={(v) => set('otherNotes', v)} maxLength={600} />
        </div>
      )
    }
  ];
}

// send: a DAF filled in by hand, sent for verification (the button says so; onSave gets { proof }).
export default function DafForm({ initial, unsure = [], mode = 'steps', keywords, services, saving, onSave, onCancel, rollLocked = false, rollHint = 'f.rollNoLocked', rollProof = false, send = false }) {
  const { t } = useT();
  const [d, setD] = useState(initial);
  const [step, setStep] = useState(0);
  const [proof, setProof] = useState(null);
  const body = useRef(null);
  const u = new Set(unsure);
  const sections = useSections(keywords, services, { locked: rollLocked, hint: rollHint, proof: rollProof ? { file: proof, setFile: setProof } : null });
  const saveLabel = send ? (saving ? t('daf.sending') : t('daf.send')) : (saving ? t('daf.saving') : t('daf.save'));
  const doSave = () => onSave(d, { proof: rollProof && d.rollNo ? proof : null });
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const last = step === sections.length - 1;

  useGSAP(() => {
    if (mode !== 'steps' || !body.current || prefersReducedMotion()) return;
    gsap.fromTo(body.current, { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: 0.55 });
  }, { dependencies: [step] });

  if (mode === 'review') {
    return (
      <div>
        <div className="space-y-12">
          {sections.map((s) => (
            <section key={s.key} className="prep-card p-5 md:p-8">
              <h3 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-6">{s.title}</h3>
              {s.render(d, set, u)}
            </section>
          ))}
        </div>
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 z-20 mt-8 prep-card px-4 py-3 flex items-center justify-between gap-3">
          <Button tone="ghost" size="md" onClick={onCancel}>{t('daf.cancel')}</Button>
          <Button tone="primary" size="lg" icon="check" onClick={doSave} disabled={saving}>{saveLabel}</Button>
        </div>
      </div>
    );
  }

  const s = sections[step];
  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-4 mb-3">
        <p className="prep-num text-sm font-semibold text-text-tertiary">{t('daf.step', { i: step + 1, n: sections.length })}</p>
        <button type="button" onClick={onCancel} className="prep-focus text-sm font-semibold text-text-tertiary hover:text-text-primary cursor-pointer">{t('daf.cancel')}</button>
      </div>
      <div className="flex gap-1.5 mb-10" aria-hidden="true">
        {sections.map((x, i) => <span key={x.key} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i <= step ? 'bg-brand' : 'bg-border-default'}`} />)}
      </div>
      <div ref={body}>
        <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight mb-8">{s.title}</h2>
        {s.render(d, set, u)}
      </div>
      {send && last && <p className="mt-10 text-sm text-text-secondary flex gap-2"><Icon name="info" className="w-4 h-4 mt-0.5 shrink-0 text-brand" />{t('daf.sendNote')}</p>}
      <div className="mt-12 flex items-center justify-between gap-3">
        <Button tone="ghost" size="lg" icon="arrowLeft" onClick={() => setStep((x) => Math.max(0, x - 1))} disabled={step === 0}>{t('daf.back')}</Button>
        {last
          ? <Button tone="primary" size="lg" icon={send ? 'upload' : 'check'} onClick={doSave} disabled={saving}>{saveLabel}</Button>
          : <Button tone="ink" size="lg" iconRight="arrowRight" onClick={() => setStep((x) => x + 1)}>{t('daf.next')}</Button>}
      </div>
    </div>
  );
}
