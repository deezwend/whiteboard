// Ekranda duran, taşınıp döndürülebilen cetvel. Tüm ölçüler ekran pikseli cinsindendir,
// bu yüzden tahta kaydırılınca/yakınlaştırılınca cetvel yerinde kalır.

export const RULER_LENGTH = 720;
export const RULER_WIDTH = 76;
const KNOB_RADIUS = 17;
const KNOB_OFFSET = RULER_LENGTH / 2 - 32;
const EDGE_SNAP = 30; // kenara bu kadar yakın başlayan kalem çizgisi kenara yapışır

export function createRuler(cx, cy) {
  return { cx, cy, angle: 0 };
}

// Ekran noktasını cetvelin yerel eksenlerine çevirir: u boyuna, v enine.
export function toLocal(r, x, y) {
  const dx = x - r.cx;
  const dy = y - r.cy;
  const c = Math.cos(r.angle);
  const s = Math.sin(r.angle);
  return { u: dx * c + dy * s, v: -dx * s + dy * c };
}

export function fromLocal(r, u, v) {
  const c = Math.cos(r.angle);
  const s = Math.sin(r.angle);
  return { x: r.cx + u * c - v * s, y: r.cy + u * s + v * c };
}

// 'knob' (döndürme düğmesi), 'body' (gövde) veya null.
export function rulerHit(r, x, y) {
  const { u, v } = toLocal(r, x, y);
  if (Math.hypot(u - KNOB_OFFSET, v - 6) <= KNOB_RADIUS + 3) return 'knob';
  if (Math.abs(u) <= RULER_LENGTH / 2 && Math.abs(v) <= RULER_WIDTH / 2) return 'body';
  return null;
}

// Nokta cetvelin bir kenarının hemen dışındaysa o kenarı döndürür: -1 üst, +1 alt.
export function nearEdge(r, x, y) {
  const { u, v } = toLocal(r, x, y);
  if (Math.abs(u) > RULER_LENGTH / 2 + EDGE_SNAP) return 0;
  const half = RULER_WIDTH / 2;
  if (v < -half && v >= -half - EDGE_SNAP) return -1;
  if (v > half && v <= half + EDGE_SNAP) return 1;
  return 0;
}

// Ekrandaki noktayı, verilen kenar boyunca `offset` kadar dışarıdaki çizgiye izdüşürür.
export function projectOnEdge(r, x, y, side, offset) {
  const { u } = toLocal(r, x, y);
  return fromLocal(r, u, side * (RULER_WIDTH / 2 + offset));
}

// Açıyı 0–359 derece olarak döndürür (ekranda saat yönünün tersi pozitif).
export function angleDegrees(r) {
  return Math.round(((-r.angle * 180) / Math.PI % 360 + 360) % 360) % 360;
}

// Döndürürken 0/45/90… derecelere 2° yakınlıkta mıknatıslanır.
export function snapAngle(a) {
  const step = Math.PI / 4;
  const snapped = Math.round(a / step) * step;
  return Math.abs(snapped - a) < (2 * Math.PI) / 180 ? snapped : a;
}

export function drawRuler(ctx, r) {
  const L = RULER_LENGTH;
  const W = RULER_WIDTH;
  ctx.save();
  ctx.translate(r.cx, r.cy);
  ctx.rotate(r.angle);

  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = 'rgba(236, 240, 247, 0.88)';
  ctx.beginPath();
  ctx.roundRect(-L / 2, -W / 2, L, W, 8);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(70, 80, 100, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Çentikler: her 10 pikselde küçük, 50'de orta, 100'de uzun ve numaralı.
  ctx.strokeStyle = 'rgba(40, 45, 60, 0.75)';
  ctx.fillStyle = 'rgba(40, 45, 60, 0.8)';
  ctx.font = '10px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.beginPath();
  for (let i = 0, u = -L / 2 + 10; u <= L / 2 - 10; u += 10, i++) {
    const len = i % 10 === 0 ? 14 : i % 5 === 0 ? 10 : 6;
    ctx.moveTo(u, -W / 2);
    ctx.lineTo(u, -W / 2 + len);
    ctx.moveTo(u, W / 2);
    ctx.lineTo(u, W / 2 - len);
    if (i % 10 === 0 && i) {
      ctx.textBaseline = 'top';
      ctx.fillText(String(i / 10), u, -W / 2 + 16);
    }
  }
  ctx.stroke();

  // Ortada açı göstergesi.
  ctx.font = '600 15px "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1f2328';
  ctx.fillText(angleDegrees(r) + '°', 0, 8);

  // Döndürme düğmesi.
  ctx.beginPath();
  ctx.arc(KNOB_OFFSET, 6, KNOB_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(74, 124, 240, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(KNOB_OFFSET, 6, 8, -Math.PI * 0.9, Math.PI * 0.6);
  ctx.stroke();
  const tip = { x: KNOB_OFFSET + 8 * Math.cos(Math.PI * 0.6), y: 6 + 8 * Math.sin(Math.PI * 0.6) };
  ctx.beginPath();
  ctx.moveTo(tip.x - 4, tip.y - 1);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineTo(tip.x + 1, tip.y - 4);
  ctx.stroke();
  ctx.restore();
}
