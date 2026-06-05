export default function Button({ onClick, children, variant = 'primary' }) {
  const baseStyle = 'w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold tracking-wide shadow-sm hover:shadow transition-all duration-200 cursor-pointer';
  const variants = {
    primary: 'bg-slate-900 hover:bg-slate-800 text-white',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white',
  };
  return (
    <button onClick={onClick} className={`${baseStyle} ${variants[variant]}`}>
      {children}
    </button>
  );
}
