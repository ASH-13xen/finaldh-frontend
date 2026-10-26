import AnswerDiagram from './AnswerDiagram';
import { diagramIsRenderable } from '../lib/answerDiagram';

// Renders a ToppersPyq.pyqAnswer (the AI-written, admin-edited house-style model
// answer): opening line -> numbered headed sections of "claim — Eg: example"
// bullets -> closing line -> optional quote -> admin images -> diagram.
// `pyqId` is needed to build image URLs. Read-only.

export default function PyqAnswerView({ answer, pyqId }) {
  if (!answer) return null;
  const token = (() => { try { return localStorage.getItem('token') || ''; } catch { return ''; } })();
  const imgUrl = (id) => `/api/toppers-copy/pyqs/${pyqId}/answer/image/${id}?token=${encodeURIComponent(token)}`;
  const sections = answer.sections || [];
  const images = answer.images || [];
  const isFromBook = answer.source === 'pdf';
  // A book answer that hasn't been through the reformat pass yet (or where it
  // failed) has no sections — fall back to the raw text rather than show nothing.
  const showRawFallback = isFromBook && sections.length === 0;

  return (
    <div className="font-reading space-y-3 text-sm leading-relaxed">
      {showRawFallback ? (
        <div className="space-y-2">
          {answer.rawText.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="whitespace-pre-line text-text-secondary">{para}</p>
          ))}
        </div>
      ) : (
        <>
          {answer.openingLine && (
            <p className="text-text-primary font-medium border-l-2 border-brand/50 pl-2.5">{answer.openingLine}</p>
          )}

          {sections.map((s, i) => (
            <div key={i} className="space-y-1">
              <p className="font-bold text-text-primary">{i + 1}. {s.heading}</p>
              <ul className="space-y-1 pl-1">
                {(s.points || []).map((p, j) => (
                  <li key={j} className="flex gap-1.5 text-text-secondary">
                    <span className="text-brand font-bold flex-shrink-0">•</span>
                    <span>
                      <span className="text-text-primary">{p.claim}</span>
                      {p.example ? <span className="text-text-tertiary"> — Eg: {p.example}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {answer.closingLine && (
            <p className="text-text-primary font-medium">{answer.closingLine}</p>
          )}

          {answer.quote && (
            <p className="text-xs text-brand italic border-l-2 border-brand/40 pl-2">“{answer.quote}”</p>
          )}
        </>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {images.map((im) => (
            <figure key={im.id} className="space-y-0.5">
              <img
                src={imgUrl(im.id)}
                alt={im.caption || 'illustration'}
                loading="lazy"
                className="w-full rounded-lg border border-border-default bg-surface"
              />
              {im.caption ? <figcaption className="text-[11px] text-text-tertiary">{im.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      )}

      {diagramIsRenderable(answer.diagram) && (
        <div className="pt-1">
          {answer.diagram.title ? (
            <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1">
              Diagram — {answer.diagram.title}
            </p>
          ) : null}
          <div className="bg-surface border border-border-default rounded-lg p-2.5">
            <AnswerDiagram diagram={answer.diagram} />
          </div>
          {answer.diagram.howToDraw ? (
            <p className="text-[11px] text-text-tertiary mt-1">{answer.diagram.howToDraw}</p>
          ) : null}
        </div>
      )}

      {isFromBook ? (
        <p className="text-[11px] text-text-tertiary pt-1.5 border-t border-border-default">
          From the official model-answer book{answer.editedAt ? ', admin-edited' : ''}
        </p>
      ) : sections.length > 0 && answer.aiModel && (
        <p className="text-[11px] text-text-tertiary pt-1.5 border-t border-border-default">
          AI-generated model answer{answer.editedAt ? ', admin-edited' : ''} · {answer.aiModel}
        </p>
      )}
    </div>
  );
}
