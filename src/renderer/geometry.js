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
    default: {
      const b = normRect(el.x, el.y, el.w, el.h);
      if (!el.rot) return b;
      // Döndürülmüş kutu: dönmüş köşeleri kapsayan eksene paralel kutu.
      const c = Math.abs(Math.cos(el.rot)), s = Math.abs(Math.sin(el.rot));
      const w = b.w * c + b.h * s, h = b.w * s + b.h * c;
      return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h };
    }
  }
}

// ---------- Döndürme ----------
// Nokta listeli öğeler (çizgi, çokgen, doğru, ok) döndürülünce koordinatları doğrudan değişir.
// Kutu öğeleri (dikdörtgen, elips, yazı, not, resim, bant) kutusunu korur ve merkezi etrafındaki
// açıyı `rot` (radyan) alanında taşır. Koordinat sistemi döndürülmez.

export function canRotate(el) {
  return el.type !== 'axes';
}

export function rotatePoint(x, y, cx, cy, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const dx = x - cx, dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

export function boxCenter(el) {
  const b = normRect(el.x, el.y, el.w, el.h);
  return [b.x + b.w / 2, b.y + b.h / 2];
}

// Açıyı (-π, π] aralığına getirir; 0'a çok yakınsa 0 yapar ki düz öğe "döndürülmüş" sayılmasın.
function normAngle(a) {
  a = Math.atan2(Math.sin(a), Math.cos(a));
  return Math.abs(a) < 1e-6 ? 0 : a;
}

// `orig` sürüklemenin başındaki kopyadır; öğe (cx, cy) etrafında `a` radyan döndürülür.
export function rotateAround(el, orig, cx, cy, a) {
  switch (el.type) {
    case 'stroke':
      el.points = orig.points.map(([x, y, p]) => [...rotatePoint(x, y, cx, cy, a), p]);
      break;
    case 'polygon':
      el.points = orig.points.map(([x, y]) => rotatePoint(x, y, cx, cy, a));
      break;
    case 'line':
    case 'arrow':
      [el.x1, el.y1] = rotatePoint(orig.x1, orig.y1, cx, cy, a);
      [el.x2, el.y2] = rotatePoint(orig.x2, orig.y2, cx, cy, a);
      break;
    case 'axes':
      break;
    default: {
      const [ox, oy] = boxCenter(orig);
      const [nx, ny] = rotatePoint(ox, oy, cx, cy, a);
      el.x = orig.x + nx - ox;
      el.y = orig.y + ny - oy;
      const r = normAngle((orig.rot || 0) + a);
      if (r) el.rot = r;
      else delete el.rot;
    }
  }
}

// Kutu öğesinin boyutunu değiştirir. Dönmüşse, sol üst köşesi (yazının başladığı yer)
// ekranda yerinde kalacak şekilde kutu kaydırılır.
export function resizeBox(el, w, h) {
  if (!el.rot) {
    el.w = w;
    el.h = h;
    return;
  }
  const [cx, cy] = boxCenter(el);
  const [px, py] = rotatePoint(el.x, el.y, cx, cy, el.rot);
  const c = Math.cos(el.rot), s = Math.sin(el.rot);
  const ncx = px + (w / 2) * c - (h / 2) * s;
  const ncy = py + (w / 2) * s + (h / 2) * c;
  el.x = ncx - w / 2;
  el.y = ncy - h / 2;
  el.w = w;
  el.h = h;
}

// Dönmüş kutu öğesinin yerel (döndürülmemiş) koordinatına çevirir.
function unrotate(el, x, y) {
  const [cx, cy] = boxCenter(el);
  return rotatePoint(x, y, cx, cy, -el.rot);
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
  if (el.rot) [x, y] = unrotate(el, x, y);
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
      const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h], [b.x + b.w / 2, b.y + b.h / 2]];
      if (!el.rot) return pts;
      const [cx, cy] = boxCenter(el);
      return pts.map(([x, y]) => rotatePoint(x, y, cx, cy, el.rot));
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
  let poly = toPolyline(el);
  if (!poly) return null;
  if (el.rot) {
    const [cx, cy] = boxCenter(el);
    poly = poly.map(([x, y, p]) => [...rotatePoint(x, y, cx, cy, el.rot), p]);
  }
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
  return parts.map((points) => pieceOf(el, points));
}

