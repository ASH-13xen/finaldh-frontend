// A current topic in the list: category, title, why it's in the news, its questions, and who it's for.
// `big` is the lead story at the top of the list.
import Icon from '../../../components/mcq/Icon';
import { useT } from '../../lib/i18n';
import { toneOf, noteDate } from '../../lib/notes';

export default function NoteCard({ note, onOpen, big = false, className = '' }) {
  const { t, lang } = useT();
  const tone = toneOf(note.category);
  return (
    <button
      type="button"
      data-reveal
      onClick={() => onOpen(note.slug)}
      className={`prep-focus prep-card prep-card-hover group relative overflow-hidden w-full h-full text-left flex flex-col cursor-pointer ${big ? 'p-7 md:p-12 gap-5' : 'p-6 md:p-7 gap-4'} ${className}`}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: tone }} aria-hidden="true" />
      {big && (
        <span className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(45% 70% at 100% 0%, ${tone}1f, transparent 70%)` }} aria-hidden="true" />
      )}
      {big && (
        <span className="absolute right-8 top-8 hidden md:inline-flex items-center gap-2 rounded-full bg-text-primary text-page text-xs font-bold px-3.5 py-1.5" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{t('nt.latest')}
        </span>
      )}
      <div className="relative flex items-center justify-between gap-3">
        <span className="prep-eyebrow flex items-center gap-2" style={{ color: tone }}>
          <span className="w-2 h-2 rounded-full" style={{ background: tone }} aria-hidden="true" />
          {t(`cat.${note.category}`)}
        </span>
        <span className="text-xs text-text-tertiary whitespace-nowrap">{noteDate(note.date, lang)}</span>
      </div>
      <h3 className={`relative font-display font-semibold tracking-tight text-text-primary ${big ? 'text-[2rem] leading-[1.08] md:text-5xl md:leading-[1.04] max-w-3xl' : 'text-2xl leading-tight'}`}>
        {note.title}
      </h3>
      {note.why && <p className={`relative text-text-secondary leading-relaxed ${big ? 'text-lg md:text-xl max-w-3xl' : 'text-[15px] line-clamp-3'}`}>{note.why}</p>}
      <div className="relative mt-auto pt-2 flex flex-wrap items-center gap-2">
        {note.forYou && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand text-text-on-accent text-xs font-bold px-3 py-1.5">
            <Icon name="star" className="w-3.5 h-3.5" />{t('nt.forYou')}
          </span>
        )}
        <span className="text-sm font-semibold text-text-secondary">{t('nt.questionsN', { n: note.questions })}</span>
        {(note.likelyFor || []).slice(0, big ? 3 : 1).map((x) => (
          <span key={x} className="text-xs rounded-full border border-border-default px-2.5 py-1 text-text-tertiary">{x}</span>
        ))}
        <span className="ml-auto w-11 h-11 rounded-full border border-border-default flex items-center justify-center text-text-secondary group-hover:bg-text-primary group-hover:text-page group-hover:border-text-primary transition-colors duration-300" aria-hidden="true">
          <Icon name="arrowRight" className="w-5 h-5 -rotate-45 group-hover:rotate-0 transition-transform duration-500" />
        </span>
      </div>
    </button>
  );
}
