import {
  newId, bbox, unionBBox, hitTest, cloneEl, translate, scaleFrom,
  insideLasso, splitByEraser, NOTE_PADDING,
} from './geometry.js';
import {
  drawElement, drawBackground, measureText, wrappedHeight, setImageLoadCallback,
} from './render.js';
import { recognizeShape } from './recognize.js';
import { createRuler, rulerHit, nearEdge, projectOnEdge, snapAngle, drawRuler } from './ruler.js';
import { openObsidianPicker } from './obsidian-picker.js';

const api = window.api;
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const editor = document.getElementById('editor');
const $ = (s) => document.querySelector(s);

// ---------- Sabitler ----------

const INK_COLORS = ['#1f2328', '#868e96', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#7048e8', '#c2255c', '#ffffff'];
const HIGHLIGHT_COLORS = ['#ffd400', '#7cf29b', '#7ad7ff', '#ff9ad5', '#ffb15c', '#c9a7ff'];
const NOTE_COLORS = ['#fff3a3', '#ffd6e0', '#c9f2d0', '#cfe6ff', '#e5d9ff', '#ffe0b8'];
// Microsoft Whiteboard'a benzer arka plan paleti: açık tonlar, sonra koyu tonlar
const BG_COLORS = [
  '#ffffff', '#f3f2f1', '#fdf6e3', '#fff4ce', '#e8f4e4', '#dff6f5',
  '#e5f1fb', '#efe9f7', '#fbe9ef', '#1e2226', '#323130', '#1f3b2d',
  '#123a4c', '#1f2a4d', '#3b1f4d',
];
const PEN_WIDTHS = [1.5, 3, 6, 10, 16];
const HIGHLIGHT_WIDTHS = [10, 18, 28, 40];
const SHAPE_WIDTHS = [1.5, 3, 6, 10];
const TAPE_WIDTHS = [10, 18, 28, 40];
// Kalem fırçaları: renk seçimi kullanmayanlar (gökkuşağı, galaksi) kendi renklerini üretir.
// icon: paneldeki düğmede gösterilen küçük önizleme (SVG içeriği, viewBox 0 0 32 16).
const BRUSH_WAVE = 'M3 11c4-7 8-7 13-1s9 6 13-2';
const BRUSHES = [
  { id: 'normal', label: 'Kalem', title: 'Düz kalem',
    icon: `<path d="${BRUSH_WAVE}" stroke="currentColor" stroke-width="2.5"/>` },
  { id: 'calligraphy', label: 'Kaligrafi', title: 'Eğik keskin uç: yöne göre incelip kalınlaşır',
    icon: '<path d="M3.4 6.4 4.3 5.5 5.2 4.8 6.3 4.0 7.6 3.2 8.9 2.6 10.2 2.2 11.4 2.1 12.4 2.3 13.4 2.8 14.4 3.5 15.3 4.3 16.3 5.3 17.2 6.2 18.1 7.1 19.0 8.0 20.0 8.8 20.8 9.4 21.6 10.0 22.3 10.4 23.0 10.8 23.5 11.0 24.1 11.0 24.7 10.7 25.6 10.0 26.6 9.2 27.5 8.3 28.4 7.3 29.4 6.4 28.6 7.1 27.7 8.0 26.8 9.0 25.9 9.9 24.9 10.7 24.0 11.5 22.8 12.3 21.5 13.0 20.2 13.6 18.9 13.9 17.8 13.8 16.7 13.5 15.8 13.0 14.8 12.2 13.9 11.4 13.0 10.4 12.0 9.5 11.1 8.6 10.2 7.8 9.3 7.0 8.4 6.4 7.6 5.9 7.0 5.4 6.4 5.1 5.8 5.0 5.2 5.1 4.5 5.5 3.6 6.3 2.6 7.1z" fill="currentColor" stroke="none"/>' },
  { id: 'brushpen', label: 'Fırça kalem', title: 'Yavaş çizince kalın, hızlı çizince ince; uçları sivri',
    icon: '<path d="M3.2 6.9 4.7 6.7 5.6 6.2 6.4 5.6 7.1 5.2 7.8 5.1 8.5 5.4 8.9 5.9 9.3 6.6 9.7 7.3 10.5 7.8 11.5 8.3 12.7 8.8 13.9 9.5 14.9 10.4 15.8 11.4 16.6 12.5 17.6 13.6 18.7 14.5 20.2 15.0 21.8 14.7 23.1 14.0 24.1 13.0 25.1 12.1 26.1 11.3 27.1 10.4 28.0 9.5 28.9 8.5 29.2 6.9 28.8 6.6 27.3 6.9 26.2 7.7 25.4 8.6 24.5 9.5 23.6 10.0 22.7 10.2 21.9 10.1 21.4 9.6 21.1 9.4 20.7 9.3 20.0 9.3 19.1 9.2 18.0 8.8 17.1 8.1 16.3 7.1 15.6 5.9 14.9 4.7 14.1 3.5 13.0 2.6 11.6 2.1 10.1 2.0 8.7 2.3 7.5 2.6 6.3 3.0 5.2 3.4 4.1 4.1 3.2 5.1 2.8 6.6z" fill="currentColor" stroke="none"/>' },
  { id: 'fountain', label: 'Dolma kalem', title: 'Hafifçe değişen kalınlıkta mürekkep',
    icon: '<path d="M3.4 7.2 4.6 6.7 5.6 6.2 6.5 5.8 7.2 5.5 7.9 5.3 8.5 5.3 9.1 5.4 9.7 5.7 10.5 6.2 11.3 6.8 12.2 7.6 13.1 8.4 14.0 9.4 15.0 10.3 15.9 11.2 17.0 12.1 18.0 12.8 19.2 13.3 20.4 13.6 21.7 13.7 22.9 13.4 24.1 13.0 25.2 12.3 26.2 11.5 27.2 10.6 28.1 9.5 28.8 8.4 29.4 7.2 28.6 6.3 27.3 6.9 26.2 7.7 25.2 8.5 24.3 9.2 23.5 9.8 22.7 10.3 22.1 10.6 21.5 10.7 20.9 10.7 20.2 10.5 19.5 10.2 18.8 9.7 17.9 9.0 17.0 8.2 16.1 7.3 15.2 6.3 14.2 5.4 13.2 4.5 12.2 3.7 11.1 3.0 9.9 2.6 8.7 2.3 7.4 2.4 6.2 2.7 5.1 3.3 4.1 4.1 3.2 5.1 2.6 6.3z" fill="currentColor" stroke="none"/>' },
  { id: 'dashed', label: 'Kesikli', title: 'Kesik kesik çizgi',
    icon: `<path d="${BRUSH_WAVE}" stroke="currentColor" stroke-width="2.5" stroke-dasharray="3 3.5"/>` },
  { id: 'arrow', label: 'Oklu', title: 'Çizginin sonuna ok ucu ekler',
    icon: '<path d="M3 12c4-7 8-7 12-2s8 5 13-4M22.5 5.5L28 6l-1 5.5" stroke="currentColor" stroke-width="2.5"/>' },
  { id: 'dashedarrow', label: 'Kesikli ok', title: 'Kesik kesik çizgi, sonunda ok ucu',
    icon: '<path d="M3 12c4-7 8-7 12-2s8 5 13-4" stroke="currentColor" stroke-width="2.5" stroke-dasharray="3 3.5"/><path d="M22.5 5.5L28 6l-1 5.5" stroke="currentColor" stroke-width="2.5"/>' },
  { id: 'rainbow', label: 'Gökkuşağı', title: 'Çizdikçe renk değiştirir', noColor: true,
    icon: `<defs><linearGradient id="brushRainbow"><stop offset="0" stop-color="#f03e3e"/><stop offset=".25" stop-color="#fab005"/><stop offset=".5" stop-color="#40c057"/><stop offset=".75" stop-color="#228be6"/><stop offset="1" stop-color="#be4bdb"/></linearGradient></defs>
      <path d="${BRUSH_WAVE}" stroke="url(#brushRainbow)" stroke-width="3.5"/>` },
  { id: 'galaxy', label: 'Galaksi', title: 'Yıldızlı uzay mürekkebi', noColor: true,
    icon: `<defs><linearGradient id="brushGalaxy"><stop offset="0" stop-color="#1b1f6b"/><stop offset=".5" stop-color="#a23bd6"/><stop offset="1" stop-color="#2f6fe0"/></linearGradient></defs>
      <path d="${BRUSH_WAVE}" stroke="url(#brushGalaxy)" stroke-width="4.5"/>
      <g fill="#fff" stroke="none"><circle cx="6.5" cy="6.6" r=".7"/><circle cx="12" cy="5.4" r=".6"/><circle cx="17" cy="10.4" r=".7"/><circle cx="23" cy="10.6" r=".6"/><circle cx="27.5" cy="6.4" r=".6"/></g>` },
  { id: 'tape', label: 'Bant', title: 'Desenli yapışkan bant (washi)',
    icon: '<path d="M2 11.5L30 4.5" stroke="currentColor" stroke-width="7" stroke-linecap="butt" opacity=".75"/><path d="M2 11.5L30 4.5" stroke="#fff" stroke-width="7" stroke-linecap="butt" stroke-dasharray="1.5 2.5" opacity=".5"/>' },
];
const FONT_SIZES = [16, 24, 36, 56, 80];
const ERASER_RADIUS = 10; // ekran pikseli
const TEMP_FADE_MS = 1200; // geçici fosforlu kalemin bırakıldıktan sonra sönme süresi
const HANDLE = 7;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const SELECT_COLOR = '#4a7cf0';
const CLIP_MIME = 'application/x-beyaztahta';

const SHAPE_TOOLS = ['rect', 'ellipse', 'line', 'arrow'];
// Araç kısayolları — Microsoft Whiteboard'daki gibi her araç tek tuşla seçilir; ayrıca üst
// sıradaki sayı tuşları (1-9, 0) en sık kullanılan araçlara doğrudan erişir. 'key' düğmenin
// köşesinde rozet olarak görünür, 'num' hızlı sayı tuşu, 'alt' ise eski alışkanlık için yedektir.
const SHORTCUTS = [
  { target: 'select', key: 'v', num: '1' },
  { target: 'pen', key: 'p', num: '2' },
  { target: 'highlighter', key: 'h', num: '3' },
  { target: 'tempHighlighter', key: 'g', num: '4' },
  { target: 'eraser', key: 'e', num: '5' },
  { target: 'ruler', key: 'r', num: '6', alt: 'u' },
  { target: 'rect', key: 'd', num: '7' },
  { target: 'ellipse', key: 'o', num: '8' },
  { target: 'line', key: 'l', num: '9' },
  { target: 'arrow', key: 'a', num: '0' },
  { target: 'text', key: 't' },
  { target: 'note', key: 'n' },
  { target: 'image', key: 'i' },
  { target: 'obsidian', key: 'b' },
];
// 'ruler', 'image' ve 'obsidian' birer araç değil eylemdir; kısayol da bunları runAction'a yönlendirir.
const ACTION_TARGETS = ['ruler', 'image', 'obsidian'];
const DEFAULT_SHORTCUTS = SHORTCUTS.map((s) => ({ ...s }));
const SLOTS = ['num', 'key', 'alt'];
// Kullanıcının değiştirdiği kısayollar (localStorage 'shortcuts': { hedef: { key, num, alt } }).
function loadShortcuts() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('shortcuts') || '{}'); } catch { /* isteğe bağlı */ }
  for (const s of SHORTCUTS) {
    const d = DEFAULT_SHORTCUTS.find((x) => x.target === s.target);
    for (const slot of SLOTS) {
      const v = saved[s.target]?.[slot];
      if (d[slot] && typeof v === 'string' && v.length === 1) s[slot] = v;
    }
  }
}
function saveShortcuts() {
  const out = {};
  for (const s of SHORTCUTS) {
    const d = DEFAULT_SHORTCUTS.find((x) => x.target === s.target);
    for (const slot of SLOTS) if (s[slot] !== d[slot]) (out[s.target] ||= {})[slot] = s[slot];
  }
  try {
    if (Object.keys(out).length) localStorage.setItem('shortcuts', JSON.stringify(out));
    else localStorage.removeItem('shortcuts');
  } catch { /* yoksay */ }
}
const KEYMAP = new Map();
function rebuildKeymap() {
  KEYMAP.clear();
  for (const s of SHORTCUTS) for (const k of [s.key, s.num, s.alt]) if (k) KEYMAP.set(k, s.target);
}
loadShortcuts();
rebuildKeymap();

// ---------- Durum ----------

const styles = {
  pen: { color: '#1f2328', width: 3, toShape: true, brush: 'normal' },
  highlighter: { color: '#ffd400', width: 18 },
  tempHighlighter: { color: '#ffd400', width: 18 },
  shape: { color: '#1f2328', width: 3, fill: 'none' },
  text: { color: '#1f2328', fontSize: 24 },
  note: { color: '#fff3a3', fontSize: 20 },
  eraser: { mode: 'stroke', all: false }, // mode: 'stroke' (bütün çizgi) | 'partial' (kısmi)
};
let tool = 'pen';
// Her araç grubunda en son kullanılan araç (grup adı -> araç), düğmede o gösterilir.
let groupPick = {};
// Özellik paneli: collapsed = alt sekmeyle gizlendi; pinned = çizerken kendiliğinden gizlenmez.
const propsUi = { collapsed: false, pinned: true };
let propsKey = null; // panelin en son gösterdiği bağlam (araç adı, 'select' ya da 'edit')
// Kapalıyken değişiklikler yalnızca Ctrl+S ile kaydedilir.
let autoSave = true;
loadPrefs();

