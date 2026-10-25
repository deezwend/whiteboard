// Mind map: düğümler tahtadaki sıradan öğelerdir (type 'mindnode'). Ağaç yapısı her düğümün
// parentId (üst düğüm), order (kardeşler arasındaki sıra) ve birinci seviyede side ('l' | 'r')
// alanlarıyla tutulur; kök düğüm yerleşimi (layout: 'map' | 'right' | 'tree') taşır. Kökün yeri
// kullanıcıya aittir, geri kalan her şey layoutMindMaps ile kökten başlayarak yeniden dizilir.
// Elle taşınan dal, kendiliğinden yerine göre kaymasını (ox, oy) saklar; alt dalları onunla gelir.

import { newId } from './geometry.js';
import {
  mindNodeSize, mindOutAnchor, mindShape, mindTextColor, mindEdgeCurve, mindEdgeWidth, mindPad, mindWrappedText, measureText,
} from './render.js';

export const BRANCH_COLORS = ['#e8590c', '#1971c2', '#2f9e44', '#c2255c', '#7048e8', '#0c8599', '#f08c00', '#e03131'];
export const ROOT_COLOR = '#364fc7';
export const MIND_FONT = [28, 20, 17]; // kök, birinci seviye, daha derin

const H_GAP = [64, 44, 34]; // üst düğümle çocukları arasındaki yatay boşluk (derinliğe göre)
const V_GAP = [26, 14, 8]; // alt alta duran kardeş dallar arası boşluk
const TREE_H_GAP = 22;
const TREE_V_GAP = 46;

export const isMind = (el) => el?.type === 'mindnode';

