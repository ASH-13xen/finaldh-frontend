import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Icon from '../components/mcq/Icon';
import { ActionButton, ErrorBanner } from '../components/mcq/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import { Shell, PageHeader, Panel, StatTile, SourceChip, AskerTag } from '../components/interview/ui';
import { iv, errorMessage, formatDate, formatClock, wordCount, ASKER_LABEL } from '../lib/interviewApi';

// Score meters for the seven qualities UPSC assesses. A single measure, so plain bars with the number
// written beside them; no chart legend needed.
function TraitRow({ t }) {
  const pct = t.score != null ? (t.score / 10) * 100 : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-text-primary">{t.label}</span>
        <span className="text-sm font-bold text-text-primary tabular-nums">{t.score != null ? `${t.score.toFixed(1)} / 10` : '—'}</span>
      </div>
      <div className="h-2 rounded-full bg-sunken mt-1.5 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={10} aria-valuenow={t.score ?? undefined} aria-label={t.label}>
        <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      {t.comment && <p className="text-xs text-text-tertiary mt-1.5 leading-relaxed">{t.comment}</p>}
    </li>
  );
}

// The board's mock marks: five members, 55 each, 275 in all (the real Personality Test maximum).
// One bar per member with the number written beside it, in board order.
const MARKS_ORDER = ['chairman', 'm1', 'm2', 'm3', 'm4'];
function BoardMarks({ marks }) {
  const byId = Object.fromEntries(marks.members.map((m) => [m.id, m]));
  return (
    <Panel className="p-5 md:p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
        <div className="shrink-0 md:w-[230px]">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-tertiary">The board’s marks</p>
          <p className="mt-1.5"><span className="font-display text-5xl font-bold text-text-primary tabular-nums">{marks.total}</span><span className="text-xl text-text-tertiary"> / {marks.outOf}</span></p>
          <p className="text-xs text-text-tertiary mt-2 leading-relaxed">A practice estimate from {marks.basedOn === 1 ? 'the one answer' : `the ${marks.basedOn} answers`} the board scored — not a prediction of your UPSC marks.</p>
        </div>
        <ul className="flex-1 grid gap-2.5">
          {MARKS_ORDER.map((id) => byId[id]).filter(Boolean).map((m) => (
            <li key={m.id} className="grid grid-cols-[92px_1fr_62px] sm:grid-cols-[110px_1fr_70px] items-center gap-3">
              <AskerTag asker={m.id} />
              <div className="h-2.5 rounded-full bg-sunken overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={m.outOf} aria-valuenow={m.marks} aria-label={`${m.label} marks`}>
                <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${(m.marks / m.outOf) * 100}%` }} />
              </div>
              <span className="text-sm font-bold text-text-primary tabular-nums text-right">{m.marks}<span className="font-normal text-text-tertiary"> / {m.outOf}</span></span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

// How the candidate carried themselves, from their own camera and microphone (numbers only).
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const ISSUE_LABEL = { absent: 'Out of view', reading: 'Looking down', eyeContact: 'Looking away', posture: 'Posture', restless: 'Restless' };
function PresencePanel({ p }) {
  const meters = [
    { label: 'Faced the board', value: p.eyeContact, good: (v) => v >= 0.7, hint: 'of the time you were answering' },
    { label: 'Out of view', value: p.absent != null && p.absent >= 0.05 ? p.absent : null, good: (v) => v <= 0.1, hint: 'your face was not in the camera', invert: true },
    { label: 'Looked down', value: p.down, good: (v) => v <= 0.15, hint: 'often reads as reading or doubt', invert: true },
    { label: 'Slouched or leaned', value: p.slump == null ? null : Math.max(p.slump || 0, p.lean || 0), good: (v) => v <= 0.2, hint: 'compared with how you sat at the start', invert: true },
    { label: 'Restless', value: p.restless, good: (v) => v <= 0.2, hint: 'shifting about', invert: true }
  ].filter((m) => m.value != null);
  return (
    <Panel className="p-5 md:p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-start gap-5 md:gap-8">
        <div className="shrink-0 md:w-[230px]">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-tertiary">How you carried yourself</p>
          {p.score != null ? (
            <p className="mt-1.5"><span className="font-display text-5xl font-bold text-text-primary tabular-nums">{p.score.toFixed(1)}</span><span className="text-xl text-text-tertiary"> / 10</span></p>
          ) : (
            <p className="mt-2 text-sm text-text-tertiary">Your camera could not be read in this interview.</p>
          )}
          <p className="text-xs text-text-tertiary mt-2 leading-relaxed">
            Measured by your own camera and microphone on {p.tracked} of {p.answers} answer{p.answers === 1 ? '' : 's'}. A webcam only sees roughly where you look, so treat these as a guide.
            {p.remarks ? ` The board remarked on it ${p.remarks === 1 ? 'once' : `${p.remarks} times`}.` : ''}
          </p>
        </div>
        <div className="flex-1 min-w-0">
          {meters.length > 0 && (
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
              {meters.map((m) => (
                <li key={m.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-text-primary">{m.label}</span>
                    <span className={`text-sm font-bold tabular-nums ${m.good(m.value) ? 'text-brand' : 'text-status-warning-text'}`}>{pct(m.value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-sunken mt-1.5 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(m.value * 100)} aria-label={m.label}>
                    <div className={`h-full rounded-full ${m.good(m.value) ? 'bg-brand' : 'bg-status-warning-text'}`} style={{ width: `${Math.max(2, m.value * 100)}%` }} />
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-1">{m.hint}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 mt-4 text-xs">
            {p.lookAways > 0 && <span className="rounded-full bg-sunken border border-border-subtle px-2.5 py-1 text-text-secondary">Looked away {p.lookAways}× · longest {p.longestAway}s</span>}
            {p.wpm != null && <span className="rounded-full bg-sunken border border-border-subtle px-2.5 py-1 text-text-secondary">{p.wpm} words a minute{p.wpm > 185 ? ' (fast)' : p.wpm < 95 ? ' (slow)' : ''}</span>}
            {p.fillersPer100 != null && <span className="rounded-full bg-sunken border border-border-subtle px-2.5 py-1 text-text-secondary">{p.fillersPer100} filler words per 100</span>}
          </div>
          {p.perQuestion?.some((q) => q.eyeContact != null) && (
            <div className="mt-5">
              <p className="text-xs font-bold text-text-tertiary mb-2">Facing the board, answer by answer</p>
              <div className="flex items-end gap-1.5 h-16" role="img" aria-label={`Facing the board per answer: ${p.perQuestion.map((q, i) => `${i + 1}: ${pct(q.eyeContact)}`).join(', ')}`}>
                {p.perQuestion.map((q, i) => (
                  <span key={q.idx} className="flex-1 max-w-6 flex flex-col items-center justify-end h-full" title={`Answer ${i + 1}: ${pct(q.eyeContact)}${q.issue ? ` · ${ISSUE_LABEL[q.issue] || q.issue}` : ''}`}>
                    <span className={`w-full rounded-t-[3px] ${q.eyeContact == null ? 'bg-border-default' : q.eyeContact >= 0.7 ? 'bg-brand' : 'bg-status-warning-text'}`} style={{ height: `${q.eyeContact == null ? 6 : Math.max(6, q.eyeContact * 100)}%` }} />
                  </span>
                ))}
              </div>
            </div>
          )}
          {p.tips?.length > 0 && (
            <ul className="mt-5 space-y-2">
              {p.tips.map((t, i) => <li key={i} className="text-sm text-text-secondary leading-relaxed flex gap-2"><Icon name="arrowRight" className="w-4 h-4 mt-0.5 text-brand shrink-0" />{t}</li>)}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

const MOOD_LABEL = { pleased: 'Pleased', neutral: 'Neutral', sceptical: 'Not convinced', displeased: 'Displeased' };

function List({ title, icon, items, empty }) {
  return (
    <Panel className="p-5">
      <h3 className="text-sm font-bold text-text-primary flex items-center gap-2"><Icon name={icon} className="w-4 h-4 text-brand" /> {title}</h3>
      {items?.length ? (
        <ul className="mt-3 space-y-2">{items.map((s, i) => <li key={i} className="text-sm text-text-secondary leading-relaxed flex gap-2"><span className="text-brand">•</span>{s}</li>)}</ul>
      ) : (
        <p className="text-sm text-text-tertiary mt-3">{empty}</p>
      )}
    </Panel>
  );
}

const downloadPdf = (session) => {
  const r = session.report;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Mock Interview Report', 40, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${formatDate(session.startedAt)} · ${session.mode === 'real' ? 'Real interview' : 'Practice'} · ${r.stats?.minutes ?? session.durationMinutes} min · The Dark Horse UPSC`, 40, 68);
  doc.setTextColor(20);
  let y = 92;
  if (r.overall != null) { doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.text(`Overall: ${r.overall.toFixed(1)} / 10`, 40, y); y += 18; }
  if (r.marks?.members?.length) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`Board's marks (practice estimate): ${r.marks.total} / ${r.marks.outOf}`, 40, y);
    y += 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(r.marks.members.map((m) => `${m.label} ${m.marks}/${m.outOf}`).join('   '), 40, y);
    y += 18;
  }
  if (r.summary) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(r.summary, W - 80);
    doc.text(lines, 40, y);
    y += lines.length * 13 + 8;
  }
  if (r.traits?.some((t) => t.score != null)) {
    autoTable(doc, { startY: y, head: [['Quality', 'Score', 'Comment']], body: r.traits.map((t) => [t.label, t.score != null ? t.score.toFixed(1) : '-', t.comment || '']), styles: { fontSize: 9 }, headStyles: { fillColor: [13, 122, 86] }, columnStyles: { 0: { cellWidth: 150 }, 1: { cellWidth: 45 } } });
    y = doc.lastAutoTable.finalY + 16;
  }
  const pr = r.presence;
  const presenceLines = pr ? [
    pr.score != null ? `Score ${pr.score.toFixed(1)} / 10 (camera read on ${pr.tracked} of ${pr.answers} answers)` : '',
    pr.eyeContact != null ? `Faced the board ${Math.round(pr.eyeContact * 100)}% of the time` : '',
    pr.lookAways ? `Looked away ${pr.lookAways} times, longest ${pr.longestAway}s` : '',
    pr.wpm != null ? `${pr.wpm} words a minute` : '',
    ...(pr.tips || [])
  ].filter(Boolean) : [];
  const lists = [['Strengths', r.strengths], ['To improve', r.improvements], ['DAF areas to prepare', r.dafGaps], ['How you carried yourself', presenceLines]].filter(([, l]) => l?.length);
  if (lists.length) {
    autoTable(doc, { startY: y, head: [['', '']], showHead: 'never', body: lists.map(([k, l]) => [k, l.map((s) => `• ${s}`).join('\n')]), styles: { fontSize: 9 }, columnStyles: { 0: { cellWidth: 120, fontStyle: 'bold' } } });
    y = doc.lastAutoTable.finalY + 16;
  }
  autoTable(doc, {
    startY: y,
    head: [['#', 'Question', 'Your answer', 'Feedback']],
    body: session.turns.filter((t) => t.answered).map((t, i) => [
      String(i + 1),
      `${ASKER_LABEL[t.asker] || ''}: ${t.question}`,
      t.skipped ? '(passed)' : t.answer,
      [t.feedback?.score != null ? `${t.feedback.score}/10` : '', t.feedback?.verdict, ...(t.feedback?.improve || []).map((s) => `- ${s}`), t.feedback?.betterAnswer].filter(Boolean).join('\n')
    ]),
    styles: { fontSize: 8, valign: 'top' },
    headStyles: { fillColor: [13, 122, 86] },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 150 }, 2: { cellWidth: 170 } }
  });
  doc.save(`mock-interview-${new Date(session.startedAt).toISOString().slice(0, 10)}.pdf`);
};

