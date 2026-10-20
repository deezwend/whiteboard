// Kova aracı: tıklanan noktayı çevreleyen kapalı alanı bulur. Çizgiler ve şekil kenarları gizli bir
// tuvale siyah olarak çizilir, tıklanan pikselden taşma dolgusu (flood fill) yapılır, dolan alanın
// kenarı piksel sınırları boyunca izlenip sadeleştirilerek dünya koordinatında bir çokgene çevrilir.
// İçteki boşluklar (delikler) dış halkaya sıfır genişlikli bir köprüyle bağlanır; çokgen evenodd
// kuralıyla doldurulduğu için delikler boş kalır ve öğe tek bir nokta listesi olarak taşınabilir.

import { bbox, unionBBox } from './geometry.js';
import { drawElement } from './render.js';

const BOUNDARY_TYPES = new Set(['stroke', 'line', 'arrow', 'rect', 'ellipse', 'polygon']);
const MAX_PIXELS = 4e6; // gizli tuvalin en büyük alanı
const GAP = 2; // ekran pikseli: çizgiler her yandan bu kadar kalın sayılır, küçük aralıklar kapanır
const SIMPLIFY = 0.75; // çokgen sadeleştirme toleransı (piksel)
const MIN_HOLE = 12; // bundan küçük delikler (piksel²) gürültü sayılır

// Alanı sınırlayan öğeler: çizgiler ve şekiller. Kovayla yapılmış dolgular sınır sayılmaz.
export function isBoundary(el) {
  return BOUNDARY_TYPES.has(el.type) && !el.bucket;
}

// Sonuç: { points, area } (dünya birimi) ya da { error: 'open' | 'line' }.
export function findRegion(elements, seed, zoom) {
  const walls = elements.filter(isBoundary);
  const box = unionBBox(walls);
  if (!box || seed.x <= box.x || seed.y <= box.y || seed.x >= box.x + box.w || seed.y >= box.y + box.h) return { error: 'open' };
  const scale = Math.min(zoom, Math.sqrt(MAX_PIXELS / Math.max(1, box.w * box.h)));
  const pad = 4 / scale;
  const ox = box.x - pad, oy = box.y - pad;
  const W = Math.ceil((box.w + pad * 2) * scale), H = Math.ceil((box.h + pad * 2) * scale);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(scale, 0, 0, scale, -ox * scale, -oy * scale);
  const grow = (GAP * 2) / scale;
  for (const el of walls) {
    // Dolgusuz, düz fırçalı ve biraz kalın çizilir: kesikli çizgi de duvar sayılsın, renk önemsiz.
    drawElement(ctx, { ...el, color: '#000', fill: 'none', brush: undefined, highlighter: false, opacity: undefined, width: (el.width || 1) + grow });
  }
  const data = ctx.getImageData(0, 0, W, H).data;
  const wall = new Uint8Array(W * H);
  for (let i = 0; i < wall.length; i++) wall[i] = data[i * 4 + 3] > 16 ? 1 : 0;

  const sx = Math.floor((seed.x - ox) * scale), sy = Math.floor((seed.y - oy) * scale);
  if (wall[sy * W + sx]) return { error: 'line' };
  const region = flood(wall, W, H, sx, sy);
  if (!region) return { error: 'open' };
  // Dolgu çizginin altına biraz girsin ki kenarda beyaz boşluk kalmasın; yalnızca duvar
  // piksellerine yayıldığı için aralıklardan dışarı taşmaz.
  dilateInto(region, wall, W, H, GAP + 1);

  const loops = traceLoops(region, W, H).map((l) => simplifyRing(l, SIMPLIFY));
  let outer = null;
  for (const l of loops) if (!outer || Math.abs(ringArea(l)) > Math.abs(ringArea(outer))) outer = l;
  if (!outer || outer.length < 3) return { error: 'open' };
  const holes = loops.filter((l) => l !== outer && l.length >= 3 && Math.abs(ringArea(l)) >= MIN_HOLE);
  let ring = outer;
  for (const h of holes) ring = bridge(ring, h);
  const points = ring.map(([x, y]) => [ox + x / scale, oy + y / scale]);
  return { points, area: Math.abs(ringArea(points)) };
}

