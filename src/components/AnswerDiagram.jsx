import { useId, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

// Renders aiAnalysis.diagram — one small, hand-drawable visual per question.
// The `kind` field picks the form; only that kind's fields are populated:
//   flow      -> SVG boxes / circles / pills / diamonds + arrows (dependency-free)
//   table     -> comparison matrix
//   chart     -> bar / pie / line (recharts), real numbers only, with a source
//   quadrant  -> 2x2 positioning on two named axes
//   pyramid   -> stacked hierarchy, narrow top to wide base
//   timeline  -> ordered events
// Returns null when the chosen kind has nothing usable (caller shows howToDraw
// text + keyword chips + any legacy mermaid).

// Validated categorical order (see dataviz skill): green, red, indigo, amber, then grays.
const CAT = [
  'var(--color-brand)',
  'var(--color-status-danger-text)',
  'var(--color-status-info-text)',
  'var(--color-status-warning-text)',
  'var(--color-text-secondary)',
  'var(--color-text-tertiary)',
];

// ===========================================================================
// flow — self-contained SVG graph
// ===========================================================================
const CHAR_W = 7.4;
const PAD_X = 14;
const PAD_Y = 10;
const LINE_H = 16;
const MAX_LINE_CHARS = 16;
const NODE_GAP = 30;
const LAYER_GAP = 66;
const MARGIN = 24;

function wrapLabel(label) {
  const words = String(label || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > MAX_LINE_CHARS && cur) { lines.push(cur); cur = w; } else { cur = next; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines.slice(0, 3) : [''];
}

function sizeFor(lines, shape) {
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  let w = Math.max(66, longest * CHAR_W + PAD_X * 2);
  let h = Math.max(42, lines.length * LINE_H + PAD_Y * 2);
  if (shape === 'circle') { const d = Math.max(w, h) * 1.06; w = d; h = d; }
  if (shape === 'diamond') { w *= 1.4; h *= 1.45; }
  return { w, h };
}

function layerize(nodes, edges) {
  const pos = new Map(nodes.map((n, i) => [n.id, i]));
  const adj = nodes.map(() => []);
  const indeg = nodes.map(() => 0);
  edges.forEach((e) => {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (a == null || b == null || a === b) return;
    adj[a].push(b);
    indeg[b] += 1;
  });
  const depth = nodes.map(() => 0);
  const ind = indeg.slice();
  const queue = [];
  nodes.forEach((_, i) => { if (ind[i] === 0) queue.push(i); });
  let seen = 0;
  while (queue.length) {
    const u = queue.shift();
    seen += 1;
    adj[u].forEach((v) => {
      depth[v] = Math.max(depth[v], depth[u] + 1);
      ind[v] -= 1;
      if (ind[v] === 0) queue.push(v);
    });
  }
  if (seen < nodes.length) nodes.forEach((_, i) => { depth[i] = i; });
  const layers = [];
  depth.forEach((d, i) => { (layers[d] = layers[d] || []).push(i); });
  return layers.filter(Boolean);
}

function anchor(n, tx, ty) {
  const ang = Math.atan2(ty - n.y, tx - n.x);
  return {
    x: n.x + (n.w / 2 + 2) * Math.cos(ang),
    y: n.y + (n.h / 2 + 2) * Math.sin(ang),
  };
}

function normalize(sized) {
  const minX = Math.min(...sized.map((n) => n.x - n.w / 2));
  const minY = Math.min(...sized.map((n) => n.y - n.h / 2));
  const maxX = Math.max(...sized.map((n) => n.x + n.w / 2));
  const maxY = Math.max(...sized.map((n) => n.y + n.h / 2));
  sized.forEach((n) => { n.x += MARGIN - minX; n.y += MARGIN - minY; });
  return { nodes: sized, width: maxX - minX + MARGIN * 2, height: maxY - minY + MARGIN * 2 };
}

function withSize(nodes) {
  return nodes.map((n) => {
    const lines = wrapLabel(n.label);
    return { ...n, lines, ...sizeFor(lines, n.shape) };
  });
}

function placeFlow(nodes, edges, horizontal) {
  const layers = layerize(nodes, edges);
  const sized = withSize(nodes);
  let along = 0;
  const layerAlong = layers.map((layer) => {
    const thick = Math.max(...layer.map((i) => (horizontal ? sized[i].w : sized[i].h)));
    const c = along + thick / 2;
    along += thick + LAYER_GAP;
    return c;
  });
  layers.forEach((layer, li) => {
    const sizes = layer.map((i) => (horizontal ? sized[i].h : sized[i].w));
    const total = sizes.reduce((a, b) => a + b, 0) + NODE_GAP * (layer.length - 1);
    let run = -total / 2;
    layer.forEach((i, k) => {
      const cross = run + sizes[k] / 2;
      run += sizes[k] + NODE_GAP;
      if (horizontal) { sized[i].x = layerAlong[li]; sized[i].y = cross; } else { sized[i].y = layerAlong[li]; sized[i].x = cross; }
    });
  });
  return normalize(sized);
}

function placeCycle(nodes, edges) {
  const sized = withSize(nodes);
  const N = sized.length;
  const maxR = Math.max(...sized.map((n) => Math.hypot(n.w, n.h) / 2));
  const R = Math.max(96, (maxR + 18) / Math.max(Math.sin(Math.PI / Math.max(N, 2)), 0.35));
  sized.forEach((n, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    n.x = Math.cos(a) * R;
    n.y = Math.sin(a) * R;
  });
  const useEdges = edges.length
    ? edges
    : sized.map((n, i) => ({ from: n.id, to: sized[(i + 1) % N].id, label: '' }));
  return { ...normalize(sized), curved: true, layoutEdges: useEdges };
}

function placeHub(nodes, edges) {
  const sized = withSize(nodes);
  const [hub, ...spokes] = sized;
  hub.x = 0;
  hub.y = 0;
  hub.isHub = true;
  const maxR = Math.max(...spokes.map((n) => Math.hypot(n.w, n.h) / 2), 40);
  const R = Math.max(120, (maxR + 24) / Math.max(Math.sin(Math.PI / Math.max(spokes.length, 2)), 0.4));
  spokes.forEach((n, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / spokes.length;
    n.x = Math.cos(a) * R;
    n.y = Math.sin(a) * R;
  });
  const useEdges = edges.length
    ? edges
    : spokes.map((n) => ({ from: hub.id, to: n.id, label: '' }));
  return { ...normalize(sized), layoutEdges: useEdges };
}

function NodeShape({ n }) {
  const stroke = n.isHub ? 'var(--accent)' : 'var(--border-default)';
  const fill = n.isHub ? 'var(--accent-soft-bg)' : 'var(--bg-sunken)';
  const common = { fill, stroke, strokeWidth: 1.6 };
  const { x, y, w, h } = n;
  let shape;
  if (n.shape === 'circle') {
    shape = <ellipse cx={x} cy={y} rx={w / 2} ry={h / 2} {...common} />;
  } else if (n.shape === 'diamond') {
    shape = <polygon points={`${x},${y - h / 2} ${x + w / 2},${y} ${x},${y + h / 2} ${x - w / 2},${y}`} {...common} />;
  } else {
    shape = <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={n.shape === 'pill' ? h / 2 : 7} {...common} />;
  }
  const startDy = -((n.lines.length - 1) * LINE_H) / 2 + 4;
  return (
    <g>
      {shape}
      <text x={x} y={y} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--text-primary)">
        {n.lines.map((line, i) => (
          <tspan key={i} x={x} dy={i === 0 ? startDy : LINE_H}>{line}</tspan>
        ))}
      </text>
    </g>
  );
}

function FlowDiagram({ diagram, uid }) {
  const model = useMemo(() => {
    const nodes = (diagram?.nodes || []).filter((n) => n.id && n.label).slice(0, 10);
    if (nodes.length < 2) return null;
    const ids = new Set(nodes.map((n) => n.id));
    const edges = (diagram?.edges || []).filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
    const layout = diagram?.layout || 'flow-vertical';
    if (layout === 'cycle') return { ...placeCycle(nodes, edges) };
    if (layout === 'hub-spoke') return { ...placeHub(nodes, edges) };
    return { ...placeFlow(nodes, edges, layout === 'flow-horizontal'), layoutEdges: edges };
  }, [diagram]);

  if (!model) return null;
  const { nodes, width, height, curved } = model;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges = (model.layoutEdges || []).filter((e) => byId[e.from] && byId[e.to]);

  return (
    <svg
      viewBox={`0 0 ${Math.round(width)} ${Math.round(height)}`}
      width={Math.round(width)}
      role="img"
      aria-label={diagram?.title || 'Answer diagram'}
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      <defs>
        <marker id={`arw-${uid}`} markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto-start-reverse">
          <path d="M0,0 L9,4.5 L0,9 z" fill="var(--text-tertiary)" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const a = byId[e.from];
        const b = byId[e.to];
        const p1 = anchor(a, b.x, b.y);
        const p2 = anchor(b, a.x, a.y);
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        let d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
        let lx = mx;
        let ly = my;
        if (curved) {
          const nx = -(p2.y - p1.y);
          const ny = p2.x - p1.x;
          const len = Math.hypot(nx, ny) || 1;
          const bow = 26;
          d = `M ${p1.x} ${p1.y} Q ${mx + (nx / len) * bow} ${my + (ny / len) * bow} ${p2.x} ${p2.y}`;
          lx = mx + (nx / len) * (bow / 2);
          ly = my + (ny / len) * (bow / 2);
        }
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="var(--text-tertiary)" strokeWidth="1.6" markerEnd={`url(#arw-${uid})`} />
            {e.label ? (
              <>
                <rect x={lx - e.label.length * 3.4 - 3} y={ly - 8} width={e.label.length * 6.8 + 6} height="15" rx="3" fill="var(--bg-surface)" />
                <text x={lx} y={ly + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--text-secondary)">{e.label}</text>
              </>
            ) : null}
          </g>
        );
      })}
      {nodes.map((n) => <NodeShape key={n.id} n={n} />)}
    </svg>
  );
}

