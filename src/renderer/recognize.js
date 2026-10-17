// Elle çizilmiş çizgiyi düzgün şekle çevirir: çizgi, üçgen, dörtgen, beşgen, elips/daire.
import { distToSeg } from './geometry.js';

const MIN_LINE_PX = 60;   // daha kısa çizgiler el yazısı olabilir, dokunma
const MIN_SHAPE_PX = 45;  // daha küçük kapalı şekiller harf olabilir (o, D…)

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function bounds(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Ramer–Douglas–Peucker sadeleştirme.
function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const a = pts[0], b = pts[pts.length - 1];
  let maxD = -1, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distToSeg(pts[i].x, pts[i].y, a.x, a.y, b.x, b.y);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= eps) return [a, b];
  const left = rdp(pts.slice(0, idx + 1), eps);
  const right = rdp(pts.slice(idx), eps);
  return left.slice(0, -1).concat(right);
}

// Kapalı çizgiyi köşe noktalarına indirger.
function closedVertices(pts, eps, diag) {
  let far = 0;
  for (let i = 1; i < pts.length; i++) if (dist(pts[i], pts[0]) > dist(pts[far], pts[0])) far = i;
  const a = rdp(pts.slice(0, far + 1), eps);
  const b = rdp(pts.slice(far).concat([pts[0]]), eps);
  let v = a.slice(0, -1).concat(b.slice(0, -1));

  // Birbirine çok yakın köşeleri birleştir, neredeyse düz açıları at.
  let changed = true;
  while (changed && v.length > 2) {
    changed = false;
    for (let i = 0; i < v.length && v.length > 2; i++) {
      const prev = v[(i - 1 + v.length) % v.length];
      const cur = v[i];
      const next = v[(i + 1) % v.length];
      if (dist(cur, next) < diag * 0.12) {
        v[(i + 1) % v.length] = { x: (cur.x + next.x) / 2, y: (cur.y + next.y) / 2 };
        v.splice(i, 1);
        changed = true;
        break;
      }
      const a1 = Math.atan2(prev.y - cur.y, prev.x - cur.x);
      const a2 = Math.atan2(next.y - cur.y, next.x - cur.x);
      let ang = Math.abs(a1 - a2);
      if (ang > Math.PI) ang = 2 * Math.PI - ang;
      if (ang > (150 * Math.PI) / 180) {
        v.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return v;
}

function polygonError(pts, v) {
  let sum = 0;
  for (const p of pts) {
    let best = Infinity;
    for (let i = 0; i < v.length; i++) {
      const a = v[i], b = v[(i + 1) % v.length];
      best = Math.min(best, distToSeg(p.x, p.y, a.x, a.y, b.x, b.y));
    }
    sum += best;
  }
  return sum / pts.length;
}

function ellipseError(pts, b) {
  const rx = b.w / 2, ry = b.h / 2;
  const cx = b.x + rx, cy = b.y + ry;
  if (rx < 1 || ry < 1) return Infinity;
  let sum = 0;
  for (const p of pts) sum += Math.abs(Math.hypot((p.x - cx) / rx, (p.y - cy) / ry) - 1);
  return (sum / pts.length) * ((rx + ry) / 2);
}

function nearAxis(a, b, tolDeg) {
  const ang = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) % 90;
  return ang < tolDeg || ang > 90 - tolDeg;
}

// Neredeyse eşit kenarlı dikdörtgen/elipsleri kare/daireye oturt.
function squarish(r) {
  const m = Math.max(r.w, r.h);
  if (Math.abs(r.w - r.h) / m < 0.12) {
    const s = (r.w + r.h) / 2;
    return { x: r.x + (r.w - s) / 2, y: r.y + (r.h - s) / 2, w: s, h: s };
  }
  return r;
}

// points: [[x, y, baskı], ...] dünya koordinatında. Tanınırsa öğe alanlarını döndürür, yoksa null.
export function recognizeShape(points, zoom) {
  const pts = points.map(([x, y]) => ({ x, y }));
  if (pts.length < 5) return null;

  let length = 0;
  for (let i = 1; i < pts.length; i++) length += dist(pts[i - 1], pts[i]);
  const b = bounds(pts);
  const diag = Math.hypot(b.w, b.h);
  const gap = dist(pts[0], pts[pts.length - 1]);

  // Açık çizgi: dümdüz mü?
  if (gap > length * 0.15) {
    if (gap * zoom < MIN_LINE_PX) return null;
    let maxDev = 0;
    const end = pts[pts.length - 1];
    for (const p of pts) maxDev = Math.max(maxDev, distToSeg(p.x, p.y, pts[0].x, pts[0].y, end.x, end.y));
    if (maxDev > Math.max(3 / zoom, gap * 0.06)) return null;
    const a = pts[0], e = { ...pts[pts.length - 1] };
    if (Math.abs(e.y - a.y) < Math.abs(e.x - a.x) * 0.07) e.y = a.y;
    else if (Math.abs(e.x - a.x) < Math.abs(e.y - a.y) * 0.07) e.x = a.x;
    return { type: 'line', x1: a.x, y1: a.y, x2: e.x, y2: e.y };
  }

  // Kapalı şekil
  if (diag * zoom < MIN_SHAPE_PX) return null;
  const v = closedVertices(pts, Math.max(4 / zoom, diag * 0.05), diag);
  const polyErr = v.length >= 3 ? polygonError(pts, v) : Infinity;
  const ellErr = ellipseError(pts, b);
  const n = v.length;

  if (n >= 3 && n <= 5 && polyErr < ellErr && polyErr < diag * 0.05) {
    if (n === 4 && v.every((p, i) => nearAxis(p, v[(i + 1) % 4], 15))) {
      return { type: 'rect', ...squarish(bounds(v)), fill: 'none' };
    }
    return { type: 'polygon', points: v.map((p) => [p.x, p.y]), fill: 'none' };
  }
  if (ellErr < ((b.w + b.h) / 4) * 0.12) {
    return { type: 'ellipse', ...squarish(b), fill: 'none' };
  }
  return null;
}
