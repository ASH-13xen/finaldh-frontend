// A QR code as an SVG image (sharp at any print size), drawn in the browser by the qrcode library.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QR({ value, size = 96, dark = '#14110d', light = '#ffffff', className = '' }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark, light } })
      .then((svg) => { if (!cancelled) setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [value, dark, light]);
  if (!src) return <span className={`inline-block ${className}`} style={{ width: size, height: size }} aria-hidden="true" />;
  return <img src={src} width={size} height={size} alt="" className={className} />;
}