function emptyBoard() {
  return { version: 1, background: 'grid', bgColor: '#ffffff', view: { x: 0, y: 0, zoom: 1 }, elements: [] };
}

let board = emptyBoard();
let selection = new Set();
let drag = null;
let editing = null;
let spaceHeld = false;
let pointer = null; // son fare konumu (ekran)
const touches = new Map();
// Tahtaya kaydedilmeyen geçici fosforlu kalem çizgileri: { el, fadeStart }.
let tempStrokes = [];
let ruler = null; // açıkken { cx, cy, angle } (ekran koordinatı)
let pinch = null;
let dpr = window.devicePixelRatio || 1;

const undoStack = [];
const redoStack = [];

// ---------- Tercihler ----------

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem('prefs') || '{}');
    for (const k of Object.keys(styles)) Object.assign(styles[k], p.styles?.[k] || {});
    if (p.tool) tool = p.tool;
    if (p.groups) groupPick = p.groups;
    if (p.props) Object.assign(propsUi, p.props);
    if (typeof p.autoSave === 'boolean') autoSave = p.autoSave;
  } catch { /* tercihler isteğe bağlı */ }
}

function savePrefs() {
  try {
    localStorage.setItem('prefs', JSON.stringify({ styles, tool, groups: groupPick, props: propsUi, autoSave }));
  } catch { /* yoksay */ }
}

// ---------- Koordinatlar ----------

function toWorld(sx, sy) {
  const v = board.view;
  return { x: (sx - v.x) / v.zoom, y: (sy - v.y) / v.zoom };
}

function toScreen(x, y) {
  const v = board.view;
  return { x: x * v.zoom + v.x, y: y * v.zoom + v.y };
}

function screenRect(b) {
  const p = toScreen(b.x, b.y);
  return { x: p.x, y: p.y, w: b.w * board.view.zoom, h: b.h * board.view.zoom };
}

// ---------- Geçmiş (geri al / yinele) ----------

// Nokta dizileri yerinde değiştirilmediği için yüzeysel kopya yeterli.
function snapshot() {
  return board.elements.map((el) => ({ ...el }));
}

function checkpoint() {
  undoStack.push(snapshot());
  if (undoStack.length > 200) undoStack.shift();
  redoStack.length = 0;
  updateUndoButtons();
}

function undo() {
  commitEditor();
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  board.elements = undoStack.pop();
  pruneSelection();
  changed();
}

function redo() {
  commitEditor();
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  board.elements = redoStack.pop();
  pruneSelection();
  changed();
}

function pruneSelection() {
  const ids = new Set(board.elements.map((e) => e.id));
  selection = new Set([...selection].filter((id) => ids.has(id)));
}

function updateUndoButtons() {
  $('[data-action="undo"]').disabled = !undoStack.length;
  $('[data-action="redo"]').disabled = !redoStack.length;
}

// ---------- Kaydetme ----------

let saveTimer = null;
let dirty = false;

// Küçük resim JSON'un ilk alanı olarak yazılır; galeri böylece dosyanın yalnızca başını okur.
function serialize() {
  return JSON.stringify({ thumb: makeThumb(), ...board });
}

// Galeri için tahtanın küçük önizlemesi (JPEG data URL); boş tahtada null.
function makeThumb() {
  const b = unionBBox(board.elements);
  if (!b) return null;
  const W = 360;
  const H = 225;
  const pad = 16;
  const scale = Math.min((W - pad * 2) / Math.max(b.w, 1), (H - pad * 2) / Math.max(b.h, 1), 1);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const view = { x: W / 2 - (b.x + b.w / 2) * scale, y: H / 2 - (b.y + b.h / 2) * scale, zoom: scale };
  drawBackground(g, view, W, H, board.background, board.bgColor);
  g.setTransform(scale, 0, 0, scale, view.x, view.y);
  for (const el of board.elements) drawElement(g, el);
  return c.toDataURL('image/jpeg', 0.75);
}

function setSaveState(text) {
  $('#saveState').textContent = text;
}

function scheduleSave() {
  dirty = true;
  clearTimeout(saveTimer);
  if (!autoSave) return setSaveState('Kaydedilmedi');
  setSaveState('Kaydediliyor…');
  saveTimer = setTimeout(saveNow, 700);
}

function setAutoSave(v) {
  autoSave = v;
  savePrefs();
  updateAutoSaveUI();
  if (dirty) scheduleSave(); // açılınca bekleyen değişiklikler hemen kaydedilir
  toast(v ? 'Otomatik kaydetme açık' : 'Otomatik kaydetme kapalı — Ctrl+S ile kaydet');
}

function updateAutoSaveUI() {
  $('#autoSaveToggle').setAttribute('aria-checked', String(autoSave));
}

// Başka tahtaya/vault'a geçmeden önce çağrılır; false dönerse geçiş iptal edilir.
// Otomatik kaydetme kapalıyken kaydedilmemiş değişiklik için kullanıcıya sorulur.
async function leaveBoard() {
  if (autoSave || !dirty) {
    await saveNow();
    return true;
  }
  const choice = api.askUnsaved();
  if (choice === 'cancel') return false;
  // 'discard': dirty kalır; yeni tahta yüklenince sıfırlanır, geçiş (ör. Aç penceresi) iptal edilirse değişiklikler hâlâ kaydedilmemiş görünür.
  if (choice === 'discard') return true;
  await saveNow();
  return !dirty; // kaydedilemediyse geçme
}

async function saveNow() {
  clearTimeout(saveTimer);
  if (!dirty) return;
  dirty = false;
  try {
    const res = await api.save(serialize());
    if (!dirty) setSaveState('Kaydedildi');
    if (res?.conflict) toast('Tahta başka bir cihazda değişmiş; senin sürümün ayrı bir kopya olarak kaydedildi');
  } catch {
    dirty = true;
    setSaveState('Kaydedilemedi!');
  }
}

window.addEventListener('beforeunload', (e) => {
  commitEditor();
  if (!dirty) return;
  if (!autoSave) {
    const choice = api.askUnsaved();
    if (choice === 'discard') return;
    if (choice === 'cancel') {
      e.preventDefault();
      e.returnValue = false; // pencere kapanmaz
      return;
    }
  }
  api.saveSync(serialize());
});

function changed(save = true) {
  requestRender();
  updateUndoButtons();
  updateProps();
  if (save) scheduleSave();
}

function loadBoard(data) {
  const base = emptyBoard();
  board = { ...base, ...(data || {}) };
  delete board.thumb; // her kayıtta yeniden üretilir
  board.view = { ...base.view, ...(data?.view || {}) };
  if (!Array.isArray(board.elements)) board.elements = [];
  undoStack.length = 0;
  redoStack.length = 0;
  selection.clear();
  dirty = false;
  setSaveState('Kaydedildi');
  updateBgUI();
  changed(false);
  // Küçük resmi olmayan (eski) tahtalar galeride görünsün diye bir kez yeniden kaydedilir.
  if (autoSave && data && !data.thumb && board.elements.length) scheduleSave();
}

// ---------- Çizim döngüsü ----------

let renderQueued = false;
const sceneCache = document.createElement('canvas');
let sceneCacheValid = false;

function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

setImageLoadCallback(() => {
  sceneCacheValid = false;
  requestRender();
});

function resize() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  sceneCache.width = canvas.width;
  sceneCache.height = canvas.height;
  sceneCacheValid = false;
  requestRender();
}

function drawScene(target, skip) {
  const c = target.getContext('2d');
  const v = board.view;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(c, v, innerWidth, innerHeight, board.background, board.bgColor);
  c.setTransform(dpr * v.zoom, 0, 0, dpr * v.zoom, dpr * v.x, dpr * v.y);
  const editingId = editing?.el.id;
  for (const el of board.elements) {
    if (el !== skip) drawElement(c, el, el.id === editingId);
  }
}

