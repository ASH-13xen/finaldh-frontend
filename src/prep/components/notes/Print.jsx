// Branded PDFs, typeset by the browser's own print engine ("Save as PDF" in the print dialog): Hindi comes
// out right (PDF libraries can't shape Devanagari), text stays selectable, and the brand header, footer and
// watermark repeat on every page - the header and footer as a table's header/footer groups, the watermark
// as a fixed-position layer, plus a faint tiled brand pattern behind the text.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../../components/mcq/Icon';
import { detectInAppBrowser, externalBrowserLink } from '../../../lib/inAppBrowser';
import { useT, fmt } from '../../lib/i18n';
import { BRAND, TELEGRAM_URL, TELEGRAM_LABEL, LOGO } from '../../lib/notes';
import QR from './QR';

const site = () => ({ url: window.location.origin, label: window.location.host.replace(/^www\./, '') });
const today = (lang) => new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

const TILE = encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='440' height='260'><text x='60' y='150' transform='rotate(-24 220 130)' font-family='Georgia,serif' font-size='15' font-weight='700' letter-spacing='5' fill='#0d7a56' fill-opacity='0.055'>THE DARK HORSE UPSC</text></svg>");

const PRINT_CSS = `
@page { size: A4; margin: 0; }
.pp-root { position: fixed; inset: 0; z-index: 300; overflow-y: auto; background: #d6cfc2; }
.pp-sheet { position: relative; width: 210mm; max-width: 100%; margin: 20px auto 80px; color: #14110d; font-family: var(--font-sans);
  background: #fffdf8 url("data:image/svg+xml;utf8,${TILE}") repeat; box-shadow: 0 30px 80px -30px rgba(0,0,0,.5);
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pp-sheet * { box-sizing: border-box; }
.pp-frame { width: 100%; border-collapse: collapse; }
.pp-frame td { padding: 0; vertical-align: top; }
.pp-head { margin: 0 16mm; padding: 9mm 0 3mm; border-bottom: 0.35mm solid rgba(13,122,86,.45); display: flex; align-items: center; justify-content: space-between; gap: 4mm; }
.pp-brand { display: flex; align-items: center; gap: 3mm; }
.pp-brand img { width: 9mm; height: 9mm; border-radius: 50%; object-fit: cover; }
.pp-brand b { display: block; font-family: var(--font-display); font-size: 11pt; font-weight: 700; line-height: 1.1; }
.pp-brand small { display: block; font-size: 6.8pt; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: #0d7a56; margin-top: .6mm; }
.pp-site { font-size: 8.5pt; font-weight: 700; color: #0d7a56; }
.pp-foot { margin: 0 16mm; padding: 3mm 0 8mm; border-top: 0.25mm solid rgba(20,17,13,.18); display: flex; justify-content: space-between; gap: 4mm; font-size: 7.5pt; color: #57534e; }
.pp-foot b { color: #0d7a56; }
.pp-body { padding: 6mm 16mm 4mm; }
.pp-eyebrow { font-size: 7.5pt; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: #0d7a56; }
.prep-hi .pp-eyebrow, .prep-hi .pp-brand small { letter-spacing: .02em; text-transform: none; font-size: 8.5pt; }
.pp-title { font-family: var(--font-display); font-size: 27pt; line-height: 1.08; font-weight: 600; letter-spacing: -0.01em; margin: 3mm 0 5mm; }
.prep-hi .pp-title { line-height: 1.35; font-size: 24pt; }
.pp-why { border-left: 1.2mm solid #f2b33d; background: #fdf3dc; padding: 3.5mm 5mm; font-size: 10.5pt; line-height: 1.55; border-radius: 0 3mm 3mm 0; }
.pp-why b { display: block; font-size: 7.5pt; letter-spacing: .16em; text-transform: uppercase; color: #92400e; margin-bottom: 1mm; }
.pp-h2 { font-family: var(--font-display); font-size: 17pt; font-weight: 600; margin: 9mm 0 2mm; letter-spacing: -0.01em; }
.pp-sec { margin-top: 6mm; break-inside: avoid; }
.pp-sec h2 { font-family: var(--font-display); font-size: 13.5pt; font-weight: 600; display: flex; gap: 3mm; align-items: baseline; margin: 0; }
.pp-sec h2 span { color: #0d7a56; font-size: 9.5pt; font-weight: 700; font-family: var(--font-sans); }
.pp-list { margin: 2mm 0 0; padding-left: 5mm; }
.pp-list li { list-style: disc; font-size: 10.5pt; line-height: 1.55; margin: 1.1mm 0; }
.pp-list li::marker { color: #0d7a56; }
ol.pp-list li { list-style: decimal; }
.prep-hi .pp-list li, .prep-hi .pp-why, .prep-hi .pp-ans { line-height: 1.75; }
.pp-q { margin-top: 5mm; padding: 4mm 5mm; border: 0.3mm solid rgba(20,17,13,.14); border-radius: 3mm; background: rgba(255,255,255,.7); break-inside: avoid; }
.pp-qmeta { font-size: 7.5pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #0d7a56; }
.pp-qtext { font-family: var(--font-display); font-size: 12.5pt; font-weight: 600; line-height: 1.3; margin-top: 1mm; }
.pp-ans { font-size: 10pt; line-height: 1.6; margin-top: 2mm; color: #2a2520; }
.pp-ans b { color: #0d7a56; }
.pp-chips { display: flex; flex-wrap: wrap; gap: 2mm; margin-top: 2mm; }
.pp-chips span { font-size: 8.5pt; font-weight: 600; border: 0.3mm solid rgba(13,122,86,.35); color: #0d7a56; background: #e7f6ee; border-radius: 99mm; padding: 1mm 3mm; }
.pp-two { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-top: 7mm; break-inside: avoid; }
.pp-label { font-size: 7.5pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #57534e; }
.pp-sources { margin-top: 7mm; font-size: 8.5pt; color: #57534e; break-inside: avoid; }
.pp-sources li { margin: 1mm 0; word-break: break-all; }
.pp-disclaimer { margin-top: 3mm; font-size: 8pt; color: #78716c; font-style: italic; }
.pp-cta { margin-top: 9mm; break-inside: avoid; background: #14110d; color: #f3ede2; border-radius: 4mm; padding: 6mm 7mm; display: flex; align-items: center; justify-content: space-between; gap: 6mm; position: relative; overflow: hidden; }
.pp-cta::before { content: ''; position: absolute; inset: 0; background: radial-gradient(60% 90% at 100% 0%, rgba(18,155,110,.45), transparent 70%); }
.pp-cta > * { position: relative; }
.pp-cta-title { font-family: var(--font-display); font-size: 15pt; line-height: 1.2; font-weight: 600; margin-top: 1.5mm; }
.pp-cta-sub { font-size: 9pt; color: rgba(243,237,226,.75); margin-top: 2mm; }
.pp-qrs { display: flex; gap: 4mm; flex-shrink: 0; }
.pp-qrs figure { margin: 0; text-align: center; }
.pp-qrs img, .pp-qrs span { display: block; background: #fff; padding: 1.2mm; border-radius: 2mm; width: 25mm !important; height: 25mm !important; }
.pp-qrs figcaption { font-size: 6.8pt; margin-top: 1.5mm; color: rgba(243,237,226,.8); max-width: 26mm; }
.pp-wm { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 5; }
.pp-wm > div { transform: rotate(-28deg); display: flex; flex-direction: column; align-items: center; gap: 6mm; opacity: .06; }
.pp-wm img { width: 64mm; height: 64mm; border-radius: 50%; object-fit: cover; filter: grayscale(1); }
.pp-wm span { font-family: var(--font-display); font-size: 38pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #0d7a56; white-space: nowrap; }
.pp-cover { position: relative; min-height: 297mm; height: 297mm; overflow: hidden; break-after: page; background: #14110d; color: #f3ede2; padding: 20mm 18mm; display: flex; flex-direction: column; justify-content: space-between; }
.pp-cover-glow { position: absolute; inset: 0; background: radial-gradient(70% 55% at 100% 0%, rgba(18,155,110,.5), transparent 70%), radial-gradient(60% 45% at 0% 100%, rgba(242,179,61,.22), transparent 70%); }
.pp-cover > * { position: relative; }
.pp-cover-brand { display: flex; align-items: center; gap: 4mm; }
.pp-cover-brand img { width: 18mm; height: 18mm; border-radius: 50%; object-fit: cover; border: 0.6mm solid rgba(243,237,226,.35); }
.pp-cover-brand b { display: block; font-family: var(--font-display); font-size: 17pt; }
.pp-cover-brand small { display: block; font-size: 8pt; letter-spacing: .24em; text-transform: uppercase; color: #6ee7b7; margin-top: 1mm; font-weight: 700; }
.pp-cover h1 { font-family: var(--font-display); font-size: 46pt; line-height: 1.02; font-weight: 600; letter-spacing: -0.02em; margin: 6mm 0 0; }
.prep-hi .pp-cover h1 { font-size: 36pt; line-height: 1.32; letter-spacing: 0; }
.pp-cover-num { font-family: var(--font-display); font-size: 120pt; line-height: .8; font-weight: 700; color: #6ee7b7; }
.pp-cover-sub { margin-top: 7mm; font-size: 12pt; color: rgba(243,237,226,.8); max-width: 140mm; line-height: 1.5; }
.pp-cover-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 8mm; border-top: 0.3mm solid rgba(243,237,226,.25); padding-top: 7mm; }
.pp-cover-foot p { font-size: 10pt; color: rgba(243,237,226,.85); line-height: 1.6; }
.pp-cover-foot b { font-size: 12pt; color: #fff; }
.pp-cover figure { margin: 0; text-align: center; }
.pp-cover figure img, .pp-cover figure span { display: block; background: #fff; padding: 1.5mm; border-radius: 2.5mm; width: 30mm !important; height: 30mm !important; }
.pp-cover figcaption { font-size: 7.5pt; margin-top: 2mm; color: rgba(243,237,226,.8); }
.pp-break { break-after: page; }
.pp-howto { counter-reset: step; margin-top: 4mm; }
.pp-howto li { display: flex; gap: 4mm; align-items: flex-start; margin: 4mm 0; font-size: 11.5pt; line-height: 1.5; }
.pp-howto li span { flex-shrink: 0; width: 9mm; height: 9mm; border-radius: 50%; background: #0d7a56; color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 10pt; }
.pp-about { margin-top: 10mm; padding: 6mm 7mm; border-radius: 4mm; border: 0.3mm solid rgba(13,122,86,.35); background: #e7f6ee; break-inside: avoid; }
.pp-about h3 { font-family: var(--font-display); font-size: 15pt; font-weight: 600; }
.pp-about p { font-size: 10.5pt; line-height: 1.6; margin-top: 2mm; }
.pp-features { margin-top: 3mm; display: grid; grid-template-columns: 1fr 1fr; gap: 2.5mm 6mm; }
.pp-features li { font-size: 9.5pt; line-height: 1.45; padding-left: 5mm; position: relative; }
.pp-features li::before { content: '✓'; position: absolute; left: 0; color: #0d7a56; font-weight: 700; }
.pp-entry { padding: 5mm 0 4mm; border-bottom: 0.3mm solid rgba(20,17,13,.12); break-inside: avoid; }
.pp-entry-head { display: flex; gap: 4mm; align-items: flex-start; }
.pp-n { font-family: var(--font-display); font-size: 22pt; line-height: 1; font-weight: 700; color: #0d7a56; min-width: 13mm; }
.pp-entry h3 { font-family: var(--font-display); font-size: 13pt; line-height: 1.3; font-weight: 600; margin: 0; }
.pp-meta { font-size: 8pt; color: #78716c; margin-top: 1mm; }
.pp-tests { margin: 2.5mm 0 0 17mm; font-size: 10pt; line-height: 1.5; }
.pp-tests b { color: #0d7a56; }
.pp-cols { margin: 2.5mm 0 0 17mm; display: grid; grid-template-columns: 1.1fr 1fr; gap: 6mm; }
.pp-cols .pp-list li { font-size: 9.5pt; margin: .8mm 0; line-height: 1.45; }
.pp-do { color: #0d7a56 !important; }
.pp-dont { color: #b91c1c !important; margin-top: 2mm; }
.pp-band { margin: 6mm 0; break-inside: avoid; display: flex; align-items: center; justify-content: space-between; gap: 5mm; padding: 4mm 5mm; border-radius: 3mm; background: #14110d; color: #f3ede2; font-size: 10pt; }
.pp-band b { color: #6ee7b7; }
@media print {
  html, body { background: #fffdf8 !important; height: auto !important; overflow: visible !important; }
  body > *:not(.pp-root) { display: none !important; }
  .pp-root { position: static; overflow: visible; background: none; }
  .pp-bar { display: none !important; }
  .pp-sheet { margin: 0; box-shadow: none; width: 210mm; max-width: none; }
}
`;

