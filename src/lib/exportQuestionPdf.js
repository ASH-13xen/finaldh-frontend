// Admin-only: download one Toppers Copy question as a PDF (the question, each
// topper's pages with the green/blue margin notes, takeaways, AI analysis).
// The PDF is assembled in the browser by questionPdfBuilder.js; the server only
// hands over the question's pages. Import this module lazily — it pulls pdf-lib.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import AnswerDiagram from '../components/AnswerDiagram';
import { diagramIsRenderable } from './answerDiagram';
import { buildQuestionPdf, LIGHT_VARS } from './questionPdfBuilder';

const bytesOf = async (url, opts) => {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch { /* not JSON */ }
    throw new Error(msg);
  }
  return { bytes: new Uint8Array(await res.arrayBuffer()), res };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The SVG diagram kinds (flow, chart, quadrant, pyramid) are rendered off-screen
// with the same component the page uses, then rasterised. Table and timeline are
// drawn natively by the builder, so they need no capture.
async function captureDiagram(diagram) {
  if (!diagramIsRenderable(diagram) || diagram.kind === 'table' || diagram.kind === 'timeline') return null;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:560px;background:#fff;pointer-events:none;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    root.render(createElement(AnswerDiagram, { diagram, staticRender: true }));
    let svg = null;
    for (let i = 0; i < 60 && !svg; i++) {
      await sleep(50);
      // the drawing is the largest <svg> — recharts also renders tiny legend icons
      const area = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height; };
      const el = [...host.querySelectorAll('svg')].sort((p, q) => area(q) - area(p))[0];
      if (el && area(el) > 400) svg = el;
    }
    if (!svg) return null;
    await sleep(250); // let recharts finish its first layout pass

    const rect = svg.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', width);
    clone.setAttribute('height', height);
    clone.removeAttribute('style');
    clone.setAttribute('font-family', 'Inter, Arial, Helvetica, sans-serif');
    // An SVG drawn as an image can't see the page's CSS variables — inline the light values.
    const xml = new XMLSerializer()
      .serializeToString(clone)
      .replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (_, name) => LIGHT_VARS[name] || '#5c5447');

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Could not render the diagram'));
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    });
    const scale = 3;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const g = canvas.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    return { png: new Uint8Array(await blob.arrayBuffer()), width, height };
  } finally {
    root.unmount();
    host.remove();
  }
}

const slug = (s) => String(s || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/**
 * @param {object} o
 * @param {object} o.toppersCopy   the topic as returned by GET /api/toppers-copy/:id
 * @param {object} o.question      one of its questions
 * @param {number} [o.answerIdx]   only this topper; omit for every topper of the question
 */
export async function downloadQuestionPdf({ toppersCopy, question, answerIdx = null }) {
  const token = localStorage.getItem('token');
  const one = answerIdx != null;
  const answers = one ? [question.answers[answerIdx]].filter(Boolean) : question.answers || [];
  if (!answers.length) throw new Error('This question has no answer copy attached.');

  const [pages, regular, bold, italic, logo, diagramImage] = await Promise.all([
    bytesOf(
      `/api/toppers-copy/admin/${toppersCopy._id}/questions/${question._id}/export-pages${one ? `?answer=${answerIdx}` : ''}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ),
    bytesOf('/fonts/DejaVuSans.ttf'),
    bytesOf('/fonts/DejaVuSans-Bold.ttf'),
    bytesOf('/fonts/DejaVuSans-Oblique.ttf'),
    bytesOf('/logodh1.jpg').catch(() => null),
    // a diagram that fails to capture should not block the export
    captureDiagram(question.aiAnalysis?.diagram).catch(() => null),
  ]);
  const pageNumbers = (pages.res.headers.get('X-Export-Pages') || '').split(',').map(Number).filter(Boolean);

  const pdfBytes = await buildQuestionPdf({
    topic: toppersCopy,
    question,
    answers,
    pagesPdf: pages.bytes,
    pageNumbers,
    fonts: { regular: regular.bytes, bold: bold.bytes, italic: italic.bytes },
    logoJpg: logo?.bytes,
    diagramImage,
  });

  const qNo = (toppersCopy.questions || []).findIndex((q) => q._id === question._id) + 1;
  const name = ['DarkHorse', slug(toppersCopy.subject), slug(toppersCopy.topic), qNo ? `Q${qNo}` : '', one ? slug(answers[0].name) : '']
    .filter(Boolean)
    .join('_');
  const url = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
