// Shared by Predicted Questions and Practice Studio: how a DAF item (a group of predictions) is named, and the
// order the tiers are ranked in.
export const TIERS = ['certain', 'likely', 'worth'];
export const TIER_ORDER = { certain: 0, likely: 1, worth: 2 };

export const groupTitle = (t, g) => {
  if (g.type === 'intro' || g.type === 'motivation') return t(`area.${g.type}`);
  if (g.type === 'education' && !g.isCollege) return g.label;
  if (g.type === 'work') return g.label;
  return g.value || g.label;
};

// Most likely first, then the most often asked.
export const byLikelihood = (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || (b.evidence?.timesAsked || 0) - (a.evidence?.timesAsked || 0);
