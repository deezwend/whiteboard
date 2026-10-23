// Beyaz Tahta — periyodik tablo.
//
// Tek giriş noktası: openPeriodicPicker(). Tam ekran bir pencere kurar; kullanıcı tablonun tamamını
// ya da seçtiği elementlerin ayrıntılı kartlarını eklemek isteyince çözülen bir Promise döner:
//   { kind: 'table' | 'cards', images: [{ src, w, h }] } | null
// Görüntüler canvas'ta çizilen PNG'lerdir (tahtaya sıradan resim olarak eklenir); w/h ekranda
// %100 yakınlıkta kaplayacakları boyuttur, piksel boyutu bunun SCALE katıdır (yakınlaşınca net kalsın).

import { ELEMENTS, shells, block } from './periodic-data.js';
import { t, lang, locale } from './i18n.js';

const FONT = '"Segoe UI", system-ui, sans-serif';
const TABLE_SCALE = 2;
const CARD_SCALE = 3;
const LS_OPTS = 'periodicOpts';

// Sınıflar: [ad, zemin, kenar/vurgu]
const CATS = {
  a: [t('Alkali metaller'), '#f9b4ab', '#c7453a'],
  ae: [t('Toprak alkali metaller'), '#fad3a0', '#c27717'],
  tm: [t('Geçiş metalleri'), '#f8e7a2', '#a88a0c'],
  pt: [t('Zayıf metaller'), '#c8e4b2', '#4f8a2a'],
  md: [t('Yarı metaller'), '#a6dccd', '#23806a'],
  nm: [t('Ametaller'), '#a9d0f3', '#2f6fb0'],
  h: [t('Halojenler'), '#c6c2f3', '#5b4fc4'],
  ng: [t('Soy gazlar'), '#e4bcee', '#9147a8'],
  la: [t('Lantanitler'), '#f4c3d8', '#b8467a'],
  ac: [t('Aktinitler'), '#ebcdb9', '#9a5a32'],
  un: [t('Özellikleri bilinmiyor'), '#e1e3e7', '#7a808b'],
};
const PHASES = {
  s: [t('Katı'), '#1f2328'],
  l: [t('Sıvı'), '#1d5fd1'],
  g: [t('Gaz'), '#d0285f'],
  u: [t('Bilinmiyor (yapay)'), '#8a909b'],
};
// Türkiye'deki ders kitaplarında kullanılan A/B grup adları.
const AB = ['1A', '2A', '3B', '4B', '5B', '6B', '7B', '8B', '8B', '8B', '1B', '2B', '3A', '4A', '5A', '6A', '7A', '8A'];

const nameOf = (e) => (lang === 'en' ? e.en : e.tr);
const dec = (s) => (lang === 'en' ? String(s) : String(s).replace('.', ','));
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const configText = (e) => e.config.replace(/([spdf])(\d+)/g, (_, l, n) => l + [...n].map((d) => SUP[d]).join(''));
const temp = (v) => (v == null ? '—' : `${v.toLocaleString(locale, { maximumFractionDigits: 2 })} °C`);

export function loadOpts() {
  const def = { names: true, mass: true, eneg: true, shells: true, legend: true };
  try { return { ...def, ...JSON.parse(localStorage.getItem(LS_OPTS) || '{}') }; } catch { return def; }
}

function saveOpts(o) {
  try { localStorage.setItem(LS_OPTS, JSON.stringify(o)); } catch { /* yoksay */ }
}

// ---------- Canvas yardımcıları ----------

function canvas(w, h, scale) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const cx = c.getContext('2d');
  cx.scale(scale, scale);
  cx.textBaseline = 'alphabetic';
  return { c, cx };
}

function roundRect(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.roundRect(x, y, w, h, r);
}

// Metni verilen genişliğe sığacak kadar küçülterek yazar.
function text(cx, s, x, y, { size, weight = 400, color = '#1f2328', align = 'left', max = Infinity }) {
  let sz = size;
  cx.font = `${weight} ${sz}px ${FONT}`;
  while (sz > 6 && cx.measureText(s).width > max) {
    sz -= 0.5;
    cx.font = `${weight} ${sz}px ${FONT}`;
  }
  cx.fillStyle = color;
  cx.textAlign = align;
  cx.fillText(s, x, y);
}