function render() {
  const live = drag && (drag.kind === 'draw' || drag.kind === 'shape') ? drag.el : null;
  if (live && !drag.temp) {
    // Çizim sırasında sahnenin geri kalanını önbellekten kopyalayıp yalnız yeni çizgiyi çiziyoruz.
    if (!sceneCacheValid) {
      drawScene(sceneCache, live);
      sceneCacheValid = true;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(sceneCache, 0, 0);
    const v = board.view;
    ctx.setTransform(dpr * v.zoom, 0, 0, dpr * v.zoom, dpr * v.x, dpr * v.y);
    drawElement(ctx, live);
  } else {
    sceneCacheValid = false;
    drawScene(canvas, null);
  }
  drawTempStrokes();
  drawOverlay();
  if (editing) positionEditor();
  $('#zoomLabel').textContent = Math.round(board.view.zoom * 100) + '%';
}

// Geçici çizgiler basılı tutulduğu sürece tam görünür, bırakılınca yavaşça söner.
function drawTempStrokes() {
  if (!tempStrokes.length) return;
  const now = performance.now();
  tempStrokes = tempStrokes.filter((t) => t.fadeStart === null || now - t.fadeStart < TEMP_FADE_MS);
  const v = board.view;
  ctx.setTransform(dpr * v.zoom, 0, 0, dpr * v.zoom, dpr * v.x, dpr * v.y);
  for (const t of tempStrokes) {
    const p = t.fadeStart === null ? 0 : (now - t.fadeStart) / TEMP_FADE_MS;
    ctx.globalAlpha = (1 + Math.cos(Math.PI * p)) / 2;
    drawElement(ctx, t.el);
  }
  ctx.globalAlpha = 1;
  if (tempStrokes.some((t) => t.fadeStart !== null)) requestRender();
}

function drawOverlay() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sel = selectedEls();
  if (sel.length && !editing) {
    ctx.strokeStyle = SELECT_COLOR;
    ctx.lineWidth = 1;
    if (sel.length > 1) {
      ctx.setLineDash([4, 3]);
      for (const el of sel) {
        const r = screenRect(bbox(el));
        ctx.strokeRect(r.x, r.y, r.w, r.h);
      }
      ctx.setLineDash([]);
    }
    const handles = handlePositions();
    if (!isSingleLine(sel)) {
      const r = screenRect(unionBBox(sel));
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    for (const p of Object.values(handles)) {
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (isSingleLine(sel)) ctx.arc(p.x, p.y, HANDLE - 1, 0, Math.PI * 2);
      else ctx.rect(p.x - HANDLE + 2, p.y - HANDLE + 2, (HANDLE - 2) * 2, (HANDLE - 2) * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  if (drag?.kind === 'lasso' && drag.points.length > 1) {
    ctx.beginPath();
    drag.points.forEach(([x, y], i) => {
      const p = toScreen(x, y);
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(74,124,240,0.08)';
    ctx.fill();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = SELECT_COLOR;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (ruler) drawRuler(ctx, ruler);

  if (pointer && (activeTool() === 'eraser' || drag?.kind === 'erase')) {
    ctx.strokeStyle = 'rgba(60,60,60,0.8)';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, ERASER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// ---------- Seçim yardımcıları ----------

function selectedEls() {
  return board.elements.filter((el) => selection.has(el.id));
}

function isSingleLine(sel) {
  return sel.length === 1 && (sel[0].type === 'line' || sel[0].type === 'arrow');
}

function handlePositions() {
  const sel = selectedEls();
  if (!sel.length) return {};
  if (isSingleLine(sel)) {
    const el = sel[0];
    return { p1: toScreen(el.x1, el.y1), p2: toScreen(el.x2, el.y2) };
  }
  const r = screenRect(unionBBox(sel));
  return {
    nw: { x: r.x, y: r.y },
    ne: { x: r.x + r.w, y: r.y },
    sw: { x: r.x, y: r.y + r.h },
    se: { x: r.x + r.w, y: r.y + r.h },
  };
}

function hitHandle(sx, sy) {
  for (const [name, p] of Object.entries(handlePositions())) {
    if (Math.abs(sx - p.x) <= HANDLE + 2 && Math.abs(sy - p.y) <= HANDLE + 2) return name;
  }
  return null;
}

function topHit(w) {
  const tol = 5 / board.view.zoom;
  for (let i = board.elements.length - 1; i >= 0; i--) {
    if (hitTest(board.elements[i], w.x, w.y, tol)) return board.elements[i];
  }
  return null;
}

function selectionIsEditable() {
  return activeTool() === 'select' && selection.size > 0;
}

// ---------- Yardımcılar ----------

function activeTool() {
  return spaceHeld ? 'hand' : tool;
}

// Yatay, dikey ve 45° açılara yakın çizgileri o açıya oturtur.
function snapStraight(a, b, stepDeg, alwaysSnap) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (!len) return b;
  const ang = Math.atan2(dy, dx);
  const step = (stepDeg * Math.PI) / 180;
  const snapped = Math.round(ang / step) * step;
  if (!alwaysSnap && Math.abs(snapped - ang) > (7 * Math.PI) / 180) return b;
  return { x: a.x + Math.cos(snapped) * len, y: a.y + Math.sin(snapped) * len };
}

function pressureOf(e) {
  return e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
}

function zoomAt(factor, sx, sy) {
  const v = board.view;
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
  const w = toWorld(sx, sy);
  v.zoom = z;
  v.x = sx - w.x * z;
  v.y = sy - w.y * z;
  sceneCacheValid = false;
  scheduleViewSave();
  requestRender();
}

function zoomFit() {
  const b = unionBBox(board.elements);
  const v = board.view;
  if (!b) {
    v.zoom = 1;
    v.x = innerWidth / 2;
    v.y = innerHeight / 2;
  } else {
    const pad = 80;
    const z = Math.min(2, Math.max(MIN_ZOOM, Math.min((innerWidth - pad * 2) / b.w, (innerHeight - pad * 2) / b.h)));
    v.zoom = z;
    v.x = innerWidth / 2 - (b.x + b.w / 2) * z;
    v.y = innerHeight / 2 - (b.y + b.h / 2) * z;
  }
  scheduleViewSave();
  requestRender();
}

// Görünüm değişikliği de kaydedilir ama "Kaydediliyor" yazısı gösterilmez.
let viewTimer = null;
function scheduleViewSave() {
  clearTimeout(viewTimer);
  viewTimer = setTimeout(() => {
    if (!dirty) api.save(serialize()).catch(() => {});
  }, 1000);
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

// ---------- İşaretçi olayları ----------

canvas.addEventListener('pointerdown', (e) => {
  hideMenu();
  if (editing) commitEditor();
  pointer = { x: e.clientX, y: e.clientY };

  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      cancelDrag();
      startPinch();
      return;
    }
    if (touches.size > 2) return;
  }
  if (drag) return;

  canvas.setPointerCapture(e.pointerId);
  const w = toWorld(e.clientX, e.clientY);
  const t = activeTool();

  if (e.button === 1 || (e.button === 0 && t === 'hand')) {
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: board.view.x, vy: board.view.y };
    updateCursor();
    return;
  }
  // Kalemin arka ucu (silgi düğmesi) her zaman siler.
  const penEraser = e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32));
  if (e.button !== 0 && !penEraser) return;

  // Cetvelin üzerine basmak, araç ne olursa olsun cetveli taşır/döndürür.
  const rh = ruler && !penEraser ? rulerHit(ruler, e.clientX, e.clientY) : null;
  if (rh === 'knob') {
    drag = { kind: 'rulerRotate', a0: ruler.angle, p0: Math.atan2(e.clientY - ruler.cy, e.clientX - ruler.cx) };
    return;
  }
  if (rh === 'body') {
    drag = { kind: 'rulerMove', sx: e.clientX, sy: e.clientY, cx: ruler.cx, cy: ruler.cy };
    return;
  }

  if (penEraser || t === 'eraser') {
    drag = { kind: 'erase', last: w, checkpointed: false };
    autoHideProps();
    eraseAlong(w, w);
    return;
  }

  switch (t) {
    case 'tempHighlighter': {
      const st = styles.tempHighlighter;
      const el = {
        id: newId(), type: 'stroke', points: [[w.x, w.y, 0.5]],
        color: st.color, width: st.width, highlighter: true, pressure: false,
      };
      tempStrokes.push({ el, fadeStart: null });
      drag = { kind: 'draw', el, temp: true, straight: false, anchor: 0 };
      autoHideProps();
      attachRuler(e);
      updateDraw(e, []);
      break;
    }

    case 'pen':
    case 'highlighter': {
      checkpoint();
      const st = styles[t];
      const el = {
        id: newId(),
        type: 'stroke',
        points: [[w.x, w.y, pressureOf(e)]],
        color: st.color,
        width: st.width,
        highlighter: t === 'highlighter',
        pressure: e.pointerType === 'pen',
      };
      if (t === 'pen' && st.brush !== 'normal') el.brush = st.brush;
      board.elements.push(el);
      drag = { kind: 'draw', el, straight: false, anchor: 0 };
      autoHideProps();
      sceneCacheValid = false;
      attachRuler(e);
      updateDraw(e, []);
      break;
    }

    case 'rect':
    case 'ellipse':
    case 'line':
    case 'arrow': {
      checkpoint();
      const st = styles.shape;
      const el = t === 'line' || t === 'arrow'
        ? { id: newId(), type: t, x1: w.x, y1: w.y, x2: w.x, y2: w.y, color: st.color, width: st.width }
        : { id: newId(), type: t, x: w.x, y: w.y, w: 0, h: 0, color: st.color, width: st.width, fill: st.fill };
      board.elements.push(el);
      drag = { kind: 'shape', el, start: w };
      autoHideProps();
      sceneCacheValid = false;
      break;
    }

    case 'text': {
      const hit = topHit(w);
      if (hit?.type === 'text') {
        openEditor(hit, false);
        break;
      }
      checkpoint();
      const st = styles.text;
      const el = {
        id: newId(), type: 'text', x: w.x, y: w.y - st.fontSize * 0.6,
        text: '', color: st.color, fontSize: st.fontSize, w: 0, h: 0,
      };
      board.elements.push(el);
      openEditor(el, true);
      break;
    }

    case 'note': {
      const hit = topHit(w);
      if (hit?.type === 'note') {
        openEditor(hit, false);
        break;
      }
      checkpoint();
      const size = 220;
      const el = {
        id: newId(), type: 'note', x: w.x - size / 2, y: w.y - size / 2, w: size, h: size,
        text: '', color: styles.note.color, fontSize: styles.note.fontSize,
      };
      board.elements.push(el);
      openEditor(el, true);
      break;
    }

    case 'select':
      startSelectDrag(e, w);
      break;
  }
  requestRender();
});

function startSelectDrag(e, w) {
  const handle = hitHandle(e.clientX, e.clientY);
  if (handle) {
    const sel = selectedEls();
    const originals = new Map(sel.map((el) => [el.id, cloneEl(el)]));
    if (handle === 'p1' || handle === 'p2') {
      drag = { kind: 'endpoint', el: sel[0], which: handle, moved: false };
      return;
    }
    const b = unionBBox(sel);
    const corners = {
      nw: { x: b.x, y: b.y }, ne: { x: b.x + b.w, y: b.y },
      sw: { x: b.x, y: b.y + b.h }, se: { x: b.x + b.w, y: b.y + b.h },
    };
    const opposite = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' };
    const freeform = sel.length === 1 && ['rect', 'ellipse', 'polygon', 'note'].includes(sel[0].type);
    drag = { kind: 'resize', anchor: corners[opposite[handle]], corner: corners[handle], originals, freeform, moved: false };
    return;
  }

  const hit = topHit(w);
  if (hit) {
    if (e.shiftKey) {
      if (selection.has(hit.id)) selection.delete(hit.id);
      else selection.add(hit.id);
    } else if (!selection.has(hit.id)) {
      selection = new Set([hit.id]);
    }
    if (selection.has(hit.id)) drag = { kind: 'move', last: w, moved: false };
  } else {
    if (!e.shiftKey) selection.clear();
    drag = { kind: 'lasso', points: [[w.x, w.y]], base: new Set(selection) };
  }
  updateProps();
}

canvas.addEventListener('pointermove', (e) => {
  pointer = { x: e.clientX, y: e.clientY };

  if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) {
      updatePinch();
      return;
    }
  }

  if (!drag) {
    updateCursor(e);
    if (activeTool() === 'eraser') requestRender();
    return;
  }

  const w = toWorld(e.clientX, e.clientY);
  switch (drag.kind) {
    case 'pan':
      board.view.x = drag.vx + (e.clientX - drag.sx);
      board.view.y = drag.vy + (e.clientY - drag.sy);
      break;

    case 'draw': {
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      updateDraw(e, events.length ? events : [e]);
      break;
    }

    case 'shape':
      updateShape(w, e.shiftKey);
      break;

    case 'rulerMove':
      ruler.cx = drag.cx + (e.clientX - drag.sx);
      ruler.cy = drag.cy + (e.clientY - drag.sy);
      break;

    case 'rulerRotate': {
      const a = drag.a0 + Math.atan2(e.clientY - ruler.cy, e.clientX - ruler.cx) - drag.p0;
      const step = Math.PI / 12;
      ruler.angle = e.shiftKey ? Math.round(a / step) * step : snapAngle(a);
      break;
    }

    case 'erase':
      eraseAlong(drag.last, w);
      drag.last = w;
      break;

    case 'move': {
      if (!drag.moved) {
        checkpoint();
        drag.moved = true;
      }
      const dx = w.x - drag.last.x;
      const dy = w.y - drag.last.y;
      for (const el of selectedEls()) translate(el, dx, dy);
      drag.last = w;
      break;
    }

    case 'resize': {
      if (!drag.moved) {
        checkpoint();
        drag.moved = true;
      }
      const { anchor: a, corner: c } = drag;
      let sx = (w.x - a.x) / (c.x - a.x || 1);
      let sy = (w.y - a.y) / (c.y - a.y || 1);
      if (drag.freeform === e.shiftKey) {
        const s = Math.max(Math.abs(sx), Math.abs(sy));
        sx = s * (Math.sign(sx) || 1);
        sy = s * (Math.sign(sy) || 1);
      }
      if (Math.abs(sx) < 0.02) sx = 0.02 * (Math.sign(sx) || 1);
      if (Math.abs(sy) < 0.02) sy = 0.02 * (Math.sign(sy) || 1);
      for (const el of selectedEls()) scaleFrom(el, drag.originals.get(el.id), a.x, a.y, sx, sy);
      break;
    }

    case 'endpoint': {
      if (!drag.moved) {
        checkpoint();
        drag.moved = true;
      }
      const el = drag.el;
      if (drag.which === 'p1') {
        const p = e.shiftKey ? snapStraight({ x: el.x2, y: el.y2 }, w, 15, true) : w;
        el.x1 = p.x; el.y1 = p.y;
      } else {
        const p = e.shiftKey ? snapStraight({ x: el.x1, y: el.y1 }, w, 15, true) : w;
        el.x2 = p.x; el.y2 = p.y;
      }
      break;
    }

    case 'lasso': {
      const last = drag.points[drag.points.length - 1];
      if (Math.hypot(w.x - last[0], w.y - last[1]) * board.view.zoom < 3) break;
      drag.points.push([w.x, w.y]);
      selection = new Set(drag.base);
      if (drag.points.length > 2) {
        for (const el of board.elements) if (insideLasso(el, drag.points)) selection.add(el.id);
      }
      break;
    }
  }
  requestRender();
});

function endPointer(e) {
  if (e.pointerType === 'touch') {
    touches.delete(e.pointerId);
    if (pinch) {
      if (touches.size < 2) {
        pinch = null;
        scheduleViewSave();
      }
      return;
    }
  }
  if (!drag) return;
  const d = drag;
  drag = null;

  switch (d.kind) {
    case 'pan':
      scheduleViewSave();
      break;
    case 'draw':
      if (d.temp) {
        const t = tempStrokes.find((t) => t.el === d.el);
        if (t) t.fadeStart = performance.now();
        break;
      }
      // Özel fırçalar şekle çevrilmez; çevrilince efekt kaybolurdu.
      if (!d.el.highlighter && !d.el.brush && !d.usedStraight && styles.pen.toShape) convertToShape(d.el);
      changed();
      break;
    case 'shape': {
      const b = bbox(d.el);
      const tiny = 4 / board.view.zoom;
      const small = d.el.type === 'line' || d.el.type === 'arrow'
        ? Math.hypot(d.el.x2 - d.el.x1, d.el.y2 - d.el.y1) < tiny
        : b.w < tiny && b.h < tiny;
      if (small) {
        board.elements.splice(board.elements.indexOf(d.el), 1);
        undoStack.pop();
        changed(false);
      } else changed();
      break;
    }
    case 'erase':
      if (d.checkpointed) changed();
      break;
    case 'move':
    case 'resize':
    case 'endpoint':
      if (d.moved) changed();
      break;
    case 'lasso':
      updateProps();
      break;
  }
  updateCursor(e);
  requestRender();
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => {
  if (!drag) {
    pointer = null;
    requestRender();
  }
});

// Elle çizilen şekli düzgün şekle çevirir. Ayrı bir geri alma adımı olduğu için
// Ctrl+Z orijinal el çizimini geri getirir.
function convertToShape(el) {
  const shape = recognizeShape(el.points, board.view.zoom);
  if (!shape) return;
  checkpoint();
  const idx = board.elements.indexOf(el);
  board.elements[idx] = { id: newId(), color: el.color, width: el.width, ...shape };
  toast('Şekle dönüştürüldü — el çizimine dönmek için Ctrl+Z');
}

function cancelDrag() {
  if (!drag) return;
  if (drag.temp) {
    const t = tempStrokes.find((t) => t.el === drag.el);
    if (t) t.fadeStart = performance.now();
  } else if (drag.kind === 'draw' || drag.kind === 'shape') {
    board.elements.splice(board.elements.indexOf(drag.el), 1);
    undoStack.pop();
    updateUndoButtons();
  }
  drag = null;
  requestRender();
}

// Tuvale tıklamak açık düzenleyiciden odağı çalmasın.
canvas.addEventListener('mousedown', (e) => e.preventDefault());

canvas.addEventListener('dblclick', (e) => {
  if (activeTool() !== 'select') return;
  const hit = topHit(toWorld(e.clientX, e.clientY));
  if (hit && (hit.type === 'text' || hit.type === 'note')) openEditor(hit, false);
  else if (hit?.obsidian) openInObsidian(hit);
});

// Cetvel kenarının hemen yanında başlayan çizgi o kenar boyunca dümdüz çizilir.
function attachRuler(e) {
  const side = ruler ? nearEdge(ruler, e.clientX, e.clientY) : 0;
  if (!side) return;
  drag.rulerSide = side;
  drag.rulerStart = { x: e.clientX, y: e.clientY };
  drag.usedStraight = true;
  drag.el.pressure = false;
}

// Kalem: Shift veya Ctrl basılıyken son noktadan itibaren dümdüz çizgi çizilir.
function updateDraw(e, events) {
  const el = drag.el;
  if (drag.rulerSide) {
    const off = (el.width * board.view.zoom) / 2 + 1;
    const a = projectOnEdge(ruler, drag.rulerStart.x, drag.rulerStart.y, drag.rulerSide, off);
    const b = projectOnEdge(ruler, e.clientX, e.clientY, drag.rulerSide, off);
    const wa = toWorld(a.x, a.y);
    const wb = toWorld(b.x, b.y);
    el.points = [[wa.x, wa.y, 0.5], [wb.x, wb.y, 0.5]];
    return;
  }
  const straight = e.shiftKey || e.ctrlKey;
  if (straight) {
    drag.usedStraight = true;
    if (!drag.straight) {
      drag.straight = true;
      drag.anchor = el.points.length - 1;
    }
    const a = el.points[drag.anchor];
    const end = snapStraight({ x: a[0], y: a[1] }, toWorld(e.clientX, e.clientY), 45, false);
    el.points.length = drag.anchor + 1;
    el.points.push([end.x, end.y, e.pressure !== undefined ? pressureOf(e) : a[2]]);
    return;
  }
  drag.straight = false;
  const minDist = 0.8 / board.view.zoom;
  for (const ce of events) {
    const w = toWorld(ce.clientX, ce.clientY);
    const last = el.points[el.points.length - 1];
    if (Math.hypot(w.x - last[0], w.y - last[1]) >= minDist) {
      el.points.push([w.x, w.y, pressureOf(ce)]);
    }
  }
}

function updateShape(w, shift) {
  const el = drag.el;
  const s = drag.start;
  if (el.type === 'line' || el.type === 'arrow') {
    const p = shift ? snapStraight(s, w, 15, true) : w;
    el.x2 = p.x;
    el.y2 = p.y;
  } else {
    let dx = w.x - s.x;
    let dy = w.y - s.y;
    if (shift) {
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      dx = m * (Math.sign(dx) || 1);
      dy = m * (Math.sign(dy) || 1);
    }
    el.x = s.x;
    el.y = s.y;
    el.w = dx;
    el.h = dy;
  }
}

// a'dan b'ye giden yol üzerindeki her şeyi siler (hızlı harekette boşluk kalmasın).
function eraseAlong(a, b) {
  const r = ERASER_RADIUS / board.view.zoom;
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(dist / (r / 2)));
  const samples = [];
  for (let i = 0; i <= steps; i++) {
    samples.push({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps });
  }
  const { mode, all } = styles.eraser;
  const hits = board.elements.filter((el) =>
    (all || (el.type !== 'note' && el.type !== 'image')) && samples.some((p) => hitTest(el, p.x, p.y, r)));
  if (!hits.length) return;
  if (!drag.checkpointed) {
    checkpoint();
    drag.checkpointed = true;
  }
  // Kısmi modda her öğe kalan parçalarıyla değiştirilir; parçalanamayanlar bütün silinir.
  const replacements = new Map();
  for (const el of hits) {
    replacements.set(el, (mode === 'partial' && splitByEraser(el, samples, r)) || []);
  }
  board.elements = board.elements.flatMap((el) => replacements.get(el) ?? [el]);
  pruneSelection();
}

// ---------- Dokunmatik: iki parmakla kaydır / yakınlaştır ----------

function touchPair() {
  const [a, b] = [...touches.values()];
  return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
}

function startPinch() {
  const { mid, dist } = touchPair();
  pinch = { dist, world: toWorld(mid.x, mid.y), zoom: board.view.zoom };
}

function updatePinch() {
  const { mid, dist } = touchPair();
  const v = board.view;
  v.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinch.zoom * (dist / pinch.dist)));
  v.x = mid.x - pinch.world.x * v.zoom;
  v.y = mid.y - pinch.world.y * v.zoom;
  requestRender();
}