// Parçalanan öğenin bir parçası: aynı görünüşte serbest çizgi.
function pieceOf(el, points) {
  return {
    id: newId(),
    type: 'stroke',
    points,
    color: el.color,
    width: el.width,
    highlighter: !!el.highlighter,
    pressure: !!el.pressure,
    ...(el.brush ? { brush: el.brush } : {}),
  };
}

// ab parçasının cd parçasını kestiği yer (ab üzerindeki 0..1 oranı) ya da null.
function crossT(a, b, c, d) {
  const rx = b[0] - a[0], ry = b[1] - a[1];
  const sx = d[0] - c[0], sy = d[1] - c[1];
  const den = rx * sy - ry * sx;
  if (!den) return null;
  const qx = c[0] - a[0], qy = c[1] - a[1];
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  return t > 0 && t < 1 && u >= 0 && u < 1 ? t : null;
}

// Makas: öğeyi kementin sınırından keser, içeride ve dışarıda kalan parçaları ayrı döndürür.
// Kementi kesmeyen ya da parçalanamayan öğeler için null döner (öğe bütün olarak değerlendirilir).
export function splitByLasso(el, lasso) {
  // Oklu fırçada her parçaya ok ucu eklenirdi; bunlar bütün olarak seçilir.
  if (el.brush === 'arrow' || el.brush === 'dashedarrow') return null;
  let poly = toPolyline(el);
  if (!poly || poly.length < 2) return null;
  if (el.rot) {
    const [cx, cy] = boxCenter(el);
    poly = poly.map(([x, y, p]) => [...rotatePoint(x, y, cx, cy, el.rot), p]);
  }
  // Parçalar yumuşatılarak çizilen serbest çizgiye dönüşür; düz kenarlı şekillerin köşeleri
  // yuvarlanmasın diye kenarlar sık noktalara bölünür.
  if (el.type !== 'stroke') poly = densify(poly, Math.max(1, el.width / 2));
  const edges = lasso.map((p, i) => [p, lasso[(i + 1) % lasso.length]]);
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (a[2] ?? 0.5) + ((b[2] ?? 0.5) - (a[2] ?? 0.5)) * t];
  // Her parça kement sınırında kesilir; aradaki küçük parçaların ortası içeride mi dışarıda mı diye bakılır.
  const runs = [];
  let crossed = false;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1], b = poly[i];
    const ts = edges.map(([c, d]) => crossT(a, b, c, d)).filter((t) => t !== null).sort((x, y) => x - y);
    if (ts.length) crossed = true;
    const cuts = [a, ...ts.map((t) => lerp(a, b, t)), b];
    for (let k = 1; k < cuts.length; k++) {
      const p = cuts[k - 1], q = cuts[k];
      const inside = pointInPolygon((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, lasso);
      const run = runs[runs.length - 1];
      if (run && run.inside === inside) run.points.push(q);
      else runs.push({ inside, points: [p, q] });
    }
  }
  if (!crossed) return null;
  // Kapalı şekilde ilk ve son parça aynı taraftaysa aslında tek parçadır.
  const closed = Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]) < 0.01;
  if (closed && runs.length > 2 && runs[0].inside === runs[runs.length - 1].inside) {
    runs[0].points = runs.pop().points.concat(runs[0].points.slice(1));
  }
  const out = { inside: [], outside: [] };
  for (const r of runs) (r.inside ? out.inside : out.outside).push(pieceOf(el, r.points));
  return out;
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
    if (el.type === 'axes') { el.ox += dx; el.oy += dy; }
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
    case 'axes': {
      // Kutu ve başlangıç noktası birlikte ölçeklenir; birim uzunluk oranla büyür.
      Object.assign(el, normRect(fx(orig.x), fy(orig.y), orig.w * sx, orig.h * sy));
      el.ox = fx(orig.ox);
      el.oy = fy(orig.oy);
      el.unit = Math.max(4, orig.unit * uniform);
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
