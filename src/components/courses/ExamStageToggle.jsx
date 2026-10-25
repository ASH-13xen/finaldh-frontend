// Big, impossible-to-miss switch between the Prelims and Mains course tracks. Only one
// track's content is shown at a time - this is the control that decides which.
const optionClass = (active) =>
  `flex-1 px-6 sm:px-10 py-4 sm:py-5 rounded-xl text-base sm:text-xl font-display font-bold tracking-tight transition-all duration-200 cursor-pointer ${
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
        <button
          type="button"
          role="tab"
          aria-selected={value === 'Prelims'}
          title="Click to see Prelims courses"
          onClick={() => onChange('Prelims')}
          className={optionClass(value === 'Prelims')}
        >
          Prelims
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={value === 'Mains'}
          title="Click to see Mains courses"
          onClick={() => onChange('Mains')}
          className={optionClass(value === 'Mains')}
        >
          Mains
        </button>
      </div>
    </div>
  );
}