function Watermark() {
  return (
    <div className="pp-wm" aria-hidden="true">
      <div><img src={LOGO} alt="" /><span>{BRAND}</span></div>
    </div>
  );
}

// Brand header and footer on every page around the content.
export function Frame({ label, children }) {
  const { t } = useT();
  const s = site();
  return (
    <table className="pp-frame">
      <thead><tr><td>
        <div className="pp-head">
          <div className="pp-brand"><img src={LOGO} alt="" /><div><b>{BRAND}</b><small>{label}</small></div></div>
          <span className="pp-site">{s.label}</span>
        </div>
      </td></tr></thead>
      <tfoot><tr><td>
        <div className="pp-foot"><span>{t('print.footer', { site: s.label })}</span><span>{t('print.chat')}: <b>{TELEGRAM_LABEL}</b></span></div>
      </td></tr></tfoot>
      <tbody><tr><td><div className="pp-body">{children}</div></td></tr></tbody>
    </table>
  );
}

function QRs({ dark = false }) {
  const { t } = useT();
  const s = site();
  return (
    <div className="pp-qrs">
      <figure><QR value={s.url} size={96} /><figcaption>{t('print.scan')}</figcaption></figure>
      <figure><QR value={TELEGRAM_URL} size={96} /><figcaption>{dark ? t('print.chat') : 'Telegram'}</figcaption></figure>
    </div>
  );
}

