import { useEffect, useState } from 'react';
import Icon from '../components/mcq/Icon';
import { ActionButton, ErrorBanner, Modal } from '../components/mcq/ui';
import { useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { Shell, PageHeader, Panel, SectionTitle, ChipInput } from '../components/interview/ui';
import { iv, errorMessage } from '../lib/interviewApi';

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];
const OPTIONALS = ['PSIR', 'Sociology', 'Anthropology', 'Geography', 'Public Administration', 'History', 'Philosophy', 'Psychology', 'Economics', 'Law', 'Mathematics', 'Physics', 'Chemistry', 'Botany', 'Zoology', 'Geology', 'Statistics', 'Agriculture', 'Animal Husbandry and Veterinary Science', 'Medical Science', 'Management', 'Commerce and Accountancy', 'Civil Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Literature'];
const HOBBY_IDEAS = ['Reading', 'Cricket', 'Chess', 'Music', 'Travelling', 'Cooking', 'Yoga', 'Photography', 'Gaming', 'Writing'];
const ACHIEVEMENT_IDEAS = ['NCC', 'NSS', 'Scouts & Guides', 'Sports captain', 'Paper published', 'Volunteering'];

const EMPTY = {
  homeState: '', homeDistrict: '', hometown: '', education: [], work: [], optional: '', hobbies: [], achievements: [],
  servicePreference: [], familyBackground: '', languages: [], otherNotes: ''
};

const fromProfile = (p) => ({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, p?.[k] ?? EMPTY[k]])) });

const inputCls = 'w-full rounded-2xl border border-border-default bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-text-tertiary mb-1.5';

function Field({ label, children, hint, htmlFor }) {
  return (
    <div>
      <label className={labelCls} htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="text-xs text-text-tertiary mt-1">{hint}</p>}
    </div>
  );
}

function Rows({ rows, onChange, fields, addLabel, blank }) {
  const set = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="grid sm:grid-cols-[repeat(var(--n),minmax(0,1fr))_auto] gap-2 items-start" style={{ '--n': fields.length }}>
          {fields.map((f) => (
            <input key={f.key} value={r[f.key] || ''} onChange={(e) => set(i, f.key, e.target.value)} placeholder={f.placeholder} aria-label={f.placeholder} className={inputCls} />
          ))}
          <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="p-2.5 rounded-xl text-text-tertiary hover:text-status-danger-text hover:bg-status-danger-bg cursor-pointer justify-self-end" aria-label="Remove">
            <Icon name="trash" className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { ...blank }])} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border-default px-3 py-2 text-sm font-semibold text-text-secondary hover:text-brand hover:border-brand cursor-pointer">
        <Icon name="plus" className="w-4 h-4" /> {addLabel}
      </button>
    </div>
  );
}

