// Öğelerin geometrisi: sınır kutusu, isabet testi, taşıma ve ölçekleme.

export const FONT_FAMILY = '"Segoe UI", system-ui, sans-serif';
export const LINE_HEIGHT = 1.25;
export const NOTE_PADDING = 14;

let uid = 0;
export function newId() {
  return Date.now().toString(36) + '-' + (uid++).toString(36) + Math.random().toString(36).slice(2, 6);
}

export function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function normRect(x, y, w, h) {
  return {
    x: w < 0 ? x + w : x,
    y: h < 0 ? y + h : y,
    w: Math.abs(w),
    h: Math.abs(h),
  };
}

export function bbox(el) {
  switch (el.type) {
    case 'stroke':
    case 'polygon': {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of el.points) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      // Oklu fırçanın ucu ve kaligrafik fırçaların kalın yerleri çizginin dışına taşar.
      const r = (el.width / 2) * (BRUSH_WIDTH[el.brush] || 1) * (el.pressure && BRUSH_WIDTH[el.brush] ? 1.45 : 1)
        + (el.brush === 'arrow' || el.brush === 'dashedarrow' ?arrowHeadSize(el) : 0);
      return { x: minX - r, y: minY - r, w: maxX - minX + 2 * r, h: maxY - minY + 2 * r };
    }
    case 'line':
    case 'arrow': {
      const r = el.width / 2 + (el.type === 'arrow' ? arrowHeadSize(el) : 0);
      const x = Math.min(el.x1, el.x2) - r;
      const y = Math.min(el.y1, el.y2) - r;
      return { x, y, w: Math.abs(el.x2 - el.x1) + 2 * r, h: Math.abs(el.y2 - el.y1) + 2 * r };
    }
    default:
      return normRect(el.x, el.y, el.w, el.h);
  }
}

// Kaligrafik fırçaların en kalın yerinin, seçilen kalınlığa oranı.
export const BRUSH_WIDTH = { calligraphy: 2.2, brushpen: 1.6, fountain: 1.2 };

export function arrowHeadSize(el) {
  return Math.max(12, el.width * 3.5);
}

export function unionBBox(els) {
  if (!els.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of els) {
    const b = bbox(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function rectsIntersect(a, b) {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

export function rectContains(outer, inner) {
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

export function hitTest(el, x, y, tol) {
  switch (el.type) {
    case 'stroke': {
      const r = el.width / 2 + tol;
      const pts = el.points;
      if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) <= r;
      for (let i = 1; i < pts.length; i++) {
        if (distToSeg(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= r) return true;
      }
      return false;
    }
    case 'polygon': {
      const pts = el.points;
      if (el.fill !== 'none' && pointInPolygon(x, y, pts)) return true;
      const r = el.width / 2 + tol;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if (distToSeg(x, y, a[0], a[1], b[0], b[1]) <= r) return true;
      }
      return false;
    }
    case 'line':
    case 'arrow':
      return distToSeg(x, y, el.x1, el.y1, el.x2, el.y2) <= el.width / 2 + tol;
    case 'rect': {
      const b = normRect(el.x, el.y, el.w, el.h);
      const inside = x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol;
      if (!inside) return false;
      if (el.fill !== 'none') return true;
      const edge = el.width / 2 + tol;
      return x <= b.x + edge || x >= b.x + b.w - edge || y <= b.y + edge || y >= b.y + b.h - edge;
    }
    case 'ellipse': {
      const b = normRect(el.x, el.y, el.w, el.h);
      const rx = b.w / 2, ry = b.h / 2;
      const cx = b.x + rx, cy = b.y + ry;
      const edge = el.width / 2 + tol;
      const outer = ((x - cx) / (rx + edge)) ** 2 + ((y - cy) / (ry + edge)) ** 2;
      if (outer > 1) return false;
      if (el.fill !== 'none') return true;
      const irx = rx - edge, iry = ry - edge;
      if (irx <= 0 || iry <= 0) return true;
      return ((x - cx) / irx) ** 2 + ((y - cy) / iry) ** 2 >= 1;
    }
    default: {
      const b = normRect(el.x, el.y, el.w, el.h);
      return x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol;
    }
  }
}

export function pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Kement seçimi için öğeyi temsil eden örnek noktalar.
function samplePoints(el) {
  switch (el.type) {
    case 'stroke':
    case 'polygon': {
      const step = Math.max(1, Math.floor(el.points.length / 40));
      return el.points.filter((_, i) => i % step === 0);
    }
    case 'line':
    case 'arrow':
      return [[el.x1, el.y1], [(el.x1 + el.x2) / 2, (el.y1 + el.y2) / 2], [el.x2, el.y2]];
    default: {
      const b = normRect(el.x, el.y, el.w, el.h);
      return [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h], [b.x + b.w / 2, b.y + b.h / 2]];
    }
  }
}

// Öğenin büyük kısmı (%80) kementin içindeyse seçilmiş sayılır; el çizimindeki küçük taşmalar sorun olmaz.
export function insideLasso(el, lasso) {
  const pts = samplePoints(el);
  const inside = pts.filter(([x, y]) => pointInPolygon(x, y, lasso)).length;
  return inside / pts.length >= 0.8;
}

// Öğenin çizgisini nokta listesine çevirir (kısmi silgi için). Dolgulu şekiller ve
// oklar parçalanamaz; bunlar için null döner ve öğe bütün olarak silinir.
function toPolyline(el) {
  switch (el.type) {
    case 'stroke':
      return el.points;
    case 'line':
      return [[el.x1, el.y1, 0.5], [el.x2, el.y2, 0.5]];
    case 'polygon':
      if (el.fill !== 'none') return null;
      return [...el.points, el.points[0]].map(([x, y]) => [x, y, 0.5]);
    case 'rect': {
      if (el.fill !== 'none') return null;
      const b = normRect(el.x, el.y, el.w, el.h);
      return [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h], [b.x, b.y]].map(([x, y]) => [x, y, 0.5]);
    }
    case 'ellipse': {
      if (el.fill !== 'none') return null;
      const b = normRect(el.x, el.y, el.w, el.h);
      const pts = [];
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        pts.push([b.x + b.w / 2 + (b.w / 2) * Math.cos(a), b.y + b.h / 2 + (b.h / 2) * Math.sin(a), 0.5]);
      }
      return pts;
    }
    default:
      return null;
  }
}

// Noktaları en fazla `step` aralıklı olacak şekilde sıklaştırır; böylece uzun düz
// parçaların ortasından da silinebilir.
function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay, ap] = pts[i - 1];
    const [bx, by, bp] = pts[i];
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / step);
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t, ap + (bp - ap) * t]);
    }
  }
  return out;
}