// ---------- Tekerlek ----------

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  // Cetvelin üzerinde tekerlek cetveli 1° (Shift ile 15°) döndürür.
  if (ruler && !e.ctrlKey && rulerHit(ruler, e.clientX, e.clientY)) {
    const dir = Math.sign(e.deltaY || e.deltaX);
    const step = ((e.shiftKey ? 15 : 1) * Math.PI) / 180;
    ruler.angle = Math.round((ruler.angle - dir * step) / step) * step;
    requestRender();
    return;
  }
  if (e.ctrlKey || e.metaKey) {
    // Dokunmatik yüzey kıstırması küçük delta üretir; fare tekerleği büyük.
    const k = Math.abs(e.deltaY) < 50 ? 0.01 : 0.0015;
    zoomAt(Math.exp(-e.deltaY * k), e.clientX, e.clientY);
    return;
  }
  const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
  const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
  board.view.x -= dx;
  board.view.y -= dy;
  sceneCacheValid = false;
  scheduleViewSave();
  requestRender();
}, { passive: false });

// ---------- İmleç ----------

function updateCursor(e) {
  const t = activeTool();
  let c = 'default';
  if (drag?.kind === 'pan') c = 'grabbing';
  else if (t === 'hand') c = 'grab';
  else if (t === 'pen' || t === 'highlighter' || t === 'tempHighlighter' || SHAPE_TOOLS.includes(t) || t === 'note') c = 'crosshair';
  else if (t === 'eraser') c = 'none';
  else if (t === 'text') c = 'text';
  if (drag?.kind === 'rulerMove') c = 'grabbing';
  else if (ruler && e && !drag && t !== 'hand' && rulerHit(ruler, e.clientX, e.clientY)) {
    c = rulerHit(ruler, e.clientX, e.clientY) === 'knob' ? 'grab' : 'move';
  } else if (t === 'select' && e) {
    const h = hitHandle(e.clientX, e.clientY);
    if (h === 'nw' || h === 'se') c = 'nwse-resize';
    else if (h === 'ne' || h === 'sw') c = 'nesw-resize';
    else if (h) c = 'move';
    else if (topHit(toWorld(e.clientX, e.clientY))) c = 'move';
  }
  canvas.style.cursor = c;
}

// ---------- Metin düzenleyici ----------

function openEditor(el, isNew) {
  if (!isNew) checkpoint();
  editing = { el, isNew, text: el.text, h: el.h };
  selection.clear();
  editor.value = el.text;
  editor.className = el.type === 'note' ? 'note' : '';
  editor.style.display = 'block';
  positionEditor();
  // Tıklamanın varsayılan odak değişikliği bittikten sonra odakla.
  setTimeout(() => {
    if (editing?.el !== el) return;
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
  });
  updateProps();
  requestRender();
}

function positionEditor() {
  const el = editing.el;
  const z = board.view.zoom;
  const p = toScreen(el.x, el.y);
  editor.style.fontSize = el.fontSize * z + 'px';
  if (el.type === 'note') {
    editor.style.color = '#1f2328';
    editor.style.left = p.x + NOTE_PADDING * z + 'px';
    editor.style.top = p.y + NOTE_PADDING * z + 'px';
    editor.style.width = (el.w - NOTE_PADDING * 2) * z + 'px';
    editor.style.height = (el.h - NOTE_PADDING * 2) * z + 'px';
  } else {
    const m = measureText(editor.value + ' ', el.fontSize);
    editor.style.color = el.color;
    editor.style.left = p.x + 'px';
    editor.style.top = p.y + 'px';
    editor.style.width = (m.w + el.fontSize) * z + 'px';
    editor.style.height = m.h * z + 'px';
  }
}

// Not, yazılan metne göre aşağı doğru büyür.
function fitNoteHeight(el, text) {
  const need = wrappedHeight(text, el.fontSize, el.w - NOTE_PADDING * 2) + NOTE_PADDING * 2;
  if (need > el.h) el.h = need;
}

editor.addEventListener('input', () => {
  if (!editing) return;
  if (editing.el.type === 'note') fitNoteHeight(editing.el, editor.value);
  requestRender();
});

editor.addEventListener('blur', () => commitEditor());

editor.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape' || (e.key === 'Enter' && e.ctrlKey)) {
    e.preventDefault();
    commitEditor();
  }
});

function commitEditor() {
  if (!editing) return;
  const { el, isNew, text: oldText, h: oldH } = editing;
  editing = null;
  editor.style.display = 'none';
  const text = editor.value.replace(/\s+$/, '');

  if (el.type === 'text' && !text.trim()) {
    board.elements.splice(board.elements.indexOf(el), 1);
    if (isNew) undoStack.pop();
  } else {
    el.text = text;
    if (el.type === 'text') Object.assign(el, measureText(text, el.fontSize));
    else fitNoteHeight(el, text);
    if (!isNew && text === oldText && el.h === oldH) {
      undoStack.pop();
      changed(false);
      return;
    }
  }
  changed();
}

// ---------- Özellik paneli ----------

function styleKey(t) {
  return SHAPE_TOOLS.includes(t) ? 'shape' : t;
}

// Panelde hangi satırların görüneceğini ve seçili değerleri belirler.
function propsContext() {
  if (editing) {
    const el = editing.el;
    return el.type === 'note'
      ? { noteColors: true, font: true, values: { noteColor: el.color, fontSize: el.fontSize } }
      : { colors: INK_COLORS, font: true, values: el };
  }
  if (selectionIsEditable()) {
    const sel = selectedEls();
    const has = (...types) => sel.some((el) => types.includes(el.type));
    const first = (...types) => sel.find((el) => types.includes(el.type)) || {};
    const ctx = { arrange: true, values: {} };
    if (has('stroke', 'line', 'arrow', 'rect', 'ellipse', 'polygon', 'text')) {
      ctx.colors = sel.every((el) => el.highlighter) ? HIGHLIGHT_COLORS : INK_COLORS;
      ctx.values.color = first('stroke', 'line', 'arrow', 'rect', 'ellipse', 'polygon', 'text').color;
    }
    if (has('stroke', 'line', 'arrow', 'rect', 'ellipse', 'polygon')) {
      ctx.widths = sel.every((el) => el.highlighter) ? HIGHLIGHT_WIDTHS
        : sel.every((el) => el.brush === 'tape') ? TAPE_WIDTHS : PEN_WIDTHS;
      ctx.values.width = first('stroke', 'line', 'arrow', 'rect', 'ellipse', 'polygon').width;
    }
    if (sel.every((el) => el.type === 'stroke' && !el.highlighter)) {
      ctx.brushes = true;
      const b = sel[0].brush || 'normal';
      ctx.values.brush = sel.every((el) => (el.brush || 'normal') === b) ? b : null;
    }
    if (has('rect', 'ellipse', 'polygon')) {
      ctx.fill = true;
      ctx.values.fill = first('rect', 'ellipse', 'polygon').fill;
    }
    if (has('text', 'note')) {
      ctx.font = true;
      ctx.values.fontSize = first('text', 'note').fontSize;
    }
    if (has('note')) {
      ctx.noteColors = true;
      ctx.values.noteColor = first('note').color;
    }
    ctx.obsidian = sel.some((el) => el.obsidian);
    ctx.obsidianOne = sel.length === 1 && !!sel[0].obsidian;
    return ctx;
  }
  const t = activeTool();
  if (t === 'pen') {
    const brush = BRUSHES.find((b) => b.id === styles.pen.brush) || BRUSHES[0];
    return {
      colors: brush.noColor ? null : INK_COLORS,
      widths: brush.id === 'tape' ? TAPE_WIDTHS : PEN_WIDTHS,
      brushes: true,
      toShape: brush.id === 'normal',
      values: styles.pen,
    };
  }
  if (t === 'highlighter') return { colors: HIGHLIGHT_COLORS, widths: HIGHLIGHT_WIDTHS, values: styles.highlighter };
  if (t === 'tempHighlighter') return { colors: HIGHLIGHT_COLORS, widths: HIGHLIGHT_WIDTHS, values: styles.tempHighlighter };
  if (SHAPE_TOOLS.includes(t)) {
    return { colors: INK_COLORS, widths: SHAPE_WIDTHS, fill: t === 'rect' || t === 'ellipse', values: styles.shape };
  }
  if (t === 'text') return { colors: INK_COLORS, font: true, values: styles.text };
  if (t === 'note') return { noteColors: true, font: true, values: { noteColor: styles.note.color, fontSize: styles.note.fontSize } };
  if (t === 'eraser') return { eraser: true };
  return null;
}

