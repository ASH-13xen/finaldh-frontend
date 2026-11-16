// Admins only: draft a current-topic note with AI from chosen sources, then review, edit, publish or delete.
// Drafts are written in the background (about a minute); the list refreshes itself while any is writing.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../components/mcq/Icon';
import { useToast } from '../../../components/Toast';
import { errorMessage } from '../../../lib/interviewApi';
import Button from '../Button';
import Sheet from '../Sheet';
import { useT } from '../../lib/i18n';
import { usePrep } from '../../lib/context';
import { api } from '../../lib/api';
import { noteDate, toneOf } from '../../lib/notes';

const CATEGORIES = ['polity', 'economy', 'international', 'environment', 'science', 'society', 'security', 'governance', 'culture', 'sports'];
const QTYPES = ['factual', 'analytical', 'opinion', 'situational', 'daf'];
const inputCls = 'prep-focus w-full rounded-2xl border border-border-default bg-surface px-4 py-3 text-[15px] outline-none focus:border-text-primary';
const splitComma = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-text-secondary mb-1.5">{label}</span>
      {children}
    </label>
  );
}

// The note as editable text: points and lists become one line / comma separated.
const toForm = (n) => ({
  title: n?.title || '',
  why: n?.why || '',
  sections: (n?.sections || []).map((s) => ({ heading: s.heading, points: s.points.join('\n') })),
  questions: (n?.questions || []).map((q) => ({ ...q })),
  likelyFor: (n?.likelyFor || []).join(', '),
  keywords: (n?.keywords || []).join(', ')
});
const fromForm = (f) => ({
  title: f.title,
  why: f.why,
  sections: f.sections.map((s) => ({ heading: s.heading, points: s.points.split('\n').map((x) => x.trim()).filter(Boolean) })).filter((s) => s.heading && s.points.length),
  questions: f.questions.filter((q) => q.q.trim()),
  likelyFor: splitComma(f.likelyFor),
  keywords: splitComma(f.keywords)
});