// Kısmi silgi: silginin geçtiği yerleri çıkarıp kalan parçaları ayrı çizgiler olarak döndürür.
// Parçalanamayan öğeler için null döner.
export function splitByEraser(el, samples, r) {
  const poly = toPolyline(el);
  if (!poly) return null;
  const pts = densify(poly, Math.max(r / 3, 0.5));
  const reach = r + el.width / 2;
  const parts = [];
  let run = [];
  for (const p of pts) {
    const erased = samples.some((s) => Math.hypot(p[0] - s.x, p[1] - s.y) <= reach);
    if (erased) {
      if (run.length > 1) parts.push(run);
      run = [];
    } else run.push(p);
  }
  if (run.length > 1) parts.push(run);
  // Kapalı şekilde başlangıç noktası silinmediyse ilk ve son parça aslında tek parçadır.
  const closed = Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]) < 0.01;
  if (closed && parts.length > 1 && parts[0][0] === pts[0] && parts[parts.length - 1].at(-1) === pts[pts.length - 1]) {
    parts[0] = parts.pop().concat(parts[0].slice(1));
  }
  return parts.map((points) => ({
    id: newId(),
    type: 'stroke',
    points,
    color: el.color,
    width: el.width,
    highlighter: !!el.highlighter,
    pressure: !!el.pressure,
    ...(el.brush ? { brush: el.brush } : {}),
  }));
}

export function cloneEl(el) {
  const c = { ...el };
  if (el.points) c.points = el.points.map((p) => p.slice());
  return c;
}

export function translate(el, dx, dy) {
  if (el.type === 'stroke') {
    el.points = el.points.map(([x, y, p]) => [x + dx, y + dy, p]);
  } else if (el.type === 'polygon') {
    el.points = el.points.map(([x, y]) => [x + dx, y + dy]);
  } else if (el.type === 'line' || el.type === 'arrow') {
    el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy;
  } else {
    el.x += dx; el.y += dy;
  }
}

// `orig` sürüklemenin başındaki kopyadır; (ax, ay) sabit kalan köşe.
export function scaleFrom(el, orig, ax, ay, sx, sy) {
  const fx = (x) => ax + (x - ax) * sx;
  const fy = (y) => ay + (y - ay) * sy;
  const uniform = Math.sqrt(Math.abs(sx * sy));
  switch (el.type) {
    case 'stroke':
      el.points = orig.points.map(([x, y, p]) => [fx(x), fy(y), p]);
      el.width = Math.max(0.5, orig.width * uniform);
      break;
    case 'polygon':
      el.points = orig.points.map(([x, y]) => [fx(x), fy(y)]);
      break;
    case 'line':
    case 'arrow':
      el.x1 = fx(orig.x1); el.y1 = fy(orig.y1);
      el.x2 = fx(orig.x2); el.y2 = fy(orig.y2);
      break;
    case 'text': {
      el.x = fx(orig.x); el.y = fy(orig.y);
      const s = Math.abs(sy);
      el.fontSize = Math.max(4, orig.fontSize * s);
      el.w = orig.w * s;
      el.h = orig.h * s;
      if (sx < 0) el.x -= el.w;
      if (sy < 0) el.y -= el.h;
      break;
    }
    default: {
      const r = normRect(fx(orig.x), fy(orig.y), orig.w * sx, orig.h * sy);
      Object.assign(el, r);
      if (el.type === 'note') {
        el.w = Math.max(60, el.w);
        el.h = Math.max(40, el.h);
      }
    }
  }
}