function updateProps() {
  const panel = $('#props');
  const c = propsContext();
  if (!c) {
    panel.classList.add('hidden');
    propsKey = null;
    return;
  }
  panel.classList.remove('hidden');
  const v = c.values || {};

  // Raptiye kapalıyken panel; araç, seçim ya da düzenleme durumu değişince yeniden açılır.
  const key = editing ? 'edit' : selectionIsEditable() ? 'select' : activeTool();
  if (key !== propsKey) {
    propsKey = key;
    if (!propsUi.pinned) propsUi.collapsed = false;
  }
  panel.classList.toggle('collapsed', propsUi.collapsed);
  const toggle = $('#propsToggle');
  toggle.title = propsUi.collapsed ? 'Paneli göster' : 'Paneli gizle';
  const dotColor = c.colors ? v.color : c.noteColors ? v.noteColor : null;
  const dot = toggle.querySelector('.tab-dot');
  dot.classList.toggle('hidden', !propsUi.collapsed || !dotColor);
  if (dotColor) dot.style.background = dotColor;
  const pin = $('#propsPin');
  pin.classList.toggle('on', propsUi.pinned);
  pin.title = propsUi.pinned
    ? 'Sabit: panel yalnızca okla gizlenir (kapatınca çizerken kendiliğinden gizlenir)'
    : 'Sabit değil: çizmeye başlayınca panel gizlenir (tıkla, sabitle)';

  const brushRow = $('#brushRow');
  brushRow.classList.toggle('hidden', !c.brushes);
  if (c.brushes) {
    brushRow.innerHTML = BRUSHES.map((b) =>
      `<button class="brush-btn${b.id === v.brush ? ' selected' : ''}" data-brush="${b.id}" title="${b.label} — ${b.title}"><svg viewBox="0 0 32 16">${b.icon}</svg></button>`,
    ).join('');
  }

  const colorRow = $('#colorRow');
  colorRow.classList.toggle('hidden', !c.colors);
  if (c.colors) {
    const custom = !c.colors.includes(v.color);
    colorRow.innerHTML = c.colors.map((col) =>
      `<button class="swatch${col === v.color ? ' selected' : ''}" data-color="${col}" style="background:${col}" title="${col}"></button>`,
    ).join('') +
      `<label class="swatch custom${custom ? ' selected' : ''}" title="Özel renk"><input type="color" value="${v.color || '#000000'}" /></label>`;
  }

  const noteRow = $('#noteColorRow');
  noteRow.classList.toggle('hidden', !c.noteColors);
  if (c.noteColors) {
    noteRow.innerHTML = NOTE_COLORS.map((col) =>
      `<button class="swatch note${col === v.noteColor ? ' selected' : ''}" data-note-color="${col}" style="background:${col}"></button>`,
    ).join('');
  }

  const widthRow = $('#widthRow');
  widthRow.classList.toggle('hidden', !c.widths);
  if (c.widths) {
    const max = c.widths[c.widths.length - 1];
    widthRow.innerHTML = c.widths.map((w) => {
      const size = Math.max(3, Math.round((w / max) * 20));
      return `<button class="width-btn${w === v.width ? ' selected' : ''}" data-width="${w}" title="${w}px"><span style="width:${size}px;height:${size}px"></span></button>`;
    }).join('');
  }

  const fontRow = $('#fontRow');
  fontRow.classList.toggle('hidden', !c.font);
  if (c.font) {
    fontRow.innerHTML = FONT_SIZES.map((f) =>
      `<button class="chip${f === v.fontSize ? ' selected' : ''}" data-font="${f}" title="Yazı boyutu ${f}">${f}</button>`,
    ).join('');
  }

  const fillRow = $('#fillRow');
  fillRow.classList.toggle('hidden', !c.fill);
  fillRow.querySelectorAll('[data-fill]').forEach((b) => b.classList.toggle('selected', b.dataset.fill === v.fill));

  $('#arrangeRow').classList.toggle('hidden', !c.arrange);
  $('#obsidianRow').classList.toggle('hidden', !c.obsidian);
  $('[data-obsidian="open"]').classList.toggle('hidden', !c.obsidianOne);
  $('#shapeRow').classList.toggle('hidden', !c.toShape);
  $('#eraserRow').classList.toggle('hidden', !c.eraser);
  document.querySelectorAll('[data-eraser-mode]').forEach((b) => b.classList.toggle('selected', b.dataset.eraserMode === styles.eraser.mode));
  $('[data-erase-all]').classList.toggle('selected', styles.eraser.all);
  $('[data-to-shape]').classList.toggle('selected', !!styles.pen.toShape);
}

// Seçim varsa seçili öğelere, yoksa aracın varsayılanına uygular.
function applyStyle(prop, value) {
  if (editing) {
    const el = editing.el;
    if (prop === 'color' && el.type === 'text') el.color = value;
    if (prop === 'noteColor' && el.type === 'note') el.color = value;
    if (prop === 'fontSize') el.fontSize = value;
    if (el.type === 'note') fitNoteHeight(el, editor.value);
    requestRender();
    updateProps();
    setTimeout(() => editor.focus());
    return;
  }
  if (selectionIsEditable()) {
    checkpoint();
    for (const el of selectedEls()) {
      if (prop === 'color' && !['note', 'image'].includes(el.type)) el.color = value;
      if (prop === 'noteColor' && el.type === 'note') el.color = value;
      if (prop === 'width' && ['stroke', 'line', 'arrow', 'rect', 'ellipse', 'polygon'].includes(el.type)) el.width = value;
      if (prop === 'fill' && ['rect', 'ellipse', 'polygon'].includes(el.type)) el.fill = value;
      if (prop === 'brush' && el.type === 'stroke' && !el.highlighter) {
        if (value === 'normal') delete el.brush;
        else el.brush = value;
      }
      if (prop === 'fontSize' && el.type === 'text') Object.assign(el, { fontSize: value }, measureText(el.text, value));
      if (prop === 'fontSize' && el.type === 'note') {
        el.fontSize = value;
        fitNoteHeight(el, el.text);
      }
    }
    changed();
    return;
  }
  const key = styleKey(activeTool());
  if (!styles[key]) return;
  styles[key][prop === 'noteColor' ? 'color' : prop] = value;
  // Bant ile diğer fırçalar farklı kalınlık listeleri kullanır; geçişte uygun bir kalınlık seç.
  if (prop === 'brush') {
    const widths = value === 'tape' ? TAPE_WIDTHS : PEN_WIDTHS;
    if (!widths.includes(styles.pen.width)) styles.pen.width = value === 'tape' ? 18 : 3;
  }
  savePrefs();
  updateProps();
}

$('#props').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.color) applyStyle('color', b.dataset.color);
  else if (b.dataset.noteColor) applyStyle('noteColor', b.dataset.noteColor);
  else if (b.dataset.width) applyStyle('width', Number(b.dataset.width));
  else if (b.dataset.font) applyStyle('fontSize', Number(b.dataset.font));
  else if (b.dataset.fill) applyStyle('fill', b.dataset.fill);
  else if (b.dataset.brush) applyStyle('brush', b.dataset.brush);
  else if (b.dataset.arrange) arrange(b.dataset.arrange);
  else if ('propsToggle' in b.dataset) setPropsCollapsed(!propsUi.collapsed);
  else if ('propsPin' in b.dataset) {
    propsUi.pinned = !propsUi.pinned;
    savePrefs();
    updateProps();
    toast(propsUi.pinned ? 'Panel sabitlendi' : 'Panel çizerken kendiliğinden gizlenecek');
  }
  else if (b.dataset.obsidian === 'refresh') refreshObsidian(selectedEls());
  else if (b.dataset.obsidian === 'open') openInObsidian(selectedEls()[0]);
  else if (b.dataset.eraserMode) {
    styles.eraser.mode = b.dataset.eraserMode;
    savePrefs();
    updateProps();
  } else if ('eraseAll' in b.dataset) {
    styles.eraser.all = !styles.eraser.all;
    savePrefs();
    updateProps();
  } else if ('toShape' in b.dataset) {
    styles.pen.toShape = !styles.pen.toShape;
    savePrefs();
    updateProps();
    toast(styles.pen.toShape ? 'Şekil algılama açık' : 'Şekil algılama kapalı');
  }
});

$('#props').addEventListener('change', (e) => {
  if (e.target.type === 'color') applyStyle('color', e.target.value);
});

// Paneldeki düğmeler düzenleyiciden odağı çalmasın.
$('#props').addEventListener('mousedown', (e) => {
  if (editing && e.target.type !== 'color') e.preventDefault();
});

function setPropsCollapsed(v) {
  if (propsUi.collapsed === v) return;
  propsUi.collapsed = v;
  savePrefs();
  updateProps();
}

// Raptiye kapalıyken tahtaya çizmeye başlamak paneli gizler.
function autoHideProps() {
  if (!propsUi.pinned) setPropsCollapsed(true);
}

function arrange(action) {
  const sel = selectedEls();
  if (!sel.length) return;
  if (action === 'delete') return deleteSelection();
  if (action === 'duplicate') return duplicateSelection();
  checkpoint();
  const rest = board.elements.filter((el) => !selection.has(el.id));
  board.elements = action === 'front' ? [...rest, ...sel] : [...sel, ...rest];
  changed();
}

function deleteSelection() {
  if (!selection.size) return;
  checkpoint();
  board.elements = board.elements.filter((el) => !selection.has(el.id));
  selection.clear();
  changed();
}

function insertCopies(els, offset) {
  checkpoint();
  const copies = els.map((el) => {
    const c = cloneEl(el);
    c.id = newId();
    translate(c, offset.x, offset.y);
    return c;
  });
  board.elements.push(...copies);
  selection = new Set(copies.map((c) => c.id));
  setTool('select');
  changed();
}

function duplicateSelection() {
  const sel = selectedEls();
  if (!sel.length) return;
  const d = 20 / board.view.zoom;
  insertCopies(sel, { x: d, y: d });
}

// ---------- Araç çubuğu ----------

function setTool(t) {
  commitEditor();
  tool = t;
  if (t !== 'select') selection.clear();
  pickInGroup(t);
  document.querySelectorAll('#toolbar [data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
  savePrefs();
  updateCursor();
  updateProps();
  requestRender();
}

$('#toolbar').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.classList.contains('gmain')) {
    // Uzun basma menüyü zaten açtıysa ardından gelen tıklama yok sayılır.
    if (suppressGroupClick) {
      suppressGroupClick = false;
      return;
    }
    // Eylem grubu (Ekle) her tıklamada menüyü açar; araç grubu ise seçiliyken tekrar tıklanınca.
    if (b.dataset.action || b.classList.contains('active')) return toggleFlyout(groupOfMain(b));
  }
  closeFlyout();
  if (b.dataset.tool) setTool(b.dataset.tool);
  else runAction(b.dataset.action);
});

// Her düğmenin köşesine kısayol rozetini yazar, ipucuna da tuşu ekler: araçlar hem tek tuşla
// hem de düğmede yazan tuşla kolayca seçilebilir.
const baseTitles = new Map();
function applyToolbarBadges() {
  for (const b of document.querySelectorAll('#toolbar button:not(.gmain)')) {
    const sc = SHORTCUTS.find((s) => s.target === (b.dataset.tool || b.dataset.action));
    if (!sc) continue;
    if (!baseTitles.has(b)) baseTitles.set(b, b.title);
    b.querySelector('kbd.key')?.remove();
    const kbd = document.createElement('kbd');
    kbd.className = 'key';
    kbd.textContent = sc.key.toUpperCase();
    b.appendChild(kbd);
    b.title = baseTitles.get(b) + ' (' + sc.key.toUpperCase() + ')';
  }
}
applyToolbarBadges();

// ---------- Araç grupları ----------
// Benzer araçlar (kalemler, şekiller, metin/not, ekleme) araç çubuğunda tek düğmede toplanır.
// Düğme gruptan en son kullanılan aracın ikonunu ve kısayol rozetini gösterir; diğerleri
// düğmenin altındaki açılır menüdedir. Menü: seçili düğmeye tekrar tıklayınca, sağ tıkla ya da
// basılı tutunca açılır. Kısayollar değişmez; tuşla seçilen araç da grubun düğmesine geçer.

const toolGroups = [];
const memberGroup = new Map(); // araç/eylem adı -> grup
let openGroup = null;
let suppressGroupClick = false;
let longPressTimer = 0;

const targetOf = (b) => b.dataset.tool || b.dataset.action;
const groupOfMain = (b) => toolGroups.find((g) => g.main === b);

for (const el of document.querySelectorAll('#toolbar .tgroup')) {
  const members = [...el.querySelectorAll('button')];
  const main = document.createElement('button');
  main.className = 'tool gmain';
  const fly = document.createElement('div');
  fly.className = 'flyout panel hidden';
  fly.append(...members);
  el.append(main, fly);
  const grp = { el, name: el.dataset.group, main, fly, members };
  toolGroups.push(grp);
  for (const m of members) memberGroup.set(targetOf(m), grp);
  showInGroup(grp, groupPick[grp.name]);

  main.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    toggleFlyout(grp);
  });
  // Kalemle sağ tık zor olduğu için basılı tutmak da menüyü açar.
  main.addEventListener('pointerdown', () => {
    suppressGroupClick = false;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      suppressGroupClick = true;
      openFlyout(grp);
    }, 450);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) main.addEventListener(ev, () => clearTimeout(longPressTimer));
}

// Grubun düğmesini verilen üyenin ikonu, ipucu ve kısayoluyla gösterir.
function showInGroup(grp, target) {
  const m = grp.members.find((x) => targetOf(x) === target) || grp.members[0];
  const { main } = grp;
  main.removeAttribute('data-tool');
  main.removeAttribute('data-action');
  if (m.dataset.tool) main.dataset.tool = m.dataset.tool;
  else main.dataset.action = m.dataset.action;
  main.innerHTML = m.innerHTML + '<span class="caret"></span>';
  main.title = m.title + ' — ' + grp.el.dataset.title + ': sağ tıkla veya basılı tut';
}

// Seçilen araç/eylem bir gruptaysa o grubun düğmesine geçirir.
function pickInGroup(target) {
  const grp = memberGroup.get(target);
  if (!grp || groupPick[grp.name] === target) return;
  groupPick[grp.name] = target;
  showInGroup(grp, target);
  savePrefs();
}

function openFlyout(grp) {
  if (openGroup && openGroup !== grp) closeFlyout();
  openGroup = grp;
  grp.fly.classList.remove('hidden');
}

