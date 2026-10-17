// Ekranda duran, taşınıp döndürülebilen yarım daire açıölçer. Cetvel gibi tüm ölçüler ekran
// pikselidir ve tahtaya kaydedilmez. İki kol (a1, a2) arasındaki açı ortada gösterilir; kalemi
// yayın hemen dışında başlatınca çizgi yay boyunca çember parçası olarak çıkar.
import { toLocal } from './ruler.js';

export const PROT_R = 220;
const KNOB_RADIUS = 15;
const ARM_RADIUS = 11;
const ARM_POS = PROT_R * 0.62; // kol tutamaçlarının merkeze uzaklığı
const BASE_STRIP = 14; // taban çizgisinin altındaki şerit
const EDGE_SNAP = 30;
const KNOB = { u: PROT_R - 28, v: -18 };

export function createProtractor(cx, cy) {
  return { cx, cy, angle: 0, a1: 0, a2: Math.PI / 3 };
}

// Kol açısı t (0..π) için yerel konum; açı ekranda saat yönünün tersine artar.
function armPoint(t, r) {
  return { u: r * Math.cos(t), v: -r * Math.sin(t) };
}

// 'knob', 'arm1', 'arm2', 'body' ya da null.
export function protractorHit(p, x, y) {
  const { u, v } = toLocal(p, x, y);
  for (const [name, t] of [['arm2', p.a2], ['arm1', p.a1]]) {
    const a = armPoint(t, ARM_POS);
    if (Math.hypot(u - a.u, v - a.v) <= ARM_RADIUS + 4) return name;
  }
  if (Math.hypot(u - KNOB.u, v - KNOB.v) <= KNOB_RADIUS + 3) return 'knob';
  if (v <= 0 && Math.hypot(u, v) <= PROT_R) return 'body';
  if (v > 0 && v <= BASE_STRIP && Math.abs(u) <= PROT_R) return 'body';
  return null;
}

// Nokta yayın hemen dışındaysa (kalem yay boyunca çizsin diye) true.
export function nearArc(p, x, y) {
  const { u, v } = toLocal(p, x, y);
  const d = Math.hypot(u, v);
  return v <= 4 && d > PROT_R && d <= PROT_R + EDGE_SNAP;
}

// Kolu ekrandaki noktanın yönüne çevirir; 1° (Shift ile 5°) adımlarla.
export function setArm(p, which, x, y, coarse) {
  const { u, v } = toLocal(p, x, y);
  let t = Math.atan2(-v, u);
  if (t < 0) t = t < -Math.PI / 2 ? Math.PI : 0;
  const step = ((coarse ? 5 : 1) * Math.PI) / 180;
  p[which] = Math.min(Math.PI, Math.max(0, Math.round(t / step) * step));
}

export function protractorDegrees(p) {
  return Math.round((Math.abs(p.a2 - p.a1) * 180) / Math.PI);
}

export function drawProtractor(ctx, p) {
  const R = PROT_R;
  ctx.save();
  ctx.translate(p.cx, p.cy);
  ctx.rotate(p.angle);

  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = 'rgba(236, 240, 247, 0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, R, Math.PI, Math.PI * 2);
  ctx.lineTo(R, BASE_STRIP);
  ctx.lineTo(-R, BASE_STRIP);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(70, 80, 100, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-R, 0);
  ctx.lineTo(R, 0);
  ctx.stroke();

  // Derece çentikleri: dışta 0→180 (sağdan sola), içte ters yönde küçük ölçek.
  ctx.strokeStyle = 'rgba(40, 45, 60, 0.75)';
  ctx.beginPath();
  for (let d = 0; d <= 180; d++) {
    const len = d % 10 === 0 ? 14 : d % 5 === 0 ? 9 : 5;
    const t = (d * Math.PI) / 180;
    const c = Math.cos(t);
    const s = -Math.sin(t);
    ctx.moveTo(R * c, R * s);
    ctx.lineTo((R - len) * c, (R - len) * s);
  }
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let d = 0; d <= 180; d += 10) {
    const t = (d * Math.PI) / 180;
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(40, 45, 60, 0.85)';
    ctx.fillText(String(d), (R - 24) * Math.cos(t), -(R - 24) * Math.sin(t));
    ctx.font = '9px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(40, 45, 60, 0.5)';
    ctx.fillText(String(180 - d), (R - 40) * Math.cos(t), -(R - 40) * Math.sin(t));
  }

  // Merkez işareti.
  ctx.strokeStyle = 'rgba(40, 45, 60, 0.8)';
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(7, 0);
  ctx.moveTo(0, -7);
  ctx.lineTo(0, 5);
  ctx.stroke();

  // Kollar ve aralarındaki açı.
  const lo = Math.min(p.a1, p.a2);
  const hi = Math.max(p.a1, p.a2);
  ctx.fillStyle = 'rgba(74, 124, 240, 0.16)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 46, -hi, -lo);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.5;
  for (const [t, color] of [[p.a1, 'rgba(74, 124, 240, 0.95)'], [p.a2, 'rgba(224, 49, 49, 0.9)']]) {
    const end = armPoint(t, R);
    const h = armPoint(t, ARM_POS);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(end.u, end.v);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(h.u, h.v, ARM_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(h.u, h.v, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const mid = armPoint((lo + hi) / 2, 70);
  ctx.font = '600 16px "Segoe UI", sans-serif';
  ctx.fillStyle = '#1f2328';
  ctx.fillText(protractorDegrees(p) + '°', mid.u, mid.v);

  // Döndürme düğmesi (cetveldekiyle aynı görünüm).
  ctx.beginPath();
  ctx.arc(KNOB.u, KNOB.v, KNOB_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(74, 124, 240, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(KNOB.u, KNOB.v, 7, -Math.PI * 0.9, Math.PI * 0.6);
  ctx.stroke();
  ctx.restore();
}