export function Cta() {
  const { t } = useT();
  const s = site();
  return (
    <div className="pp-cta">
      <div>
        <p className="pp-eyebrow" style={{ color: '#6ee7b7' }}>{BRAND}</p>
        <p className="pp-cta-title">{t('print.practise', { site: s.label })}</p>
        <p className="pp-cta-sub">{t('print.chat')}: {TELEGRAM_LABEL}</p>
      </div>
      <QRs dark />
    </div>
  );
}

function About({ interviews }) {
  const { t } = useT();
  return (
    <div className="pp-about">
      <h3>{t('print.about')}</h3>
      <p>{t('print.aboutText')}</p>
      <ul className="pp-features">
        {[1, 2, 3, 4].map((i) => <li key={i}>{t(`print.feature${i}`, { n: fmt(interviews) })}</li>)}
      </ul>
    </div>
  );
}

// A current-topic note as a PDF: the notes, then every question with its model answer, then sources.
export function NoteDoc({ note, categoryLabel, date }) {
  const { t } = useT();
  return (
    <Frame label={t('print.notesLabel')}>
      <p className="pp-eyebrow">{[categoryLabel, date].filter(Boolean).join(' · ')}</p>
      <h1 className="pp-title">{note.title}</h1>
      {note.why && <div className="pp-why"><b>{t('nt.why')}</b>{note.why}</div>}
      {note.sections.map((s, i) => (
        <section key={i} className="pp-sec">
          <h2><span>{String(i + 1).padStart(2, '0')}</span>{s.heading}</h2>
          <ul className="pp-list">{s.points.map((p, j) => <li key={j}>{p}</li>)}</ul>
        </section>
      ))}
      {(note.likelyFor?.length > 0 || note.keywords?.length > 0) && (
        <div className="pp-two">
          {note.likelyFor?.length > 0 && <div><p className="pp-label">{t('nt.likelyFor')}</p><div className="pp-chips">{note.likelyFor.map((x) => <span key={x}>{x}</span>)}</div></div>}
          {note.keywords?.length > 0 && <div><p className="pp-label">{t('nt.keywords')}</p><div className="pp-chips">{note.keywords.map((x) => <span key={x}>{x}</span>)}</div></div>}
        </div>
      )}
      {note.questions?.length > 0 && <h2 className="pp-h2">{t('nt.questions')}</h2>}
      {note.questions?.map((q, i) => (
        <div key={i} className="pp-q">
          <p className="pp-qmeta">Q{i + 1} · {t(`nt.qtype.${q.type}`)}</p>
          <p className="pp-qtext">{q.q}</p>
          {q.answer && <p className="pp-ans"><b>{t('nt.answer')}: </b>{q.answer}</p>}
        </div>
      ))}
      {note.sources?.length > 0 && (
        <div className="pp-sources">
          <p className="pp-label">{t('nt.sources')}</p>
          <ul>{note.sources.map((s) => <li key={s.url}>{s.title} — {s.url}</li>)}</ul>
        </div>
      )}
      <p className="pp-disclaimer">{t('nt.aiNote')}</p>
      <Cta />
    </Frame>
  );
}