// ---------- Tablo ----------

const CW = 108, CH = 124, GAP = 4, SX = CW + GAP, SY = CH + GAP;
const M = 36, LW = 34, GH = 40, FGAP = 28;

// Tek bir element hücresi (sol üst köşe x, y); anahtar hücresi için de kullanılır.
function drawCell(cx, e, x, y, o) {
  const [, bg, fg] = CATS[e.cat];
  roundRect(cx, x, y, CW, CH, 8);
  cx.fillStyle = bg;
  cx.fill();
  cx.lineWidth = 1.5;
  cx.strokeStyle = fg;
  cx.stroke();
  text(cx, String(e.z), x + 8, y + 20, { size: 15, weight: 700 });
  if (o.eneg && e.eneg != null) text(cx, dec(e.eneg.toFixed(2).replace(/0$/, '')), x + CW - 8, y + 19, { size: 12, color: '#3d4250', align: 'right' });
  const sh = o.shells ? shells(e) : null;
  if (sh) {
    sh.forEach((n, i) => text(cx, String(n), x + CW - 8, y + 38 + i * 11.5, { size: 10.5, color: '#3d4250', align: 'right' }));
  }
  const symX = sh ? x + 47 : x + CW / 2;
  text(cx, e.sym, symX, y + 66, { size: 38, weight: 700, color: PHASES[e.phase][1], align: 'center', max: sh ? 76 : CW - 12 });
  if (o.names) text(cx, nameOf(e), symX, y + 90, { size: 12, align: 'center', max: sh ? 82 : CW - 10 });
  if (o.mass) text(cx, dec(e.mass), symX, y + 109, { size: 12, color: '#3d4250', align: 'center', max: sh ? 82 : CW - 10 });
}

export function renderTable(o) {
  const TH = o.legend ? 78 : 10;
  const x0 = M + LW, y0 = M + TH + GH;
  const cellX = (col) => x0 + (col - 1) * SX;
  const cellY = (row) => (row <= 7 ? y0 + (row - 1) * SY : y0 + 7 * SY + FGAP + (row - 9) * SY);
  const W = cellX(18) + CW + M;
  const H = cellY(10) + CH + (o.legend ? 44 : M);
  const { c, cx } = canvas(W, H, TABLE_SCALE);
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, W, H);

  if (o.legend) {
    text(cx, t('Elementlerin Periyodik Tablosu'), x0, M + 36, { size: 34, weight: 700 });
    text(cx, t('118 element · gruplar, periyotlar ve element sınıfları'), x0, M + 60, { size: 15, color: '#5d6372' });
  }

  // Grup başlıkları: her sütunun en üstteki hücresinin üstüne.
  for (let g = 1; g <= 18; g++) {
    const top = Math.min(...ELEMENTS.filter((e) => e.group === g).map((e) => e.row));
    const x = cellX(g) + CW / 2, y = cellY(top);
    text(cx, AB[g - 1], x, y - 22, { size: 16, weight: 700, align: 'center' });
    text(cx, String(g), x, y - 7, { size: 12, color: '#6b7180', align: 'center' });
  }
  // Periyot numaraları
  for (let p = 1; p <= 7; p++) text(cx, String(p), x0 - 14, cellY(p) + CH / 2 + 6, { size: 18, weight: 700, color: '#6b7180', align: 'center' });

  for (const e of ELEMENTS) drawCell(cx, e, cellX(e.col), cellY(e.row), o);

  // 3. gruptaki lantanit / aktinit yer tutucuları ve f bloğu satır adları
  for (const [row, cat, range, syms, frow] of [[6, 'la', '57–71', 'La–Lu', 9], [7, 'ac', '89–103', 'Ac–Lr', 10]]) {
    const [label, bg, fg] = CATS[cat];
    const x = cellX(3), y = cellY(row);
    roundRect(cx, x, y, CW, CH, 8);
    cx.fillStyle = bg;
    cx.fill();
    cx.setLineDash([5, 4]);
    cx.lineWidth = 1.5;
    cx.strokeStyle = fg;
    cx.stroke();
    cx.setLineDash([]);
    text(cx, range, x + CW / 2, y + 56, { size: 18, weight: 700, align: 'center' });
    text(cx, syms, x + CW / 2, y + 78, { size: 13, color: '#3d4250', align: 'center' });
    const fy = cellY(frow) + CH / 2;
    text(cx, label, cellX(3) - 14, fy + 2, { size: 15, weight: 700, color: fg, align: 'right' });
    text(cx, range, cellX(3) - 14, fy + 20, { size: 12, color: '#6b7180', align: 'right' });
  }

  if (o.legend) {
    drawLegend(cx, cellX(3), cellY(1), cellX(12) + CW - cellX(3), cellY(4) - 46 - cellY(1), o);
    text(cx, t('Atom kütlesi köşeli parantez içindeyse en kararlı izotopun kütle numarasıdır. Elektronegatiflik Pauling ölçeğindedir. Sembolün rengi 25 °C\'deki hâli gösterir.'),
      x0, H - 18, { size: 13, color: '#6b7180', max: W - x0 - M });
  }
  return { src: c.toDataURL('image/png'), w: W, h: H };
}