export default function InterviewReport({ sessionId, go, onHome }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    iv(`/sessions/${sessionId}`)
      .then(({ session: s }) => { if (!cancelled) setSession(s); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); });
    return () => { cancelled = true; };
  }, [sessionId]);

  if (error) return <Shell><div className="py-16"><ErrorBanner>{error}</ErrorBanner></div></Shell>;
  if (!session) return <div className="flex items-center justify-center min-h-[60vh]"><LoadingSpinner text="Loading your report..." /></div>;
  if (session.status === 'in-progress') {
    return (
      <Shell>
        <PageHeader onBack={onHome} title="This interview isn’t finished" subtitle="Resume it, or end it from the interview room to get the report." actions={<ActionButton tone="primary" icon="play" onClick={() => go({ screen: 'room', sessionId })}>Resume</ActionButton>} />
      </Shell>
    );
  }

  const r = session.report || {};
  const s = r.stats || {};
  const answered = session.turns.filter((t) => t.answered);
  const ai = r.generatedBy === 'gemini';

  return (
    <Shell>
      <PageHeader
        onBack={onHome}
        eyebrow={`${formatDate(session.startedAt)} · ${session.formatLabel ? `${session.formatLabel} · ` : ''}${session.mode === 'real' ? 'Real interview' : 'Practice'}${session.temperamentLabel ? ` · ${session.temperamentLabel.toLowerCase()} board` : ''} · ${s.minutes ?? session.durationMinutes} min${s.pauses ? ` · paused ${s.pauses}×` : ''}`}
        title="Your interview report"
        actions={
          <>
            <ActionButton size="sm" icon="download" onClick={() => downloadPdf(session)}>Download PDF</ActionButton>
            <ActionButton size="sm" tone="primary" icon="mic" onClick={() => go({ screen: 'setup' })}>Interview again</ActionButton>
          </>
        }
      />

      <div className="grid md:grid-cols-[260px_1fr] gap-5 mb-6">
        <Panel className="p-6 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-tertiary">Overall</p>
          {r.overall != null ? (
            <p className="mt-2"><span className="text-6xl font-bold text-text-primary tabular-nums">{r.overall.toFixed(1)}</span><span className="text-xl text-text-tertiary"> / 10</span></p>
          ) : (
            <>
              <p className="mt-3 text-4xl font-bold text-text-tertiary">—</p>
              <p className="text-xs text-text-tertiary mt-2 leading-relaxed">Scores appear once AI feedback is switched on.</p>
            </>
          )}
        </Panel>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatTile icon="message" label="Answered" value={`${s.answered ?? 0} / ${s.questions ?? 0}`} hint={s.skipped ? `${s.skipped} passed` : 'none passed'} />
          <StatTile icon="list" label="Avg. answer" value={`${s.avgWords ?? 0} words`} hint="45–90 seconds is ideal" />
          <StatTile icon="clock" label="Avg. time" value={s.avgSeconds ? formatClock(s.avgSeconds) : '—'} hint="per answer" />
          <StatTile icon="repeat" label="Follow-ups" value={s.followUps ?? 0} hint="the board probed further" />
          <StatTile icon="mic" label="Spoken" value={s.voiceAnswers ?? 0} hint="answers given by voice" />
          <StatTile icon="users" label="Members" value={Object.keys(s.byAsker || {}).length} hint="of the board asked you" />
        </div>
      </div>

      {r.marks?.members?.length > 0 && <BoardMarks marks={r.marks} />}
      {r.presence && <PresencePanel p={r.presence} />}

      {r.summary && (
        <Panel className="p-5 md:p-6 mb-6">
          <p className="text-[15px] text-text-secondary leading-relaxed">{r.summary}</p>
        </Panel>
      )}

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-5 mb-6">
        <Panel className="p-5 md:p-6">
          <h2 className="text-lg font-bold text-text-primary">The qualities the board assesses</h2>
          <p className="text-sm text-text-tertiary mt-1 mb-5">As listed by UPSC for the Personality Test.</p>
          <ul className="space-y-4">{(r.traits || []).map((t) => <TraitRow key={t.key} t={t} />)}</ul>
        </Panel>
        <div className="grid gap-5">
          <List title="What went well" icon="check" items={r.strengths} empty="—" />
          <List title="To work on" icon="target" items={r.improvements} empty={ai ? '—' : 'Detailed suggestions appear once AI feedback is switched on.'} />
          <List title="DAF areas to prepare" icon="edit" items={r.dafGaps} empty="No gaps flagged." />
        </div>
      </div>

      <h2 className="text-lg font-bold text-text-primary mb-3">Question by question</h2>
      <ol className="space-y-3">
        {answered.map((t, i) => (
          <li key={t.idx}>
            <Panel className="p-5" as="article">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-sunken text-xs font-bold text-text-secondary flex items-center justify-center">{i + 1}</span>
                  <AskerTag asker={t.asker} />
                </div>
                {t.feedback?.score != null && <span className="rounded-full bg-accent-soft-bg border border-accent-soft-border text-brand px-3 py-0.5 text-sm font-bold">{t.feedback.score.toFixed(1)} / 10</span>}
              </div>
              <p className="font-display text-lg text-text-primary mt-3 leading-snug">{t.question}</p>
              <SourceChip source={t.source} className="mt-2" />
              <div className="mt-4 rounded-2xl bg-sunken/70 border border-border-subtle px-4 py-3">
                <p className="text-xs font-bold text-text-tertiary mb-1 flex items-center gap-1.5">
                  <Icon name={t.answerMode === 'voice' ? 'mic' : 'keyboard'} className="w-3.5 h-3.5" /> Your answer
                  {!t.skipped && <span className="font-normal">· {wordCount(t.answer)} words{t.answerSeconds ? ` · ${formatClock(t.answerSeconds)}` : ''}</span>}
                </p>
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{t.skipped ? <span className="italic text-text-tertiary">Passed</span> : t.answer}</p>
              </div>
              {t.reaction?.text && (
                <p className="mt-3 text-sm text-text-secondary">
                  <span className="font-semibold text-text-primary">{ASKER_LABEL[t.asker]} said:</span> <span className="italic">“{t.reaction.text}”</span>
                  {t.reaction.mood && t.reaction.mood !== 'neutral' && <span className="ml-2 rounded-full bg-sunken border border-border-subtle px-2 py-0.5 text-[11px] font-semibold text-text-tertiary not-italic">{MOOD_LABEL[t.reaction.mood]}</span>}
                </p>
              )}
              {t.interrupted && <p className="mt-2 text-xs font-semibold text-status-warning-text">The board cut this answer short.</p>}
              {t.feedback && (
                <div className="mt-3 space-y-2">
                  {t.feedback.verdict && <p className="text-sm text-text-secondary leading-relaxed">{t.feedback.verdict}</p>}
                  {t.feedback.improve?.length > 0 && <ul className="space-y-1">{t.feedback.improve.map((s2, j) => <li key={j} className="text-sm text-text-secondary flex gap-2"><Icon name="arrowRight" className="w-4 h-4 mt-0.5 text-brand shrink-0" />{s2}</li>)}</ul>}
                  {t.feedback.betterAnswer && <p className="text-sm text-text-secondary leading-relaxed border-l-2 border-accent-soft-border pl-3"><span className="font-semibold text-text-primary">A stronger answer: </span>{t.feedback.betterAnswer}</p>}
                  {t.feedback.pastNote && <p className="text-xs text-text-tertiary leading-relaxed"><Icon name="quote" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{t.feedback.pastNote}</p>}
                </div>
              )}
            </Panel>
          </li>
        ))}
      </ol>
      {answered.length === 0 && <p className="text-sm text-text-tertiary">No questions were answered in this interview.</p>}
    </Shell>
  );
}