export default function InterviewProfile({ status, go, onHome }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    iv('/profile')
      .then((d) => { if (!cancelled) { setForm(fromProfile(d.profile)); setSaved(!d.empty); } })
      .catch((err) => { if (!cancelled) setLoadError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setDirty(true); };

  const save = async () => {
    setSaving(true);
    try {
      const d = await iv('/profile', { method: 'PUT', body: form });
      setForm(fromProfile(d.profile));
      setDirty(false);
      setSaved(!d.empty);
      toast.success('DAF details saved.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await iv('/profile', { method: 'DELETE' });
      setForm(EMPTY);
      setSaved(false);
      setDirty(false);
      setConfirmDelete(false);
      toast.success('Your DAF details were deleted.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><LoadingSpinner text="Loading your DAF..." /></div>;
  if (loadError) return <Shell><div className="py-16"><ErrorBanner>{loadError}</ErrorBanner></div></Shell>;

  const preview = [
    form.homeState && { icon: 'mapPin', text: [form.homeDistrict, form.homeState].filter(Boolean).join(', ') },
    ...form.education.filter((e) => e.degree || e.discipline || e.institution).map((e) => ({ icon: 'graduation', text: [e.degree, e.discipline, e.institution].filter(Boolean).join(' · ') })),
    ...form.work.filter((w) => w.role || w.organization).map((w) => ({ icon: 'briefcase', text: [w.role, w.organization].filter(Boolean).join(' at ') })),
    form.optional && { icon: 'book', text: `${form.optional} optional` },
    ...form.hobbies.map((h) => ({ icon: 'heart', text: h })),
    ...form.achievements.map((a) => ({ icon: 'award', text: a })),
    form.servicePreference.length && { icon: 'target', text: form.servicePreference.slice(0, 4).join(' › ') },
    form.familyBackground && { icon: 'users', text: form.familyBackground },
    form.languages.some((l) => !/^(hindi|english)$/i.test(l.trim())) && { icon: 'message', text: `Languages: ${form.languages.join(', ')}` }
  ].filter(Boolean);

  return (
    <Shell wide>
      <PageHeader
        onBack={onHome}
        eyebrow="Step 1"
        title="Your DAF"
        subtitle="The board reads your Detailed Application Form before you walk in, and most questions grow out of it. Add the parts they ask about."
      />

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-6">
          <p className="text-sm text-text-secondary flex items-start gap-2 -mt-2">
            <Icon name="lock" className="w-4 h-4 mt-0.5 shrink-0 text-text-tertiary" />
            Copy the details from your DAF — it takes about two minutes. Only these fields are saved, never your name, roll number, address or phone, and you can delete them any time.
          </p>

          <Panel className="p-5 md:p-6">
            <SectionTitle icon="mapPin" title="Home" subtitle="Expect questions on your state and district: what they are famous for, their problems, and what you would do as DM there." />
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Home state" htmlFor="homeState">
                <select id="homeState" value={form.homeState} onChange={(e) => set('homeState', e.target.value)} className={inputCls}>
                  <option value="">Choose…</option>
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="District" htmlFor="homeDistrict"><input id="homeDistrict" value={form.homeDistrict} onChange={(e) => set('homeDistrict', e.target.value)} placeholder="e.g. Meerut" className={inputCls} /></Field>
              <Field label="Hometown / city" htmlFor="hometown"><input id="hometown" value={form.hometown} onChange={(e) => set('hometown', e.target.value)} placeholder="Where you grew up" className={inputCls} /></Field>
            </div>
          </Panel>

          <Panel className="p-5 md:p-6">
            <SectionTitle icon="graduation" title="Education" subtitle="Boards ask about your subject and why you are leaving it for civil services." />
            <Rows
              rows={form.education}
              onChange={(v) => set('education', v)}
              blank={{ degree: '', discipline: '', institution: '', year: '' }}
              addLabel="Add a degree"
              fields={[{ key: 'degree', placeholder: 'Degree (B.Tech, BA…)' }, { key: 'discipline', placeholder: 'Subject / branch' }, { key: 'institution', placeholder: 'College / university' }, { key: 'year', placeholder: 'Year' }]}
            />
          </Panel>

          <Panel className="p-5 md:p-6">
            <SectionTitle icon="briefcase" title="Work experience" subtitle="Your role, what you learnt, and why you left are near-certain questions." />
            <Rows
              rows={form.work}
              onChange={(v) => set('work', v)}
              blank={{ role: '', organization: '', duration: '' }}
              addLabel="Add a job"
              fields={[{ key: 'role', placeholder: 'Role' }, { key: 'organization', placeholder: 'Organisation' }, { key: 'duration', placeholder: 'Duration' }]}
            />
          </Panel>

          <Panel className="p-5 md:p-6">
            <SectionTitle icon="heart" title="Optional, hobbies and achievements" />
            <div className="space-y-5">
              <Field label="Optional subject" htmlFor="optional">
                <select id="optional" value={form.optional} onChange={(e) => set('optional', e.target.value)} className={`${inputCls} sm:max-w-sm`}>
                  <option value="">Choose…</option>
                  {OPTIONALS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Hobbies & interests" hint="Write them as in your DAF. Boards go deep on these — expect history, rules, and how they connect to administration." htmlFor="hobbies">
                <ChipInput id="hobbies" values={form.hobbies} onChange={(v) => set('hobbies', v)} placeholder="Type a hobby and press Enter" suggestions={HOBBY_IDEAS} />
              </Field>
              <Field label="Achievements & activities" hint="Sports, NCC/NSS, awards, papers, positions of responsibility." htmlFor="achievements">
                <ChipInput id="achievements" values={form.achievements} onChange={(v) => set('achievements', v)} placeholder="e.g. NCC C certificate" suggestions={ACHIEVEMENT_IDEAS} />
              </Field>
            </div>
          </Panel>

          <Panel className="p-5 md:p-6">
            <SectionTitle icon="target" title="Service preference & background" />
            <div className="space-y-5">
              <div>
                <span className={labelCls}>Service preference (in order)</span>
                <div className="flex flex-wrap gap-2">
                  {form.servicePreference.map((s, i) => (
                    <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-brand text-text-on-accent text-sm font-bold pl-2 pr-1.5 py-1">
                      <span className="w-5 h-5 rounded-full bg-white/25 text-[11px] flex items-center justify-center">{i + 1}</span>
                      {s}
                      <button type="button" onClick={() => set('servicePreference', form.servicePreference.filter((x) => x !== s))} className="p-0.5 rounded-full hover:bg-white/20 cursor-pointer" aria-label={`Remove ${s}`}><Icon name="x" className="w-3.5 h-3.5" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(status.services || []).filter((s) => !form.servicePreference.includes(s)).map((s) => (
                    <button key={s} type="button" onClick={() => set('servicePreference', [...form.servicePreference, s])} className="rounded-full border border-border-default px-2.5 py-1 text-xs font-semibold text-text-secondary hover:border-brand hover:text-brand cursor-pointer">{s}</button>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Family background" hint="Parents' occupations. Boards often ask about them: a farmer parent brings questions on agriculture, a teacher on education." htmlFor="familyBackground">
                  <input id="familyBackground" value={form.familyBackground} onChange={(e) => set('familyBackground', e.target.value)} placeholder="e.g. Father: farmer; Mother: teacher" className={inputCls} />
                </Field>
                <Field label="Languages" hint="Add your mother tongue and any regional language. Boards ask about these." htmlFor="languages">
                  <ChipInput id="languages" values={form.languages} onChange={(v) => set('languages', v)} placeholder="Hindi, English…" max={6} />
                </Field>
              </div>
              <Field label="Anything else in your DAF" hint="The board reads this too, and may ask about it." htmlFor="otherNotes">
                <textarea id="otherNotes" rows={3} value={form.otherNotes} onChange={(e) => set('otherNotes', e.target.value)} placeholder="Internships, projects, places lived, unusual facts the board may pick up…" className={inputCls} />
              </Field>
            </div>
          </Panel>
        </div>

        {/* Sticky summary */}
        <aside className="lg:sticky lg:top-24 space-y-4">
          <Panel className="p-5">
            <h2 className="text-sm font-bold text-text-primary">What the board will ask about</h2>
            {preview.length ? (
              <ul className="mt-3 space-y-2">
                {preview.map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <Icon name={p.icon} className="w-4 h-4 mt-0.5 text-brand shrink-0" />
                    <span className="leading-snug">{p.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-tertiary mt-2">Nothing yet. Each detail you add becomes a set of predicted questions.</p>
            )}
            <ActionButton tone="primary" className="w-full mt-5" icon="save" onClick={save} disabled={saving || !dirty}>
              {saving ? 'Saving…' : dirty ? 'Save DAF details' : 'Saved'}
            </ActionButton>
            {saved && !dirty && (
              <ActionButton className="w-full mt-2" icon="sparkles" onClick={() => go({ screen: 'predictions' })}>See predicted questions</ActionButton>
            )}
          </Panel>
          {saved && (
            <button onClick={() => setConfirmDelete(true)} className="w-full text-xs font-semibold text-text-tertiary hover:text-status-danger-text cursor-pointer">
              Delete my DAF details
            </button>
          )}
        </aside>
      </div>

      {confirmDelete && (
        <Modal
          title="Delete your DAF details?"
          onClose={() => setConfirmDelete(false)}
          footer={<><ActionButton onClick={() => setConfirmDelete(false)}>Cancel</ActionButton><ActionButton tone="danger" icon="trash" onClick={remove}>Delete</ActionButton></>}
        >
          <p className="text-sm text-text-secondary pb-3">Your saved details and predicted questions are removed. Your past mock interviews stay.</p>
        </Modal>
      )}
    </Shell>
  );
}
