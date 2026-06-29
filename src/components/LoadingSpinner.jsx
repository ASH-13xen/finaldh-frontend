export default function LoadingSpinner({ text }) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-4 border-border-subtle border-t-brand rounded-full animate-spin"></div>
      {text && (
        <p className="mt-4 text-[11px] font-sans font-bold uppercase tracking-widest text-text-tertiary animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}