// Tablonun üst ortasındaki boşluğa: büyütülmüş örnek hücre, sınıflar ve hâl renkleri.
function drawLegend(cx, x, y, w, h, o) {
  const k = 1.5;
  const sample = ELEMENTS[25]; // Demir
  const kx = x + 130, ky = y + (h - CH * k) / 2;
  cx.save();
  cx.translate(kx, ky);
  cx.scale(k, k);
  drawCell(cx, sample, 0, 0, o);
  cx.restore();
  const sh = o.shells;
  const labels = [
    [t('Atom numarası'), 20, 'L'],
    [t('Sembol'), 62, 'L'],
    o.names && [t('Element adı'), 88, 'L'],
    o.mass && [t('Atom kütlesi'), 107, 'L'],
    o.eneg && [t('Elektronegatiflik'), 16, 'R'],
    sh && [t('Katmanlardaki elektronlar'), 58, 'R'],
  ].filter(Boolean);
  cx.strokeStyle = '#9aa0ab';
  cx.lineWidth = 1;
  for (const [s, yy, side] of labels) {
    const ly = ky + yy * k;
    const ex = side === 'L' ? kx - 4 : kx + CW * k + 4;
    const lx = side === 'L' ? kx - 16 : kx + CW * k + 16;
    cx.beginPath();
    cx.moveTo(ex, ly - 4);
    cx.lineTo(lx, ly - 4);
    cx.stroke();
    text(cx, s, side === 'L' ? lx - 4 : lx + 4, ly, { size: 13, color: '#3d4250', align: side === 'L' ? 'right' : 'left', max: 120 });
  }

  // Sınıflar (iki sütun) ve hâller
  const cx0 = kx + CW * k + 170;
  const cats = Object.values(CATS);
  const rowH = Math.min(26, h / 6);
  text(cx, t('Element sınıfları'), cx0, y + 14, { size: 14, weight: 700 });
  cats.forEach(([label, bg, fg], i) => {
    const col = Math.floor(i / 6), row = i % 6;
    const sx = cx0 + col * 214, sy = y + 28 + row * rowH;
    roundRect(cx, sx, sy, 22, 16, 4);
    cx.fillStyle = bg;
    cx.fill();
    cx.strokeStyle = fg;
    cx.lineWidth = 1.2;
    cx.stroke();
    text(cx, label, sx + 30, sy + 13, { size: 14, color: '#1f2328', max: 180 });
  });
  const px0 = x + w - 150;
  text(cx, t('25 °C\'de hâli'), px0, y + 14, { size: 14, weight: 700 });
  Object.values(PHASES).forEach(([label, color], i) => {
    const sy = y + 28 + i * rowH;
    text(cx, 'Ab', px0, sy + 14, { size: 17, weight: 700, color });
    text(cx, label, px0 + 30, sy + 13, { size: 14, max: 120 });
  });
}

// ---------- Element kartı ----------

const KW = 760, KH = 360, KL = 220;