function closeFlyout() {
  openGroup?.fly.classList.add('hidden');
  openGroup = null;
}

function toggleFlyout(grp) {
  if (openGroup === grp) closeFlyout();
  else openFlyout(grp);
}

// Menünün dışına basınca kapanır.
window.addEventListener('pointerdown', (e) => {
  if (openGroup && !openGroup.el.contains(e.target)) closeFlyout();
}, true);

$('#zoombar').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) runAction(b.dataset.action);
});

$('#filebar').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) runAction(b.dataset.action);
});

function runAction(a) {
  pickInGroup(a);
  switch (a) {
    case 'undo': return undo();
    case 'redo': return redo();
    case 'image': return $('#imageInput').click();
    case 'obsidian': return insertFromObsidian();
    case 'zoomIn': return zoomAt(1.25, innerWidth / 2, innerHeight / 2);
    case 'zoomOut': return zoomAt(0.8, innerWidth / 2, innerHeight / 2);
    case 'zoomReset': return zoomAt(1 / board.view.zoom, innerWidth / 2, innerHeight / 2);
    case 'zoomFit': return zoomFit();
    case 'menu': return toggleMenu();
    case 'gallery': return handleCommand('gallery');
    case 'ruler':
      ruler = ruler ? null : createRuler(innerWidth / 2, innerHeight / 2);
      $('[data-action="ruler"]').classList.toggle('active', !!ruler);
      return requestRender();
  }
}

// ---------- Menü ----------

function toggleMenu() {
  $('#menu').classList.toggle('hidden');
}

function hideMenu() {
  $('#menu').classList.add('hidden');
}

$('#menu').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.cmd) {
    hideMenu();
    handleCommand(b.dataset.cmd);
  } else if ('autosave' in b.dataset) {
    setAutoSave(!autoSave);
  } else if (b.dataset.bg) {
    board.background = b.dataset.bg;
    updateBgUI();
    changed();
  } else if (b.dataset.bgColor) {
    board.bgColor = b.dataset.bgColor;
    updateBgUI();
    changed();
  } else if (b.dataset.themeMode) {
    setTheme(b.dataset.themeMode);
  }
});

// Uygulama teması (açık / koyu / sistem); tercih bu bilgisayara özel ayar olarak saklanır
function updateThemeUI(mode) {
  document.querySelectorAll('#themeRow [data-theme-mode]').forEach((b) => b.classList.toggle('selected', b.dataset.themeMode === mode));
}

async function setTheme(mode) {
  updateThemeUI(await api.setTheme(mode));
}

api.getTheme().then(updateThemeUI);

// Özel arka plan rengi: sürüklerken canlı önizleme, bırakınca kaydet
$('#menu').addEventListener('input', (e) => {
  if (e.target.id !== 'bgCustomColor') return;
  board.bgColor = e.target.value;
  document.body.style.background = board.bgColor;
  sceneCacheValid = false;
  requestRender();
});
$('#menu').addEventListener('change', (e) => {
  if (e.target.id !== 'bgCustomColor') return;
  board.bgColor = e.target.value;
  updateBgUI();
  changed();
});

function updateBgUI() {
  document.querySelectorAll('#bgPatternRow [data-bg]').forEach((b) => b.classList.toggle('selected', b.dataset.bg === board.background));
  const custom = !BG_COLORS.includes(board.bgColor);
  $('#bgColorRow').innerHTML = BG_COLORS.map((c) =>
    `<button class="swatch${c === board.bgColor ? ' selected' : ''}" data-bg-color="${c}" style="background:${c}" title="${c}"></button>`,
  ).join('') +
    `<label class="swatch custom${custom ? ' selected' : ''}" title="Özel renk"><input type="color" id="bgCustomColor" value="${board.bgColor}" /></label>`;
  document.body.style.background = board.bgColor;
}

async function handleCommand(cmd) {
  commitEditor();
  switch (cmd) {
    case 'new':
      if (!(await leaveBoard())) return;
      await api.newBoard();
      loadBoard(emptyBoard());
      zoomFit();
      closeGallery();
      toast('Yeni tahta oluşturuldu');
      break;
    case 'open': {
      if (!(await leaveBoard())) return;
      const res = await api.open();
      if (res) {
        loadBoard(res.data);
        toast('Tahta açıldı');
      }
      break;
    }
    case 'save':
      dirty = true;
      await saveNow();
      toast('Kaydedildi');
      break;
    case 'saveAs': {
      const p = await api.saveAs(serialize());
      if (p) {
        dirty = false;
        setSaveState('Kaydedildi');
        toast('Kaydedildi');
      }
      break;
    }
    case 'exportPng':
      return exportPng();
    case 'showFolder':
      if (autoSave) await saveNow();
      return api.showFolder();
    case 'gallery':
      return galleryOpen() ? closeGallery() : openGallery();
    case 'openVault':
      return openVault();
    case 'createVault':
      return createVault();
    case 'clear':
      if (board.elements.length && confirm('Tahtadaki her şey silinsin mi? (Ctrl+Z ile geri alınabilir)')) {
        checkpoint();
        board.elements = [];
        selection.clear();
        changed();
      }
      break;
    case 'help':
      return helpOpen() ? closeHelp() : openHelp();
    case 'obsidianRefreshAll':
      return refreshObsidian(board.elements);
    default:
      runAction(cmd);
  }
}

api.onMenu(handleCommand);
api.onOpenPath(async (p) => {
  commitEditor();
  if (!(await leaveBoard())) return;
  const res = await api.openPath(p);
  if (res) {
    loadBoard(res.data);
    closeGallery();
    toast('Tahta açıldı');
  }
});

// Başka bir bilgisayarda (Google Drive senkronuyla) güncellenen tahtayı pencereye dönünce yükler.
// Kaydedilmemiş değişiklik varsa dokunmayız; kayıt sırasında çakışma kopyası oluşur.
window.addEventListener('focus', async () => {
  if (dirty || drag || editing) return;
  const res = await api.checkExternal();
  if (!res || dirty || drag || editing) return;
  const view = board.view;
  loadBoard(res.data);
  board.view = view;
  sceneCacheValid = false;
  requestRender();
  toast('Tahta başka bir cihazda güncellenmiş; son hâli yüklendi');
});
// ---------- Rehber (F1) ----------

const help = $('#help');
const helpSearch = $('#helpSearch');
const helpTabs = [...document.querySelectorAll('#helpNav [data-help-tab]')];
const helpSections = [...document.querySelectorAll('#helpContent [data-help-section]')];
const helpOpen = () => !help.classList.contains('hidden');

// Araç hedeflerinin rehberdeki adları (SHORTCUTS tablosunun tek eksiği bu etiketler).
const TOOL_LABELS = {
  select: 'Seç', pen: 'Kalem', highlighter: 'Fosforlu kalem', tempHighlighter: 'Geçici fosforlu kalem',
  eraser: 'Silgi', ruler: 'Cetveli aç / kapat', rect: 'Dikdörtgen', ellipse: 'Elips', line: 'Çizgi',
  arrow: 'Ok', text: 'Metin', note: 'Yapışkan not', image: 'Resim veya PDF ekle', obsidian: "Obsidian'dan ekle",
};
// Menü hızlandırıcıları ve fare/klavye kombinasyonları (araç kısayolları dışındakiler).
const GENERAL_KEYS = [
  [['Ctrl+Z'], 'Geri al'], [['Ctrl+Y', 'Ctrl+Shift+Z'], 'Yinele'],
  [['Ctrl+C', 'Ctrl+X', 'Ctrl+V'], 'Kopyala / kes / yapıştır'], [['Ctrl+D'], 'Seçileni çoğalt'],
  [['Ctrl+A'], 'Tümünü seç'], [['Delete', 'Backspace'], 'Seçileni sil'],
  [['Ok tuşları'], 'Seçileni 1 piksel kaydır (Shift ile 10)'], [['['], 'Arkaya gönder'], [[']'], 'Öne getir'],
  [['Esc'], 'Seçimi bırak, açık pencereyi kapat'], [['Shift', 'tıklama'], 'Seçime ekle / çıkar'],
  [['Boşluk', 'sürükle'], 'Tahtayı kaydır'], [['Ctrl', 'tekerlek'], 'Yakınlaştır / uzaklaştır'],
  [['Shift', 'tekerlek'], 'Yatay kaydır'], [['Ctrl+=', 'Ctrl+-'], 'Yakınlaştır / uzaklaştır'],
  [['Ctrl+0'], '%100 yakınlık'], [['Ctrl+1'], 'Tümünü ekrana sığdır'],
  [['Shift', 'Ctrl'], 'Kalemle çizerken basılı tut: dümdüz çizgi'],
  [['Shift'], 'Şekil çizerken: kare / daire, 15° adım'],
  [['Esc', 'Ctrl+Enter'], 'Metin / not yazmayı bitir'],
  [['Ctrl+G'], 'Tahtalarım'], [['Ctrl+N'], 'Yeni tahta'], [['Ctrl+O'], 'Aç'], [['Ctrl+S'], 'Kaydet'],
  [['Ctrl+Shift+S'], 'Farklı kaydet'], [['Ctrl+E'], 'PNG olarak dışa aktar'],
  [['F2'], 'Galeride seçili tahtayı yeniden adlandır'], [['F1'], 'Bu rehber'], [['F12'], 'Geliştirici araçları'],
];

const kbd = (k) => `<kbd>${k}</kbd>`;

// Düzenlenen kısayol yuvası: { target, slot } ya da null.
let capturing = null;

function buildHelpKeys() {
  $('#helpToolKeys').innerHTML = SHORTCUTS.map((s) => {
    const keys = SLOTS.filter((slot) => s[slot]).map((slot) => {
      const on = capturing && capturing.target === s.target && capturing.slot === slot;
      return `<button class="keychip${on ? ' capturing' : ''}" data-target="${s.target}" data-slot="${slot}" ` +
        `title="Değiştirmek için tıkla">${on ? 'Tuşa bas…' : s[slot].toUpperCase()}</button>`;
    }).join(' ');
    return `<tr><td>${keys}</td><td>${TOOL_LABELS[s.target] || s.target}</td></tr>`;
  }).join('');
  $('#helpGeneralKeys').innerHTML = GENERAL_KEYS.map(([keys, label]) =>
    `<tr><td>${keys.map(kbd).join(' ')}</td><td>${label}</td></tr>`).join('');
}
buildHelpKeys();

function refreshShortcutUi() {
  rebuildKeymap();
  saveShortcuts();
  applyToolbarBadges();
  for (const grp of toolGroups) showInGroup(grp, groupPick[grp.name]);
  buildHelpKeys();
}

// Yeni tuş başka bir yuvada kullanılıyorsa iki yuvanın tuşları yer değiştirir.
function assignShortcut(target, slot, newKey) {
  const s = SHORTCUTS.find((x) => x.target === target);
  const old = s[slot];
  if (newKey === old) return;
  for (const o of SHORTCUTS) {
    for (const sl of SLOTS) {
      if (o[sl] === newKey) {
        o[sl] = old;
        toast(`"${newKey.toUpperCase()}" tuşu "${TOOL_LABELS[o.target]}" aracındaydı; tuşlar yer değiştirdi`);
      }
    }
  }
  s[slot] = newKey;
  refreshShortcutUi();
}

$('#helpToolKeys').addEventListener('click', (e) => {
  const b = e.target.closest('.keychip');
  if (!b) return;
  capturing = { target: b.dataset.target, slot: b.dataset.slot };
  buildHelpKeys();
});

// Yakalama sırasında basılan tuşu kısayol yapar (yakalama evresinde, genel işleyiciden önce).
window.addEventListener('keydown', (e) => {
  if (!capturing) return;
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
  e.preventDefault();
  e.stopPropagation();
  const { target, slot } = capturing;
  capturing = null;
  const k = e.key.toLowerCase();
  if (e.key === 'Escape') { /* vazgeç */ }
  else if (e.ctrlKey || e.metaKey || e.altKey || k.length !== 1 || [' ', '[', ']'].includes(k)) {
    toast('Bu tuş kısayol olarak kullanılamaz; tek bir harf, rakam ya da simge seç');
  } else {
    assignShortcut(target, slot, k);
    return;
  }
  buildHelpKeys();
}, true);

$('#helpResetKeys').addEventListener('click', () => {
  capturing = null;
  for (const s of SHORTCUTS) Object.assign(s, DEFAULT_SHORTCUTS.find((x) => x.target === s.target));
  refreshShortcutUi();
  toast('Kısayollar varsayılana döndürüldü');
});

function showHelpTab(name) {
  helpTabs.forEach((b) => b.classList.toggle('active', b.dataset.helpTab === name));
  helpSections.forEach((s) => s.classList.toggle('active', s.dataset.helpSection === name));
  $('#helpContent').scrollTop = 0;
  try { localStorage.setItem('helpTab', name); } catch { /* localStorage kapalı olabilir */ }
}

function currentHelpTab() {
  return helpTabs.find((b) => b.classList.contains('active'))?.dataset.helpTab;
}

