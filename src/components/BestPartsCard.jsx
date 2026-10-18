import { useEffect, useState } from 'react';

// "Best part of the answer" — admin-cropped highlights from the toppers' copies for one
// question (see AdminToppersBestParts.jsx). Shown at the top of the answer view's analysis
// panel; tap an image to see it full size.

const imageUrl = (id) =>
  `/api/toppers-copy/best-parts/${id}/image?token=${encodeURIComponent(localStorage.getItem('token') || '')}`;

export default function BestPartsCard({ parts, onOpenTopper }) {
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    if (!zoom) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setZoom(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  if (!parts?.length) return null;

  return (
    <section className="mb-5 rounded-2xl border border-accent-soft-border bg-accent-soft-bg/50 p-3">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand mb-2">📸 Best part of the answer</p>
      <div className="space-y-3">
        {parts.map((p) => (
          <figure key={p._id} className="rounded-xl overflow-hidden border border-border-default bg-surface">
            <button onClick={() => setZoom(p)} className="block w-full bg-white cursor-zoom-in" title="Tap to enlarge">
              <img
                src={imageUrl(p._id)}
                alt={p.caption || `Best part — ${p.topperName}`}
                className="w-full h-auto max-h-96 object-contain"
                loading="lazy"
                draggable={false}
              />
            </button>
            <figcaption className="px-3 py-2 space-y-0.5">
              {p.caption && <p className="text-[13px] text-text-primary leading-snug">{p.caption}</p>}
              <p className="text-[11px] text-text-tertiary">
                {p.topperName ? (
                  onOpenTopper ? (
                    <button className="font-semibold text-brand hover:underline cursor-pointer" onClick={() => onOpenTopper(p)}>
                      {p.topperName}
                    </button>
                  ) : <span className="font-semibold">{p.topperName}</span>
                ) : null}
                {p.topperName ? ' · ' : ''}page {p.page}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4" onClick={() => setZoom(null)}>
          <figure className="max-w-5xl w-full max-h-full overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img src={imageUrl(zoom._id)} alt={zoom.caption || 'Best part'} className="w-full h-auto bg-white rounded-lg" draggable={false} />
            {zoom.caption && <figcaption className="mt-2 text-sm text-white/90 text-center">{zoom.caption}</figcaption>}
          </figure>
          <button className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 text-white text-lg cursor-pointer" onClick={() => setZoom(null)} aria-label="Close">✕</button>
        </div>
      )}
    </section>
  );
}