function cardRows(e) {
  const sh = shells(e);
  return [
    [t('Grup'), e.group ? `${e.group} (${AB[e.group - 1]})` : t('— (f bloğu)')],
    [t('Periyot'), String(e.period)],
    [t('Blok'), block(e)],
    [t('Elektron dizilimi'), configText(e)],
    [t('Katmanlar'), sh.join(' – ')],
    [t('Elektronegatiflik'), e.eneg == null ? '—' : dec(e.eneg)],
    [t('Hâli (25 °C)'), PHASES[e.phase][0]],
    [t('Erime noktası'), temp(e.mp)],
    e.sublimes ? [t('Süblimleşme'), temp(e.bp)] : [t('Kaynama noktası'), temp(e.bp)],
  ];
}

function drawCard(cx, e) {
  const [catName, bg, fg] = CATS[e.cat];
  cx.fillStyle = '#ffffff';
  roundRect(cx, 1, 1, KW - 2, KH - 2, 18);
  cx.fill();
  // Sol renkli bölme
  cx.save();
  roundRect(cx, 1, 1, KW - 2, KH - 2, 18);
  cx.clip();
  cx.fillStyle = bg;
  cx.fillRect(0, 0, KL, KH);
  cx.restore();
  roundRect(cx, 1, 1, KW - 2, KH - 2, 18);
  cx.lineWidth = 2;
  cx.strokeStyle = fg;
  cx.stroke();

  text(cx, String(e.z), 22, 46, { size: 30, weight: 700 });
  text(cx, e.sym, KL / 2, 170, { size: 96, weight: 700, color: PHASES[e.phase][1], align: 'center', max: KL - 24 });
  text(cx, nameOf(e), KL / 2, 214, { size: 25, weight: 700, align: 'center', max: KL - 24 });
  text(cx, dec(e.mass), KL / 2, 250, { size: 20, align: 'center' });
  text(cx, t('Atom kütlesi'), KL / 2, 270, { size: 12, color: '#4b5160', align: 'center' });
  // Sınıf etiketi
  cx.font = `600 13px ${FONT}`;
  const cw = Math.min(KL - 24, cx.measureText(catName).width + 22);
  roundRect(cx, (KL - cw) / 2, 296, cw, 28, 14);
  cx.fillStyle = '#ffffff';
  cx.fill();
  cx.lineWidth = 1.5;
  cx.strokeStyle = fg;
  cx.stroke();
  text(cx, catName, KL / 2, 315, { size: 13, weight: 600, color: fg, align: 'center', max: cw - 12 });

  // Ayrıntılar
  const dx = KL + 24, vx = dx + 150, vmax = 584 - vx - 8;
  cardRows(e).forEach(([label, value], i) => {
    const y = 48 + i * 33;
    if (i) {
      cx.fillStyle = '#eceef2';
      cx.fillRect(dx, y - 22, 584 - dx - 4, 1);
    }
    text(cx, label, dx, y, { size: 14, color: '#6b7180', max: 144 });
    text(cx, value, vx, y, { size: 16.5, weight: 600, max: vmax });
  });

  drawBohr(cx, e, 670, 200);
  text(cx, t('Bohr modeli'), 670, 48, { size: 13, color: '#6b7180', align: 'center' });
}

function drawBohr(cx, e, ox, oy) {
  const sh = shells(e);
  const [, bg, fg] = CATS[e.cat];
  const r0 = 26, r1 = 72;
  const step = sh.length > 1 ? (r1 - r0) / (sh.length - 1) : 0;
  sh.forEach((n, i) => {
    const r = sh.length > 1 ? r0 + i * step : 40;
    cx.beginPath();
    cx.arc(ox, oy, r, 0, Math.PI * 2);
    cx.strokeStyle = '#c4c8d0';
    cx.lineWidth = 1;
    cx.stroke();
    const dot = n > 24 ? 2.1 : 2.8;
    for (let j = 0; j < n; j++) {
      const a = -Math.PI / 2 + (j / n) * Math.PI * 2 + i * 0.35;
      cx.beginPath();
      cx.arc(ox + Math.cos(a) * r, oy + Math.sin(a) * r, dot, 0, Math.PI * 2);
      cx.fillStyle = '#2457d6';
      cx.fill();
    }
  });
  cx.beginPath();
  cx.arc(ox, oy, 15, 0, Math.PI * 2);
  cx.fillStyle = bg;
  cx.fill();
  cx.strokeStyle = fg;
  cx.lineWidth = 1.5;
  cx.stroke();
  text(cx, e.sym, ox, oy + 4.5, { size: 12, weight: 700, align: 'center', max: 26 });
}

