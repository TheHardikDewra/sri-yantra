// Draws the flat figure (bhu-prastara) from the solved coordinates.
// The nine triangles come straight out of the solver; the lotuses, the three
// circles and the bhupura are drawing convention, laid out from data.layout.

const NS = 'http://www.w3.org/2000/svg';
const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
const f = n => n.toFixed(6);

export const ENCLOSURES = [
  ['trikona', 'the central triangle', 1],
  ['ashtakona', 'eight triangles', 8],
  ['antardasara', 'inner ten', 10],
  ['bahirdasara', 'outer ten', 10],
  ['chaturdasara', 'fourteen', 14],
];

// Shape of one lotus petal, two cubics from base corner to tip and back. The
// low handle gives the petal its shoulders; the high handle pulls the sides in
// so they arrive at the tip along different directions and meet in a cusp.
// LOW_A past 1.0 makes neighbouring petals cross; a high handle past the tip
// radius rounds the point off.
const LOW_R = 0.30, LOW_A = 1.02, HIGH_R = 0.74, HIGH_A = 0.40;

// A ring of n petals. Neighbours share their base point, so there is no gap
// (kesara) between them, as the canon insists.
export function petalRing(n, r0, r1) {
  const half = Math.PI / n;
  const span = r1 - r0, out = [];
  for (let k = 0; k < n; k++) {
    const am = 2 * Math.PI * k / n;
    const [p0x, p0y] = polar(r0, am - half);
    const [p1x, p1y] = polar(r0, am + half);
    const [tx, ty] = polar(r1, am);
    const [ax, ay] = polar(r0 + LOW_R * span, am - half * LOW_A);
    const [bx, by] = polar(r0 + HIGH_R * span, am - half * HIGH_A);
    const [cx, cy] = polar(r0 + HIGH_R * span, am + half * HIGH_A);
    const [dx, dy] = polar(r0 + LOW_R * span, am + half * LOW_A);
    out.push(
      `M${f(p0x)},${f(-p0y)}` +
      `C${f(ax)},${f(-ay)} ${f(bx)},${f(-by)} ${f(tx)},${f(-ty)}` +
      `C${f(cx)},${f(-cy)} ${f(dx)},${f(-dy)} ${f(p1x)},${f(-p1y)}`);
  }
  return out.join(' ');
}

// The k-th of the three parallel bhupura lines. One side is laid out and then
// rotated a quarter turn three times. Walking the top side inwards from its
// left corner, the outline runs along the square, turns out and up the near
// face of the gate's neck, back out under the cap, then up and across the cap
// - the T-shaped portal of the traditional canon. `k` counts inwards, and
// every edge moves toward the interior by one gap.
export function bhupura(L, k = 0) {
  const g = L.gate, d = k * g.inset;
  const s = L.bhupura[0] - d;
  const reach = g.reach - d;
  const step = g.step + d;          // faces down, so it insets upward
  const cap = g.cap - d;
  const neck = g.neck - d;
  const side = [[-s, s], [-neck, s], [-neck, step], [-cap, step], [-cap, reach],
                [cap, reach], [cap, step], [neck, step], [neck, s], [s, s]];
  const pts = [];
  for (let q = 0; q < 4; q++) {
    for (const p of side) {
      let [x, y] = p;
      for (let i = 0; i < q; i++) { const t = x; x = y; y = -t; }
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(x - last[0], y - last[1]) > 1e-9) pts.push([x, y]);
    }
  }
  return 'M' + pts.map(([x, y]) => `${f(x)},${f(-y)}`).join(' L') + ' Z';
}