// Aranan kelimeyi içeren sekmeleri belirgin bırakır, eşleşen satırları vurgular.
function runHelpSearch(jump = true) {
  const q = helpSearch.value.trim().toLocaleLowerCase('tr');
  helpContentClear();
  helpTabs.forEach((b) => b.classList.remove('nomatch'));
  $('#helpEmpty').classList.add('hidden');
  if (!q) return;
  const matches = new Map(helpSections.map((s) => [s.dataset.helpSection, s.textContent.toLocaleLowerCase('tr').includes(q)]));
  helpTabs.forEach((b) => b.classList.toggle('nomatch', !matches.get(b.dataset.helpTab)));
  if (![...matches.values()].some(Boolean)) return $('#helpEmpty').classList.remove('hidden');
  if (jump && !matches.get(currentHelpTab())) showHelpTab([...matches].find(([, m]) => m)[0]);
  const section = helpSections.find((s) => s.classList.contains('active'));
  const hits = [...section.querySelectorAll('h3, h4, p, li, tr')].filter((el) =>
    !el.querySelector('h3, h4, p, li, tr') && el.textContent.toLocaleLowerCase('tr').includes(q));
  hits.forEach((el) => el.classList.add('hit'));
  hits[0]?.scrollIntoView({ block: 'center' });
}

function helpContentClear() {
  document.querySelectorAll('#helpContent .hit').forEach((el) => el.classList.remove('hit'));
}

function openHelp() {
  let tab = 'start';
  try { tab = localStorage.getItem('helpTab') || tab; } catch { /* yok say */ }
  if (!helpTabs.some((b) => b.dataset.helpTab === tab)) tab = 'start';
  helpSearch.value = '';
  runHelpSearch();
  showHelpTab(tab);
  help.classList.remove('hidden');
  helpSearch.focus();
}

function closeHelp() {
  help.classList.add('hidden');
  helpSearch.blur();
}

$('#helpNav').addEventListener('click', (e) => {
  const b = e.target.closest('[data-help-tab]');
  if (!b) return;
  showHelpTab(b.dataset.helpTab);
  runHelpSearch(false);
});
helpSearch.addEventListener('input', () => runHelpSearch());
$('#helpClose').addEventListener('click', closeHelp);
help.addEventListener('click', (e) => {
  if (e.target.id === 'help') closeHelp();
});

// ---------- Tahta galerisi ----------

const gallery = $('#gallery');
const galleryGrid = $('#galleryGrid');
const gallerySearch = $('#gallerySearch');
let galleryData = null;

function galleryOpen() {
  return !gallery.classList.contains('hidden');
}

function obsidianPickerOpen() {
  return !!document.getElementById('obsidianPicker');
}

// Galeri, Obsidian seçicisi ya da PDF sayfa penceresi açıkken pano ve sürükle-bırak tahtaya işlemez.
function overlayOpen() {
  return galleryOpen() || obsidianPickerOpen() || pdfDialogOpen();
}

async function openGallery() {
  hideMenu();
  if (autoSave) await saveNow(); // açık tahtanın küçük resmi güncel olsun
  gallerySearch.value = '';
  gallery.classList.remove('hidden');
  await refreshGallery();
  gallerySearch.focus();
}

function closeGallery() {
  gallery.classList.add('hidden');
}

async function refreshGallery() {
  galleryData = await api.listBoards();
  $('#galleryDir').textContent = galleryData.dir;
  $('#galleryDir').title = galleryData.dir;
  renderVaults();
  renderGallery();
}

function renderVaults() {
  const list = $('#vaultList');
  list.textContent = '';
  for (const v of galleryData.vaults) {
    const chip = document.createElement('div');
    chip.className = 'chip vchip' + (v.current ? ' selected' : '') + (v.missing ? ' missing' : '');
    chip.dataset.vault = v.path;
    chip.title = v.path + (v.missing ? ' (bulunamadı)' : '');
    const name = document.createElement('span');
    name.className = 'vname';
    name.textContent = v.name;
    chip.appendChild(name);
    if (!v.current) {
      const rm = document.createElement('button');
      rm.className = 'vremove';
      rm.dataset.gcmd = 'removeVault';
      rm.title = 'Listeden kaldır (dosyalar silinmez)';
      rm.textContent = '×';
      chip.appendChild(rm);
    }
    list.appendChild(chip);
  }
}

