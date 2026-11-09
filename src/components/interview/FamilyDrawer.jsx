import { useEffect, useState } from 'react';
import Icon from '../mcq/Icon';
import { Chip } from '../mcq/ui';
import { iv, errorMessage, cseLabel, ASKER_LABEL } from '../../lib/interviewApi';
import { AskerTag, Skeleton, TimesAsked, YearBars } from './ui';

// Everything behind one question: every interview it was asked in (year, board, who asked, what kind
// of candidate), what the candidate said, how the board followed up, and similar questions.
// Render with key={familyId} so opening another question starts fresh.
export default function FamilyDrawer({ familyId, onClose, onPractice }) {
  const [stack, setStack] = useState([familyId]);
  const current = stack[stack.length - 1];
  const [loaded, setLoaded] = useState({ id: null, data: null, error: '' });
  const [transcriptId, setTranscriptId] = useState(null);
  const data = loaded.id === current ? loaded.data : null;
  const error = loaded.id === current ? loaded.error : '';

  useEffect(() => {
    if (!current) return undefined;
    let cancelled = false;
    iv(`/bank/families/${current}`)
      .then((d) => { if (!cancelled) setLoaded({ id: current, data: d, error: '' }); })
      .catch((err) => { if (!cancelled) setLoaded({ id: current, data: null, error: errorMessage(err) }); });
    return () => { cancelled = true; };
  }, [current]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') (transcriptId ? setTranscriptId(null) : onClose()); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, transcriptId]);

  if (!familyId) return null;
  const f = data?.family;

  return (
    <div className="fixed inset-0 z-[110] flex justify-end bg-black/40 backdrop-blur-[2px]" onClick={onClose} role="dialog" aria-modal="true" aria-label="Question details">
      <aside className="h-full w-full max-w-xl bg-page border-l border-border-default shadow-2xl flex flex-col iv-rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            {stack.length > 1 && (
              <button onClick={() => setStack((s) => s.slice(0, -1))} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-raised cursor-pointer" aria-label="Back">
                <Icon name="arrowLeft" className="w-5 h-5" />
              </button>
            )}
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-text-tertiary">Past question</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-raised cursor-pointer" aria-label="Close">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {error && <p className="text-sm text-status-danger-text">{error}</p>}
          {!data && !error && (
            <div className="space-y-3">
              <Skeleton className="h-8 w-4/5" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
          {f && (
            <>
              <h2 className="font-display text-2xl font-semibold text-text-primary leading-snug">{f.text}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <TimesAsked n={f.timesAsked} years={f.years} />
                <YearBars yearCounts={f.yearCounts} />
                {f.topicLabels?.map((t) => <Chip key={t}>{t}</Chip>)}
                {f.shelfLife === 'event' && <Chip tone="warning">Tied to news of its year</Chip>}
              </div>
              {f.boards?.filter(Boolean).length > 0 && (
                <p className="text-sm text-text-tertiary mt-3">
                  Boards: <span className="text-text-secondary font-medium">{f.boards.filter(Boolean).join(', ')}</span>
                </p>
              )}
              {onPractice && (
                <button onClick={() => onPractice(f)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-hover text-text-on-accent px-4 py-2 text-sm font-bold cursor-pointer">
                  <Icon name="mic" className="w-4 h-4" /> Practise answering this
                </button>
              )}

              <h3 className="text-sm font-bold text-text-primary mt-7 mb-3">Asked in {data.asked.length} interview{data.asked.length === 1 ? '' : 's'}</h3>
              <ol className="space-y-3">
                {data.asked.map((a) => (
                  <li key={a.id} className="rounded-2xl border border-border-default bg-surface p-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="font-bold text-text-primary">{cseLabel(a.year)}</span>
                      {a.board && <span className="text-text-secondary">{a.board} board</span>}
                      <AskerTag asker={a.asker} />
                    </div>
                    {a.text !== f.text && <p className="text-sm text-text-primary mt-2 leading-relaxed">“{a.text}”</p>}
                    {a.originalText && <p className="text-xs text-text-tertiary mt-1 italic">Originally: {a.originalText}</p>}
                    {a.candidate && <p className="text-xs text-text-tertiary mt-2"><Icon name="user" className="w-3 h-3 inline -mt-0.5 mr-1" />{a.candidate}</p>}
                    {a.note && (
                      <p className="text-sm text-text-secondary mt-2 leading-relaxed border-l-2 border-accent-soft-border pl-3">
                        <span className="font-semibold">The candidate wrote:</span> {a.note}
                      </p>
                    )}
                    {a.followedBy && (
                      <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                        <Icon name="repeat" className="w-3.5 h-3.5 inline -mt-0.5 mr-1 text-brand" />
                        <span className="font-semibold">{ASKER_LABEL[a.asker] || 'The board'} followed up:</span> {a.followedBy}
                      </p>
                    )}
                    <button onClick={() => setTranscriptId(a.transcriptId)} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline cursor-pointer">
                      Read the whole interview <Icon name="arrowRight" className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ol>

              {data.related?.length > 0 && (
                <>
                  <h3 className="text-sm font-bold text-text-primary mt-7 mb-3">Similar questions</h3>
                  <ul className="space-y-2">
                    {data.related.map((r) => (
                      <li key={r.id}>
                        <button onClick={() => setStack((s) => [...s, r.id])} className="w-full text-left rounded-xl border border-border-subtle bg-surface hover:border-brand px-3.5 py-2.5 cursor-pointer group">
                          <span className="text-sm text-text-primary group-hover:text-brand">{r.text}</span>
                          <span className="block mt-1"><TimesAsked n={r.timesAsked} years={r.years} /></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </aside>
      {transcriptId && <TranscriptModal id={transcriptId} onClose={() => setTranscriptId(null)} highlight={current} />}
    </div>
  );
}

export function TranscriptModal({ id, onClose, highlight }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    iv(`/bank/transcripts/${id}`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); });
    return () => { cancelled = true; };
  }, [id]);

  const t = data?.transcript;
  const c = t?.candidate || {};
  const facts = [c.optional && `${c.optional} optional`, c.homeState, ...(c.education || []).slice(0, 1), ...(c.hobbies || []).slice(0, 3), ...(!c.hobbies?.length ? (c.keywords || []).slice(0, 5) : [])].filter(Boolean);

  // Group consecutive questions by who asked them, like the transcripts themselves.
  const blocks = [];
  for (const q of data?.questions || []) {
    const last = blocks[blocks.length - 1];
    if (last && last.asker === q.asker) last.items.push(q);
    else blocks.push({ asker: q.asker, items: [q] });
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-6" onClick={(e) => { e.stopPropagation(); onClose(); }} role="dialog" aria-modal="true" aria-label="Interview transcript">
      <div className="bg-page border border-border-default rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl iv-rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border-subtle">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-tertiary">Interview transcript</p>
            {t && <h2 className="text-xl font-display font-semibold text-text-primary mt-1">{cseLabel(t.year)}{t.board ? ` · ${t.board} board` : ''}{t.session ? ` · ${t.session}` : ''}</h2>}
            {facts.length > 0 && <p className="text-sm text-text-tertiary mt-1">{facts.join(' · ')}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-raised cursor-pointer" aria-label="Close">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">
          {error && <p className="text-sm text-status-danger-text">{error}</p>}
          {!data && !error && <div className="space-y-3"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>}
          {blocks.map((b, i) => (
            <div key={i} className="mb-5">
              <AskerTag asker={b.asker} className="mb-2" />
              <ol className="space-y-2">
                {b.items.map((q) => (
                  <li key={q.id} className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${q.familyId && q.familyId === highlight ? 'bg-accent-soft-bg border border-accent-soft-border' : 'bg-surface border border-border-subtle'}`}>
                    <span className="text-text-primary">{q.followUp && <span className="text-brand font-semibold">↳ </span>}{q.text}</span>
                    {q.note && <span className="block text-xs text-text-tertiary mt-1">Candidate: {q.note}</span>}
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {t?.experience && (
            <div className="rounded-2xl border border-dashed border-border-default p-4 text-sm text-text-secondary leading-relaxed">
              <span className="font-semibold text-text-primary">The candidate’s experience: </span>{t.experience}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
