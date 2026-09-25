import { useEffect, useState } from "react";

const ROWS = 14;
const PER_ROW = 8;
const DRIFT_MS = 20000;

// Faint tiled "name · email · phone" over the whole student portal - PDFs, iframes and
// modals included - so any screenshot or screen recording names the account it came
// from. It drifts every DRIFT_MS so a leak can't be cleaned by cropping a fixed spot,
// and it ignores the pointer so nothing underneath stops working. Mid-grey rather than a
// theme token: in dark mode it still has to show over white PDF pages.
export default function SessionWatermark({ user }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const id = setInterval(() => {
      setOffset({ x: Math.round(Math.random() * 240 - 120), y: Math.round(Math.random() * 120 - 60) });
    }, DRIFT_MS);
    return () => clearInterval(id);
  }, []);

  const label = [
    user.fullName || user.name,
    user.email,
    user.mobileNumber,
    new Date().toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }),
  ].filter(Boolean).join("  ·  ");

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[9999] pointer-events-none select-none overflow-hidden print:block"
    >
      <div
        className="absolute -inset-1/2 flex flex-col justify-around transition-transform duration-[3000ms] ease-in-out"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) rotate(-24deg)` }}
      >
        {Array.from({ length: ROWS }, (_, row) => (
          <div
            key={row}
            className="flex gap-24 whitespace-nowrap text-sm font-sans font-semibold text-[#808080] opacity-[0.16]"
            style={{ marginLeft: row % 2 ? "-12rem" : 0 }}
          >
            {Array.from({ length: PER_ROW }, (_, i) => <span key={i}>{label}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}
