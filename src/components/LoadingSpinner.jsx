export default function LoadingSpinner({ text }) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
      {text && <p className="mt-4 text-sm font-medium tracking-wide text-slate-500 animate-pulse">{text}</p>}
    </div>
  );
}