// ===========================================================================
// table
// ===========================================================================
function TableDiagram({ diagram }) {
  const columns = (diagram.columns || []).map((c) => String(c));
  const rows = (diagram.rows || []).map((r) => (Array.isArray(r) ? r : r.cells || [])).filter((c) => c.length);
  if (columns.length < 2 || rows.length < 1) return null;
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th
              key={i}
              className={`border border-border-default bg-surface-raised px-2.5 py-1.5 font-bold text-text-primary ${i === 0 ? 'text-left' : 'text-left'}`}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, ri) => (
          <tr key={ri}>
            {columns.map((_, ci) => (
              <td
                key={ci}
                className={`border border-border-default px-2.5 py-1.5 align-top ${ci === 0 ? 'font-semibold text-text-primary bg-surface-raised/50' : 'text-text-secondary'}`}
              >
                {cells[ci] ?? ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ===========================================================================
// chart
// ===========================================================================
function ChartDiagram({ diagram }) {
  const series = (diagram.series || [])
    .map((s) => ({ label: String(s.label || ''), points: (s.points || []).filter((p) => p.label) }))
    .filter((s) => s.points.length);
  if (!series.length) return null;
  const type = ['bar', 'pie', 'line'].includes(diagram.chartType) ? diagram.chartType : 'bar';
  const multi = series.length > 1;

  // merge points across series by category label
  const cats = [];
  series.forEach((s) => s.points.forEach((p) => { if (!cats.includes(p.label)) cats.push(p.label); }));
  const merged = cats.map((label) => {
    const row = { label };
    series.forEach((s, i) => {
      const hit = s.points.find((p) => p.label === label);
      row[s.label || `s${i}`] = hit ? hit.value : 0;
    });
    return row;
  });

  const axis = { stroke: 'var(--color-text-tertiary)', fontSize: 10 };
  const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />;
  const tip = (
    <Tooltip
      contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-default)', borderRadius: 8, fontSize: 11 }}
      labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 700 }}
    />
  );

  let chart;
  if (type === 'pie') {
    const data = series[0].points.map((p) => ({ name: p.label, value: p.value }));
    chart = (
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(d) => d.name}>
          {data.map((d, i) => <Cell key={d.name} fill={CAT[i % CAT.length]} stroke="var(--color-surface)" strokeWidth={2} />)}
        </Pie>
        {tip}
      </PieChart>
    );
  } else if (type === 'line') {
    chart = (
      <LineChart data={merged} margin={{ top: 6, right: 14, bottom: 4, left: -14 }}>
        {grid}
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} />
        {tip}
        {multi && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s, i) => (
          <Line key={s.label || i} type="monotone" dataKey={s.label || `s${i}`} stroke={CAT[i % CAT.length]} strokeWidth={2} dot={{ r: 3 }} />
        ))}
      </LineChart>
    );
  } else {
    chart = (
      <BarChart data={merged} margin={{ top: 6, right: 14, bottom: 4, left: -14 }}>
        {grid}
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} />
        {tip}
        {multi && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s, i) => (
          <Bar key={s.label || i} dataKey={s.label || `s${i}`} fill={CAT[i % CAT.length]} radius={[4, 4, 0, 0]} maxBarSize={44}>
            {!multi && merged.map((_, ci) => <Cell key={ci} fill={CAT[ci % CAT.length]} />)}
          </Bar>
        ))}
      </BarChart>
    );
  }

  return (
    <div>
      <div style={{ width: '100%', height: 210 }}>
        <ResponsiveContainer>{chart}</ResponsiveContainer>
      </div>
      {(diagram.unit || diagram.source) && (
        <p className="text-[10px] text-text-tertiary mt-1">
          {diagram.unit ? `Figures in ${diagram.unit}. ` : ''}{diagram.source ? `Source: ${diagram.source}` : ''}
        </p>
      )}
    </div>
  );
}

