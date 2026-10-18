// Öğeleri ve arka planı tuvale çizer.
import { FONT_FAMILY, LINE_HEIGHT, NOTE_PADDING, arrowHeadSize, normRect, BRUSH_WIDTH } from './geometry.js';
import { compileFunction, functionLabel } from './mathexpr.js';

// Açılmış gizleme bantlarının kimlikleri. Dosyaya kaydedilmez: tahta her açıldığında bantlar kapalıdır.
export const revealedCovers = new Set();
// Öğrenci modu kapalıyken formül resimleri yerine düz metin çizilir.
export const renderOpts = { math: true };

const imageCache = new Map();
let onImageLoad = () => {};

export function setImageLoadCallback(cb) {
  onImageLoad = cb;
}

export function getImage(src) {
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.onload = () => onImageLoad();
    img.src = src;
    imageCache.set(src, img);
  }
  return img;
}

const measureCtx = document.createElement('canvas').getContext('2d');

export function font(size) {
  return `${size}px ${FONT_FAMILY}`;
}

// Metin öğesinin genişlik/yüksekliğini hesaplar.
export function measureText(text, fontSize) {
  measureCtx.font = font(fontSize);
  const lines = text.split('\n');
  let w = 0;
  for (const line of lines) w = Math.max(w, measureCtx.measureText(line).width);
  return { w: Math.max(w, fontSize * 0.5), h: lines.length * fontSize * LINE_HEIGHT };
}

// Notun içindeki metnin satır kaydırmalı yüksekliği.
export function wrappedHeight(text, fontSize, maxWidth) {
  measureCtx.font = font(fontSize);
  return wrapText(measureCtx, text, maxWidth).length * fontSize * LINE_HEIGHT;
}

export function wrapText(ctx, text, maxWidth) {
  const out = [];
  for (const para of text.split('\n')) {
    if (!para) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      const test = line + word;
      if (ctx.measureText(test).width <= maxWidth || !line) {
        // Tek başına sığmayan uzun kelimeyi harf harf böl.
        if (!line && ctx.measureText(word).width > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
              out.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          line = chunk;
        } else line = test;
      } else {
        out.push(line.trimEnd());
        line = word.trimStart();
      }
    }
    out.push(line);
  }
  return out;
}

function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function fillStyle(el) {
  if (el.fill === 'soft') return hexToRgba(el.color, 0.18);
  if (el.fill === 'solid') return el.color;
  return null;
}

// Noktalar arasından orta noktalara ikinci derece eğrilerle geçerek yumuşak çizgi.
function tracePath(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 2) {
    ctx.lineTo(pts[1][0], pts[1][1]);
    return;
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
}

// Kalem baskısına göre parça kalınlığı.
function segWidth(el, p0, p1) {
  return el.pressure ? el.width * (0.35 + ((p0[2] + p1[2]) / 2) * 1.1) : el.width;
}

// Çizgiyi parça parça çizer; her parçadan önce style(i, mesafe) çağrılır (renk).
// widths verilirse parça kalınlığı, parçanın ortasındaki noktanın kalınlığıdır.
function drawSegments(ctx, el, style, widths = null) {
  const pts = el.points;
  let dist = 0;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    style(i, dist);
    dist += Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    ctx.lineWidth = widths ? widths[i - 1] : segWidth(el, p0, p1);
    ctx.beginPath();
    const m0x = i > 1 ? (pts[i - 1][0] + pts[i - 2][0]) / 2 : p0[0];
    const m0y = i > 1 ? (pts[i - 1][1] + pts[i - 2][1]) / 2 : p0[1];
    const m1x = (p0[0] + p1[0]) / 2;
    const m1y = (p0[1] + p1[1]) / 2;
    ctx.moveTo(m0x, m0y);
    ctx.quadraticCurveTo(p0[0], p0[1], m1x, m1y);
    if (i === pts.length - 1) ctx.lineTo(p1[0], p1[1]);
    ctx.stroke();
  }
}

const GALAXY_COLORS = [[27, 31, 107], [75, 43, 179], [162, 59, 214], [47, 111, 224]];
const galaxyPalettes = new Map();

