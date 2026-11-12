import AnswerDiagram from './AnswerDiagram';
import { diagramIsRenderable } from '../lib/answerDiagram';
import { parseRawAnswer } from '../lib/pyqRawAnswer';

// Renders a ToppersPyq.pyqAnswer (the AI-written, admin-edited house-style model
// answer): opening line -> numbered headed sections of "claim — Eg: example"
// bullets -> closing line -> optional quote -> admin images -> diagram.
// `pyqId` is needed to build image URLs. Read-only.

const SECTION_TONES = ['fact', 'data', 'case', 'diagram'];
const CARD = 'p-3 bg-[var(--va-tint)] border border-border-default border-l-4 border-l-[var(--va-ink)] rounded-xl';

export default function PyqAnswerView({ answer, pyqId }) {
  if (!answer) return null;
  const token = (() => { try { return localStorage.getItem('token') || ''; } catch { return ''; } })();
  const imgUrl = (id) => `/api/toppers-copy/pyqs/${pyqId}/answer/image/${id}?token=${encodeURIComponent(token)}`;
  const isFromBook = answer.source === 'pdf';
  // A book answer that hasn't been through the reformat pass yet (or where it
  // failed) has no sections: recover them from the text, or show it as it is.
  const parsed = isFromBook && !answer.sections?.length ? parseRawAnswer(answer.rawText) : null;
  const { openingLine, closingLine } = parsed || answer;
  const sections = parsed?.sections || answer.sections || [];
  const images = answer.images || [];
  const showRawFallback = isFromBook && sections.length === 0;

  return (
    <div className="font-reading space-y-4 text-[18px] leading-relaxed">
      {showRawFallback ? (
        <div className="space-y-3">
          {(answer.rawText || '').split(/\n{2,}/).map((para, i) => (
            <p key={i} className={`va-tone-intro ${CARD} whitespace-pre-line text-text-primary`}>{para}</p>
          ))}
        </div>
      ) : (
        <>
          {openingLine && (
            <p className={`va-tone-intro ${CARD} text-text-primary font-medium`}>{openingLine}</p>
          )}

          {sections.map((s, i) => (
            <div key={i} className={`va-tone-${SECTION_TONES[i % SECTION_TONES.length]} ${CARD} space-y-1.5`}>
              {s.heading ? <p className="font-bold text-[var(--va-ink)]">{sections.slice(0, i + 1).filter((x) => x.heading).length}. {s.heading}</p> : null}
              <ul className="space-y-1.5">
                {(s.points || []).map((p, j) => (
                  <li key={j} className="flex gap-1.5 text-text-primary">
                    <span className="text-[var(--va-ink)] font-bold flex-shrink-0">•</span>
                    <span>
                      <span>{p.claim}</span>
                      {p.example ? <span className="va-tone-example font-hand text-[21px] text-[var(--va-ink)]"> — Eg: {p.example}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {closingLine && (
            <p className={`va-tone-conclusion ${CARD} text-text-primary font-medium`}>{closingLine}</p>
          )}

          {answer.quote && (
            <p className={`va-tone-quote ${CARD} font-hand text-[21px] text-[var(--va-ink)]`}>“{answer.quote}”</p>
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
              {im.caption ? <figcaption className="text-[13px] text-text-tertiary">{im.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      )}

      {diagramIsRenderable(answer.diagram) && (
        <div className="va-tone-diagram pt-1">
          {answer.diagram.title ? (
            <p className="text-sm font-bold text-[var(--va-ink)] uppercase tracking-wider mb-1.5">
              Diagram — {answer.diagram.title}
            </p>
          ) : null}
          <div className="bg-surface border border-border-default rounded-lg p-2.5">
            <AnswerDiagram diagram={answer.diagram} />
          </div>
          {answer.diagram.howToDraw ? (
            <p className="text-base text-text-secondary mt-1.5">{answer.diagram.howToDraw}</p>
          ) : null}
        </div>
      )}

      {isFromBook ? (
        <p className="text-[13px] text-text-tertiary pt-1.5 border-t border-border-default">
          From the official model-answer book{answer.editedAt ? ', admin-edited' : ''}
        </p>
      ) : sections.length > 0 && answer.aiModel && (
        <p className="text-[13px] text-text-tertiary pt-1.5 border-t border-border-default">
          AI-generated model answer{answer.editedAt ? ', admin-edited' : ''} · {answer.aiModel}
        </p>
      )}
    </div>
  );
}