function NoteEditor({ id, onClose, onSaved }) {
  const { t } = useT();
  const toast = useToast();
  const [doc, setDoc] = useState(null);
  const [lang, setLang] = useState('en');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.admin.note(id)
      .then((d) => { if (!cancelled) setDoc({ category: d.note.category, tags: (d.note.tags || []).join(', '), en: toForm(d.note.en), hi: toForm(d.note.hi) }); })
      .catch((err) => { if (!cancelled) { toast.error(errorMessage(err, t('common.error'))); onClose(); } });
    return () => { cancelled = true; };
  }, [id, onClose, t, toast]);

  const f = doc?.[lang];
  const set = (patch) => setDoc((d) => ({ ...d, [lang]: { ...d[lang], ...patch } }));
  const setSection = (i, patch) => set({ sections: f.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const setQuestion = (i, patch) => set({ questions: f.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  const save = async () => {
    setSaving(true);
    try {
      await api.admin.updateNote(id, { category: doc.category, tags: splitComma(doc.tags), en: fromForm(doc.en), hi: fromForm(doc.hi) });
      toast.success(t('nt.admin.saved'));
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet onClose={onClose} label={t('nt.admin.edit')} wide>
      <div className="px-5 md:px-10 pt-14 md:pt-10 pb-28">
        <p className="prep-eyebrow text-brand">{t('nt.admin.edit')}</p>
        {!doc ? <div className="mt-8 h-64 rounded-3xl bg-sunken animate-pulse" /> : (
          <div className="mt-5 space-y-6">
            <div className="flex gap-2" role="tablist">
              {['en', 'hi'].map((l) => (
                <button key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => setLang(l)}
                  className={`prep-focus h-11 px-5 rounded-full font-semibold border cursor-pointer ${lang === l ? 'bg-text-primary text-page border-text-primary' : 'border-border-default text-text-secondary'}`}>
                  {l === 'en' ? t('nt.admin.english') : t('nt.admin.hindi')}
                </button>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label={t('nt.admin.category')}>
                <select value={doc.category} onChange={(e) => setDoc((d) => ({ ...d, category: e.target.value }))} className={inputCls}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}
                </select>
              </Field>
              <Field label={t('nt.admin.tags')}>
                <input value={doc.tags} onChange={(e) => setDoc((d) => ({ ...d, tags: e.target.value }))} className={inputCls} />
              </Field>
            </div>
            <Field label={t('nt.admin.title')}><input value={f.title} onChange={(e) => set({ title: e.target.value })} className={`${inputCls} font-display text-xl`} /></Field>
            <Field label={t('nt.admin.why')}><textarea rows={3} value={f.why} onChange={(e) => set({ why: e.target.value })} className={inputCls} /></Field>

            {f.sections.map((s, i) => (
              <div key={i} className="prep-card p-4 md:p-5 space-y-3">
                <div className="flex gap-2">
                  <input aria-label={t('nt.admin.heading')} value={s.heading} onChange={(e) => setSection(i, { heading: e.target.value })} className={`${inputCls} font-semibold`} />
                  <button type="button" onClick={() => set({ sections: f.sections.filter((_, j) => j !== i) })} className="prep-focus shrink-0 w-12 rounded-2xl border border-border-default text-text-tertiary hover:text-rose-600 cursor-pointer" aria-label={t('nt.admin.remove')}><Icon name="trash" className="w-5 h-5 mx-auto" /></button>
                </div>
                <Field label={t('nt.admin.points')}><textarea rows={Math.max(3, s.points.split('\n').length + 1)} value={s.points} onChange={(e) => setSection(i, { points: e.target.value })} className={inputCls} /></Field>
              </div>
            ))}
            <Button tone="ghost" size="sm" icon="plus" onClick={() => set({ sections: [...f.sections, { heading: '', points: '' }] })}>{t('nt.admin.addSection')}</Button>

            <h3 className="pt-4 font-display text-2xl font-semibold">{t('nt.questions')}</h3>
            {f.questions.map((q, i) => (
              <div key={i} className="prep-card p-4 md:p-5 space-y-3">
                <div className="flex gap-2">
                  <input aria-label={t('nt.admin.question')} value={q.q} onChange={(e) => setQuestion(i, { q: e.target.value })} className={`${inputCls} font-semibold`} />
                  <select aria-label="type" value={q.type} onChange={(e) => setQuestion(i, { type: e.target.value })} className={`${inputCls} w-auto`}>
                    {QTYPES.map((ty) => <option key={ty} value={ty}>{t(`nt.qtype.${ty}`)}</option>)}
                  </select>
                  <button type="button" onClick={() => set({ questions: f.questions.filter((_, j) => j !== i) })} className="prep-focus shrink-0 w-12 rounded-2xl border border-border-default text-text-tertiary hover:text-rose-600 cursor-pointer" aria-label={t('nt.admin.remove')}><Icon name="trash" className="w-5 h-5 mx-auto" /></button>
                </div>
                <Field label={t('nt.admin.answer')}><textarea rows={4} value={q.answer} onChange={(e) => setQuestion(i, { answer: e.target.value })} className={inputCls} /></Field>
              </div>
            ))}
            <Button tone="ghost" size="sm" icon="plus" onClick={() => set({ questions: [...f.questions, { q: '', type: 'analytical', answer: '' }] })}>{t('nt.admin.addQuestion')}</Button>

            <div className="grid md:grid-cols-2 gap-4 pt-2">
              <Field label={t('nt.admin.likelyFor')}><input value={f.likelyFor} onChange={(e) => set({ likelyFor: e.target.value })} className={inputCls} /></Field>
              <Field label={t('nt.admin.keywords')}><input value={f.keywords} onChange={(e) => set({ keywords: e.target.value })} className={inputCls} /></Field>
            </div>
          </div>
        )}
      </div>
      {doc && (
        <div className="sticky bottom-0 px-5 md:px-10 py-4 bg-page/95 backdrop-blur border-t border-border-subtle flex justify-end prep-safe-bottom">
          <Button tone="primary" size="lg" icon="save" disabled={saving} onClick={save}>{t('nt.admin.save')}</Button>
        </div>
      )}
    </Sheet>
  );
}

const STATUS_STYLE = {
  generating: 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300',
  failed: 'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300',
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300'
};

export default function AdminDesk({ onChanged }) {
  const { t, lang } = useT();
  const { go } = usePrep();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(null);
  const [tick, setTick] = useState(0);
  const [topic, setTopic] = useState('');
  const [links, setLinks] = useState('');
  const [text, setText] = useState('');
  const [paste, setPaste] = useState(false);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(null);

  const writing = useMemo(() => (list || []).some((n) => n.status === 'generating'), [list]);
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const load = () => api.admin.notes().then((d) => { if (!cancelled) setList(d.notes); }).catch(() => {});
    load();
    const id = writing ? setInterval(load, 5000) : null;
    return () => { cancelled = true; if (id) clearInterval(id); };
  }, [open, writing, tick]);

  const changed = useRef(onChanged);
  useEffect(() => { changed.current = onChanged; }, [onChanged]);
  const refresh = useCallback(() => { setTick((k) => k + 1); changed.current?.(); }, []);
  const closeEditor = useCallback(() => setEditing(null), []);

  const submit = async (e) => {
    e.preventDefault();
    const urls = links.split(/\s+/).map((x) => x.trim()).filter(Boolean);
    if (!urls.length && text.trim().length < 200) { toast.error(t('nt.admin.needSource')); return; }
    setSending(true);
    try {
      await api.admin.createNote({ topic, urls, text });
      toast.success(t('nt.admin.started'));
      setTopic(''); setLinks(''); setText(''); setPaste(false);
      setTick((k) => k + 1);
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setSending(false);
    }
  };

  const act = async (fn, done) => {
    try {
      await fn();
      if (done) toast.success(done);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    }
  };

  if (!open) {
    return (
      <div className="mt-10">
        <Button tone="ghost" size="md" icon="lock" onClick={() => setOpen(true)}>{t('nt.admin.open')}</Button>
      </div>
    );
  }

  return (
    <section className="mt-10 rounded-[1.75rem] border-2 border-dashed border-amber-400/70 bg-amber-50/60 dark:bg-amber-400/5 px-5 py-6 md:px-8 md:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="prep-eyebrow text-amber-800 dark:text-amber-300 flex items-center gap-2"><Icon name="lock" className="w-4 h-4" />{t('nt.admin')}</p>
          <p className="mt-2 text-text-secondary max-w-2xl">{t('nt.admin.sub')}</p>
        </div>
        <Button tone="plain" size="sm" icon="x" onClick={() => setOpen(false)}>{t('nt.admin.close')}</Button>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} required minLength={3} maxLength={140} placeholder={t('nt.admin.topic')} className={`${inputCls} h-14 text-lg`} />
        <Field label={t('nt.admin.links')}>
          <textarea rows={3} value={links} onChange={(e) => setLinks(e.target.value)} placeholder="https://pib.gov.in/…" className={`${inputCls} font-mono text-sm`} />
        </Field>
        {paste ? (
          <Field label={`${t('nt.admin.paste')} — ${t('nt.admin.pasteHint')}`}>
            <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} maxLength={40000} className={inputCls} />
          </Field>
        ) : (
          <button type="button" onClick={() => setPaste(true)} className="prep-focus text-sm font-semibold text-brand underline underline-offset-4 cursor-pointer">{t('nt.admin.paste')}</button>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" tone="primary" size="lg" icon="sparkles" disabled={sending || topic.trim().length < 3}>{t('nt.admin.generate')}</Button>
          {writing && <span className="text-sm text-text-secondary flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />{t('nt.admin.working')}</span>}
        </div>
      </form>

      <h3 className="mt-10 font-display text-2xl font-semibold">{t('nt.admin.drafts')}</h3>
      {!list ? <div className="mt-4 h-24 rounded-2xl bg-sunken animate-pulse" /> : !list.length ? <p className="mt-3 text-text-secondary">{t('nt.admin.none')}</p> : (
        <ul className="mt-4 space-y-3">
          {list.map((n) => (
            <li key={n.id} className="prep-card px-5 py-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${STATUS_STYLE[n.status] || ''}`}>
                    {n.status === 'generating' ? t('nt.admin.generating') : n.status === 'failed' ? t('nt.admin.failed') : n.status === 'published' ? t('nt.admin.published') : t('nt.admin.draft')}
                  </span>
                  {n.category && <span className="text-xs font-semibold" style={{ color: toneOf(n.category) }}>{t(`cat.${n.category}`)}</span>}
                  <span className="text-xs text-text-tertiary">{noteDate(n.publishedAt || n.createdAt, lang)}</span>
                </div>
                <p className="mt-1.5 font-semibold text-text-primary truncate">{lang === 'hi' && n.titleHi ? n.titleHi : n.title}</p>
                {n.error && <p className="mt-1 text-xs text-rose-700 dark:text-rose-300 break-words">{n.error}</p>}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {['draft', 'published'].includes(n.status) && (
                  <>
                    <Button tone="ghost" size="sm" icon="eye" onClick={() => go({ screen: 'notes', note: n.slug })}>{t('nt.admin.preview')}</Button>
                    <Button tone="ghost" size="sm" icon="edit" onClick={() => setEditing(n.id)}>{t('nt.admin.edit')}</Button>
                    {n.status === 'draft'
                      ? <Button tone="primary" size="sm" icon="send" onClick={() => act(() => api.admin.updateNote(n.id, { status: 'published' }), t('nt.admin.published.toast'))}>{t('nt.admin.publish')}</Button>
                      : <Button tone="ghost" size="sm" onClick={() => act(() => api.admin.updateNote(n.id, { status: 'draft' }))}>{t('nt.admin.unpublish')}</Button>}
                  </>
                )}
                {n.status !== 'generating' && (
                  <Button tone="plain" size="sm" icon="trash" onClick={() => { if (window.confirm(t('nt.admin.confirmDelete'))) act(() => api.admin.deleteNote(n.id)); }}>{t('nt.admin.delete')}</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <NoteEditor id={editing} onClose={closeEditor} onSaved={refresh} />}
    </section>
  );
}