export function renderCard(e, scale = CARD_SCALE) {
  const { c, cx } = canvas(KW, KH, scale);
  drawCard(cx, e);
  return { src: c.toDataURL('image/png'), w: KW, h: KH, canvas: c };
}

// ---------- Seçim penceresi ----------

let picker = null;

export function openPeriodicPicker() {
  if (picker) return picker;
  picker = new Promise((resolve) => {
    const opts = loadOpts();
    const selected = new Set();
    let current = ELEMENTS[0];

    const root = document.createElement('div');
    root.id = 'periodicPicker';
    const optBox = (key, label) => `<label class="pt-opt"><input type="checkbox" data-opt="${key}"${opts[key] ? ' checked' : ''}> ${label}</label>`;
    root.innerHTML = `
      <div class="panel pt-card">
        <div class="pt-head">
          <h2>${t('Periyodik tablo')}</h2>
          <input type="search" class="pt-search" placeholder="${t('Element ara: ad, sembol ya da numara')}" spellcheck="false">
          <button class="chip" data-act="close">${t('Kapat')} <kbd>Esc</kbd></button>
        </div>
        <div class="pt-grid">
          <div class="pt-preview"><canvas></canvas></div>
          ${ELEMENTS.map((e) => `<button class="pt-el" data-z="${e.z}" data-cat="${e.cat}" style="grid-row:${e.row > 7 ? e.row + 1 : e.row};grid-column:${e.col};--bg:${CATS[e.cat][1]};--fg:${CATS[e.cat][2]}" title="${nameOf(e)}"><i>${e.z}</i><b style="color:${PHASES[e.phase][1]}">${e.sym}</b><span>${nameOf(e)}</span></button>`).join('')}
          <div class="pt-ph" style="grid-row:6;grid-column:3;--bg:${CATS.la[1]};--fg:${CATS.la[2]}">57–71</div>
          <div class="pt-ph" style="grid-row:7;grid-column:3;--bg:${CATS.ac[1]};--fg:${CATS.ac[2]}">89–103</div>
          <div class="pt-gap" style="grid-row:8;grid-column:1 / -1"></div>
        </div>
        <div class="pt-legend">
          ${Object.entries(CATS).map(([k, [label, bg, fg]]) => `<span class="pt-cat" data-cat="${k}" style="--bg:${bg};--fg:${fg}"><i></i>${label}</span>`).join('')}
        </div>
        <div class="pt-foot">
          <div class="pt-opts">
            <span class="muted">${t('Tabloda göster:')}</span>
            ${optBox('names', t('Adlar'))}${optBox('mass', t('Atom kütlesi'))}${optBox('eneg', t('Elektronegatiflik'))}${optBox('shells', t('Katmanlar'))}${optBox('legend', t('Başlık ve açıklama'))}
          </div>
          <span class="pt-hint muted">${t('Kart için elementlere tıkla; çift tıklayınca kartı hemen eklenir.')}</span>
          <div class="pt-actions">
            <button class="chip" data-act="cards" disabled></button>
            <button class="chip selected" data-act="table">${t('Tabloyu tahtaya ekle')}</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root);

    const $ = (s) => root.querySelector(s);
    const grid = $('.pt-grid');
    const search = $('.pt-search');
    const cardsBtn = $('[data-act="cards"]');
    const previewCanvas = $('.pt-preview canvas');

    function showPreview(e) {
      current = e;
      const dpr = window.devicePixelRatio || 1;
      const box = $('.pt-preview');
      const k = Math.min(box.clientWidth / KW, box.clientHeight / KH) || 0.5;
      const scale = k * dpr;
      previewCanvas.width = Math.round(KW * scale);
      previewCanvas.height = Math.round(KH * scale);
      previewCanvas.style.width = `${KW * k}px`;
      previewCanvas.style.height = `${KH * k}px`;
      const cx = previewCanvas.getContext('2d');
      cx.setTransform(scale, 0, 0, scale, 0, 0);
      cx.clearRect(0, 0, KW, KH);
      drawCard(cx, e);
      root.querySelectorAll('.pt-el.current').forEach((b) => b.classList.remove('current'));
      grid.querySelector(`[data-z="${e.z}"]`).classList.add('current');
    }

    function updateCount() {
      cardsBtn.disabled = !selected.size;
      cardsBtn.textContent = selected.size
        ? t('Seçili kartları ekle ({n})', { n: selected.size })
        : t('Seçili kartları ekle');
    }

    function finish(result) {
      root.remove();
      document.removeEventListener('keydown', onKey);
      picker = null;
      resolve(result);
    }

    function insertCards(list) {
      finish({ kind: 'cards', images: list.map((e) => renderCard(e)) });
    }

    function toggle(e) {
      if (selected.has(e.z)) selected.delete(e.z);
      else selected.add(e.z);
      grid.querySelector(`[data-z="${e.z}"]`).classList.toggle('selected', selected.has(e.z));
      updateCount();
    }

    function matches(q) {
      q = q.trim().toLocaleLowerCase(locale);
      if (!q) return null;
      const exact = ELEMENTS.filter((e) => e.sym.toLowerCase() === q || String(e.z) === q);
      const rest = ELEMENTS.filter((e) => !exact.includes(e) &&
        [e.tr, e.en].some((n) => n.toLocaleLowerCase(locale).includes(q)));
      return [...exact, ...rest];
    }

    search.addEventListener('input', () => {
      const m = matches(search.value);
      grid.classList.toggle('filtering', !!m);
      root.querySelectorAll('.pt-el').forEach((b) => b.classList.toggle('match', !!m && m.some((e) => e.z === Number(b.dataset.z))));
      if (m?.length) showPreview(m[0]);
    });
    search.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const m = matches(search.value);
      if (m?.length) toggle(m[0]);
    });

    grid.addEventListener('pointerover', (ev) => {
      const b = ev.target.closest('.pt-el');
      if (b) showPreview(ELEMENTS[b.dataset.z - 1]);
    });
    grid.addEventListener('focusin', (ev) => {
      const b = ev.target.closest('.pt-el');
      if (b) showPreview(ELEMENTS[b.dataset.z - 1]);
    });
    grid.addEventListener('click', (ev) => {
      const b = ev.target.closest('.pt-el');
      if (b) toggle(ELEMENTS[b.dataset.z - 1]);
    });
    grid.addEventListener('dblclick', (ev) => {
      const b = ev.target.closest('.pt-el');
      if (b) insertCards([ELEMENTS[b.dataset.z - 1]]);
    });

    // Sınıf etiketinin üstüne gelince o sınıfın elementleri vurgulanır.
    const legend = $('.pt-legend');
    legend.addEventListener('pointerover', (ev) => {
      const c = ev.target.closest('.pt-cat');
      if (c) grid.dataset.hl = c.dataset.cat;
    });
    legend.addEventListener('pointerleave', () => delete grid.dataset.hl);
    for (const k of Object.keys(CATS)) {
      grid.querySelectorAll(`.pt-el[data-cat="${k}"]`).forEach((b) => b.classList.add(`cat-${k}`));
    }

    $('.pt-opts').addEventListener('change', (ev) => {
      const k = ev.target.dataset.opt;
      if (!k) return;
      opts[k] = ev.target.checked;
      saveOpts(opts);
    });

    root.addEventListener('click', (ev) => {
      if (ev.target === root) return finish(null);
      const act = ev.target.closest('[data-act]')?.dataset.act;
      if (act === 'close') finish(null);
      else if (act === 'cards' && selected.size) insertCards([...selected].sort((a, b) => a - b).map((z) => ELEMENTS[z - 1]));
      else if (act === 'table') finish({ kind: 'table', images: [renderTable(opts)] });
    });

    // Tahtanın kısayolları pencere açıkken zaten çalışmaz (app.js modalOpen); burada yalnızca Esc.
    function onKey(ev) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        if (search.value) {
          search.value = '';
          search.dispatchEvent(new Event('input'));
        } else finish(null);
      }
    }
    document.addEventListener('keydown', onKey);

    updateCount();
    requestAnimationFrame(() => showPreview(current));
    search.focus();
  });
  return picker;
}

export function periodicPickerOpen() {
  return !!document.getElementById('periodicPicker');
}