// The 100-question guide as a PDF: a cover, how to use it, every question, and a back page about us.
export function GuideDoc({ entries, corpus }) {
  const { t, tn, lang } = useT();
  const s = site();
  return (
    <>
      <section className="pp-cover">
        <div className="pp-cover-glow" aria-hidden="true" />
        <div className="pp-cover-brand"><img src={LOGO} alt="" /><div><b>{BRAND}</b><small>{t('print.guideLabel')}</small></div></div>
        <div>
          <p className="pp-cover-num">{fmt(entries.length)}</p>
          <h1>{t('guide.title', { n: fmt(entries.length) })}</h1>
          {corpus?.interviews > 0 && <p className="pp-cover-sub">{t('print.cover.built', { n: fmt(corpus.interviews) })}</p>}
        </div>
        <div className="pp-cover-foot">
          <p><b>{t('print.cover.by')}</b><br />{s.label} · {TELEGRAM_LABEL}<br />{t('print.downloaded', { date: today(lang) })}</p>
          <figure><QR value={s.url} size={120} /><figcaption>{t('print.scan')}</figcaption></figure>
        </div>
      </section>
      <Frame label={t('print.guideLabel')}>
        <div className="pp-break">
          <h2 className="pp-h2" style={{ marginTop: 0 }}>{t('print.howTo')}</h2>
          <ol className="pp-howto">{[1, 2, 3, 4].map((i) => <li key={i}><span>{i}</span>{t(`print.howTo${i}`)}</li>)}</ol>
          <About interviews={corpus?.interviews} />
          <Cta />
        </div>
        {entries.map((e, i) => (
          <div key={e.key}>
            <article className="pp-entry">
              <div className="pp-entry-head">
                <span className="pp-n">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{e.text}</h3>
                  <p className="pp-meta">{tn('common.askedTimes', e.timesAsked)}</p>
                </div>
              </div>
              {e.guide.tests && <p className="pp-tests"><b>{t('guide.tests')}: </b>{e.guide.tests}</p>}
              <div className="pp-cols">
                <div>
                  <p className="pp-label">{t('guide.structure')}</p>
                  <ol className="pp-list">{e.guide.structure.map((x, j) => <li key={j}>{x}</li>)}</ol>
                </div>
                <div>
                  {e.guide.dos?.length > 0 && <><p className="pp-label pp-do">{t('guide.dos')}</p><ul className="pp-list">{e.guide.dos.map((x, j) => <li key={j}>{x}</li>)}</ul></>}
                  {e.guide.donts?.length > 0 && <><p className="pp-label pp-dont">{t('guide.donts')}</p><ul className="pp-list">{e.guide.donts.map((x, j) => <li key={j}>{x}</li>)}</ul></>}
                </div>
              </div>
            </article>
            {(i + 1) % 20 === 0 && i + 1 < entries.length && (
              <div className="pp-band"><span><b>{BRAND}</b> · {t('print.practise', { site: s.label })}</span><span>{TELEGRAM_LABEL}</span></div>
            )}
          </div>
        ))}
        <div style={{ breakBefore: 'page' }}>
          <About interviews={corpus?.interviews} />
          <Cta />
        </div>
      </Frame>
    </>
  );
}

