// Shared helper for the per-question AI-analysis diagram (aiAnalysis.diagram).
// Kept out of the component file so React Fast Refresh stays happy.

// Does this diagram spec carry enough to actually draw something for its kind?
export function diagramIsRenderable(d) {
  if (!d) return false;
  switch (d.kind) {
    case 'table':
      return (d.columns?.length || 0) >= 2 && (d.rows?.length || 0) >= 1;
    case 'chart':
      return (d.series || []).some((s) => (s.points || []).some((p) => p.label));
    case 'quadrant':
      return (d.quadrantItems?.length || 0) >= 1;
    case 'pyramid':
      return (d.levels?.length || 0) >= 2;
    case 'timeline':
      return (d.events?.length || 0) >= 2;
    default: // flow
      return (d.nodes?.length || 0) >= 2;
  }
}