// Tarama satırlı taşma dolgusu. Tuvalin kenarına ulaşırsa alan kapalı değildir: null.
function flood(wall, W, H, sx, sy) {
  const region = new Uint8Array(W * H);
  const stack = [sx, sy];
  while (stack.length) {
    const y = stack.pop(), x0 = stack.pop();
    let x = x0;
    const row = y * W;
    if (region[row + x]) continue;
    while (x > 0 && !wall[row + x - 1] && !region[row + x - 1]) x--;
    if (x === 0) return null;
    let upOpen = false, downOpen = false;
    for (; x < W && !wall[row + x] && !region[row + x]; x++) {
      if (y === 0 || y === H - 1 || x === W - 1) return null;
      region[row + x] = 1;
      const up = row - W + x, down = row + W + x;
      const u = !wall[up] && !region[up];
      if (u && !upOpen) stack.push(x, y - 1);
      upOpen = u;
      const d = !wall[down] && !region[down];
      if (d && !downOpen) stack.push(x, y + 1);
      downOpen = d;
    }
  }
  return region;
}

function dilateInto(region, wall, W, H, steps) {
  for (let s = 0; s < steps; s++) {
    const add = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (region[i] || !wall[i]) continue;
        if (region[i - 1] || region[i + 1] || region[i - W] || region[i + W]) add.push(i);
      }
    }
    if (!add.length) break;
    for (const i of add) region[i] = 1;
  }
}

// Bölgenin kenarlarını piksel köşeleri üzerinden kapalı halkalar olarak izler. Her iç pikselin
// dışa bakan kenarı, iç taraf sağda kalacak yönde bir kenar parçasıdır (0 sağ, 1 aşağı, 2 sol, 3 yukarı).
function traceLoops(region, W, H) {
  const VW = W + 1;
  const out = new Uint8Array(VW * (H + 1));
  const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && region[y * W + x];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!region[y * W + x]) continue;
      if (!at(x, y - 1)) out[y * VW + x] |= 1; // üst kenar: (x,y) → (x+1,y)
      if (!at(x + 1, y)) out[y * VW + x + 1] |= 2; // sağ kenar: (x+1,y) → (x+1,y+1)
      if (!at(x, y + 1)) out[(y + 1) * VW + x + 1] |= 4; // alt kenar: (x+1,y+1) → (x,y+1)
      if (!at(x - 1, y)) out[(y + 1) * VW + x] |= 8; // sol kenar: (x,y+1) → (x,y)
    }
  }
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  const loops = [];
  for (let v = 0; v < out.length; v++) {
    while (out[v]) {
      let dir = Math.log2(out[v] & -out[v]);
      let x = v % VW, y = (v - x) / VW;
      const sx = x, sy = y;
      const pts = [];
      let prev = -1;
      do {
        out[y * VW + x] &= ~(1 << dir);
        if (dir !== prev) pts.push([x, y]);
        prev = dir;
        x += DX[dir];
        y += DY[dir];
        const m = out[y * VW + x];
        // Çapraz değen piksellerde (iki çıkış) sağa dönüşü tercih et; halkalar kesişmez.
        const right = (dir + 1) % 4, left = (dir + 3) % 4;
        if (m & (1 << right)) dir = right;
        else if (m & (1 << dir)) { /* düz devam */ }
        else if (m & (1 << left)) dir = left;
        else break;
      } while (x !== sx || y !== sy);
      if (pts.length >= 3) loops.push(pts);
    }
  }
  return loops;
}

function ringArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  return a / 2;
}

// Kapalı halkayı Douglas-Peucker ile sadeleştirir (en uzak iki noktadan ikiye bölünerek).
function simplifyRing(pts, eps) {
  if (pts.length < 8) return pts;
  let far = 0, best = -1;
  for (let i = 1; i < pts.length; i++) {
    const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2;
    if (d > best) { best = d; far = i; }
  }
  const a = dp(pts.slice(0, far + 1), eps), b = dp([...pts.slice(far), pts[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

function dp(pts, eps) {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    const [ax, ay] = pts[s], [bx, by] = pts[e];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let idx = -1, max = eps;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

// Deliği halkaya en yakın iki noktası arasından giden gidiş-dönüş bir köprüyle ekler.
function bridge(ring, hole) {
  let bi = 0, bj = 0, best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    for (let j = 0; j < hole.length; j++) {
      const d = (ring[i][0] - hole[j][0]) ** 2 + (ring[i][1] - hole[j][1]) ** 2;
      if (d < best) { best = d; bi = i; bj = j; }
    }
  }
  const h = [...hole.slice(bj), ...hole.slice(0, bj), hole[bj]];
  return [...ring.slice(0, bi + 1), ...h, ring[bi], ...ring.slice(bi + 1)];
}

// Kutu öğesinin ya da çokgenin iç alanı (dünya birimi²); kova sonucunu şekille eşleştirmek için.
export function shapeArea(el) {
  if (el.type === 'polygon') return Math.abs(ringArea(el.points));
  const b = bbox({ ...el, rot: 0 });
  return el.type === 'ellipse' ? (Math.PI * b.w * b.h) / 4 : b.w * b.h;
}