// The overlay: a preview of the document, "Save as PDF" (the print dialog) and Close.
export default function PrintView({ title, fileName, onClose, children }) {
  const { t, lang, hi } = useT();
  const [busy, setBusy] = useState(false);
  const root = useRef(null);
  const [inApp] = useState(() => detectInAppBrowser().detected);

  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') close.current(); };
    window.addEventListener('keydown', onKey);
    root.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await document.fonts?.ready;
      const imgs = [...(root.current?.querySelectorAll('img') || [])];
      await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
    } catch { /* print anyway */ }
    setBusy(false);
    // The PDF's file name comes from the page title.
    const prevTitle = document.title;
    document.title = fileName || title || BRAND;
    const restore = () => { document.title = prevTitle; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
    setTimeout(restore, 60000);
  };

  return createPortal(
    <div ref={root} tabIndex={-1} lang={lang} role="dialog" aria-modal="true" aria-label={title} className={`pp-root outline-none ${hi ? 'prep-hi' : ''}`}>
      <style>{PRINT_CSS}</style>
      <div className="pp-bar sticky top-0 z-10 bg-[#14110d]/95 backdrop-blur text-[#f3ede2] px-4 md:px-8 py-3 flex items-center gap-3 shadow-lg">
        <button type="button" onClick={onClose} className="prep-focus h-11 px-4 rounded-full border border-white/25 hover:border-white flex items-center gap-2 text-sm font-semibold cursor-pointer">
          <Icon name="x" className="w-4 h-4" />{t('print.close')}
        </button>
        <p className="flex-1 min-w-0 text-sm text-white/75 truncate hidden sm:block">
          {inApp ? t('print.inApp') : t('print.hint')}
        </p>
        {inApp && externalBrowserLink() && (
          <a href={externalBrowserLink()} className="prep-focus h-11 px-4 rounded-full border border-white/25 hover:border-white items-center gap-2 text-sm font-semibold hidden sm:flex">
            <Icon name="external" className="w-4 h-4" />Chrome / Safari
          </a>
        )}
        <button type="button" onClick={save} disabled={busy} className="prep-focus ml-auto h-11 px-5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60">
          <Icon name="download" className="w-4 h-4" />{busy ? t('print.preparing') : t('print.print')}
        </button>
      </div>
      {inApp && <p className="pp-bar sm:hidden bg-amber-100 text-amber-900 text-sm px-4 py-3">{t('print.inApp')}</p>}
      <div className="pp-sheet">
        {children}
        <Watermark />
      </div>
    </div>,
    document.body
  );
}
