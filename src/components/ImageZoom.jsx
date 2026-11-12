import { useEffect } from 'react';
import { createPortal } from 'react-dom';

// Full-size image over the whole page (portal: the value addition reader sits in its own stacking context).
export default function ImageZoom({ src, caption, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <figure className="max-w-5xl w-full max-h-full overflow-auto" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={caption || 'Enlarged image'} className="w-full h-auto bg-white rounded-lg" draggable={false} />
        {caption && <figcaption className="mt-2 text-sm text-white/90 text-center">{caption}</figcaption>}
      </figure>
      <button className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 text-white text-lg cursor-pointer" onClick={onClose} aria-label="Close">✕</button>
    </div>,
    document.body,
  );
}