// el.galaxy (#rrggbb) varsa o renkten koyu → ana renk → açık → komşu ton geçişli bir palet
// türetilir; yoksa klasik uzay renkleri kullanılır.
function galaxyPalette(el) {
  const hex = el.galaxy;
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return GALAXY_COLORS;
  let pal = galaxyPalettes.get(hex);
  if (!pal) {
    const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
    const mix = (t, f) => c.map((v, k) => Math.round(v + (t[k] - v) * f));
    // Ana rengin kanallarını kaydırarak yakın bir ton elde edilir (örn. mor → mavi).
    const shifted = [c[2], c[0], c[1]];
    pal = [mix([8, 8, 20], 0.7), c, mix([255, 255, 255], 0.3), mix(shifted, 0.45)];
    galaxyPalettes.set(hex, pal);
  }
  return pal;
}

function galaxyColor(dist, pal = GALAXY_COLORS) {
  const t = (dist / 90) % pal.length;
  const a = pal[Math.floor(t)];
  const b = pal[(Math.floor(t) + 1) % pal.length];
  const f = t - Math.floor(t);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Öğe kimliğinden türetilen sabit sözde rastgele sayılar: yıldızlar her çizimde aynı yerde kalır.
function seededRandom(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function drawGalaxyStars(ctx, el) {
  const pts = el.points;
  const rnd = seededRandom(el.id);
  const gap = Math.max(4, el.width * 1.2);
  let next = rnd() * gap;
  let dist = 0;
  ctx.fillStyle = '#ffffff';
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const half = segWidth(el, pts[i - 1], pts[i]) / 2;
    while (next <= dist + len && len > 0) {
      const f = (next - dist) / len;
      const nx = -(y1 - y0) / len;
      const ny = (x1 - x0) / len;
      const off = (rnd() * 2 - 1) * half * 0.7;
      const r = Math.max(0.5, half * (0.08 + rnd() * 0.16));
      ctx.globalAlpha = 0.55 + rnd() * 0.45;
      ctx.beginPath();
      ctx.arc(x0 + (x1 - x0) * f + nx * off, y0 + (y1 - y0) * f + ny * off, r, 0, Math.PI * 2);
      ctx.fill();
      next += gap * (0.5 + rnd());
    }
    dist += len;
  }
}

// Bant (washi) fırçasının çapraz çizgili deseni; her tuval bağlamı için bir kez oluşturulur.
const tapePatterns = new WeakMap();
function tapePattern(ctx) {
  let p = tapePatterns.get(ctx);
  if (!p) {
    const c = document.createElement('canvas');
    c.width = c.height = 12;
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 3;
    g.beginPath();
    for (let k = -12; k <= 24; k += 12) {
      g.moveTo(k, 12);
      g.lineTo(k + 12, 0);
    }
    g.stroke();
    p = ctx.createPattern(c, 'repeat');
    tapePatterns.set(ctx, p);
  }
  return p;
}

// Kaligrafi ucu sağ üstten sol alta 45° eğik durur: bu yöne paralel çizgiler incelir, dik olanlar kalınlaşır.
const NIB_X = Math.cos(-Math.PI / 4);
const NIB_Y = Math.sin(-Math.PI / 4);

function pressureFactor(el, p) {
  return el.pressure ? 0.35 + p[2] * 1.1 : 1;
}

function drawCalligraphy(ctx, el) {
  const pts = el.points;
  const half = (p) => (el.width * BRUSH_WIDTH.calligraphy * pressureFactor(el, p)) / 2;
  // Her parça, ucun iki konumu arasındaki dörtgendir. Hepsi aynı yönde dolanır ki
  // 'nonzero' dolgu çakışan parçalarda delik bırakmasın.
  ctx.beginPath();
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const h0 = half(p0);
    const h1 = half(p1);
    const quad = [
      [p0[0] + NIB_X * h0, p0[1] + NIB_Y * h0],
      [p1[0] + NIB_X * h1, p1[1] + NIB_Y * h1],
      [p1[0] - NIB_X * h1, p1[1] - NIB_Y * h1],
      [p0[0] - NIB_X * h0, p0[1] - NIB_Y * h0],
    ];
    const cross = (p1[0] - p0[0]) * NIB_Y - (p1[1] - p0[1]) * NIB_X;
    if (cross < 0) quad.reverse();
    quad.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
  ctx.fill();
  // Uca paralel giderken çizgi tamamen kaybolmasın diye ince bir iz.
  ctx.lineWidth = Math.max(0.6, el.width * 0.3);
  ctx.beginPath();
  tracePath(ctx, pts);
  ctx.stroke();
}

// Fırça ve dolma kalem: hızlı çizilen yerler incelir, uçlar sivrilir.
// Hız, noktalar arası mesafenin çizginin ortanca mesafesine oranıdır; böylece
// fare/kalem örnekleme hızından ve yakınlaştırmadan bağımsızdır.
const widthCache = new WeakMap();
function inkWidths(el) {
  const pts = el.points;
  const hit = widthCache.get(pts);
  if (hit && hit.len === pts.length && hit.width === el.width && hit.brush === el.brush) return hit.widths;
  const brush = el.brush === 'brushpen';
  const n = pts.length;
  const d = pts.map((p, i) => (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0));
  const sorted = d.slice(1).sort((a, b) => a - b);
  const med = Math.max(sorted[Math.floor(sorted.length / 2)] || 1, 0.5);
  let f = d.map((di, i) => {
    const sp = (i ? di : d[1] || 0) / med;
    return brush ? Math.min(1.45, Math.max(0.35, 1.5 - sp * 0.4)) : Math.min(1.12, Math.max(0.65, 1.15 - sp * 0.12));
  });
  // İleri ve geri yumuşatma: kalınlık ani sıçramasın.
  for (let i = 1; i < n; i++) f[i] = f[i - 1] + (f[i] - f[i - 1]) * 0.25;
  for (let i = n - 2; i >= 0; i--) f[i] = f[i + 1] + (f[i] - f[i + 1]) * 0.25;
  // Uçların sivrilmesi: başta ve sonda belli bir uzunluk boyunca incelir.
  const total = d.reduce((a, b) => a + b, 0);
  const startLen = el.width * (brush ? 4 : 1.5);
  const endLen = el.width * (brush ? 5 : 2.5);
  let acc = 0;
  const widths = pts.map((p, i) => {
    acc += d[i];
    const ts = Math.min(1, acc / startLen);
    const te = Math.min(1, (total - acc) / endLen);
    const taper = (brush ? 0.12 : 0.35) + (brush ? 0.88 : 0.65) * Math.sqrt(Math.min(ts, te));
    return el.width * BRUSH_WIDTH[el.brush] * f[i] * taper * pressureFactor(el, p);
  });
  widthCache.set(pts, { len: n, width: el.width, brush: el.brush, widths });
  return widths;
}

// Oklu fırça: çizginin son yönüne bakan ok ucu.
function drawStrokeArrowHead(ctx, el) {
  const pts = el.points;
  const end = pts[pts.length - 1];
  const size = arrowHeadSize(el);
  let from = pts[0];
  for (let i = pts.length - 2; i >= 0; i--) {
    from = pts[i];
    if (Math.hypot(end[0] - from[0], end[1] - from[1]) >= size * 0.8) break;
  }
  if (from[0] === end[0] && from[1] === end[1]) return;
  const angle = Math.atan2(end[1] - from[1], end[0] - from[0]);
  ctx.lineWidth = el.pressure ? segWidth(el, end, end) : el.width;
  ctx.beginPath();
  ctx.moveTo(end[0] - size * Math.cos(angle - Math.PI / 7), end[1] - size * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(end[0], end[1]);
  ctx.lineTo(end[0] - size * Math.cos(angle + Math.PI / 7), end[1] - size * Math.sin(angle + Math.PI / 7));
  ctx.stroke();
}

function drawStroke(ctx, el) {
  const pts = el.points;
  const brush = el.highlighter ? 'normal' : el.brush || 'normal';
  ctx.lineCap = brush === 'tape' ? 'butt' : 'round';
  ctx.lineJoin = 'round';
  const color = brush === 'rainbow' ? 'hsl(0, 90%, 55%)' : brush === 'galaxy' ? galaxyColor(0, galaxyPalette(el)) : el.color;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  // Dışarıdan verilen saydamlık (geçici fosforlu kalemin sönmesi) korunur.
  const baseAlpha = ctx.globalAlpha;
  if (el.highlighter) {
    ctx.globalAlpha = baseAlpha * 0.38;
  } else if (brush === 'tape') {
    ctx.globalAlpha = baseAlpha * 0.85;
  }

  if (pts.length === 1) {
    ctx.beginPath();
    if (brush === 'tape') ctx.rect(pts[0][0] - el.width / 2, pts[0][1] - el.width / 2, el.width, el.width);
    else ctx.arc(pts[0][0], pts[0][1], el.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = baseAlpha;
    return;
  }

  if (brush === 'calligraphy') {
    drawCalligraphy(ctx, el);
  } else if (brush === 'brushpen' || brush === 'fountain') {
    drawSegments(ctx, el, () => {}, inkWidths(el));
  } else if (brush === 'rainbow') {
    drawSegments(ctx, el, (i, d) => { ctx.strokeStyle = `hsl(${(d * 0.6) % 360}, 90%, 55%)`; });
  } else if (brush === 'galaxy') {
    const pal = galaxyPalette(el);
    drawSegments(ctx, el, (i, d) => { ctx.strokeStyle = galaxyColor(d, pal); });
    drawGalaxyStars(ctx, el);
  } else if (brush === 'tape' || brush === 'dashed' || brush === 'dashedarrow' || !el.pressure || el.highlighter) {
    ctx.lineWidth = el.width;
    if (brush === 'dashed' || brush === 'dashedarrow') ctx.setLineDash([el.width * 1.5, el.width * 2.5]);
    ctx.beginPath();
    tracePath(ctx, pts);
    ctx.stroke();
    if (brush === 'tape') {
      ctx.strokeStyle = tapePattern(ctx);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  } else {
    // Kalem baskısına göre değişken kalınlık: her parça ayrı kalınlıkta çizilir.
    drawSegments(ctx, el, () => {});
  }
  if (brush === 'arrow' || brush === 'dashedarrow') drawStrokeArrowHead(ctx, el);
  ctx.globalAlpha = baseAlpha;
}

function drawArrowHead(ctx, el) {
  const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
  const size = arrowHeadSize(el);
  ctx.beginPath();
  ctx.moveTo(el.x2 - size * Math.cos(angle - Math.PI / 7), el.y2 - size * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(el.x2, el.y2);
  ctx.lineTo(el.x2 - size * Math.cos(angle + Math.PI / 7), el.y2 - size * Math.sin(angle + Math.PI / 7));
  ctx.stroke();
}

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawElement(ctx, el, hideText = false) {
  ctx.save();
  if (el.rot) {
    // Döndürülmüş kutu öğesi: merkezi etrafında döndürülüp düz hâli gibi çizilir.
    const b = normRect(el.x, el.y, el.w, el.h);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(el.rot);
    ctx.translate(-cx, -cy);
  }
  switch (el.type) {
    case 'stroke':
      drawStroke(ctx, el);
      break;

    case 'line':
    case 'arrow':
      ctx.strokeStyle = el.color;
      ctx.lineWidth = el.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(el.x1, el.y1);
      ctx.lineTo(el.x2, el.y2);
      ctx.stroke();
      if (el.type === 'arrow') drawArrowHead(ctx, el);
      break;

    case 'rect':
    case 'ellipse':
    case 'polygon': {
      const b = el.type === 'polygon' ? null : normRect(el.x, el.y, el.w, el.h);
      ctx.beginPath();
      if (el.type === 'polygon') {
        el.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
      } else if (el.type === 'rect') roundRectPath(ctx, b.x, b.y, b.w, b.h, Math.min(8, el.width * 2));
      else ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
      const f = fillStyle(el);
      if (f) {
        ctx.fillStyle = f;
        ctx.fill();
      }
      ctx.strokeStyle = el.color;
      ctx.lineWidth = el.width;
      ctx.lineJoin = 'round';
      ctx.stroke();
      break;
    }

    case 'text': {
      if (hideText) break;
      // Formüllü metin ($…$) ana süreçte KaTeX ile resme çevrilir; resim yazıyla eşleşiyorsa o çizilir.
      if (renderOpts.math && el.math?.src && el.math.text === el.text) {
        const img = getImage(el.math.src);
        if (img.complete && img.naturalWidth) {
          ctx.drawImage(img, el.x, el.y, el.w, el.h);
          break;
        }
      }
      ctx.fillStyle = el.color;
      ctx.font = font(el.fontSize);
      ctx.textBaseline = 'top';
      const lh = el.fontSize * LINE_HEIGHT;
      const pad = (lh - el.fontSize) / 2;
      el.text.split('\n').forEach((line, i) => ctx.fillText(line, el.x, el.y + pad + i * lh));
      break;
    }

    case 'note': {
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = el.color;
      roundRectPath(ctx, el.x, el.y, el.w, el.h, 4);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      if (hideText) break;
      ctx.fillStyle = '#1f2328';
      ctx.font = font(el.fontSize);
      ctx.textBaseline = 'top';
      const lh = el.fontSize * LINE_HEIGHT;
      const pad = (lh - el.fontSize) / 2;
      const lines = wrapText(ctx, el.text, el.w - NOTE_PADDING * 2);
      ctx.beginPath();
      ctx.rect(el.x, el.y, el.w, el.h);
      ctx.clip();
      lines.forEach((line, i) => ctx.fillText(line, el.x + NOTE_PADDING, el.y + NOTE_PADDING + pad + i * lh));
      break;
    }

    case 'image': {
      const img = getImage(el.src);
      const b = normRect(el.x, el.y, el.w, el.h);
      if (img.complete && img.naturalWidth) ctx.drawImage(img, b.x, b.y, b.w, b.h);
      else {
        ctx.fillStyle = '#eef0f4';
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      break;
    }

    case 'cover':
      drawCover(ctx, el);
      break;

    case 'axes':
      drawAxes(ctx, el);
      break;
  }
  ctx.restore();
}

// Gizleme bandı: kapalıyken altını tamamen örten desenli şerit, açıkken yalnızca kesikli çerçeve.
function drawCover(ctx, el) {
  const b = normRect(el.x, el.y, el.w, el.h);
  const r = Math.min(6, b.w / 2, b.h / 2);
  if (revealedCovers.has(el.id)) {
    roundRectPath(ctx, b.x, b.y, b.w, b.h, r);
    ctx.fillStyle = hexToRgba(el.color, 0.07);
    ctx.fill();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = hexToRgba(el.color, 0.65);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return;
  }
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  roundRectPath(ctx, b.x, b.y, b.w, b.h, r);
  ctx.fillStyle = el.color;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = tapePattern(ctx);
  ctx.fill();
  // Ortadaki soru işareti bandın altında bir şey saklandığını belli eder.
  const size = Math.min(b.h * 0.55, b.w * 0.5, 30);
  if (size >= 9) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `600 ${size}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', b.x + b.w / 2, b.y + b.h / 2 + size * 0.04);
  }
}

// Fonksiyon ifadeleri bir kez derlenir.
const fnCache = new Map();
function compiled(expr) {
  let c = fnCache.get(expr);
  if (!c) {
    c = compileFunction(expr);
    fnCache.set(expr, c);
  }
  return c.fn || null;
}

// Etiketlerin birbirine girmemesi için kaç birimde bir sayı yazılacağı.
function labelStep(unit) {
  for (const k of [1, 2, 5, 10, 20, 50, 100, 200, 500]) if (unit * k >= 26) return k;
  return 1000;
}

function arrowTip(ctx, x, y, angle, size) {
  ctx.beginPath();
  ctx.moveTo(x - size * Math.cos(angle - 0.45), y - size * Math.sin(angle - 0.45));
  ctx.lineTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle + 0.45), y - size * Math.sin(angle + 0.45));
  ctx.stroke();
}

// Koordinat sistemi: (ox, oy) başlangıç noktası, unit bir birimin dünya uzunluğu; y yukarı doğru artar.
function drawAxes(ctx, el) {
  const b = normRect(el.x, el.y, el.w, el.h);
  const u = el.unit;
  const { ox, oy } = el;
  ctx.beginPath();
  ctx.rect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const i0 = Math.ceil((b.x - ox) / u);
  const i1 = Math.floor((b.x + b.w - ox) / u);
  const j0 = Math.ceil((b.y - oy) / u);
  const j1 = Math.floor((b.y + b.h - oy) / u);

  if (el.grid && i1 - i0 < 400 && j1 - j0 < 400) {
    ctx.strokeStyle = hexToRgba(el.color, 0.13);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      ctx.moveTo(ox + i * u, b.y);
      ctx.lineTo(ox + i * u, b.y + b.h);
    }
    for (let j = j0; j <= j1; j++) {
      ctx.moveTo(b.x, oy + j * u);
      ctx.lineTo(b.x + b.w, oy + j * u);
    }
    ctx.stroke();
  }

  const fs = Math.max(10, Math.min(16, u * 0.34));
  const step = labelStep(u);
  const tick = Math.min(6, u * 0.18);
  const hasX = oy >= b.y && oy <= b.y + b.h;
  const hasY = ox >= b.x && ox <= b.x + b.w;
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.color;
  ctx.lineWidth = 2;
  ctx.font = `${fs}px ${FONT_FAMILY}`;
  if (hasX) {
    ctx.beginPath();
    ctx.moveTo(b.x, oy);
    ctx.lineTo(b.x + b.w, oy);
    ctx.stroke();
    arrowTip(ctx, b.x + b.w, oy, 0, 11);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      if (!i || ox + i * u > b.x + b.w - 14) continue;
      ctx.moveTo(ox + i * u, oy - tick);
      ctx.lineTo(ox + i * u, oy + tick);
    }
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = Math.ceil(i0 / step) * step; i <= i1; i += step) {
      if (i && ox + i * u <= b.x + b.w - 18) ctx.fillText(String(i), ox + i * u, oy + tick + 3);
    }
    ctx.font = `italic 600 ${fs * 1.15}px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('x', b.x + b.w - 4, oy - 8);
    ctx.font = `${fs}px ${FONT_FAMILY}`;
  }
  if (hasY) {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ox, b.y + b.h);
    ctx.lineTo(ox, b.y);
    ctx.stroke();
    arrowTip(ctx, ox, b.y, -Math.PI / 2, 11);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let j = j0; j <= j1; j++) {
      if (!j || oy + j * u < b.y + 14) continue;
      ctx.moveTo(ox - tick, oy + j * u);
      ctx.lineTo(ox + tick, oy + j * u);
    }
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let j = Math.ceil(j0 / step) * step; j <= j1; j += step) {
      if (j && oy + j * u >= b.y + 18) ctx.fillText(String(-j), ox - tick - 4, oy + j * u);
    }
    ctx.font = `italic 600 ${fs * 1.15}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('y', ox + 9, b.y + 2);
    ctx.font = `${fs}px ${FONT_FAMILY}`;
  }
  if (hasX && hasY) {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('0', ox - 4, oy + 3);
  }

  // Fonksiyon grafikleri: kutu genişliği boyunca örneklenir; tanımsız yerlerde ve
  // dikey asimptotlarda (ör. tan, 1/x) çizgi kesilir.
  const fns = el.fns || [];
  const n = Math.min(3000, Math.max(60, Math.ceil(b.w / 1.5)));
  fns.forEach((fn) => {
    const f = compiled(fn.expr);
    if (!f) return;
    ctx.strokeStyle = fn.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let down = false;
    let prev = 0;
    for (let s = 0; s <= n; s++) {
      const wx = b.x + (b.w * s) / n;
      const wy = oy - f((wx - ox) / u) * u;
      if (!Number.isFinite(wy) || Math.abs(wy - (b.y + b.h / 2)) > b.h * 20) {
        down = false;
        continue;
      }
      if (down && Math.abs(wy - prev) > b.h * 1.5) down = false;
      if (down) ctx.lineTo(wx, wy);
      else ctx.moveTo(wx, wy);
      down = true;
      prev = wy;
    }
    ctx.stroke();
  });
  // Lejant: sol üstte her fonksiyon kendi renginde.
  ctx.font = `600 ${fs}px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  fns.forEach((fn, k) => {
    ctx.fillStyle = fn.color;
    ctx.fillText(functionLabel(fn.expr), b.x + 6, b.y + 6 + k * fs * 1.4);
  });
}

// Arka plan deseni ekran koordinatlarında çizilir; böylece tuval sonsuz görünür.
export function drawBackground(ctx, view, width, height, pattern, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  if (pattern === 'none') return;

  const dark = isDark(color);
  let step = 40 * view.zoom;
  while (step < 14) step *= 2;
  while (step > 120) step /= 2;
  const ox = ((view.x % step) + step) % step;
  const oy = ((view.y % step) + step) % step;

  if (pattern === 'dots') {
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.22)' : 'rgba(30,40,60,0.22)';
    const r = Math.max(1, Math.min(2, view.zoom * 1.4));
    for (let x = ox; x < width; x += step) {
      for (let y = oy; y < height; y += step) {
        ctx.fillRect(x - r / 2, y - r / 2, r, r);
      }
    }
    return;
  }

  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.10)' : 'rgba(30,60,120,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (pattern === 'grid') {
    for (let x = ox; x < width; x += step) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, height);
    }
  }
  for (let y = oy; y < height; y += step) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
  }
  ctx.stroke();
}

export function isDark(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}