// ===========================================================================
// quadrant
// ===========================================================================
function QuadrantDiagram({ diagram }) {
  const items = (diagram.quadrantItems || []).filter((i) => i.label).slice(0, 8);
  if (items.length < 1) return null;
  const W = 320;
  const H = 260;
  const pad = 30;
  const cx = W / 2;
  const cy = H / 2;
  const sx = (x) => cx + (Math.max(-1, Math.min(1, x)) * (W / 2 - pad));
  const sy = (y) => cy - (Math.max(-1, Math.min(1, y)) * (H / 2 - pad));
  const ax = diagram.xAxis || {};
  const ay = diagram.yAxis || {};
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} style={{ maxWidth: '100%', height: 'auto' }} role="img" aria-label={diagram.title || 'Quadrant diagram'}>
      <rect x={pad} y={pad} width={W - pad * 2} height={H - pad * 2} fill="var(--bg-sunken)" stroke="var(--border-default)" strokeWidth="1" />
      <line x1={cx} y1={pad} x2={cx} y2={H - pad} stroke="var(--border-default)" strokeWidth="1.4" />
      <line x1={pad} y1={cy} x2={W - pad} y2={cy} stroke="var(--border-default)" strokeWidth="1.4" />
      <text x={pad - 4} y={cy - 4} textAnchor="start" fontSize="10" fontWeight="700" fill="var(--text-tertiary)">{ax.low}</text>
      <text x={W - pad + 4} y={cy - 4} textAnchor="end" fontSize="10" fontWeight="700" fill="var(--text-tertiary)">{ax.high}</text>
      <text x={cx + 4} y={pad - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-tertiary)">{ay.high}</text>
      <text x={cx + 4} y={H - pad + 14} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-tertiary)">{ay.low}</text>
      {items.map((it, i) => (
        <g key={i}>
          <circle cx={sx(it.x)} cy={sy(it.y)} r="4.5" fill="var(--accent)" />
          <text x={sx(it.x) + 7} y={sy(it.y) + 3.5} fontSize="10.5" fontWeight="600" fill="var(--text-primary)">{it.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ===========================================================================
// pyramid
// ===========================================================================
function PyramidDiagram({ diagram }) {
  const levels = (diagram.levels || []).map((l) => String(l)).filter(Boolean).slice(0, 6);
  if (levels.length < 2) return null;
  const W = 320;
  const rowH = 46;
  const gap = 4;
  const H = levels.length * rowH + gap * (levels.length - 1) + 8;
  const apex = 26;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} style={{ maxWidth: '100%', height: 'auto' }} role="img" aria-label={diagram.title || 'Pyramid diagram'}>
      {levels.map((lvl, i) => {
        const y = 4 + i * (rowH + gap);
        const topHalf = (apex + (W / 2 - apex) * (i / levels.length));
        const botHalf = (apex + (W / 2 - apex) * ((i + 1) / levels.length));
        const cx = W / 2;
        const pts = [
          [cx - topHalf, y],
          [cx + topHalf, y],
          [cx + botHalf, y + rowH],
          [cx - botHalf, y + rowH],
        ].map((p) => p.join(',')).join(' ');
        return (
          <g key={i}>
            <polygon points={pts} fill={i === 0 ? 'var(--accent-soft-bg)' : 'var(--bg-sunken)'} stroke={i === 0 ? 'var(--accent)' : 'var(--border-default)'} strokeWidth="1.4" />
            <text x={cx} y={y + rowH / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text-primary)">{lvl}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ===========================================================================
// timeline
// ===========================================================================
function TimelineDiagram({ diagram }) {
  const events = (diagram.events || []).filter((e) => e.when || e.label).slice(0, 8);
  if (events.length < 2) return null;
  return (
    <ol className="relative border-l-2 border-border-default ml-2 space-y-3 py-1">
      {events.map((e, i) => (
        <li key={i} className="ml-4">
          <span className="absolute -left-[7px] w-3 h-3 rounded-full bg-brand border-2 border-surface" />
          {e.when ? <p className="text-[11px] font-bold text-brand leading-tight">{e.when}</p> : null}
          <p className="text-xs text-text-primary leading-snug">{e.label}</p>
        </li>
      ))}
    </ol>
  );
}

// ===========================================================================
export default function AnswerDiagram({ diagram }) {
  const uid = useId().replace(/[:]/g, '');
  if (!diagram) return null;
  const kind = diagram.kind || 'flow';

  let body;
  if (kind === 'table') body = <TableDiagram diagram={diagram} />;
  else if (kind === 'chart') body = <ChartDiagram diagram={diagram} />;
  else if (kind === 'quadrant') body = <QuadrantDiagram diagram={diagram} />;
  else if (kind === 'pyramid') body = <PyramidDiagram diagram={diagram} />;
  else if (kind === 'timeline') body = <TimelineDiagram diagram={diagram} />;
  else body = <FlowDiagram diagram={diagram} uid={uid} />;

  if (!body) return null;
  return <div className="overflow-x-auto -mx-1 px-1">{body}</div>;
}
