// Big, impossible-to-miss switch between the Prelims, Mains and Interview (Personality Test) tracks. Only
// one track's content is shown at a time - this is the control that decides which.
const optionClass = (active) =>
  `flex-1 px-3 sm:px-8 py-4 sm:py-5 rounded-xl text-sm sm:text-xl whitespace-nowrap font-display font-bold tracking-tight transition-all duration-200 cursor-pointer ${
    active
      ? 'bg-brand text-text-on-accent shadow-lg scale-[1.02]'
      : 'text-text-secondary hover:text-text-primary hover:bg-surface'
  }`;

export default function ExamStageToggle({ value, onChange }) {
  return (
    <div className="mb-10 md:mb-14 flex justify-center">
      <div
        role="tablist"
        aria-label="Exam stage"
        className="w-full sm:w-auto inline-flex gap-2 bg-sunken border-2 border-border-default p-2 rounded-2xl shadow-inner"
      >
        {[['Prelims', 'Prelims'], ['Mains', 'Mains'], ['Interview', 'Interview (PT)']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={value === key}
            title={`Click to see ${label}`}
            onClick={() => onChange(key)}
            className={optionClass(value === key)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