function relativeTime(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'az önce';
  if (s < 3600) return `${Math.floor(s / 60)} dakika önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} saat önce`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} gün önce`;
  return new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const ICON_RENAME = '<svg viewBox="0 0 24 24"><path d="M4 20l4-1L19 8a2.1 2.1 0 00-3-3L5 16z"/></svg>';
const ICON_DELETE = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';

function renderGallery() {
  const q = gallerySearch.value.trim().toLocaleLowerCase('tr');
  const list = galleryData.boards.filter((b) => b.name.toLocaleLowerCase('tr').includes(q));
  galleryGrid.textContent = '';

  const add = document.createElement('button');
  add.className = 'gcard gnew';
  add.dataset.gcmd = 'new';
  add.innerHTML = '<div class="gthumb"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></div><div class="gname">Yeni tahta</div>';
  galleryGrid.appendChild(add);

  for (const b of list) {
    const card = document.createElement('div');
    card.className = 'gcard' + (b.path === galleryData.current ? ' current' : '');
    card.dataset.path = b.path;
    card.tabIndex = 0;
    const thumb = document.createElement('div');
    thumb.className = 'gthumb';
    if (b.thumb) {
      const img = document.createElement('img');
      img.src = b.thumb;
      img.alt = '';
      thumb.appendChild(img);
    } else {
      thumb.innerHTML = '<span class="muted">Önizleme yok</span>';
    }
    const name = document.createElement('div');
    name.className = 'gname';
    name.textContent = b.name;
    name.title = b.name;
    const meta = document.createElement('div');
    meta.className = 'gmeta';
    meta.textContent = (b.path === galleryData.current ? 'Açık · ' : '') + relativeTime(b.mtime);
    const actions = document.createElement('div');
    actions.className = 'gactions';
    actions.innerHTML = `<button class="tool" data-gcmd="rename" title="Yeniden adlandır">${ICON_RENAME}</button>` +
      `<button class="tool" data-gcmd="delete" title="Sil">${ICON_DELETE}</button>`;
    card.append(thumb, actions, name, meta);
    galleryGrid.appendChild(card);
  }

  if (!list.length && q) {
    const empty = document.createElement('p');
    empty.className = 'muted gempty';
    empty.textContent = 'Aramaya uyan tahta yok.';
    galleryGrid.appendChild(empty);
  }
}

async function openFromGallery(p) {
  if (p === galleryData.current) return closeGallery();
  if (!(await leaveBoard())) return;
  const res = await api.openPath(p);
  if (!res) return refreshGallery();
  loadBoard(res.data);
  closeGallery();
}

function startRename(card) {
  const nameEl = card.querySelector('.gname');
  const oldName = nameEl.textContent;
  const input = document.createElement('input');
  input.className = 'grename';
  input.value = oldName;
  nameEl.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = async (commit) => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    if (commit && name && name !== oldName) {
      if (autoSave) await saveNow();
      const res = await api.renameBoard(card.dataset.path, name);
      if (res.error) toast(res.error);
    }
    refreshGallery();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('click', (e) => e.stopPropagation());
}

async function deleteFromGallery(card) {
  const name = card.querySelector('.gname')?.textContent || '';
  if (!confirm(`"${name}" silinsin mi?`)) return;
  if (autoSave) await saveNow();
  const res = await api.deleteBoard(card.dataset.path);
  if (res.deleted && res.wasCurrent) {
    loadBoard(emptyBoard());
    zoomFit();
  }
  if (res.deleted) toast('Tahta silindi');
  refreshGallery();
}

// Vault'a geçince oradaki tahta açılır; galeri açıksa açık kalır ki yeni vault'un tahtaları görülsün.
function vaultOpened(res, message = 'Vault açıldı') {
  if (!res) return;
  if (res.error) return toast(res.error);
  loadBoard(res.data);
  if (!res.data) zoomFit();
  toast(message);
  if (galleryOpen()) refreshGallery();
}

async function openVault() {
  if (!(await leaveBoard())) return;
  vaultOpened(await api.openVault());
}

async function createVault() {
  if (!(await leaveBoard())) return;
  vaultOpened(await api.createVault(), 'Yeni vault oluşturuldu');
}

async function switchVault(dir) {
  if (dir === galleryData.dir) return;
  if (!(await leaveBoard())) return;
  vaultOpened(await api.switchVault(dir));
}

async function removeVault(dir) {
  await api.removeVault(dir);
  refreshGallery();
}

gallery.addEventListener('click', (e) => {
  if (e.target === gallery) return closeGallery();
  const btn = e.target.closest('[data-gcmd]');
  const card = e.target.closest('.gcard[data-path]');
  switch (btn?.dataset.gcmd) {
    case 'new': return handleCommand('new');
    case 'close': return closeGallery();
    case 'openVault': return openVault();
    case 'createVault': return createVault();
    case 'removeVault': return removeVault(btn.closest('[data-vault]').dataset.vault);
    case 'showFolder': return api.showFolder();
    case 'rename': return startRename(card);
    case 'delete': return deleteFromGallery(card);
  }
  const vault = e.target.closest('[data-vault]');
  if (vault) return switchVault(vault.dataset.vault);
  if (card) openFromGallery(card.dataset.path);
});

gallerySearch.addEventListener('input', () => galleryData && renderGallery());

function galleryKeydown(e) {
  if (e.target.classList?.contains('grename')) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    closeGallery();
  } else if (e.key === 'Enter' && e.target.matches?.('.gcard[data-path]')) {
    openFromGallery(e.target.dataset.path);
  } else if (e.key === 'Enter' && e.target === gallerySearch) {
    const first = galleryGrid.querySelector('.gcard[data-path]');
    if (first) openFromGallery(first.dataset.path);
  } else if (e.key === 'F2' && e.target.matches?.('.gcard[data-path]')) {
    startRename(e.target);
  }
}

// ---------- PNG dışa aktarma ----------

async function exportPng() {
  const els = selection.size ? selectedEls() : board.elements;
  const b = unionBBox(els);
  if (!b) return toast('Dışa aktarılacak bir şey yok');
  const pad = 40;
  const scale = Math.min(2, 12000 / Math.max(b.w + pad * 2, b.h + pad * 2));
  const w = Math.ceil((b.w + pad * 2) * scale);
  const h = Math.ceil((b.h + pad * 2) * scale);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const c = out.getContext('2d');
  const view = { x: (pad - b.x) * scale, y: (pad - b.y) * scale, zoom: scale };
  drawBackground(c, view, w, h, board.background, board.bgColor);
  c.setTransform(scale, 0, 0, scale, view.x, view.y);
  for (const el of els) drawElement(c, el);
  const p = await api.exportPng(out.toDataURL('image/png'));
  if (p) toast('Resim kaydedildi');
}

// ---------- Resimler ----------

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Çok büyük resimleri küçülterek dosya boyutunu makul tutar.
function prepareImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 2400;
      let { naturalWidth: w, naturalHeight: h } = img;
      if (Math.max(w, h) <= max) return resolve({ src, w, h });
      const k = max / Math.max(w, h);
      w = Math.round(w * k);
      h = Math.round(h * k);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const jpeg = src.startsWith('data:image/jpeg');
      resolve({ src: c.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.9), w, h });
    };
    img.onerror = reject;
    img.src = src;
  });
}

const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

let pdfjs = null;
async function loadPdfJs() {
  if (!pdfjs) {
    pdfjs = await import('./vendor/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
  }
  return pdfjs;
}

// "1-5, 8, 11-" gibi bir yazıyı sıralı, tekrarsız sayfa numaralarına çevirir.
// "11-" sona kadar demektir. Geçersizse hata metni döner.
function parsePageRanges(text, max) {
  const pages = new Set();
  const parts = text.split(/[,;\s]+/).filter(Boolean);
  if (!parts.length) return { error: 'Sayfa numarası yaz' };
  for (const part of parts) {
    const m = /^(\d+)?(?:\s*[-–]\s*(\d+)?)?$/.exec(part);
    if (!m || (!m[1] && !m[2])) return { error: `Anlaşılmadı: "${part}"` };
    const isRange = part.includes('-') || part.includes('–');
    const a = m[1] ? +m[1] : 1;
    const b = isRange ? (m[2] ? +m[2] : max) : a;
    if (a < 1 || b < 1 || a > max || b > max) return { error: `PDF ${max} sayfa; "${part}" dışarıda kalıyor` };
    for (let n = Math.min(a, b); n <= Math.max(a, b); n++) pages.add(n);
  }
  return { pages: [...pages].sort((x, y) => x - y) };
}

const pdfDialog = $('#pdfPages');
const pdfDialogOpen = () => !pdfDialog.classList.contains('hidden');

// Hangi sayfaların ekleneceğini sorar; sayfa numaraları dizisi ya da (vazgeçilirse) null döner.
function askPdfPages(name, count) {
  const form = $('#pdfForm');
  const range = $('#pdfRange');
  const from = $('#pdfFrom');
  const take = $('#pdfTake');
  const summary = $('#pdfSummary');
  const ok = $('#pdfOk');
  $('#pdfName').textContent = name;
  $('#pdfCount').textContent = count;
  from.max = count;
  take.max = count;
  from.value = 1;
  take.value = Math.min(5, count);
  range.value = '';
  form.pdfMode.value = 'all';

  const pick = () => {
    const mode = form.pdfMode.value;
    if (mode === 'all') return { pages: Array.from({ length: count }, (_, i) => i + 1) };
    if (mode === 'range') return parsePageRanges(range.value, count);
    const s = Math.floor(+from.value);
    const n = Math.floor(+take.value);
    if (!(s >= 1 && s <= count)) return { error: `Başlangıç 1 ile ${count} arasında olmalı`, field: from };
    if (!(n >= 1)) return { error: 'Sayfa sayısı en az 1 olmalı', field: take };
    const end = Math.min(count, s + n - 1);
    return { pages: Array.from({ length: end - s + 1 }, (_, i) => s + i), clipped: s + n - 1 > count };
  };
  const update = () => {
    const r = pick();
    range.classList.toggle('invalid', form.pdfMode.value === 'range' && !!r.error && range.value.trim() !== '');
    from.classList.toggle('invalid', r.field === from);
    take.classList.toggle('invalid', r.field === take);
    summary.classList.toggle('error', !!r.error && !(form.pdfMode.value === 'range' && !range.value.trim()));
    ok.disabled = !!r.error;
    if (r.error) summary.textContent = r.error;
    else {
      const p = r.pages;
      const which = p.length === 1 ? `${p[0]}. sayfa` : `${p.length} sayfa (${describePages(p)})`;
      summary.textContent = which + ' eklenecek' + (r.clipped ? ' — PDF burada bitiyor' : '') +
        (p.length > 30 ? '. Biraz sürebilir.' : '');
    }
    return r;
  };
  // Bir kutuya yazmaya başlayınca ilgili seçenek kendiliğinden seçilsin.
  const focusMode = (mode) => () => { form.pdfMode.value = mode; update(); };

  return new Promise((resolve) => {
    const finish = (pages) => {
      pdfDialog.classList.add('hidden');
      form.removeEventListener('input', update);
      form.removeEventListener('submit', onSubmit);
      pdfDialog.removeEventListener('keydown', onKey);
      pdfDialog.removeEventListener('pointerdown', onBackdrop);
      $('#pdfCancel').removeEventListener('click', onCancel);
      range.removeEventListener('focus', onRangeFocus);
      from.removeEventListener('focus', onFromFocus);
      take.removeEventListener('focus', onFromFocus);
      resolve(pages);
    };
    const onSubmit = (e) => {
      e.preventDefault();
      const r = update();
      if (!r.error) finish(r.pages);
    };
    const onKey = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(null);
      }
    };
    const onBackdrop = (e) => { if (e.target === pdfDialog) finish(null); };
    const onCancel = () => finish(null);
    const onRangeFocus = focusMode('range');
    const onFromFocus = focusMode('from');
    form.addEventListener('input', update);
    form.addEventListener('submit', onSubmit);
    pdfDialog.addEventListener('keydown', onKey);
    pdfDialog.addEventListener('pointerdown', onBackdrop);
    $('#pdfCancel').addEventListener('click', onCancel);
    range.addEventListener('focus', onRangeFocus);
    from.addEventListener('focus', onFromFocus);
    take.addEventListener('focus', onFromFocus);
    pdfDialog.classList.remove('hidden');
    update();
    ok.focus();
  });
}

// [1,2,3,5,7,8] -> "1-3, 5, 7-8"
function describePages(pages) {
  const out = [];
  for (let i = 0; i < pages.length; i++) {
    let j = i;
    while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++;
    out.push(i === j ? `${pages[i]}` : `${pages[i]}-${pages[j]}`);
    i = j;
  }
  const s = out.join(', ');
  return s.length > 40 ? s.slice(0, 40) + '…' : s;
}

// PDF'in seçilen sayfalarını resme çevirip alt alta yerleştirir.
async function insertPdf(file, at) {
  let doc;
  try {
    const lib = await loadPdfJs();
    doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  } catch {
    return toast('PDF açılamadı: ' + file.name);
  }
  const pages = doc.numPages > 1 ? await askPdfPages(file.name, doc.numPages) : [1];
  if (!pages) return doc.destroy();
  const count = pages.length;

  const z = board.view.zoom;
  const center = at || toWorld(innerWidth / 2, innerHeight / 2);
  const created = [];
  let y = null;
  for (const [i, n] of pages.entries()) {
    toast(`PDF ekleniyor… ${i + 1}/${count}`);
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, 2400 / Math.max(base.width, base.height));
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width);
    c.height = Math.round(vp.height);
    // 'print' amacı requestAnimationFrame kullanmaz; pencere arka plandayken de işlem sürer.
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp, intent: 'print' }).promise;
    // Sayfa ekranda yüksekliğin ~%80'i kadar görünsün.
    const h = (innerHeight * 0.8) / z;
    const w = (h * base.width) / base.height;
    if (y === null) y = center.y - h / 2;
    created.push({ id: newId(), type: 'image', src: c.toDataURL('image/jpeg', 0.9), x: center.x - w / 2, y, w, h });
    y += h + 24 / z;
    page.cleanup();
  }
  doc.destroy();
  checkpoint();
  board.elements.push(...created);
  setTool('select');
  selection = new Set(created.map((el) => el.id));
  changed();
  toast(`${count} sayfa eklendi`);
}

async function insertImageFiles(files, at) {
  for (const f of [...files].filter(isPdf)) await insertPdf(f, at);
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (!list.length) return;
  const z = board.view.zoom;
  const center = at || (pointer ? toWorld(pointer.x, pointer.y) : toWorld(innerWidth / 2, innerHeight / 2));
  const created = [];
  let offset = 0;
  for (const f of list) {
    try {
      const { src, w, h } = await prepareImage(await readAsDataURL(f));
      const k = Math.min(1 / z, (innerWidth * 0.5) / z / w, (innerHeight * 0.5) / z / h);
      created.push({
        id: newId(), type: 'image', src,
        x: center.x - (w * k) / 2 + offset, y: center.y - (h * k) / 2 + offset, w: w * k, h: h * k,
      });
      offset += 24 / z;
    } catch {
      toast('Resim açılamadı: ' + f.name);
    }
  }
  if (!created.length) return;
  checkpoint();
  board.elements.push(...created);
  setTool('select');
  selection = new Set(created.map((el) => el.id));
  changed();
}

// ---------- Obsidian ----------

// Obsidian notundan seçilen bölüm resim olarak eklenir; "obsidian" alanı kaynağı hatırlar
// (yenilemek ve Obsidian'da açmak için).
async function insertFromObsidian() {
  commitEditor();
  const res = await openObsidianPicker(api);
  if (!res) return;
  const { src, w, h } = res.result;
  const z = board.view.zoom;
  const center = toWorld(innerWidth / 2, innerHeight / 2);
  // Ekranda kendi boyutunda görünür; ekrana sığmayacak kadar genişse küçültülür.
  const k = Math.min(1 / z, (innerWidth * 0.8) / z / w);
  const el = {
    id: newId(), type: 'image', src,
    x: center.x - (w * k) / 2, y: center.y - Math.min(h * k, innerHeight * 0.8 / z) / 2, w: w * k, h: h * k,
    obsidian: { vault: res.vault, rel: res.rel, section: res.section, width: res.width, title: res.result.title },
  };
  checkpoint();
  board.elements.push(el);
  setTool('select');
  selection = new Set([el.id]);
  changed();
}

// Bölümleri Obsidian'daki güncel hâlleriyle yeniden üretir; genişlik korunur, yükseklik içeriğe uyar.
async function refreshObsidian(els) {
  const list = els.filter((el) => el.obsidian);
  if (!list.length) return toast('Tahtada Obsidian\'dan eklenmiş bölüm yok');
  toast(list.length > 1 ? `${list.length} bölüm yenileniyor…` : 'Yenileniyor…');
  const results = await Promise.all(list.map((el) => api.obsidianRender(el.obsidian)));
  let updated = 0;
  const errors = [];
  list.forEach((old, i) => {
    const r = results[i];
    const el = board.elements.find((e) => e.id === old.id); // beklerken silinmiş olabilir
    if (!el) return;
    if (r.error) return errors.push(`${old.obsidian.title}: ${r.error}`);
    if (r.src === el.src) return;
    if (!updated) checkpoint();
    el.src = r.src;
    el.h = (el.w * r.h) / r.w;
    el.obsidian = { ...el.obsidian, title: r.title };
    updated++;
  });
  if (updated) changed();
  if (errors.length) toast(errors.join(' — '));
  else if (updated) toast(updated > 1 ? `${updated} bölüm güncellendi` : 'Bölüm güncellendi');
  else toast('Bölümler zaten güncel');
}

async function openInObsidian(el) {
  if (!el?.obsidian) return;
  const ok = await api.obsidianOpen(el.obsidian);
  if (!ok) toast('Not bulunamadı; vault bağlı olmayabilir');
}

$('#imageInput').addEventListener('change', (e) => {
  insertImageFiles(e.target.files, toWorld(innerWidth / 2, innerHeight / 2));
  e.target.value = '';
});

// Electron'un bırakılan dosyaya "gitmesini" engelle.
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  if (overlayOpen()) return;
  if (e.dataTransfer?.files.length) insertImageFiles(e.dataTransfer.files, toWorld(e.clientX, e.clientY));
});

// ---------- Pano (kopyala / yapıştır) ----------

document.addEventListener('copy', (e) => {
  if (editing || !selection.size || overlayOpen()) return;
  const sel = selectedEls();
  e.clipboardData.setData(CLIP_MIME, JSON.stringify(sel));
  e.clipboardData.setData('text/plain', sel.filter((el) => el.text).map((el) => el.text).join('\n\n'));
  e.preventDefault();
});

document.addEventListener('cut', (e) => {
  if (editing || !selection.size || overlayOpen()) return;
  const sel = selectedEls();
  e.clipboardData.setData(CLIP_MIME, JSON.stringify(sel));
  e.preventDefault();
  deleteSelection();
});

document.addEventListener('paste', (e) => {
  if (editing || e.target === editor || overlayOpen()) return;
  const dt = e.clipboardData;
  e.preventDefault();
  const at = pointer ? toWorld(pointer.x, pointer.y) : toWorld(innerWidth / 2, innerHeight / 2);

  const own = dt.getData(CLIP_MIME);
  if (own) {
    try {
      const els = JSON.parse(own);
      const b = unionBBox(els);
      insertCopies(els, { x: at.x - (b.x + b.w / 2), y: at.y - (b.y + b.h / 2) });
    } catch { /* bozuk pano verisi */ }
    return;
  }

  const files = [...dt.items].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean);
  if (files.length) return insertImageFiles(files, at);

  const text = dt.getData('text/plain').trim();
  if (text) {
    checkpoint();
    const fs = styles.text.fontSize;
    const el = { id: newId(), type: 'text', x: at.x, y: at.y, text, color: styles.text.color, fontSize: fs, ...measureText(text, fs) };
    board.elements.push(el);
    setTool('select');
    selection = new Set([el.id]);
    changed();
  }
});

// ---------- Klavye ----------

let nudgeTime = 0;

window.addEventListener('keydown', (e) => {
  if (e.target === editor || obsidianPickerOpen() || pdfDialogOpen()) return;
  if (galleryOpen()) return galleryKeydown(e);
  // Rehber açıkken tuşlar tahtayı etkilemesin (arama kutusuna yazılan harf araç seçmesin).
  if (helpOpen()) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeHelp();
    }
    return;
  }

  if (drag?.kind === 'draw' && (e.key === 'Shift' || e.key === 'Control')) {
    updateDraw({ clientX: pointer.x, clientY: pointer.y, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey }, []);
    requestRender();
    return;
  }

  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();

  if (e.key === ' ' && !e.repeat) {
    spaceHeld = true;
    updateCursor();
    e.preventDefault();
    return;
  }

  if (mod) {
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    else if (k === 'a') {
      e.preventDefault();
      setTool('select');
      selection = new Set(board.elements.map((el) => el.id));
      updateProps();
      requestRender();
    } else if (k === 'd') { e.preventDefault(); duplicateSelection(); }
    else if ((k === 'c' || k === 'x') && selection.size) {
      // Seçili metin olmasa da "copy" olayının tetiklenmesini garanti eder.
      e.preventDefault();
      document.execCommand(k === 'c' ? 'copy' : 'cut');
    }
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteSelection();
  } else if (e.key === 'Escape') {
    selection.clear();
    closeFlyout();
    hideMenu();
    updateProps();
    requestRender();
  } else if (e.key.startsWith('Arrow') && selection.size) {
    e.preventDefault();
    const step = (e.shiftKey ? 10 : 1) / board.view.zoom;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (Date.now() - nudgeTime > 600) checkpoint();
    nudgeTime = Date.now();
    for (const el of selectedEls()) translate(el, d[0], d[1]);
    changed();
  } else if (e.key === ']') arrange('front');
  else if (e.key === '[') arrange('back');
  else if (!e.altKey && KEYMAP.has(k)) {
    const target = KEYMAP.get(k);
    // Eylemin açtığı pencere (ör. Obsidian seçicisinin arama kutusu) tuşun harfini almasın.
    e.preventDefault();
    if (ACTION_TARGETS.includes(target)) runAction(target);
    else setTool(target);
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === ' ') {
    spaceHeld = false;
    updateCursor();
  }
  if (drag?.kind === 'draw' && (e.key === 'Shift' || e.key === 'Control')) {
    updateDraw({ clientX: pointer.x, clientY: pointer.y, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey }, []);
    requestRender();
  }
});

window.addEventListener('blur', () => {
  spaceHeld = false;
  updateCursor();
});

window.addEventListener('resize', resize);

// ---------- Başlangıç ----------

async function init() {
  resize();
  setTool(tool);
  updateBgUI();
  updateAutoSaveUI();
  const res = await api.loadInitial();
  if (res.data) loadBoard(res.data);
  else {
    loadBoard(emptyBoard());
    zoomFit();
  }
}

init();
