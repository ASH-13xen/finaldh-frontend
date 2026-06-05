export default function StatusBadge({ type, text }) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    info: 'bg-blue-50 text-blue-700 border-blue-100',
  };
  return (
    <span className={`px-2 py-0.5 border rounded-full font-semibold ${styles[type] || ''}`}>
      {text}
    </span>
  );
}