// Tahtadaki düğümlerin ağaç dizini: kimlik -> düğüm, kimlik -> sıralı çocuklar, kökler.
export function mindIndex(elements) {
  const byId = new Map();
  for (const el of elements) if (el.type === 'mindnode') byId.set(el.id, el);
  const kids = new Map();
  const roots = [];
  for (const n of byId.values()) {
    const p = n.parentId && byId.get(n.parentId);
    if (p && p !== n) {
      if (!kids.has(p.id)) kids.set(p.id, []);
      kids.get(p.id).push(n);
    } else roots.push(n);
  }
  for (const list of kids.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return { byId, kids, roots, childrenOf: (n) => kids.get(n.id) || [] };
}

export function rootOf(idx, n) {
  const seen = new Set();
  while (n.parentId && idx.byId.has(n.parentId) && !seen.has(n.id)) {
    seen.add(n.id);
    n = idx.byId.get(n.parentId);
  }
  return n;
}

// Düğüm ve bütün alt dalları.
export function subtree(idx, n, out = []) {
  out.push(n);
  for (const c of idx.childrenOf(n)) subtree(idx, c, out);
  return out;
}

// Ok tuşlarıyla gezinirken ve kenar çizerken kullanılan yön: çocuklar düğümün neresinde?
export function childDir(n, root) {
  if ((root.layout || 'map') === 'tree') return 'd';
  if (!n.depth) return 'r';
  return n.edir === 'l' ? 'l' : 'r';
}

// ---------- Yerleşim ----------

export function layoutMindMaps(elements) {
  const idx = mindIndex(elements);
  if (!idx.byId.size) return;
  const done = new Set();
  for (const r of idx.roots) layoutTree(idx, r, done);
  // Döngüye girmiş düğümler (bozuk dosya) kök yapılır.
  for (const n of idx.byId.values()) {
    if (done.has(n.id)) continue;
    delete n.parentId;
    layoutTree(mindIndex(elements), n, done);
  }
}

function layoutTree(idx, root, done) {
  // Derinlik, dal rengi, gizlilik ve boyutlar.
  const visit = (n, depth, branch, hidden) => {
    if (done.has(n.id)) return;
    done.add(n.id);
    n.depth = depth;
    n.branch = n.color || branch;
    n.hidden = hidden || undefined;
    if (!hidden) Object.assign(n, mindNodeSize(n));
    const ch = idx.childrenOf(n);
    ch.forEach((c, i) => {
      c.order = i;
      if (depth === 0 && !c.color) c.color = BRANCH_COLORS[i % BRANCH_COLORS.length];
      if (depth !== 0) delete c.side;
      visit(c, depth + 1, n.branch, hidden || !!n.collapsed);
    });
    n.nkids = ch.length ? subtree(idx, n).length - 1 : undefined;
    if (!ch.length) delete n.collapsed;
  };
  // Kökün ortası yerinde kalır: yazısı uzayıp kısalınca iki yana doğru büyür.
  const cx = root.x + (root.w || 0) / 2, cy = root.y + (root.h || 0) / 2;
  if (!root.color) root.color = ROOT_COLOR;
  visit(root, 0, root.color, false);
  delete root.parentId;
  delete root.side;
  delete root.edir;
  delete root.px;
  delete root.py;
  root.x = cx - root.w / 2;
  root.y = cy - root.h / 2;

  const visible = (n) => (n.collapsed ? [] : idx.childrenOf(n));
  const gap = (arr, d) => arr[Math.min(d, arr.length - 1)];
  const hideUnder = (n) => {
    for (const c of idx.childrenOf(n)) {
      c.x = n.x;
      c.y = n.y;
      hideUnder(c);
    }
  };

  if ((root.layout || 'map') === 'tree') {
    const ext = new Map();
    const width = (n) => {
      const ch = visible(n);
      const sum = ch.reduce((s, c) => s + width(c), 0) + TREE_H_GAP * Math.max(0, ch.length - 1);
      const w = Math.max(n.w, sum);
      ext.set(n.id, w);
      return w;
    };
    width(root);
    const place = (n) => {
      if (n.collapsed) return hideUnder(n);
      const ch = visible(n);
      const total = ch.reduce((s, c) => s + ext.get(c.id), 0) + TREE_H_GAP * Math.max(0, ch.length - 1);
      let x = n.x + n.w / 2 - total / 2;
      const a = mindOutAnchor(n, 'd');
      for (const c of ch) {
        const e = ext.get(c.id);
        c.x = x + e / 2 - c.w / 2 + (c.ox || 0);
        c.y = n.y + n.h + TREE_V_GAP + (c.oy || 0);
        c.edir = 'd';
        c.px = a.x;
        c.py = a.y;
        place(c);
        x += e + TREE_H_GAP;
      }
    };
    place(root);
    return;
  }

  // Yatay yerleşim: her dalın yüksekliği, çocuklarının alt alta dizilince kapladığı yerdir.
  const ext = new Map();
  const height = (n) => {
    const ch = visible(n);
    const sum = ch.reduce((s, c) => s + height(c), 0) + gap(V_GAP, n.depth) * Math.max(0, ch.length - 1);
    const h = Math.max(n.h, sum);
    ext.set(n.id, h);
    return h;
  };
  const stack = (n, list, dir) => {
    const total = list.reduce((s, c) => s + ext.get(c.id), 0) + gap(V_GAP, n.depth) * Math.max(0, list.length - 1);
    const a = mindOutAnchor(n, dir);
    let y = n.y + n.h / 2 - total / 2;
    for (const c of list) {
      const e = ext.get(c.id);
      const cy = y + e / 2;
      c.x = (dir === 'r' ? n.x + n.w + gap(H_GAP, n.depth) : n.x - gap(H_GAP, n.depth) - c.w) + (c.ox || 0);
      c.y = cy - c.h / 2 + (c.oy || 0);
      c.edir = dir;
      c.px = a.x;
      c.py = a.y;
      if (c.collapsed) hideUnder(c);
      else stack(c, visible(c), dir);
      y += e + gap(V_GAP, n.depth);
    }
  };
  for (const c of idx.childrenOf(root)) height(c);
  if (root.collapsed) return hideUnder(root);
  const ch = visible(root);
  const both = (root.layout || 'map') === 'map';
  stack(root, ch.filter((c) => !both || c.side !== 'l'), 'r');
  if (both) stack(root, ch.filter((c) => c.side === 'l'), 'l');
}

// ---------- Düğüm ekleme / taşıma ----------

// Kök düğüm: (x, y) ortası olacak şekilde.
export function makeRoot(x, y, text = '', extra = {}) {
  const n = { id: newId(), type: 'mindnode', text, fontSize: MIND_FONT[0], color: ROOT_COLOR, layout: 'map', x, y, w: 0, h: 0, ...extra };
  const s = mindNodeSize(n);
  return Object.assign(n, { x: x - s.w / 2, y: y - s.h / 2, ...s });
}

function fontFor(depth) {
  return MIND_FONT[Math.min(depth, MIND_FONT.length - 1)];
}

// Birinci seviyede yeni dalın konacağı taraf: daha az düğüm olan taraf (eşitse sağ).
function lighterSide(idx, root) {
  let l = 0, r = 0;
  for (const c of idx.childrenOf(root)) {
    const k = subtree(idx, c).length;
    if (c.side === 'l') l += k;
    else r += k;
  }
  return l < r ? 'l' : 'r';
}

// Kardeş listesinde `at` sırasına yer açar (sonrakiler bir kayar).
function makeRoom(idx, parent, at) {
  for (const c of idx.childrenOf(parent)) if ((c.order ?? 0) >= at) c.order = (c.order ?? 0) + 1;
}

function newNode(idx, parent, order, side) {
  const depth = (parent.depth || 0) + 1;
  const n = { id: newId(), type: 'mindnode', text: '', parentId: parent.id, order, fontSize: fontFor(depth), x: parent.x, y: parent.y, w: 0, h: 0 };
  if (depth === 1) {
    const used = new Set(idx.childrenOf(parent).map((c) => c.color));
    n.color = BRANCH_COLORS.find((c) => !used.has(c)) || BRANCH_COLORS[idx.childrenOf(parent).length % BRANCH_COLORS.length];
    n.side = side || lighterSide(idx, parent);
  }
  return n;
}

// side: kökün belirli bir tarafına eklemek için ('l' | 'r').
export function addChild(elements, parent, side) {
  const idx = mindIndex(elements);
  delete parent.collapsed;
  return newNode(idx, parent, idx.childrenOf(parent).length, side);
}

// Seçili düğümün hemen altına (before: üstüne) kardeş; kökte çocuk ekler.
export function addSibling(elements, n, before = false) {
  const idx = mindIndex(elements);
  const p = n.parentId && idx.byId.get(n.parentId);
  if (!p) return addChild(elements, n);
  const at = (n.order ?? 0) + (before ? 0 : 1);
  makeRoom(idx, p, at);
  // Birinci seviyede Enter dengeli düzeni korur: yeni dal az dolu tarafa gider (üstüne eklerken aynı taraf).
  return newNode(idx, p, at, before ? n.side : undefined);
}

// Düğümü (alt dallarıyla) yeni üst düğüme taşır; side kökün altındaysa hangi taraf.
export function reparent(elements, n, parent, { order = Infinity, side } = {}) {
  delete n.ox;
  delete n.oy;
  const idx = mindIndex(elements);
  if (subtree(idx, n).includes(parent)) return false;
  const was = n.depth;
  const sibs = idx.childrenOf(parent).filter((c) => c !== n);
  const at = Math.min(order, sibs.length);
  sibs.forEach((c, i) => { c.order = i < at ? i : i + 1; });
  n.parentId = parent.id;
  n.order = at;
  const depth = (parent.depth || 0) + 1;
  if (depth === 1) {
    n.side = side || n.side || lighterSide(idx, parent);
    if (!n.color) n.color = BRANCH_COLORS[sibs.length % BRANCH_COLORS.length];
  } else {
    delete n.side;
    if (was === 1) delete n.color; // birinci seviyenin dal rengi aşağıda yeni dalın rengine uyar
  }
  if (was !== depth) {
    const shift = depth - (was ?? depth);
    for (const d of subtree(idx, n)) if (d.fontSize === fontFor(d.depth ?? 0)) d.fontSize = fontFor((d.depth ?? 0) + shift);
  }
  delete parent.collapsed;
  return true;
}

// Bir seviye yukarı: üst düğümün hemen altına kardeş olur.
export function promote(elements, n) {
  const idx = mindIndex(elements);
  const p = n.parentId && idx.byId.get(n.parentId);
  const gp = p?.parentId && idx.byId.get(p.parentId);
  if (!gp) return false;
  return reparent(elements, n, gp, { order: (p.order ?? 0) + 1, side: p.side });
}

// Düğümü kardeşleri arasında d adım kaydırır; birinci seviyede taraf içinde kalır.
export function shiftOrder(elements, n, d) {
  const idx = mindIndex(elements);
  const p = n.parentId && idx.byId.get(n.parentId);
  if (!p) return false;
  const all = idx.childrenOf(p);
  const same = all.filter((c) => (c.side === 'l') === (n.side === 'l'));
  const i = same.indexOf(n);
  const j = i + d;
  if (j < 0 || j >= same.length) return false;
  const other = same[j];
  [n.order, other.order] = [other.order, n.order];
  return true;
}

// Kökten ayırır: düğüm kendi mind map'inin kökü olur.
export function detach(n) {
  delete n.parentId;
  delete n.side;
  delete n.ox;
  delete n.oy;
  n.color = n.branch || n.color || ROOT_COLOR;
  n.layout = 'map';
  delete n.edir;
}

// Sürükleyip bırakınca (hedef düğüm yoksa): bırakılan yere göre kardeşler arasındaki yeni sıra ve taraf.
export function dropReorder(elements, n) {
  const idx = mindIndex(elements);
  const p = n.parentId && idx.byId.get(n.parentId);
  if (!p) return false;
  const root = rootOf(idx, n);
  const tree = (root.layout || 'map') === 'tree';
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
  let side = n.side;
  if (!p.depth && (root.layout || 'map') === 'map') side = cx < p.x + p.w / 2 ? 'l' : 'r';
  const sibs = idx.childrenOf(p).filter((c) => c !== n);
  const sameSide = sibs.filter((c) => p.depth || (c.side === 'l') === (side === 'l'));
  const key = (c) => (tree ? c.x + c.w / 2 : c.y + c.h / 2);
  const next = sameSide.find((c) => key(c) > (tree ? cx : cy));
  const at = next ? sibs.indexOf(next) : sameSide.length ? sibs.indexOf(sameSide[sameSide.length - 1]) + 1 : sibs.length;
  return reparent(elements, n, p, { order: at, side });
}

// Sürüklenip boş yere bırakılan dallar oldukları yerde kalır: kendiliğinden yerleri hesaplanır ve
// aradaki fark kayma olarak saklanır. Dengeli düzende birinci seviye dal kökün öbür yanına
// bırakılırsa o tarafa geçer.
export function placeFree(elements, nodes) {
  const idx = mindIndex(elements);
  const want = new Map();
  for (const n of nodes) {
    const p = n.parentId && idx.byId.get(n.parentId);
    if (!p) continue;
    want.set(n, { x: n.x, y: n.y });
    if (!p.parentId && (rootOf(idx, n).layout || 'map') === 'map') n.side = n.x + n.w / 2 < p.x + p.w / 2 ? 'l' : 'r';
    delete n.ox;
    delete n.oy;
  }
  if (!want.size) return;
  layoutMindMaps(elements);
  for (const [n, w] of want) {
    const ox = Math.round(w.x - n.x), oy = Math.round(w.y - n.y);
    if (ox) n.ox = ox;
    if (oy) n.oy = oy;
  }
}

// Elle verilmiş kaymaları siler (düğümler ve bütün alt dalları); bir şey değiştiyse true.
export function resetPlacement(elements, nodes) {
  const idx = mindIndex(elements);
  let any = false;
  for (const n of nodes) {
    for (const c of subtree(idx, n)) {
      if (c.ox || c.oy) any = true;
      delete c.ox;
      delete c.oy;
    }
  }
  return any;
}

export const hasPlacement = (elements, nodes) => {
  const idx = mindIndex(elements);
  return nodes.some((n) => subtree(idx, n).some((c) => c.ox || c.oy));
};

// ---------- Ok tuşlarıyla gezinme ----------

export function navigate(elements, n, key) {
  const idx = mindIndex(elements);
  const root = rootOf(idx, n);
  const tree = (root.layout || 'map') === 'tree';
  const p = n.parentId && idx.byId.get(n.parentId);
  const kids = n.collapsed ? [] : idx.childrenOf(n);
  // Ekranda bu yöndeki en yakın kardeş (birinci seviyede aynı taraftakiler).
  const sibling = (d) => {
    if (!p) return null;
    const sibs = idx.childrenOf(p).filter((c) => p.depth || tree || (c.side === 'l') === (n.side === 'l'));
    return sibs[sibs.indexOf(n) + d] || null;
  };
  // Çocuklardan ortaya en yakın olan (ilk açıldığında akıllıca bir başlangıç).
  const middle = (list) => list.length ? list[Math.floor((list.length - 1) / 2)] : null;
  if (tree) {
    if (key === 'ArrowDown') return middle(kids);
    if (key === 'ArrowUp') return p || null;
    return sibling(key === 'ArrowRight' ? 1 : -1);
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') return sibling(key === 'ArrowDown' ? 1 : -1);
  const toward = key === 'ArrowRight' ? 'r' : 'l';
  if (!n.depth) return middle(kids.filter((c) => (root.layout || 'map') !== 'map' || (c.side === 'l') === (toward === 'l')));
  return n.edir === toward ? middle(kids) : p || null;
}

// ---------- Metinden mind map (Markdown / girintili liste) ----------

function cleanMd(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/!\[\[[^\]]*\]\]/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]#|]+)(#[^\]]*)?\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/==(.+?)==/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s\^[\w-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Satırlardan ağaç çıkarır: başlıklar (#) seviyelerini, maddeler ve düz satırlar girintilerini verir.
export function parseOutline(text) {
  const lines = text.replace(/\t/g, '    ').split(/\r?\n/);
  let start = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    if (end > 0) start = end + 1;
  }
  const rows = [];
  let inCode = false;
  for (const raw of lines.slice(start)) {
    if (/^\s*(```|~~~)/.test(raw)) { inCode = !inCode; continue; }
    if (inCode || !raw.trim() || /^\s*(\||[-*_]{3,}\s*$)/.test(raw)) continue;
    const ind = raw.length - raw.trimStart().length;
    const h = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(raw);
    if (h) {
      rows.push({ head: h[1].length, text: cleanMd(h[2]) });
      continue;
    }
    const li = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/.exec(raw);
    const body = li ? li[1] : raw.trim().replace(/^>\s*/, '');
    const t = cleanMd(body);
    if (t) rows.push({ ind, text: t });
  }
  // Girinti birimi: girintili satırlardaki en küçük girinti.
  const unit = Math.min(...rows.filter((r) => r.ind > 0).map((r) => r.ind), Infinity);
  const u = Number.isFinite(unit) ? unit : 2;
  const roots = [];
  const stack = [];
  let base = 0;
  for (const r of rows) {
    let level;
    if (r.head) {
      level = r.head;
      base = r.head;
    } else level = base + 1 + Math.round(r.ind / u);
    const node = { text: r.text.slice(0, 300), children: [] };
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else roots.push(node);
    stack.push({ level, node });
  }
  return roots;
}

// Ayrıştırılmış ağacı düğüm öğelerine çevirir. parent verilirse onun altına eklenir; yoksa
// (x, y) ortalı yeni bir kök kurulur (birden çok üst madde varsa title başlıklı bir kökün altına).
export function buildFromOutline(elements, roots, { parent = null, x = 0, y = 0, title = '', limit = 400 } = {}) {
  const out = [];
  if (!roots.length) return out;
  let top = parent;
  let list = roots;
  if (!top) {
    const single = roots.length === 1;
    top = makeRoot(x, y, single ? roots[0].text : title);
    list = single ? roots[0].children : roots;
    out.push(top);
  }
  const idx = mindIndex(elements);
  const base = top.depth || 0;
  const startOrder = parent ? idx.childrenOf(parent).length : 0;
  let l = 0, r = 0;
  if (!base) for (const c of idx.childrenOf(top)) (c.side === 'l' ? (l += 1) : (r += 1));
  const count = (n) => 1 + n.children.reduce((s, c) => s + count(c), 0);
  const add = (src, par, depth, order) => {
    if (out.length >= limit) return;
    const n = { id: newId(), type: 'mindnode', text: src.text, parentId: par.id, order, fontSize: fontFor(depth), x: top.x, y: top.y, w: 0, h: 0 };
    if (depth === 1) {
      const k = count(src);
      n.side = l < r ? 'l' : 'r';
      if (n.side === 'l') l += k;
      else r += k;
    }
    out.push(n);
    src.children.forEach((c, i) => add(c, n, depth + 1, i));
  };
  list.forEach((c, i) => add(c, top, base + 1, startOrder + i));
  if (parent) delete parent.collapsed;
  return out;
}

// Dalın Markdown ana hattı: kök başlık, alt dallar girintili madde.
export function toOutline(elements, n) {
  const idx = mindIndex(elements);
  const line = (s) => (s || '').replace(/\s*\n\s*/g, ' ').trim();
  const lines = [n.depth ? `- ${line(n.text)}` : `# ${line(n.text)}`];
  const walk = (p, d) => {
    for (const c of idx.childrenOf(p)) {
      lines.push(`${'  '.repeat(d)}- ${line(c.text)}`);
      walk(c, d + 1);
    }
  };
  walk(n, n.depth ? 1 : 0);
  return lines.join('\n');
}

// ---------- Sıradan nesnelere dönüştürme ----------
// Her düğüm bir şekil + yazıya, her kenar kavisli bir çizgiye dönüşür; hepsi tek grup olur.
export function flatten(nodes) {
  const gid = newId();
  const out = [];
  const sample = (el) => {
    const [x0, y0, c1x, c1y, c2x, c2y, x1, y1] = mindEdgeCurve(el);
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, u = 1 - t;
      pts.push([
        u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x1,
        u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y1,
        0.5,
      ]);
    }
    return pts;
  };
  for (const n of nodes) {
    if (n.hidden) continue;
    const c = n.branch || n.color || ROOT_COLOR;
    if (n.edir) out.push({ id: newId(), type: 'stroke', points: sample(n), color: c, width: mindEdgeWidth(n), pressure: false, groupId: gid });
    const shape = mindShape(n);
    if (shape === 'pill' || shape === 'rounded') {
      // radius: düğümün köşe yuvarlaklığı (hap biçimi dahil) korunur.
      const radius = shape === 'pill' ? n.h / 2 : Math.min(10, n.h / 3);
      out.push({ id: newId(), type: 'rect', x: n.x, y: n.y, w: n.w, h: n.h, radius, color: c, width: 1.6, fill: n.fill || (n.depth ? 'soft' : 'solid'), groupId: gid });
    } else if (shape === 'underline') {
      out.push({ id: newId(), type: 'line', x1: n.x, y1: n.y + n.h, x2: n.x + n.w, y2: n.y + n.h, color: c, width: n.depth ? mindEdgeWidth(n) : 3, groupId: gid });
    }
    const p = mindPad(n);
    if (n.text) {
      // Liste biçimi düğümde yoktur; kaydırılmış satırlar ayrı satır olarak yazılır.
      const t = { id: newId(), type: 'text', x: n.x + p.x, y: n.y + p.y, text: mindWrappedText(n), color: mindTextColor(n), fontSize: n.fontSize, groupId: gid };
      for (const k of ['bold', 'italic', 'underline', 'align']) if (n[k]) t[k] = n[k];
      out.push(Object.assign(t, measureText(t.text, t.fontSize, t)));
    }
  }
  return out;
}