function el(name, attrs) {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

// Two ways of colouring the same exact figure. "ink" keeps the page's palette
// and tints the enclosures; "traditional" is the polychrome of painted and
// printed yantras — flat fills, no gradients — where the cells are coloured by
// the way they point and the bhupura field carries the saffron ground.
export const PALETTES = {
  ink: { name: 'Ink' },
  traditional: {
    name: 'Traditional',
    ground: '#e8a41d', line: '#8e1b10', wall: '#a8210f',
    petal: '#ef8f22', petalLine: '#8e1b10',
    band: '#173b86', halo: '#f5c542',
    up: '#f0a81d', down: '#1f74b8', core: '#d8451a',
    bindu: '#17150f',
  },
};

export function draw(data, opts = {}) {
  const o = Object.assign({
    fill: true, nine: true, outer: true, marma: false, label: false,
    palette: 'ink', size: 1000, paper: null, ink: null,
  }, opts);
  const L = data.layout;
  const P = PALETTES[o.palette] || PALETTES.ink;
  const trad = o.palette === 'traditional';
  const span = o.outer ? L.gate.reach + 0.04 : 1.06;
  const k = o.size / (2 * span);
  const stroke = trad ? P.line : (o.ink || 'currentColor');

  const svg = el('svg', {
    xmlns: NS, viewBox: `0 0 ${o.size} ${o.size}`,
    width: o.size, height: o.size,
    'font-family': 'ui-monospace, monospace',
  });
  if (o.paper) svg.appendChild(el('rect',
    { width: o.size, height: o.size, fill: o.paper }));

  const g = el('g', {
    transform: `translate(${o.size / 2},${o.size / 2}) scale(${k})`,
    fill: 'none', stroke,
    'stroke-width': (2 / k).toFixed(6), 'stroke-linejoin': 'round',
  });
  svg.appendChild(g);

  if (o.outer) {
    if (trad) {
      // saffron ground inside the bhupura, then the blue band of the circles
      g.appendChild(el('path', { d: bhupura(L, 0), fill: P.ground }));
      g.appendChild(el('circle',
        { cx: 0, cy: 0, r: L.trivritta[L.trivritta.length - 1], fill: P.band }));
      g.appendChild(el('circle',
        { cx: 0, cy: 0, r: L.lotus16[1], fill: P.band }));
    }
    for (let i = 0; i < L.bhupura.length; i++)
      g.appendChild(el('path', { d: bhupura(L, i) }));
    for (const r of L.trivritta)
      g.appendChild(el('circle', { cx: 0, cy: 0, r }));
    for (const [n, band] of [[16, L.lotus16], [8, L.lotus8]]) {
      g.appendChild(el('path', {
        d: petalRing(n, band[0], band[1]),
        fill: trad ? P.petal : 'none',
      }));
    }
  }
  g.appendChild(el('circle',
    { cx: 0, cy: 0, r: L.circle, fill: trad ? P.halo : 'none' }));

  if (o.fill) {
    for (const t of data.yantra_triangles) {
      const col = trad
        ? (t.ring <= 1 ? P.core : t.points_up ? P.up : P.down)
        : `var(--e${t.ring})`;
      g.appendChild(el('polygon', {
        points: t.points.map(([x, y]) => `${f(x)},${f(-y)}`).join(' '),
        fill: col, 'fill-opacity': trad ? 1 : 0.9, stroke: 'none',
      }));
    }
    // redraw the cell edges so filled neighbours stay separated
    for (const t of data.yantra_triangles) {
      g.appendChild(el('polygon', {
        points: t.points.map(([x, y]) => `${f(x)},${f(-y)}`).join(' '),
        fill: 'none', 'stroke-width': (1 / k).toFixed(6),
        'stroke-opacity': trad ? 0.85 : 0.35,
      }));
    }
  }

  if (o.nine) {
    for (const t of data.triangles) {
      g.appendChild(el('polygon', {
        points: t.points.map(([x, y]) => `${f(x)},${f(-y)}`).join(' '),
      }));
    }
  }

  if (o.marma) {
    const seen = new Set();
    for (const c of data.cells) {
      for (const [x, y] of c.points) {
        const key = `${x.toFixed(7)}|${y.toFixed(7)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        g.appendChild(el('circle', {
          cx: f(x), cy: f(-y), r: (3.2 / k).toFixed(6),
          fill: 'var(--accent)', stroke: 'none',
        }));
      }
    }
  }

  if (o.label) {
    for (const t of data.triangles) {
      const [x, y] = t.points[1];
      const lab = el('text', {
        x: f(x + 0.02), y: f(-y - 0.015),
        'font-size': (13 / k).toFixed(6),
        fill: 'var(--accent)', stroke: 'none',
      });
      lab.textContent = 't' + t.i;
      g.appendChild(lab);
    }
  }

  const [bx, by] = data.bindu;
  g.appendChild(el('circle', {
    cx: f(bx), cy: f(-by), r: L.bindu,
    fill: trad ? P.bindu : (o.ink || 'currentColor'), stroke: 'none',
  }));

  return svg;
}

// Serialise with the CSS variables resolved, so a downloaded file stands alone.
export function serialise(data, opts) {
  const cs = getComputedStyle(document.documentElement);
  const svg = draw(data, Object.assign({}, opts, {
    paper: cs.getPropertyValue('--paper').trim(),
    ink: cs.getPropertyValue('--ink').trim(),
  }));
  let s = new XMLSerializer().serializeToString(svg);
  for (let i = 0; i < 5; i++)
    s = s.replaceAll(`var(--e${i})`, cs.getPropertyValue(`--e${i}`).trim());
  s = s.replaceAll('var(--accent)', cs.getPropertyValue('--accent').trim());
  return s;
}
