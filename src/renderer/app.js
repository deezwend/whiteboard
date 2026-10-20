import {
  newId, bbox, unionBBox, hitTest, cloneEl, translate, scaleFrom,
  rotateAround, canRotate, resizeBox, insideLasso, splitByEraser, splitByLasso, NOTE_PADDING, CELL_PAD, rectsIntersect,
  POLY_SHAPES, shapePoints,
} from './geometry.js';
import {
  drawElement, drawBackground, measureText, wrappedHeight, listIndent, setImageLoadCallback, revealedCovers, renderOpts, getImage,
  LINK_SIZE,
} from './render.js';
import { recognizeShape, shapeToPoints } from './recognize.js';
import { createRuler, rulerHit, nearEdge, projectOnEdge, snapAngle, drawRuler } from './ruler.js';
import { createProtractor, protractorHit, nearArc, setArm, drawProtractor, PROT_R } from './protractor.js';
import { compileFunction, functionLabel } from './mathexpr.js';
import { openObsidianPicker } from './obsidian-picker.js';
import { t, lang, locale } from './i18n.js';

const api = window.api;
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const editor = document.getElementById('editor');
const $ = (s) => document.querySelector(s);

// ---------- Sabitler ----------

const INK_COLORS = ['#1f2328', '#868e96', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#7048e8', '#c2255c', '#ffffff'];
const HIGHLIGHT_COLORS = ['#ffd400', '#7cf29b', '#7ad7ff', '#ff9ad5', '#ffb15c', '#c9a7ff'];
const NOTE_COLORS = ['#fff3a3', '#ffd6e0', '#c9f2d0', '#cfe6ff', '#e5d9ff', '#ffe0b8'];
const LASER_COLORS = ['#ff2d2d', '#ff8c1a', '#ffd400', '#2fe36b', '#2d9bff', '#c04dff', '#ff3dbb'];
const COVER_COLORS = ['#4a7cf0', '#7048e8', '#e8590c', '#2f9e44', '#c2255c', '#495057'];
// Koordinat sistemine eklenen fonksiyonların sırayla aldığı renkler.
const FN_COLORS = ['#e03131', '#1971c2', '#2f9e44', '#f08c00', '#7048e8', '#c2255c'];
// Kareli arka planın bir karesi (dünya birimi); pergel ve koordinat sistemi bu birimi kullanır.
const GRID_UNIT = 40;
// Metindeki $…$ / $$…$$ formülleri (açılıştan sonra / kapanıştan önce boşluk olmaz, "$5 ile $10" formül değildir).
const MATH_RE = /\$\$[^$]+?\$\$|\$[^\s$](?:[^$]*?[^\s$])?\$(?!\d)/;
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
// Galaksi fırçasının renk seçenekleri: 'classic' klasik uzay renkleridir (öğeye yazılmaz),
// diğerleri öğenin galaxy alanına yazılır ve render.js o renkten bir palet türetir.
const GALAXY_TINTS = ['classic', '#e03131', '#f08c00', '#2f9e44', '#0c8599', '#1971c2', '#7048e8', '#c2255c', '#1f2328'];
const GALAXY_CLASSIC_BG = 'linear-gradient(135deg, #1b1f6b, #a23bd6 55%, #2f6fe0)';
// Kalem fırçaları: renk seçimi kullanmayanlar (gökkuşağı) kendi renklerini üretir; galaksi
// kalem rengi yerine kendi renk listesini (GALAXY_TINTS) kullanır.
// icon: paneldeki düğmede gösterilen küçük önizleme (SVG içeriği, viewBox 0 0 32 16).
const BRUSH_WAVE = 'M3 11c4-7 8-7 13-1s9 6 13-2';
const BRUSHES = [
  { id: 'normal', label: t('Kalem'), title: t('Düz kalem'),
    icon: `<path d="${BRUSH_WAVE}" stroke="currentColor" stroke-width="2.5"/>` },
  { id: 'calligraphy', label: t('Kaligrafi'), title: t('Eğik keskin uç: yöne göre incelip kalınlaşır'),
    icon: '<path d="M3.4 6.4 4.3 5.5 5.2 4.8 6.3 4.0 7.6 3.2 8.9 2.6 10.2 2.2 11.4 2.1 12.4 2.3 13.4 2.8 14.4 3.5 15.3 4.3 16.3 5.3 17.2 6.2 18.1 7.1 19.0 8.0 20.0 8.8 20.8 9.4 21.6 10.0 22.3 10.4 23.0 10.8 23.5 11.0 24.1 11.0 24.7 10.7 25.6 10.0 26.6 9.2 27.5 8.3 28.4 7.3 29.4 6.4 28.6 7.1 27.7 8.0 26.8 9.0 25.9 9.9 24.9 10.7 24.0 11.5 22.8 12.3 21.5 13.0 20.2 13.6 18.9 13.9 17.8 13.8 16.7 13.5 15.8 13.0 14.8 12.2 13.9 11.4 13.0 10.4 12.0 9.5 11.1 8.6 10.2 7.8 9.3 7.0 8.4 6.4 7.6 5.9 7.0 5.4 6.4 5.1 5.8 5.0 5.2 5.1 4.5 5.5 3.6 6.3 2.6 7.1z" fill="currentColor" stroke="none"/>' },
  { id: 'brushpen', label: t('Fırça kalem'), title: t('Yavaş çizince kalın, hızlı çizince ince; uçları sivri'),
    icon: '<path d="M3.2 6.9 4.7 6.7 5.6 6.2 6.4 5.6 7.1 5.2 7.8 5.1 8.5 5.4 8.9 5.9 9.3 6.6 9.7 7.3 10.5 7.8 11.5 8.3 12.7 8.8 13.9 9.5 14.9 10.4 15.8 11.4 16.6 12.5 17.6 13.6 18.7 14.5 20.2 15.0 21.8 14.7 23.1 14.0 24.1 13.0 25.1 12.1 26.1 11.3 27.1 10.4 28.0 9.5 28.9 8.5 29.2 6.9 28.8 6.6 27.3 6.9 26.2 7.7 25.4 8.6 24.5 9.5 23.6 10.0 22.7 10.2 21.9 10.1 21.4 9.6 21.1 9.4 20.7 9.3 20.0 9.3 19.1 9.2 18.0 8.8 17.1 8.1 16.3 7.1 15.6 5.9 14.9 4.7 14.1 3.5 13.0 2.6 11.6 2.1 10.1 2.0 8.7 2.3 7.5 2.6 6.3 3.0 5.2 3.4 4.1 4.1 3.2 5.1 2.8 6.6z" fill="currentColor" stroke="none"/>' },
  { id: 'fountain', label: t('Dolma kalem'), title: t('Hafifçe değişen kalınlıkta mürekkep'),
    icon: '<path d="M3.4 7.2 4.6 6.7 5.6 6.2 6.5 5.8 7.2 5.5 7.9 5.3 8.5 5.3 9.1 5.4 9.7 5.7 10.5 6.2 11.3 6.8 12.2 7.6 13.1 8.4 14.0 9.4 15.0 10.3 15.9 11.2 17.0 12.1 18.0 12.8 19.2 13.3 20.4 13.6 21.7 13.7 22.9 13.4 24.1 13.0 25.2 12.3 26.2 11.5 27.2 10.6 28.1 9.5 28.8 8.4 29.4 7.2 28.6 6.3 27.3 6.9 26.2 7.7 25.2 8.5 24.3 9.2 23.5 9.8 22.7 10.3 22.1 10.6 21.5 10.7 20.9 10.7 20.2 10.5 19.5 10.2 18.8 9.7 17.9 9.0 17.0 8.2 16.1 7.3 15.2 6.3 14.2 5.4 13.2 4.5 12.2 3.7 11.1 3.0 9.9 2.6 8.7 2.3 7.4 2.4 6.2 2.7 5.1 3.3 4.1 4.1 3.2 5.1 2.6 6.3z" fill="currentColor" stroke="none"/>' },
  { id: 'dashed', label: t('Kesikli'), title: t('Kesik kesik çizgi'),
    icon: `<path d="${BRUSH_WAVE}" stroke="currentColor" stroke-width="2.5" stroke-dasharray="3 3.5"/>` },
  { id: 'arrow', label: t('Oklu'), title: t('Çizginin sonuna ok ucu ekler'),
    icon: '<path d="M3 12c4-7 8-7 12-2s8 5 13-4M22.5 5.5L28 6l-1 5.5" stroke="currentColor" stroke-width="2.5"/>' },
  { id: 'dashedarrow', label: t('Kesikli ok'), title: t('Kesik kesik çizgi, sonunda ok ucu'),
    icon: '<path d="M3 12c4-7 8-7 12-2s8 5 13-4" stroke="currentColor" stroke-width="2.5" stroke-dasharray="3 3.5"/><path d="M22.5 5.5L28 6l-1 5.5" stroke="currentColor" stroke-width="2.5"/>' },
  { id: 'rainbow', label: t('Gökkuşağı'), title: t('Çizdikçe renk değiştirir'), noColor: true,
    icon: `<defs><linearGradient id="brushRainbow"><stop offset="0" stop-color="#f03e3e"/><stop offset=".25" stop-color="#fab005"/><stop offset=".5" stop-color="#40c057"/><stop offset=".75" stop-color="#228be6"/><stop offset="1" stop-color="#be4bdb"/></linearGradient></defs>
      <path d="${BRUSH_WAVE}" stroke="url(#brushRainbow)" stroke-width="3.5"/>` },
  { id: 'galaxy', label: t('Galaksi'), title: t('Yıldızlı uzay mürekkebi'),
    icon: `<defs><linearGradient id="brushGalaxy"><stop offset="0" stop-color="#1b1f6b"/><stop offset=".5" stop-color="#a23bd6"/><stop offset="1" stop-color="#2f6fe0"/></linearGradient></defs>
      <path d="${BRUSH_WAVE}" stroke="url(#brushGalaxy)" stroke-width="4.5"/>
      <g fill="#fff" stroke="none"><circle cx="6.5" cy="6.6" r=".7"/><circle cx="12" cy="5.4" r=".6"/><circle cx="17" cy="10.4" r=".7"/><circle cx="23" cy="10.6" r=".6"/><circle cx="27.5" cy="6.4" r=".6"/></g>` },
  { id: 'tape', label: t('Bant'), title: t('Desenli yapışkan bant (washi)'),
    icon: '<path d="M2 11.5L30 4.5" stroke="currentColor" stroke-width="7" stroke-linecap="butt" opacity=".75"/><path d="M2 11.5L30 4.5" stroke="#fff" stroke-width="7" stroke-linecap="butt" stroke-dasharray="1.5 2.5" opacity=".5"/>' },
  { id: 'hatch', label: t('Taralı'), title: t('Çizdiğin alanın içini eğik çizgilerle tarar'),
    icon: '<defs><clipPath id="brushHatch"><path d="M4 14 9 2h19l-5 12z"/></clipPath></defs><path d="M0 16 14 2M5 16 19 2M10 16 24 2M15 16 29 2M20 16 34 2M25 16 39 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="butt" clip-path="url(#brushHatch)"/>' },
];
// Taralı fırçanın tarama yönleri: 'fwd' varsayılandır (öğeye yazılmaz), diğerleri öğenin hatch alanına yazılır.
const HATCH_DIRS = [
  { id: 'fwd', label: t('Eğik tarama'), icon: '<path d="M7 15 20 2M12 15 25 2" />' },
  { id: 'back', label: t('Ters eğik tarama'), icon: '<path d="M7 2l13 13M12 2l13 13" />' },
  { id: 'cross', label: t('Çapraz tarama'), icon: '<path d="M7 15 20 2M12 15 25 2M7 2l13 13M12 2l13 13" />' },
];
const FONT_SIZES = [16, 24, 36, 56, 80];
const ERASER_RADIUS = 10; // ekran pikseli
const TEMP_FADE_MS = 1200; // geçici fosforlu kalemin bırakıldıktan sonra sönme süresi
const HANDLE = 7;
const ROT_HANDLE_GAP = 26; // döndürme tutamacının çerçeveye uzaklığı (ekran pikseli)
const OVERLAY_PANELS = '#toolbar, #props, #filebar, #zoombar, #searchBar'; // tahtanın üstünde duran çubuklar
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const SELECT_COLOR = '#4a7cf0';
const LOCK_COLOR = '#e8590c';
const GUIDE_COLOR = '#e8368f'; // taşırken çıkan hizalama kılavuzları
const SNAP_PX = 6; // kılavuzun yapıştığı uzaklık (ekran pikseli)
// Metin biçimi alanları (yazı, not ve tablo öğelerinde; yalnızca varsayılandan farklıysa yazılır).
const FMT_PROPS = ['bold', 'italic', 'underline', 'align', 'list'];
const TEXT_TYPES = ['text', 'note', 'table'];
// Çıkartma aracının emojileri.
const STICKERS = ['👍', '👎', '❤️', '⭐', '🔥', '🎉', '✅', '❌', '❓', '❗', '💡', '📌', '🎯', '🏆', '⚠️', '💯',
  '😀', '😂', '😍', '😮', '😢', '😡', '🤔', '👏', '🙌', '💪', '👀', '🚀', '⏰', '📅', '📝', '📚'];
// Adresin tamamı bir web bağlantısıysa yapıştırınca bağlantı kartı olur.
const URL_RE = /^https?:\/\/[^\s]+$/i;
const IMAGE_URL_RE = /\.(png|jpe?g|gif|webp|bmp|avif)(?:[?#]|$)/i;
const CLIP_MIME = 'application/x-beyaztahta';

const SHAPE_TOOLS = ['rect', 'ellipse', 'line', 'arrow', 'compass', ...POLY_SHAPES];
// Araç kısayolları — Microsoft Whiteboard'daki gibi her araç tek tuşla seçilir; ayrıca üst
// sıradaki sayı tuşları (1-9, 0) en sık kullanılan araçlara doğrudan erişir. 'key' düğmenin
// köşesinde rozet olarak görünür, 'num' hızlı sayı tuşu, 'alt' ise eski alışkanlık için yedektir.
const SHORTCUTS = [
  { target: 'select', key: 'v', num: '1' },
  { target: 'cut', key: 's' },
  { target: 'pen', key: 'p', num: '2' },
  { target: 'highlighter', key: 'h', num: '3' },
  { target: 'tempHighlighter', key: 'g', num: '4' },
  { target: 'laser', key: 'w' },
  { target: 'eraser', key: 'e', num: '5' },
  { target: 'ruler', key: 'r', num: '6', alt: 'u' },
  { target: 'protractor', key: 'q' },
  { target: 'rect', key: 'd', num: '7' },
  { target: 'ellipse', key: 'o', num: '8' },
  { target: 'line', key: 'l', num: '9' },
  { target: 'arrow', key: 'a', num: '0' },
  { target: 'compass', key: 'c' },
  { target: 'text', key: 't' },
  { target: 'note', key: 'n' },
  { target: 'cover', key: 'k' },
  { target: 'sticker', key: 'm' },
  { target: 'image', key: 'i' },
  { target: 'obsidian', key: 'b' },
  { target: 'table', key: 'y' },
  { target: 'template', key: 'j' },
  { target: 'link', key: 'f' },
  { target: 'axes', key: 'x' },
];
// Bunlar birer araç değil eylemdir; kısayol da bunları runAction'a yönlendirir.
const ACTION_TARGETS = ['ruler', 'protractor', 'image', 'obsidian', 'axes', 'table', 'template', 'link'];
// Yalnızca Öğrenci modu açıkken kullanılabilen araçlar ve komutlar.
const STUDENT_TARGETS = ['protractor', 'compass', 'cover', 'axes'];
const STUDENT_COMMANDS = ['exportPdf', 'print', 'unlockAll', 'coversHide', 'coversShow'];
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
  pen: { color: '#1f2328', width: 3, toShape: true, brush: 'normal', galaxy: 'classic', hatch: 'fwd' },
  highlighter: { color: '#ffd400', width: 18 },
  tempHighlighter: { color: '#ffd400', width: 18 },
  shape: { color: '#1f2328', width: 3, fill: 'none' },
  text: { color: '#1f2328', fontSize: 24 },
  note: { color: '#fff3a3', fontSize: 20 },
  sticker: { emoji: '👍' },
  cover: { color: '#4a7cf0' },
  laser: { color: '#ff2d2d' },
  eraser: { mode: 'stroke', all: false }, // mode: 'stroke' (bütün çizgi) | 'partial' (kısmi)
};
// PDF eklerken sayfalar kilitlensin mi; PDF dışa aktarma / yazdırma seçenekleri.
let pdfLock = true;
let studentMode = false;
let exportOpts = { orient: 'portrait', fit: 'width', bg: true };
let tool = 'pen';
// Her araç grubunda en son kullanılan araç (grup adı -> araç), düğmede o gösterilir.
let groupPick = {};
// Özellik paneli: collapsed = alt sekmeyle gizlendi; pinned = çizerken kendiliğinden gizlenmez.
const propsUi = { collapsed: false, pinned: true };
let propsKey = null; // panelin en son gösterdiği bağlam (araç adı, 'select' ya da 'edit')
// Kapalıyken değişiklikler yalnızca Ctrl+S ile kaydedilir.
let autoSave = true;
let showComments = true; // yorum rozetleri görünsün mü (menüdeki "Yorumları göster")
loadPrefs();

// Araç ayarındaki metin biçiminden yeni öğeye yalnızca varsayılandan farklı olanlar yazılır.
function fmtOf(st) {
  const out = {};
  for (const k of FMT_PROPS) if (st[k] && !(k === 'align' && st[k] === 'left')) out[k] = st[k];
  return out;
}

function setFmt(el, prop, value) {
  if (!value || (prop === 'align' && value === 'left')) delete el[prop];
  else el[prop] = value;
}

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
let protractor = null; // açıkken { cx, cy, angle, a1, a2 } (ekran koordinatı)
let crop = null; // resim kırpılırken { id, r: { x, y, w, h } } (dünya koordinatı)
let search = null; // tahtada arama açıkken { q, hits: [kimlik], i }
let compass = null; // pergel kuruluyken { cx, cy, r, a } (dünya koordinatı; a: kalem ucunun açısı)
let fnEdit = null; // koordinat sisteminde denklemi düzenlenen grafik: { id, i: fns içindeki sıra }
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
    if (typeof p.pdfLock === 'boolean') pdfLock = p.pdfLock;
    if (typeof p.studentMode === 'boolean') studentMode = p.studentMode;
    if (typeof p.showComments === 'boolean') showComments = p.showComments;
    if (p.exportOpts) Object.assign(exportOpts, p.exportOpts);
  } catch { /* tercihler isteğe bağlı */ }
}

function savePrefs() {
  try {
    localStorage.setItem('prefs', JSON.stringify({ styles, tool, groups: groupPick, props: propsUi, autoSave, pdfLock, exportOpts, studentMode, showComments }));
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
  crop = null;
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  board.elements = undoStack.pop();
  pruneSelection();
  changed();
}

function redo() {
  commitEditor();
  crop = null;
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
  if (!autoSave) return setSaveState(t('Kaydedilmedi'));
  setSaveState(t('Kaydediliyor…'));
  saveTimer = setTimeout(saveNow, 700);
}

function setAutoSave(v) {
  autoSave = v;
  savePrefs();
  updateAutoSaveUI();
  if (dirty) scheduleSave(); // açılınca bekleyen değişiklikler hemen kaydedilir
  toast(v ? t('Otomatik kaydetme açık') : t('Otomatik kaydetme kapalı — Ctrl+S ile kaydet'));
}

// Öğrenci modu: açıölçer, pergel, gizleme bandı, koordinat sistemi, kilitleme, formüller, PDF ve
// yazdırma. Kapalıyken araçlar gizlenir; tahtadaki bant, grafik gibi nesneler yerinde kalır.
function setStudentMode(v) {
  studentMode = v;
  savePrefs();
  applyStudentMode();
  toast(v ? t('Öğrenci modu açık') : t('Öğrenci modu kapalı'));
}

function applyStudentMode() {
  document.body.classList.toggle('student', studentMode);
  $('#studentToggle').setAttribute('aria-checked', String(studentMode));
  renderOpts.math = studentMode;
  if (!studentMode) {
    protractor = null;
    compass = null;
    $('[data-action="protractor"]').classList.remove('active');
    if (STUDENT_TARGETS.includes(tool)) setTool('pen');
  }
  // Grup düğmesi gizlenen bir aracı gösteriyorsa gruptaki ilk görünür araca geçer.
  for (const grp of toolGroups) {
    const pick = groupPick[grp.name];
    showInGroup(grp, !studentMode && STUDENT_TARGETS.includes(pick) ? targetOf(grp.members[0]) : pick);
  }
  buildHelpKeys();
  sceneCacheValid = false;
  changed(false);
}

function studentOnly() {
  if (studentMode) return true;
  toast(t('Bu özellik Öğrenci modunda kullanılabilir — menüden (☰) aç'));
  return false;
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
    if (!dirty) setSaveState(t('Kaydedildi'));
    if (res?.conflict) toast(t('Tahta başka bir cihazda değişmiş; senin sürümün ayrı bir kopya olarak kaydedildi'));
  } catch {
    dirty = true;
    setSaveState(t('Kaydedilemedi!'));
  }
}

// Dil değiştirmek için sayfa yeniden yüklenirken (setLanguage) kaydetme sorusu tekrarlanmaz.
let reloadingForLang = false;
window.addEventListener('beforeunload', (e) => {
  if (reloadingForLang) return; // leaveBoard kaydetti ya da kullanıcı "Kaydetme" dedi
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
  syncMath();
  if (search) runSearch(false);
  requestRender();
  updateUndoButtons();
  updateProps();
  if (commentFor) renderCommentPop();
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
  revealedCovers.clear();
  compass = null;
  crop = null;
  resetComments();
  dirty = false;
  setSaveState(t('Kaydedildi'));
  updateBgUI();
  changed(false);
  // Küçük resmi olmayan (eski) tahtalar galeride görünsün diye bir kez yeniden kaydedilir.
  if (autoSave && data && !data.thumb && board.elements.length) scheduleSave();
}

// ---------- Formüller ($…$) ----------
// Formül içeren metin öğesi ana süreçte KaTeX ile şeffaf bir resme çevrilir ve öğenin "math"
// alanında saklanır ({ src, text, key }). Resim, yazı/boyut/renk değişince yeniden üretilir;
// o arada eski resim (yazı da değiştiyse düz metin) gösterilir.

const mathTimers = new Map(); // öğe kimliği -> bekleyen istek zamanlayıcısı
const mathKey = (el) => `${el.fontSize}|${el.color}`;

function syncMath() {
  if (!studentMode) return;
  for (const el of board.elements) {
    if (el.type !== 'text') continue;
    if (!MATH_RE.test(el.text)) {
      if (el.math) {
        delete el.math;
        const m = measureText(el.text, el.fontSize, el);
        resizeBox(el, m.w, m.h);
      }
      continue;
    }
    if (el.math && el.math.text === el.text && el.math.key === mathKey(el)) continue;
    requestMath(el);
  }
}

// Boyutlandırırken art arda istek gitmesin diye kısa bir bekleme.
function requestMath(el) {
  const want = el.text + '\u0000' + mathKey(el);
  const pending = mathTimers.get(el.id);
  if (pending?.want === want) return;
  if (pending) clearTimeout(pending.timer);
  const timer = setTimeout(async () => {
    const src = board.elements.find((e) => e.id === el.id);
    if (!src || src.type !== 'text') return mathTimers.delete(el.id);
    const { text, fontSize, color } = src;
    const key = mathKey(src);
    const r = await api.renderMath({ text, fontSize, color });
    if (mathTimers.get(el.id)?.timer === timer) mathTimers.delete(el.id);
    // Beklerken öğe silinmiş, geri alınmış ya da değişmiş olabilir: güncel nesne kimlikle bulunur.
    const cur = board.elements.find((e) => e.id === el.id);
    if (!cur || r?.error || cur.text !== text || mathKey(cur) !== key) return;
    cur.math = { src: r.src, text, key };
    resizeBox(cur, r.w, r.h);
    sceneCacheValid = false;
    requestRender();
    if (autoSave) scheduleSave();
  }, 180);
  mathTimers.set(el.id, { want, timer });
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
    // Tablo hücresi düzenlenirken yalnızca o hücrenin yazısı gizlenir.
    if (el !== skip) drawElement(c, el, el.id === editingId && (editing.cell || true));
  }
}

function render() {
  const live = drag && (drag.kind === 'draw' || drag.kind === 'shape' || drag.kind === 'compassArc') ? drag.el : null;
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
  updateCommentPins();
  positionCommentPop();
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
  if (crop) drawCropOverlay();
  else if (sel.length && !editing && sel.some((el) => el.locked)) {
    // Kilitli nesne taşınamaz, boyutlandırılamaz: tutamaçsız, kesikli turuncu çerçeve.
    ctx.strokeStyle = LOCK_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    for (const el of sel) {
      const r = screenRect(bbox(el));
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    ctx.setLineDash([]);
  } else if (sel.length && !editing && drag?.kind === 'rotate') {
    drawRotateOverlay(sel);
  } else if (sel.length && !editing) {
    ctx.strokeStyle = SELECT_COLOR;
    ctx.lineWidth = 1;
    // Birden fazla birim (tek nesne ya da grup) seçiliyse her birinin çerçevesi kesikli çizilir.
    const units = unitsOf(sel);
    if (units.length > 1) {
      ctx.setLineDash([4, 3]);
      for (const u of units) {
        const r = screenRect(u.b);
        ctx.strokeRect(r.x, r.y, r.w, r.h);
      }
      ctx.setLineDash([]);
    }
    // Dönmüş kutu öğelerinin kendi (dönük) çerçevesi de ince çizilir.
    for (const el of sel) {
      if (!el.rot) continue;
      const r = screenRect({ x: el.x, y: el.y, w: el.w, h: el.h });
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.rotate(el.rot);
      ctx.strokeRect(-r.w / 2, -r.h / 2, r.w, r.h);
      ctx.restore();
    }
    const handles = handlePositions();
    if (!isSingleLine(sel)) {
      const r = screenRect(unionBBox(sel));
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    if (handles.rot) {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const dir = handles.rot.below ? -1 : 1;
      ctx.moveTo(handles.rot.x, handles.rot.y + dir * (HANDLE + 1));
      ctx.lineTo(handles.rot.x, handles.rot.y + dir * ROT_HANDLE_GAP);
      ctx.stroke();
    }
    for (const [name, p] of Object.entries(handles)) {
      if (name === 'rot') {
        drawRotateHandle(p.x, p.y);
        continue;
      }
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (isSingleLine(sel)) ctx.arc(p.x, p.y, HANDLE - 1, 0, Math.PI * 2);
      else ctx.rect(p.x - HANDLE + 2, p.y - HANDLE + 2, (HANDLE - 2) * 2, (HANDLE - 2) * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  if ((drag?.kind === 'lasso' || drag?.kind === 'cutLasso') && drag.points.length > 1) {
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

  if (drag?.kind === 'move' && drag.guides) drawGuides(drag.guides);
  if (ruler) drawRuler(ctx, ruler);
  if (protractor) drawProtractor(ctx, protractor);
  if (activeTool() === 'compass') drawCompass();
  drawSearchHits();
  drawLaser();

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

// Taşırken yapışılan kenar / orta çizgileri.
function drawGuides(guides) {
  ctx.save();
  ctx.strokeStyle = GUIDE_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  for (const g of guides) {
    if (g.x !== undefined) {
      const a = toScreen(g.x, g.y0), b = toScreen(g.x, g.y1);
      ctx.moveTo(Math.round(a.x) + 0.5, a.y);
      ctx.lineTo(Math.round(b.x) + 0.5, b.y);
    } else {
      const a = toScreen(g.x0, g.y), b = toScreen(g.x1, g.y);
      ctx.moveTo(a.x, Math.round(a.y) + 0.5);
      ctx.lineTo(b.x, Math.round(b.y) + 0.5);
    }
  }
  ctx.stroke();
  ctx.restore();
}

// Döndürme tutamacı: içinde dönen ok bulunan yuvarlak düğme.
function drawRotateHandle(x, y) {
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = SELECT_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, HANDLE + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const r = HANDLE - 3;
  const a = -Math.PI * 0.35;
  ctx.beginPath();
  ctx.arc(x, y, r, a, Math.PI * 1.25);
  ctx.stroke();
  // Okun ucu, yayın başında.
  const tx = x + r * Math.cos(a), ty = y + r * Math.sin(a);
  ctx.fillStyle = SELECT_COLOR;
  ctx.beginPath();
  ctx.moveTo(tx + 3, ty - 2.5);
  ctx.lineTo(tx + 1, ty + 3);
  ctx.lineTo(tx - 3.5, ty - 1);
  ctx.closePath();
  ctx.fill();
}

// Döndürürken: dönen nesnelerin çerçevesi, merkez noktası, merkezden tutamağa çizgi ve açı.
function drawRotateOverlay(sel) {
  const c = toScreen(drag.cx, drag.cy);
  const p = drag.pointer;
  ctx.strokeStyle = SELECT_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  for (const el of sel) {
    const r = screenRect(bbox(el));
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  }
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = SELECT_COLOR;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  drawRotateHandle(p.x, p.y);
  let deg = Math.round(((drag.base + drag.angle) * 180) / Math.PI) % 360;
  if (deg < 0) deg += 360;
  const label = deg + '°';
  ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
  const tw = ctx.measureText(label).width;
  const lx = p.x + 14, ly = p.y - 26;
  ctx.fillStyle = 'rgba(31,35,40,0.85)';
  ctx.beginPath();
  ctx.roundRect(lx, ly, tw + 12, 20, 5);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, lx + 6, ly + 10);
}

// ---------- Seçim yardımcıları ----------

function selectedEls() {
  return board.elements.filter((el) => selection.has(el.id));
}

// ---------- Gruplar ----------
// Gruplanan nesneler aynı groupId'yi taşır. Tıklama, Shift+tık ve kement grubu bütün olarak seçer;
// Ctrl+tık gruptaki tek nesneyi seçer. Hizalama ve dağıtma her grubu tek birim sayar.

function groupMates(el) {
  return el.groupId ? board.elements.filter((e) => e.groupId === el.groupId && !e.locked) : [el];
}

// Seçimde bir grubun herhangi bir üyesi varsa grubun tamamını ekler.
function expandGroups(ids) {
  const gids = new Set();
  for (const el of board.elements) if (el.groupId && ids.has(el.id)) gids.add(el.groupId);
  if (!gids.size) return ids;
  const out = new Set(ids);
  for (const el of board.elements) if (el.groupId && gids.has(el.groupId) && !el.locked) out.add(el.id);
  return out;
}

// Nesneleri birimlere ayırır: her grup bir birim, gruba girmeyen her nesne bir birim.
function unitsOf(els) {
  const map = new Map();
  for (const el of els) {
    const k = el.groupId || el.id;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(el);
  }
  return [...map.values()].map((list) => ({ els: list, b: unionBBox(list) }));
}

function groupSelection() {
  const sel = selectedEls().filter((el) => !el.locked);
  if (unitsOf(sel).length < 2) return toast(t('Gruplamak için en az iki nesne seç'));
  checkpoint();
  const gid = newId();
  for (const el of sel) el.groupId = gid;
  changed();
  toast(t('{n} nesne gruplandı — gruptan tek nesne seçmek için Ctrl+tık', { n: sel.length }));
}

function ungroupSelection() {
  const sel = selectedEls().filter((el) => el.groupId);
  if (!sel.length) return toast(t('Seçimde grup yok'));
  checkpoint();
  for (const el of sel) delete el.groupId;
  changed();
  toast(t('Grup çözüldü'));
}

// Ctrl+Shift+G: seçim tek bir grupsa çözer, değilse gruplar.
function toggleGroup() {
  const sel = selectedEls();
  if (sel.length && sel[0].groupId && sel.every((el) => el.groupId === sel[0].groupId)) ungroupSelection();
  else groupSelection();
}

// ---------- Hizalama ve dağıtma ----------
// Seçili birimler (grup ya da tek nesne) seçimin çerçevesine göre hizalanır; dağıtmada aralarındaki
// boşluklar eşitlenir, ızgarada okuma sırasıyla düzenli satır ve sütunlara dizilir.

function alignSelection(how) {
  const units = unitsOf(selectedEls().filter((el) => !el.locked));
  const dist = how === 'distH' || how === 'distV';
  if (units.length < (dist ? 3 : 2)) {
    return toast(dist ? t('Dağıtmak için en az üç nesne seç') : t('Hizalamak için en az iki nesne seç'));
  }
  const all = unionBBox(units.flatMap((u) => u.els));
  const move = (u, dx, dy) => {
    for (const el of u.els) translate(el, dx, dy);
  };
  checkpoint();
  if (dist) {
    const h = how === 'distH';
    const key = h ? 'x' : 'y', size = h ? 'w' : 'h';
    const list = [...units].sort((a, b) => a.b[key] + a.b[size] / 2 - (b.b[key] + b.b[size] / 2));
    const gap = (all[size] - list.reduce((sum, u) => sum + u.b[size], 0)) / (list.length - 1);
    let pos = all[key];
    for (const u of list) {
      const d = pos - u.b[key];
      move(u, h ? d : 0, h ? 0 : d);
      pos += u.b[size] + gap;
    }
  } else if (how === 'grid') {
    arrangeGrid(units, all, move);
  } else {
    for (const { b, ...u } of units) {
      const dx = how === 'left' ? all.x - b.x
        : how === 'right' ? all.x + all.w - b.x - b.w
        : how === 'hcenter' ? all.x + all.w / 2 - b.x - b.w / 2 : 0;
      const dy = how === 'top' ? all.y - b.y
        : how === 'bottom' ? all.y + all.h - b.y - b.h
        : how === 'vcenter' ? all.y + all.h / 2 - b.y - b.h / 2 : 0;
      move(u, dx, dy);
    }
  }
  changed();
}

// Birimleri okuma sırasına göre (yukarıdan aşağı, soldan sağa) eşit hücreli bir ızgaraya dizer.
function arrangeGrid(units, all, move) {
  const cols = Math.ceil(Math.sqrt(units.length));
  const byY = [...units].sort((a, b) => a.b.y + a.b.h / 2 - (b.b.y + b.b.h / 2));
  const order = [];
  for (let i = 0; i < byY.length; i += cols) order.push(...byY.slice(i, i + cols).sort((a, b) => a.b.x - b.b.x));
  const cw = Math.max(...units.map((u) => u.b.w));
  const ch = Math.max(...units.map((u) => u.b.h));
  const gap = Math.max(16, Math.min(cw, ch) * 0.1);
  order.forEach((u, i) => {
    const x = all.x + (i % cols) * (cw + gap);
    const y = all.y + Math.floor(i / cols) * (ch + gap);
    move(u, x - u.b.x, y - u.b.y);
  });
}

// Taşıma başında: taşınan nesnelerin ilk hâlleri ve yapışılabilecek diğer nesnelerin (ekrandakiler) kutuları.
function startMoveSnap() {
  const moving = selectedEls().filter((el) => !el.locked);
  drag.orig = new Map(moving.map((el) => [el, { ...el }]));
  drag.b0 = unionBBox(moving);
  const a = toWorld(0, 0), z = toWorld(innerWidth, innerHeight);
  const view = { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
  drag.targets = board.elements
    .filter((el) => !selection.has(el.id))
    .map(bbox)
    .filter((b) => rectsIntersect(b, view))
    .slice(-400);
}

// Taşınan kutunun kenarlarını ve ortasını, diğer nesnelerin kenar ve ortalarına yaklaşınca yapıştırır.
function snapMove(dx, dy) {
  const b = drag.b0;
  if (!b || !drag.targets.length) return { dx: 0, dy: 0, guides: null };
  const tol = SNAP_PX / board.view.zoom;
  const lines = (r, k, size) => [r[k], r[k] + r[size] / 2, r[k] + r[size]];
  const best = (k, size, d) => {
    let hit = null;
    const mine = lines(b, k, size).map((v) => v + d);
    for (const tb of drag.targets) {
      for (const tv of lines(tb, k, size)) {
        for (const mv of mine) {
          const diff = tv - mv;
          if (Math.abs(diff) <= tol && (!hit || Math.abs(diff) < Math.abs(hit.diff))) hit = { diff, v: tv, tb };
        }
      }
    }
    return hit;
  };
  const hx = best('x', 'w', dx);
  const hy = best('y', 'h', dy);
  const nb = { x: b.x + dx + (hx?.diff || 0), y: b.y + dy + (hy?.diff || 0), w: b.w, h: b.h };
  const guides = [];
  if (hx) guides.push({ x: hx.v, y0: Math.min(nb.y, hx.tb.y), y1: Math.max(nb.y + nb.h, hx.tb.y + hx.tb.h) });
  if (hy) guides.push({ y: hy.v, x0: Math.min(nb.x, hy.tb.x), x1: Math.max(nb.x + nb.w, hy.tb.x + hy.tb.w) });
  return { dx: hx?.diff || 0, dy: hy?.diff || 0, guides: guides.length ? guides : null };
}

function isSingleLine(sel) {
  return sel.length === 1 && (sel[0].type === 'line' || sel[0].type === 'arrow');
}

function handlePositions() {
  const sel = selectedEls();
  if (!sel.length || crop || sel.some((el) => el.locked)) return {};
  if (isSingleLine(sel)) {
    const el = sel[0];
    return { p1: toScreen(el.x1, el.y1), p2: toScreen(el.x2, el.y2) };
  }
  const r = screenRect(unionBBox(sel));
  const h = {
    nw: { x: r.x, y: r.y },
    ne: { x: r.x + r.w, y: r.y },
    sw: { x: r.x, y: r.y + r.h },
    se: { x: r.x + r.w, y: r.y + r.h },
  };
  // Döndürme tutamacı: çerçevenin üst kenarının ortasının biraz yukarısında; orada ekranın
  // dışında ya da bir panelin altında kalacaksa alt kenarın altında.
  if (sel.every(canRotate)) {
    const x = r.x + r.w / 2;
    const up = r.y - ROT_HANDLE_GAP;
    const covered = up < HANDLE * 2 || [...document.querySelectorAll(OVERLAY_PANELS)].some((p) => {
      const b = p.getBoundingClientRect();
      return b.width > 0 && x >= b.left - HANDLE && x <= b.right + HANDLE && up >= b.top - HANDLE && up <= b.bottom + HANDLE;
    });
    h.rot = { x, y: covered ? r.y + r.h + ROT_HANDLE_GAP : up, below: covered };
  }
  return h;
}

function hitHandle(sx, sy) {
  for (const [name, p] of Object.entries(handlePositions())) {
    if (Math.abs(sx - p.x) <= HANDLE + 2 && Math.abs(sy - p.y) <= HANDLE + 2) return name;
  }
  return null;
}

// Kilitli nesneler (ör. üzerine yazılan PDF sayfası) tıklamayla seçilmez; yalnızca çift tıklama
// (includeLocked) onları bulur.
function topHit(w, includeLocked = false) {
  const tol = 5 / board.view.zoom;
  for (let i = board.elements.length - 1; i >= 0; i--) {
    const el = board.elements[i];
    if ((includeLocked || !el.locked) && hitTest(el, w.x, w.y, tol)) return el;
  }
  return null;
}

// Noktanın altındaki en üstteki gizleme bandı (üstünde çizgiler olsa bile).
function coverAt(w) {
  for (let i = board.elements.length - 1; i >= 0; i--) {
    const el = board.elements[i];
    if (el.type === 'cover' && hitTest(el, w.x, w.y, 0)) return el;
  }
  return null;
}

function toggleCover(el, show = !revealedCovers.has(el.id)) {
  if (show) revealedCovers.add(el.id);
  else revealedCovers.delete(el.id);
  sceneCacheValid = false;
  requestRender();
  updateProps();
}

function setAllCovers(show) {
  const covers = board.elements.filter((el) => el.type === 'cover');
  if (!covers.length) return toast(t('Tahtada gizleme bandı yok'));
  for (const el of covers) toggleCover(el, show);
  toast(show ? t('Bütün bantlar açıldı') : t('Bütün bantlar kapatıldı'));
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
  refreshCursor();
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
  refreshCursor();
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
function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

// ---------- İşaretçi olayları ----------

canvas.addEventListener('pointerdown', (e) => {
  hideMenu();
  closeComments();
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

  // Kırpma sürerken tahtaya basmak yalnızca kırpma çerçevesini değiştirir.
  if (crop) {
    const part = cropHit(e.clientX, e.clientY);
    if (part) drag = { kind: 'crop', part, start: w, r0: { ...crop.r } };
    return;
  }
  // Lazer işaretçi cetvel ve açıölçeri de taşımaz; yalnızca iz bırakır.
  if (t === 'laser' && !penEraser) {
    laserStroke++;
    addLaserPoint(e.clientX, e.clientY);
    drag = { kind: 'laser' };
    requestRender();
    return;
  }

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
  // Açıölçer de cetvel gibi her araçta önceliklidir: kollar, döndürme düğmesi, gövde.
  const ph = protractor && !penEraser ? protractorHit(protractor, e.clientX, e.clientY) : null;
  if (ph === 'knob') {
    drag = { kind: 'protRotate', a0: protractor.angle, p0: Math.atan2(e.clientY - protractor.cy, e.clientX - protractor.cx) };
    return;
  }
  if (ph === 'arm1' || ph === 'arm2') {
    drag = { kind: 'protArm', which: ph === 'arm1' ? 'a1' : 'a2' };
    return;
  }
  if (ph === 'body') {
    drag = { kind: 'protMove', sx: e.clientX, sy: e.clientY, cx: protractor.cx, cy: protractor.cy };
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
      if (el.brush === 'galaxy' && st.galaxy && st.galaxy !== 'classic') el.galaxy = st.galaxy;
      if (el.brush === 'hatch' && st.hatch && st.hatch !== 'fwd') el.hatch = st.hatch;
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

    case 'cover': {
      // Var olan banda dokunmak onu açar/kapatır; boş yerde sürüklemek yeni bant çizer.
      const hit = coverAt(w);
      if (hit && !hit.locked) {
        toggleCover(hit);
        break;
      }
      checkpoint();
      const el = { id: newId(), type: 'cover', x: w.x, y: w.y, w: 0, h: 0, color: styles.cover.color };
      board.elements.push(el);
      drag = { kind: 'shape', el, start: w };
      autoHideProps();
      sceneCacheValid = false;
      break;
    }

    case 'compass':
      startCompass(e, w);
      break;

    case 'text': {
      const hit = topHit(w);
      if (hit?.type === 'text') {
        openEditor(hit, false);
        break;
      }
      if (hit?.type === 'table') {
        openEditor(hit, false, cellAt(hit, w));
        break;
      }
      checkpoint();
      const st = styles.text;
      const el = {
        id: newId(), type: 'text', x: w.x, y: w.y - st.fontSize * 0.6,
        text: '', color: st.color, fontSize: st.fontSize, w: 0, h: 0, ...fmtOf(st),
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
        text: '', color: styles.note.color, fontSize: styles.note.fontSize, ...fmtOf(styles.note),
      };
      board.elements.push(el);
      openEditor(el, true);
      break;
    }

    case 'sticker': {
      // Seçili emoji tıklanan yere ekranda ~64 piksel boyunda yapıştırılır.
      checkpoint();
      const size = 64 / board.view.zoom;
      board.elements.push({ id: newId(), type: 'sticker', x: w.x - size / 2, y: w.y - size / 2, w: size, h: size, emoji: styles.sticker.emoji });
      changed();
      break;
    }

    case 'select':
      startSelectDrag(e, w);
      break;

    case 'cut':
      drag = { kind: 'cutLasso', start: [w.x, w.y], points: [[w.x, w.y]] };
      break;

    default:
      // Hazır şekiller (üçgen, yıldız…) sürüklenen kutuya göre çokgen olarak çizilir.
      if (POLY_SHAPES.includes(t)) {
        checkpoint();
        const st = styles.shape;
        const el = { id: newId(), type: 'polygon', points: shapePoints(t, w.x, w.y, 0, 0), color: st.color, width: st.width, fill: st.fill };
        board.elements.push(el);
        drag = { kind: 'shape', el, start: w, poly: t };
        autoHideProps();
        sceneCacheValid = false;
      }
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
    if (handle === 'rot') {
      // Seçim, çerçevesinin merkezi etrafında döner. Tek kutu öğesinde gösterilen açı toplam açıdır.
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const base = sel.length === 1 && sel[0].rot ? sel[0].rot : 0;
      drag = {
        kind: 'rotate', cx, cy, originals, base, angle: 0, moved: false,
        start: Math.atan2(w.y - cy, w.x - cx), pointer: { x: e.clientX, y: e.clientY },
      };
      return;
    }
    const corners = {
      nw: { x: b.x, y: b.y }, ne: { x: b.x + b.w, y: b.y },
      sw: { x: b.x, y: b.y + b.h }, se: { x: b.x + b.w, y: b.y + b.h },
    };
    const opposite = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' };
    // Dönmüş kutu öğeleri yalnızca orantılı büyür; serbest boyutlandırma onları çarpıtırdı.
    const keepRatio = sel.some((el) => el.rot);
    const freeform = sel.length === 1 && ['rect', 'ellipse', 'polygon', 'note', 'table', 'link'].includes(sel[0].type) && !keepRatio;
    drag = { kind: 'resize', anchor: corners[opposite[handle]], corner: corners[handle], originals, freeform, keepRatio, moved: false };
    return;
  }

  const hit = topHit(w);
  if (hit) {
    // Ctrl+tık gruptaki tek nesneyi seçer; aksi hâlde grup bütün olarak seçilir.
    const single = e.ctrlKey || e.metaKey;
    const mates = single ? [hit] : groupMates(hit);
    if (e.shiftKey) {
      const add = !selection.has(hit.id);
      for (const m of mates) {
        if (add) selection.add(m.id);
        else selection.delete(m.id);
      }
    } else if (single || !selection.has(hit.id)) {
      selection = new Set(mates.map((m) => m.id));
    }
    if (selection.has(hit.id)) drag = { kind: 'move', start: w, moved: false };
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
    if (activeTool() === 'eraser' || activeTool() === 'laser' || (activeTool() === 'compass' && !compass)) requestRender();
    return;
  }

  const w = toWorld(e.clientX, e.clientY);
  switch (drag.kind) {
    case 'pan':
      board.view.x = drag.vx + (e.clientX - drag.sx);
      board.view.y = drag.vy + (e.clientY - drag.sy);
      break;

    case 'laser': {
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ce of events.length ? events : [e]) addLaserPoint(ce.clientX, ce.clientY);
      break;
    }

    case 'crop':
      updateCrop(w);
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

    case 'protMove':
      protractor.cx = drag.cx + (e.clientX - drag.sx);
      protractor.cy = drag.cy + (e.clientY - drag.sy);
      break;

    case 'protRotate': {
      const a = drag.a0 + Math.atan2(e.clientY - protractor.cy, e.clientX - protractor.cx) - drag.p0;
      const step = Math.PI / 12;
      protractor.angle = e.shiftKey ? Math.round(a / step) * step : snapAngle(a);
      break;
    }

    case 'protArm':
      setArm(protractor, drag.which, e.clientX, e.clientY, e.shiftKey);
      break;

    case 'compassSet':
    case 'compassRadius': {
      const p = e.shiftKey ? snapRadius(w) : w;
      compass.r = Math.hypot(p.x - compass.cx, p.y - compass.cy);
      compass.a = Math.atan2(w.y - compass.cy, w.x - compass.cx);
      break;
    }

    case 'compassMove': {
      const c = e.shiftKey ? snapGrid(w) : w;
      compass.cx = c.x;
      compass.cy = c.y;
      break;
    }

    case 'compassArc':
      updateCompassArc(w);
      break;

    case 'erase':
      eraseAlong(drag.last, w);
      drag.last = w;
      break;

    case 'move': {
      if (!drag.moved) {
        checkpoint();
        drag.moved = true;
        startMoveSnap();
      }
      // Diğer nesnelerin kenar ve ortalarına yapışır (Ctrl basılıyken yapışmaz). Öğeler her adımda
      // ilk hâllerinden yeniden kaydırılır; nokta dizileri yine yerinde değiştirilmez.
      let dx = w.x - drag.start.x;
      let dy = w.y - drag.start.y;
      drag.guides = null;
      if (!e.ctrlKey && !e.metaKey) {
        const snap = snapMove(dx, dy);
        dx += snap.dx;
        dy += snap.dy;
        drag.guides = snap.guides;
      }
      for (const [el, o] of drag.orig) {
        const c = { ...o };
        translate(c, dx, dy);
        Object.assign(el, c);
      }
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
      if (drag.keepRatio || drag.freeform === e.shiftKey) {
        const s = Math.max(Math.abs(sx), Math.abs(sy));
        sx = s * (Math.sign(sx) || 1);
        sy = s * (Math.sign(sy) || 1);
      }
      if (Math.abs(sx) < 0.02) sx = 0.02 * (Math.sign(sx) || 1);
      if (Math.abs(sy) < 0.02) sy = 0.02 * (Math.sign(sy) || 1);
      for (const el of selectedEls()) scaleFrom(el, drag.originals.get(el.id), a.x, a.y, sx, sy);
      break;
    }

    case 'rotate': {
      let a = Math.atan2(w.y - drag.cy, w.x - drag.cx) - drag.start;
      // Shift: toplam açı 15°'lik adımlara oturur; Shift'siz de 0/90/180/270'e yaklaşınca yapışır.
      const total = drag.base + a;
      if (e.shiftKey) {
        const step = Math.PI / 12;
        a = Math.round(total / step) * step - drag.base;
      } else {
        const right = Math.round(total / (Math.PI / 2)) * (Math.PI / 2);
        if (Math.abs(total - right) < (3 * Math.PI) / 180) a = right - drag.base;
      }
      drag.pointer = { x: e.clientX, y: e.clientY };
      if (!drag.moved) {
        if (Math.abs(a) < 1e-9) break;
        checkpoint();
        drag.moved = true;
      }
      drag.angle = a;
      for (const el of selectedEls()) rotateAround(el, drag.originals.get(el.id), drag.cx, drag.cy, a);
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
        for (const el of board.elements) if (!el.locked && insideLasso(el, drag.points)) selection.add(el.id);
        selection = expandGroups(selection);
      }
      break;
    }

    case 'cutLasso': {
      // Makas dikdörtgen çizer: başlangıç köşesinden imlece kadar.
      const [x0, y0] = drag.start;
      drag.points = [[x0, y0], [w.x, y0], [w.x, w.y], [x0, w.y]];
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
      // Kapalı gizleme bandına kalemle dokunmak (çizmeden) bandı açar; nokta tahtaya eklenmez.
      if (d.el.points.length === 1 && !d.usedStraight) {
        const [x, y] = d.el.points[0];
        const cover = coverAt({ x, y });
        if (cover && !revealedCovers.has(cover.id)) {
          board.elements.splice(board.elements.indexOf(d.el), 1);
          undoStack.pop();
          updateUndoButtons();
          toggleCover(cover, true);
          break;
        }
      }
      // Oklu fırçalar şekle çevrilmez: ok ucu yönü anlamını yitirirdi. Taralı alan da elle
      // çizildiği gibi kalır; şeklin içini izlemesi gerekir.
      if (!d.el.highlighter && d.el.brush !== 'arrow' && d.el.brush !== 'dashedarrow' && d.el.brush !== 'hatch' && !d.usedStraight && styles.pen.toShape) convertToShape(d.el);
      changed();
      break;
    case 'compassSet':
      if (compass.r * board.view.zoom < 4) {
        compass = null;
        toast(t('Pergel: merkezden dışarı doğru sürükleyerek yarıçapı belirle'));
      }
      break;
    case 'compassArc':
      endCompassArc(d);
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
    case 'rotate':
      if (d.moved) changed();
      break;
    case 'lasso':
      updateProps();
      break;
    case 'cutLasso': {
      // Tıklama ya da çok ince dikdörtgen kesme yapmaz.
      const [x1, y1] = d.points[2] ?? d.start;
      const tiny = 4 / board.view.zoom;
      if (Math.abs(x1 - d.start[0]) >= tiny && Math.abs(y1 - d.start[1]) >= tiny) cutWithLasso(d.points);
      break;
    }
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

// Makas: kementin içinden geçen çizgileri kement sınırından keser ve içeride kalan parçaları
// (tamamen içerdeki nesnelerle birlikte) seçer; ardından Ctrl+X / Ctrl+C / sürükleme ile kullanılır.
// Kesme ayrı bir geri alma adımıdır; Ctrl+Z çizgileri yeniden birleştirir.
function cutWithLasso(lasso) {
  if (lasso.length < 3) return;
  const picked = [];
  const replacements = new Map();
  for (const el of board.elements) {
    if (el.locked) continue;
    const parts = el.type === 'image' ? splitImageByRect(el, lasso) : splitByLasso(el, lasso);
    if (parts && parts.inside.length) {
      replacements.set(el, carryComments(el, [...parts.outside, ...parts.inside]));
      picked.push(...parts.inside);
    } else if (!parts && insideLasso(el, lasso)) picked.push(el);
  }
  if (!picked.length) {
    toast(t('Dikdörtgenin içinde kesilecek bir şey yok'));
    return;
  }
  if (replacements.size) {
    checkpoint();
    board.elements = board.elements.flatMap((el) => replacements.get(el) ?? [el]);
  }
  setTool('select');
  selection = new Set(picked.map((el) => el.id));
  if (replacements.size) changed();
  updateProps();
  toast(t('Parça seçildi — Ctrl+X kes, Ctrl+C kopyala ya da sürükleyip taşı'));
}

// Makas resmi (PDF sayfası, Obsidian bölümü de resimdir) dikdörtgenden böler: kesişen bölüm
// içeride, kalan üst/alt/sol/sağ şeritler dışarıda ayrı resimler olur. Dikdörtgen resmi
// kesmiyorsa, resim döndürülmüşse ya da henüz yüklenmediyse null döner (bütün olarak değerlendirilir).
function splitImageByRect(el, lasso) {
  if (el.rot) return null;
  const img = getImage(el.src);
  if (!img.complete || !img.naturalWidth) return null;
  const xs = lasso.map((p) => p[0]), ys = lasso.map((p) => p[1]);
  const r = { x: Math.min(...xs), y: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  const b = { x: Math.min(el.x, el.x + el.w), y: Math.min(el.y, el.y + el.h), w: Math.abs(el.w), h: Math.abs(el.h) };
  const x1 = Math.max(b.x, r.x), y1 = Math.max(b.y, r.y);
  const x2 = Math.min(b.x + b.w, r.x2), y2 = Math.min(b.y + b.h, r.y2);
  const eps = 0.5;
  if (x2 - x1 < eps || y2 - y1 < eps) return null;
  if (x1 - b.x < eps && y1 - b.y < eps && b.x + b.w - x2 < eps && b.y + b.h - y2 < eps) return null;
  const kx = img.naturalWidth / b.w;
  const ky = img.naturalHeight / b.h;
  const jpeg = el.src.startsWith('data:image/jpeg');
  // Parçalar kaynağı hatırlamaz: Obsidian yenilemesi her parçaya bütün bölümü geri koyardı.
  const { obsidian, comments, commentsResolved, ...base } = el;
  const piece = (x, y, w, h) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * kx));
    c.height = Math.max(1, Math.round(h * ky));
    c.getContext('2d').drawImage(img, (x - b.x) * kx, (y - b.y) * ky, w * kx, h * ky, 0, 0, c.width, c.height);
    return { ...base, id: newId(), src: c.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.92), x, y, w, h };
  };
  const outside = [];
  if (y1 - b.y >= eps) outside.push(piece(b.x, b.y, b.w, y1 - b.y));
  if (b.y + b.h - y2 >= eps) outside.push(piece(b.x, y2, b.w, b.y + b.h - y2));
  if (x1 - b.x >= eps) outside.push(piece(b.x, y1, x1 - b.x, y2 - y1));
  if (b.x + b.w - x2 >= eps) outside.push(piece(x2, y1, b.x + b.w - x2, y2 - y1));
  return { inside: [piece(x1, y1, x2 - x1, y2 - y1)], outside };
}

// Elle çizilen şekli düzgün şekle çevirir. Ayrı bir geri alma adımı olduğu için
// Ctrl+Z orijinal el çizimini geri getirir.
function convertToShape(el) {
  const shape = recognizeShape(el.points, board.view.zoom);
  if (!shape) return;
  checkpoint();
  const idx = board.elements.indexOf(el);
  if (el.brush) {
    // Özel fırçalı çizgi vektör şekle çevrilmez (efekt kaybolurdu); aynı fırçayla şeklin
    // kenarı yeniden çizilir. Eski points dizisi değiştirilmez (geri alma buna dayanır).
    let len = 0;
    for (let i = 1; i < el.points.length; i++) {
      len += Math.hypot(el.points[i][0] - el.points[i - 1][0], el.points[i][1] - el.points[i - 1][1]);
    }
    const step = Math.min(6, Math.max(1, len / Math.max(1, el.points.length - 1)));
    const avgP = el.points.reduce((s, p) => s + (p[2] ?? 0.5), 0) / el.points.length;
    const points = shapeToPoints(shape, step).map(([x, y]) => [x, y, avgP]);
    board.elements[idx] = { ...el, id: newId(), points };
  } else {
    board.elements[idx] = { id: newId(), color: el.color, width: el.width, ...shape };
  }
  toast(t('Şekle dönüştürüldü — el çizimine dönmek için Ctrl+Z'));
}

function cancelDrag() {
  if (!drag) return;
  if (drag.temp) {
    const t = tempStrokes.find((t) => t.el === drag.el);
    if (t) t.fadeStart = performance.now();
  } else if (drag.kind === 'draw' || drag.kind === 'shape' || drag.kind === 'compassArc') {
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
  const w = toWorld(e.clientX, e.clientY);
  const hit = topHit(w);
  if (hit?.type === 'cover') toggleCover(hit);
  else if (hit && (hit.type === 'text' || hit.type === 'note')) openEditor(hit, false);
  else if (hit?.type === 'table') openEditor(hit, false, cellAt(hit, w));
  else if (hit?.type === 'link') openLinkEl(hit);
  else if (hit?.obsidian) openInObsidian(hit);
  else if (hit?.type === 'image') {
    selection = new Set([hit.id]);
    startCrop();
  }
  else if (!hit) {
    // Kilitli nesne yalnızca çift tıklamayla seçilir (kilidini açmak ya da silmek için).
    const locked = topHit(w, true);
    if (locked?.locked) {
      selection = new Set([locked.id]);
      updateProps();
      requestRender();
      toast(t('Kilitli nesne seçildi — panelden ya da Ctrl+L ile kilidini açabilirsin'));
    }
  }
});

// Cetvel kenarının hemen yanında başlayan çizgi o kenar boyunca dümdüz çizilir;
// açıölçerin yayının hemen dışında başlayan çizgi de yay boyunca çember parçası olur.
function attachRuler(e) {
  const side = ruler ? nearEdge(ruler, e.clientX, e.clientY) : 0;
  if (side) {
    drag.rulerSide = side;
    drag.rulerStart = { x: e.clientX, y: e.clientY };
  } else if (protractor && nearArc(protractor, e.clientX, e.clientY)) {
    const a = Math.atan2(e.clientY - protractor.cy, e.clientX - protractor.cx);
    drag.protArc = { a0: a, last: a, acc: 0 };
  } else return;
  drag.usedStraight = true;
  drag.el.pressure = false;
}

// Açısal farkı (-π, π] aralığına getirir; yay çizerken açı ±π'den geçince sıçramasın.
function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// Merkezi (cx, cy) olan r yarıçaplı yayın a0'dan a0+acc'ye kadar noktaları (2°'lik adımlarla).
function arcPoints(cx, cy, r, a0, acc, map = (x, y) => [x, y]) {
  const n = Math.max(1, Math.ceil(Math.abs(acc) / (Math.PI / 90)));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + (acc * i) / n;
    const [x, y] = map(cx + r * Math.cos(t), cy + r * Math.sin(t));
    pts.push([x, y, 0.5]);
  }
  return pts;
}

// Kalem: Shift veya Ctrl basılıyken son noktadan itibaren dümdüz çizgi çizilir.
function updateDraw(e, events) {
  const el = drag.el;
  if (drag.protArc) {
    const pa = drag.protArc;
    const a = Math.atan2(e.clientY - protractor.cy, e.clientX - protractor.cx);
    pa.acc = Math.max(-Math.PI * 2, Math.min(Math.PI * 2, pa.acc + angleDelta(a, pa.last)));
    pa.last = a;
    const r = PROT_R + (el.width * board.view.zoom) / 2 + 1;
    el.points = arcPoints(protractor.cx, protractor.cy, r, pa.a0, pa.acc, (x, y) => {
      const p = toWorld(x, y);
      return [p.x, p.y];
    });
    return;
  }
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
    return;
  }
  let dx = w.x - s.x;
  let dy = w.y - s.y;
  if (shift) {
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    dx = m * (Math.sign(dx) || 1);
    dy = m * (Math.sign(dy) || 1);
  }
  if (drag.poly) {
    el.points = shapePoints(drag.poly, s.x, s.y, dx, dy);
    return;
  }
  el.x = s.x;
  el.y = s.y;
  el.w = dx;
  el.h = dy;
}

// ---------- Yorumlar ----------
// Notion'daki gibi her nesneye bir yorum dizisi eklenebilir: el.comments = [{ id, text, time, edited? }].
// el.commentsResolved dizinin çözüldüğünü gösterir (rozeti gizlenir; yeni yorum diziyi yeniden açar).
// Geri al yüzeysel kopyaya dayandığı için dizi ve yorum nesneleri yerinde değiştirilmez, her
// değişiklik yeni bir dizi atar. Rozetler ve pencere DOM'dadır; dışa aktarılan resimlere girmez.

const pinLayer = $('#commentPins');
const commentPop = $('#commentPop');
const commentInput = $('#commentInput');
const pinNodes = new Map(); // öğe kimliği -> rozet düğmesi
const commentDrafts = new Map(); // öğe kimliği -> gönderilmemiş yorum
let commentFor = null; // yorum penceresi açıkken nesnenin kimliği
let commentEditId = null; // düzenlenen yorumun kimliği

const ICON_COMMENT = '<svg viewBox="0 0 24 24"><path d="M5 5h14a1 1 0 011 1v9a1 1 0 01-1 1h-8l-4 3v-3H5a1 1 0 01-1-1V6a1 1 0 011-1z"/></svg>';

const commentsOf = (el) => el.comments || [];
const commentEl = () => board.elements.find((el) => el.id === commentFor);

function withoutComments(el) {
  const { comments, commentsResolved, ...rest } = el;
  return rest;
}

// Parçalanan (silgi, makas) öğenin yorumları ilk parçasında kalır.
function carryComments(el, parts) {
  if (!el.comments || !parts.length) return parts;
  const first = { ...parts[0], comments: el.comments };
  if (el.commentsResolved) first.commentsResolved = true;
  return [first, ...parts.slice(1)];
}

function setShowComments(v) {
  showComments = v;
  savePrefs();
  updateCommentsToggleUI();
  requestRender();
}

function updateCommentsToggleUI() {
  $('#commentsToggle').setAttribute('aria-checked', String(showComments));
}

// Açık yorumu olan her nesnenin sağ üst köşesine sayılı bir rozet koyar (her çizimde).
function updateCommentPins() {
  const live = new Set();
  if (showComments) {
    for (const el of board.elements) {
      const list = commentsOf(el);
      if (!list.length || el.commentsResolved || editing?.el.id === el.id) continue;
      live.add(el.id);
      let pin = pinNodes.get(el.id);
      if (!pin) {
        pin = document.createElement('button');
        pin.className = 'comment-pin';
        pin.dataset.id = el.id;
        pinLayer.append(pin);
        pinNodes.set(el.id, pin);
      }
      if (pin.dataset.n !== String(list.length)) {
        pin.dataset.n = list.length;
        pin.innerHTML = `${ICON_COMMENT}<span>${list.length}</span>`;
      }
      const last = list[list.length - 1].text;
      pin.title = last.length > 120 ? last.slice(0, 120) + '…' : last;
      const r = screenRect(bbox(el));
      pin.style.transform = `translate(${Math.round(r.x + r.w + 2)}px, ${Math.round(r.y - 24)}px)`;
      pin.classList.toggle('open', commentFor === el.id);
    }
  }
  for (const [id, pin] of pinNodes) {
    if (live.has(id)) continue;
    pin.remove();
    pinNodes.delete(id);
  }
}

pinLayer.addEventListener('click', (e) => {
  const pin = e.target.closest('.comment-pin');
  if (!pin) return;
  if (commentFor === pin.dataset.id) closeComments();
  else openComments(pin.dataset.id);
});

function commentOnSelection() {
  const sel = selectedEls();
  if (sel.length !== 1) return toast(t('Yorum eklemek için tek bir nesne seç'));
  if (commentFor === sel[0].id) closeComments();
  else openComments(sel[0].id);
}

function openComments(id) {
  if (!board.elements.some((el) => el.id === id)) return;
  commitEditor();
  closeComments();
  commentFor = id;
  commentEditId = null;
  commentPop.classList.remove('hidden');
  renderCommentPop();
  commentInput.value = commentDrafts.get(id) || '';
  fitTextarea(commentInput);
  const list = $('#commentList');
  list.scrollTop = list.scrollHeight;
  commentInput.focus();
  updateProps();
  requestRender();
}

function closeComments() {
  if (!commentFor) return;
  const draft = commentInput.value;
  if (draft.trim()) commentDrafts.set(commentFor, draft);
  else commentDrafts.delete(commentFor);
  commentFor = null;
  commentEditId = null;
  commentPop.classList.add('hidden');
  updateProps();
  requestRender();
}

// Başka bir tahtaya geçilince pencere ve taslaklar atılır.
function resetComments() {
  commentFor = null;
  commentEditId = null;
  commentDrafts.clear();
  commentPop.classList.add('hidden');
}

function renderCommentPop() {
  const el = commentEl();
  if (!el) return closeComments();
  const list = commentsOf(el);
  $('#commentList').innerHTML = list.map((c) => (c.id === commentEditId
    ? `<div class="comment editing" data-id="${c.id}"><textarea class="comment-edit">${escHtml(c.text)}</textarea><div class="comment-hint">${t('Enter: kaydet — Esc: vazgeç')}</div></div>`
    : `<div class="comment" data-id="${c.id}"><div class="comment-meta"><span title="${new Date(c.time).toLocaleString(locale)}">${relativeTime(c.time)}${c.edited ? t(' · düzenlendi') : ''}</span><span class="comment-actions"><button class="tool" data-comment="edit" title="${t('Düzenle')}">${ICON_RENAME}</button><button class="tool" data-comment="delete" title="${t('Sil')}">${ICON_DELETE}</button></span></div><div class="comment-text">${escHtml(c.text)}</div></div>`),
  ).join('');
  const resolved = !!el.commentsResolved;
  $('#commentState').classList.toggle('hidden', !resolved);
  const rb = $('[data-comment="resolve"]');
  rb.classList.toggle('hidden', !list.length);
  rb.classList.toggle('active', resolved);
  rb.title = resolved ? t('Yeniden aç') : t('Çözüldü olarak işaretle');
  commentInput.placeholder = list.length ? t('Yanıtla…') : t('Yorum ekle…');
  const edit = $('#commentList .comment-edit');
  if (edit) {
    fitTextarea(edit);
    edit.focus();
    edit.setSelectionRange(edit.value.length, edit.value.length);
  }
  positionCommentPop();
}

// Pencere nesnenin sağında (yer yoksa solunda) durur, ekrandan taşmaz.
function positionCommentPop() {
  if (!commentFor) return;
  const el = commentEl();
  if (!el) return;
  const r = screenRect(bbox(el));
  const w = commentPop.offsetWidth, h = commentPop.offsetHeight, m = 12, top = 64;
  let x = r.x + r.w + 34;
  if (x + w > innerWidth - m) x = r.x - w - m;
  x = Math.max(m, Math.min(innerWidth - w - m, x));
  const y = Math.max(top, Math.min(innerHeight - h - m, r.y - 24));
  commentPop.style.left = x + 'px';
  commentPop.style.top = y + 'px';
}

function fitTextarea(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 2 + 'px';
}

// Yorum dizisini tek geri alma adımıyla değiştirir.
function setComments(el, comments, resolved) {
  checkpoint();
  if (comments.length) el.comments = comments;
  else delete el.comments;
  if (resolved && comments.length) el.commentsResolved = true;
  else delete el.commentsResolved;
  changed();
}

function sendComment() {
  const el = commentEl();
  const text = commentInput.value.trim();
  if (!el || !text) return;
  // Çözülmüş diziye yazmak onu yeniden açar.
  setComments(el, [...commentsOf(el), { id: newId(), text, time: Date.now() }], false);
  commentInput.value = '';
  commentDrafts.delete(el.id);
  fitTextarea(commentInput);
  const list = $('#commentList');
  list.scrollTop = list.scrollHeight;
}

function saveCommentEdit() {
  const el = commentEl();
  const ta = $('#commentList .comment-edit');
  const id = commentEditId;
  commentEditId = null;
  if (!el || !ta) return renderCommentPop();
  const text = ta.value.trim();
  const old = commentsOf(el).find((c) => c.id === id);
  if (!old || !text || text === old.text) return renderCommentPop();
  setComments(el, commentsOf(el).map((c) => (c.id === id ? { ...c, text, edited: Date.now() } : c)), el.commentsResolved);
}

commentPop.addEventListener('click', (e) => {
  const b = e.target.closest('[data-comment]');
  if (!b) return;
  const el = commentEl();
  const action = b.dataset.comment;
  if (action === 'close') return closeComments();
  if (!el) return;
  if (action === 'send') return sendComment();
  if (action === 'resolve') {
    const resolve = !el.commentsResolved;
    setComments(el, commentsOf(el), resolve);
    if (resolve) {
      closeComments();
      toast(t('Yorum çözüldü — nesneyi seçip panelden yeniden açabilirsin'));
    }
    return;
  }
  const id = b.closest('.comment')?.dataset.id;
  if (action === 'edit') {
    commentEditId = id;
    renderCommentPop();
  } else if (action === 'delete') {
    setComments(el, commentsOf(el).filter((c) => c.id !== id), el.commentsResolved);
    toast(t('Yorum silindi — Ctrl+Z ile geri alabilirsin'));
  }
});

commentInput.addEventListener('input', () => fitTextarea(commentInput));
commentInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    sendComment();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeComments();
  }
});

const commentList = $('#commentList');
commentList.addEventListener('input', (e) => {
  if (e.target.classList.contains('comment-edit')) fitTextarea(e.target);
});
commentList.addEventListener('keydown', (e) => {
  if (!e.target.classList.contains('comment-edit')) return;
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    saveCommentEdit();
    commentInput.focus();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    commentEditId = null;
    renderCommentPop();
    commentInput.focus();
  }
});

// ---------- Tahtada arama (Ctrl+F) ----------
// Metin, not, Obsidian bölümü başlığı ve fonksiyon ifadelerinde arar; eşleşmeler okunma sırasıyla
// (yukarıdan aşağı) gezilir, bulunan nesne ekranın ortasına getirilir.

const searchBar = $('#searchBar');
const searchInput = $('#searchInput');

// Nesnenin yorumlarında da arar.
function searchText(el) {
  return [ownText(el), ...commentsOf(el).map((c) => c.text)].join('\n');
}

function ownText(el) {
  if (el.type === 'text' || el.type === 'note') return el.text;
  if (el.type === 'table') return el.cells.map((row) => row.join('\t')).join('\n');
  if (el.type === 'link') return [el.title, el.desc, el.url].filter(Boolean).join('\n');
  if (el.obsidian) return el.obsidian.title || '';
  if (el.type === 'axes') return (el.fns || []).map((f) => f.expr).join(' ');
  return '';
}

function openSearch() {
  commitEditor();
  searchBar.classList.remove('hidden');
  searchInput.focus();
  searchInput.select();
  if (searchInput.value.trim()) runSearch(false);
}

function closeSearch() {
  searchBar.classList.add('hidden');
  searchInput.blur();
  search = null;
  requestRender();
}

// jump: ilk eşleşmeye git. Tahta değişince (jump=false) liste yenilenir, sıradaki konum korunur.
function runSearch(jump = true) {
  const q = searchInput.value.trim().toLocaleLowerCase('tr');
  if (!q) {
    search = null;
    updateSearchCount();
    return requestRender();
  }
  const hits = board.elements
    .filter((el) => searchText(el).toLocaleLowerCase('tr').includes(q))
    .map((el) => ({ id: el.id, b: bbox(el) }))
    .sort((a, b) => a.b.y - b.b.y || a.b.x - b.b.x)
    .map((h) => h.id);
  const keep = !jump && search?.q === q ? Math.min(search.i, Math.max(0, hits.length - 1)) : 0;
  search = { q, hits, i: keep };
  updateSearchCount();
  if (jump && hits.length) focusSearchHit();
  requestRender();
}

function stepSearch(d) {
  if (!search?.hits.length) return;
  const n = search.hits.length;
  search.i = (search.i + d + n) % n;
  focusSearchHit();
}

function updateSearchCount() {
  const el = $('#searchCount');
  const n = search?.hits.length || 0;
  el.textContent = !search ? '' : n ? `${search.i + 1} / ${n}` : t('Bulunamadı');
  el.classList.toggle('none', !!search && !n);
}

// Bulunan nesneyi ekranın ortasına getirir; ekrana sığmıyorsa uzaklaştırır.
function focusSearchHit() {
  const el = board.elements.find((x) => x.id === search.hits[search.i]);
  if (!el) return;
  const b = bbox(el);
  const v = board.view;
  const pad = 100;
  if (b.w * v.zoom > innerWidth - pad * 2 || b.h * v.zoom > innerHeight - pad * 2) {
    v.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, (innerWidth - pad * 2) / b.w, (innerHeight - pad * 2) / b.h));
  }
  v.x = innerWidth / 2 - (b.x + b.w / 2) * v.zoom;
  v.y = innerHeight / 2 - (b.y + b.h / 2) * v.zoom;
  sceneCacheValid = false;
  scheduleViewSave();
  updateSearchCount();
  requestRender();
}

function drawSearchHits() {
  if (!search?.hits.length) return;
  const current = search.hits[search.i];
  for (const el of board.elements) {
    if (!search.hits.includes(el.id)) continue;
    const r = screenRect(bbox(el));
    const on = el.id === current;
    ctx.fillStyle = on ? 'rgba(255, 170, 0, 0.18)' : 'rgba(255, 212, 0, 0.14)';
    ctx.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
    ctx.strokeStyle = on ? '#f08c00' : 'rgba(240, 160, 0, 0.6)';
    ctx.lineWidth = on ? 2.5 : 1.2;
    ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
  }
}

searchInput.addEventListener('input', () => runSearch(true));
searchInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') {
    e.preventDefault();
    stepSearch(e.shiftKey ? -1 : 1);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeSearch();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    searchInput.select();
  }
});
searchBar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-search]');
  if (!b) return;
  if (b.dataset.search === 'close') closeSearch();
  else stepSearch(b.dataset.search === 'next' ? 1 : -1);
});

// ---------- Resim kırpma ----------
// Tek bir resim seçiliyken panelden "Kırp" (ya da resme çift tıklama). Kırpma çerçevesi kenar ve
// köşelerinden sürüklenir, içinden tutup taşınır; Enter uygular, Esc vazgeçer. Uygulanınca resim
// yeni, kırpılmış bir resimle değiştirilir (Ctrl+Z eski hâline döndürür).

const CROP_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function startCrop() {
  const el = selectedEls()[0];
  if (!el || el.type !== 'image' || el.locked) return;
  if (el.rot) return toast(t('Döndürülmüş resim kırpılamaz — önce düz hâle getir'));
  const img = getImage(el.src);
  if (!img.complete || !img.naturalWidth) return toast(t('Resim henüz yüklenmedi'));
  crop = { id: el.id, r: { x: el.x, y: el.y, w: el.w, h: el.h } };
  updateProps();
  requestRender();
  toast(t('Kırp: kenarları sürükle — Enter uygula, Esc vazgeç'));
}

function cancelCrop() {
  if (!crop) return;
  crop = null;
  updateProps();
  requestRender();
}

function cropEl() {
  return crop && board.elements.find((el) => el.id === crop.id);
}

function cropHandlePos() {
  const r = screenRect(crop.r);
  const xs = { w: r.x, c: r.x + r.w / 2, e: r.x + r.w };
  const ys = { n: r.y, c: r.y + r.h / 2, s: r.y + r.h };
  return Object.fromEntries(CROP_HANDLES.map((h) => [h, {
    x: xs[h.includes('w') ? 'w' : h.includes('e') ? 'e' : 'c'],
    y: ys[h.includes('n') ? 'n' : h.includes('s') ? 's' : 'c'],
  }]));
}

function cropHit(sx, sy) {
  for (const [name, p] of Object.entries(cropHandlePos())) {
    if (Math.abs(sx - p.x) <= 10 && Math.abs(sy - p.y) <= 10) return name;
  }
  const r = screenRect(crop.r);
  if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return 'move';
  return null;
}

function updateCrop(w) {
  const el = cropEl();
  if (!el) return cancelCrop();
  const b = { x: el.x, y: el.y, w: el.w, h: el.h };
  const r0 = drag.r0;
  const dx = w.x - drag.start.x;
  const dy = w.y - drag.start.y;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  if (drag.part === 'move') {
    crop.r = { ...r0, x: clamp(r0.x + dx, b.x, b.x + b.w - r0.w), y: clamp(r0.y + dy, b.y, b.y + b.h - r0.h) };
    return;
  }
  const min = 12 / board.view.zoom;
  let x1 = r0.x, y1 = r0.y, x2 = r0.x + r0.w, y2 = r0.y + r0.h;
  const p = drag.part;
  if (p.includes('w')) x1 = clamp(x1 + dx, b.x, x2 - min);
  if (p.includes('e')) x2 = clamp(x2 + dx, x1 + min, b.x + b.w);
  if (p.includes('n')) y1 = clamp(y1 + dy, b.y, y2 - min);
  if (p.includes('s')) y2 = clamp(y2 + dy, y1 + min, b.y + b.h);
  crop.r = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function applyCrop() {
  const el = cropEl();
  if (!el) return cancelCrop();
  const r = crop.r;
  const same = Math.abs(r.x - el.x) < 0.01 && Math.abs(r.y - el.y) < 0.01 &&
    Math.abs(r.w - el.w) < 0.01 && Math.abs(r.h - el.h) < 0.01;
  crop = null;
  if (same) {
    updateProps();
    return requestRender();
  }
  const img = getImage(el.src);
  const kx = img.naturalWidth / el.w;
  const ky = img.naturalHeight / el.h;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.w * kx));
  c.height = Math.max(1, Math.round(r.h * ky));
  c.getContext('2d').drawImage(img, (r.x - el.x) * kx, (r.y - el.y) * ky, r.w * kx, r.h * ky, 0, 0, c.width, c.height);
  const jpeg = el.src.startsWith('data:image/jpeg');
  checkpoint();
  el.src = c.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.92);
  Object.assign(el, r);
  changed();
  toast(t('Resim kırpıldı — eski hâli için Ctrl+Z'));
}

function drawCropOverlay() {
  const el = cropEl();
  if (!el) return;
  const b = screenRect({ x: el.x, y: el.y, w: el.w, h: el.h });
  const r = screenRect(crop.r);
  ctx.save();
  ctx.fillStyle = 'rgba(20, 25, 40, 0.55)';
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.setLineDash([]);
  // Üçte bir kılavuz çizgileri.
  ctx.beginPath();
  for (const f of [1 / 3, 2 / 3]) {
    ctx.moveTo(r.x + r.w * f, r.y);
    ctx.lineTo(r.x + r.w * f, r.y + r.h);
    ctx.moveTo(r.x, r.y + r.h * f);
    ctx.lineTo(r.x + r.w, r.y + r.h * f);
  }
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  for (const p of Object.values(cropHandlePos())) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = SELECT_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(p.x - 5, p.y - 5, 10, 10);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function cropCursor(part) {
  if (part === 'move') return 'move';
  if (part === 'n' || part === 's') return 'ns-resize';
  if (part === 'e' || part === 'w') return 'ew-resize';
  return part === 'nw' || part === 'se' ? 'nwse-resize' : 'nesw-resize';
}

// ---------- Lazer işaretçi ----------
// Sunum yaparken imleç parlayan bir nokta olur (rengi panelden seçilir); basılı tutup çizince arkasında kısa
// süre görünüp sönen bir iz bırakır. Tahtaya kaydedilmez, geri alma listesine girmez.

const LASER_FADE_MS = 700;
let laserTrail = []; // { x, y, t, s } ekran koordinatı; s: hangi çizgiye ait olduğu
let laserStroke = 0;

function addLaserPoint(x, y) {
  laserTrail.push({ x, y, t: performance.now(), s: laserStroke });
}

// '#rrggbb' -> 'r, g, b' (rgba() içinde saydamlıkla kullanmak için).
function rgbOf(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0xff2d2d;
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function drawLaser() {
  const now = performance.now();
  laserTrail = laserTrail.filter((p) => now - p.t < LASER_FADE_MS);
  const rgb = rgbOf(styles.laser.color);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = `rgba(${rgb}, 0.8)`;
  ctx.shadowBlur = 10;
  for (let i = 1; i < laserTrail.length; i++) {
    const a = laserTrail[i - 1];
    const b = laserTrail[i];
    if (a.s !== b.s) continue;
    const k = 1 - (now - b.t) / LASER_FADE_MS;
    ctx.strokeStyle = `rgba(${rgb}, ${0.9 * k})`;
    ctx.lineWidth = 2 + 4 * k;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  if (pointer && activeTool() === 'laser') {
    const g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 11);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.3, `rgba(${rgb}, 1)`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.shadowBlur = 0;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (laserTrail.length) requestRender();
}

// ---------- Pergel ----------
// İlk sürükleme merkezi ve yarıçapı belirler. Sonra merkezdeki tutamaçla pergel taşınır, kalem
// ucundaki tutamaçla yarıçap değişir; başka her yerde sürüklemek, kalem ucunu merkez etrafında
// döndürerek yay çizer (tam tur çember olur). Dokunmak tam çember çizer. Esc pergeli sıfırlar.

const snapGrid = (p) => ({ x: Math.round(p.x / GRID_UNIT) * GRID_UNIT, y: Math.round(p.y / GRID_UNIT) * GRID_UNIT });

// Shift basılıyken yarıçap yarım karenin katlarına yuvarlanır.
function snapRadius(w) {
  const half = GRID_UNIT / 2;
  const a = Math.atan2(w.y - compass.cy, w.x - compass.cx);
  const r = Math.max(half, Math.round(Math.hypot(w.x - compass.cx, w.y - compass.cy) / half) * half);
  return { x: compass.cx + r * Math.cos(a), y: compass.cy + r * Math.sin(a) };
}

function compassTip() {
  return { x: compass.cx + compass.r * Math.cos(compass.a), y: compass.cy + compass.r * Math.sin(compass.a) };
}

function compassHandle(sx, sy) {
  if (!compass) return null;
  const c = toScreen(compass.cx, compass.cy);
  if (Math.hypot(sx - c.x, sy - c.y) <= 12) return 'center';
  const t = compassTip();
  const p = toScreen(t.x, t.y);
  if (Math.hypot(sx - p.x, sy - p.y) <= 12) return 'tip';
  return null;
}

function startCompass(e, w) {
  const h = compassHandle(e.clientX, e.clientY);
  if (!compass) {
    const c = e.shiftKey ? snapGrid(w) : w;
    compass = { cx: c.x, cy: c.y, r: 0, a: 0 };
    drag = { kind: 'compassSet' };
  } else if (h === 'center') {
    drag = { kind: 'compassMove' };
  } else if (h === 'tip') {
    drag = { kind: 'compassRadius' };
  } else {
    checkpoint();
    const a = Math.atan2(w.y - compass.cy, w.x - compass.cx);
    compass.a = a;
    const st = styles.shape;
    const el = { id: newId(), type: 'stroke', points: arcPoints(compass.cx, compass.cy, compass.r, a, 0), color: st.color, width: st.width, highlighter: false, pressure: false };
    board.elements.push(el);
    drag = { kind: 'compassArc', el, a0: a, last: a, acc: 0, moved: false };
    autoHideProps();
    sceneCacheValid = false;
  }
}

function updateCompassArc(w) {
  const a = Math.atan2(w.y - compass.cy, w.x - compass.cx);
  drag.acc = Math.max(-Math.PI * 2, Math.min(Math.PI * 2, drag.acc + angleDelta(a, drag.last)));
  drag.last = a;
  compass.a = a;
  if (Math.abs(drag.acc) * compass.r * board.view.zoom > 3) drag.moved = true;
  drag.el.points = arcPoints(compass.cx, compass.cy, compass.r, drag.a0, drag.acc);
}

function endCompassArc(d) {
  // Dokunma ya da tam tur: yay yerine düzgün bir çember (elips öğesi) bırakılır.
  if (!d.moved || Math.abs(d.acc) >= Math.PI * 2 - 0.03) {
    const { cx, cy, r } = compass;
    const circle = { id: d.el.id, type: 'ellipse', x: cx - r, y: cy - r, w: r * 2, h: r * 2, color: d.el.color, width: d.el.width, fill: 'none' };
    board.elements[board.elements.indexOf(d.el)] = circle;
  }
  changed();
}

// Pergelin kolları, merkez ve kalem ucu tutamaçları, yarıçap (kare cinsinden).
function drawCompass() {
  const p = pointer && !compass && !drag ? pointer : null;
  if (!compass) {
    if (p) {
      ctx.fillStyle = 'rgba(74,124,240,0.9)';
      ctx.font = '12px "Segoe UI", sans-serif';
      ctx.fillText(t('Merkezden sürükle'), p.x + 14, p.y + 18);
    }
    return;
  }
  const z = board.view.zoom;
  const c = toScreen(compass.cx, compass.cy);
  const t = compassTip();
  const tp = toScreen(t.x, t.y);
  const rs = compass.r * z;
  ctx.save();
  ctx.strokeStyle = 'rgba(74,124,240,0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(c.x, c.y, rs, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(74,124,240,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(tp.x, tp.y);
  ctx.stroke();
  for (const [q, r] of [[c, 6], [tp, 7]]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(74,124,240,0.95)';
  ctx.beginPath();
  ctx.arc(c.x, c.y, 2, 0, Math.PI * 2);
  ctx.fill();
  const label = 'r = ' + t('{n} kare', { n: (compass.r / GRID_UNIT).toLocaleString(locale, { maximumFractionDigits: 1 }) });
  ctx.font = '600 12px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const mx = (c.x + tp.x) / 2;
  const my = (c.y + tp.y) / 2;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(mx - tw / 2 - 4, my - 22, tw + 8, 17);
  ctx.fillStyle = '#2457d6';
  ctx.fillText(label, mx, my - 6);
  ctx.restore();
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
  // Kilitli nesneler silgiden etkilenmez; not, resim, bant ve koordinat sistemi yalnızca "hepsini sil" açıkken silinir.
  const hits = board.elements.filter((el) => !el.locked &&
    (all || !['note', 'image', 'cover', 'axes', 'table', 'sticker', 'link'].includes(el.type)) && samples.some((p) => hitTest(el, p.x, p.y, r)));
  if (!hits.length) return;
  if (!drag.checkpointed) {
    checkpoint();
    drag.checkpointed = true;
  }
  // Kısmi modda her öğe kalan parçalarıyla değiştirilir; parçalanamayanlar bütün silinir.
  const replacements = new Map();
  for (const el of hits) {
    replacements.set(el, carryComments(el, (mode === 'partial' && splitByEraser(el, samples, r)) || []));
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
  refreshCursor();
}

// ---------- Tekerlek ----------

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  // Cetvelin üzerinde tekerlek cetveli 1° (Shift ile 15°) döndürür.
  const turnable = (ruler && rulerHit(ruler, e.clientX, e.clientY) && ruler) ||
    (protractor && protractorHit(protractor, e.clientX, e.clientY) && protractor);
  if (turnable && !e.ctrlKey) {
    const dir = Math.sign(e.deltaY || e.deltaX);
    const step = ((e.shiftKey ? 15 : 1) * Math.PI) / 180;
    turnable.angle = Math.round((turnable.angle - dir * step) / step) * step;
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

// Fırçalarda imleç, fırçanın renginde ve ekrandaki kalınlığında siyah kenarlı bir noktadır.
// Chromium 128 pikselden büyük imleç resimlerini yok saydığı için çap sınırlanır.
let brushCursorKey = '';
let brushCursorValue = 'crosshair';
function brushCursor(st, translucent) {
  const d = Math.round(Math.min(96, Math.max(4, st.width * board.view.zoom)) * 2) / 2;
  const key = `${st.color}|${d}|${translucent}`;
  if (key === brushCursorKey) return brushCursorValue;
  const size = Math.ceil(d + 4);
  const c = size / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`
    + `<circle cx="${c}" cy="${c}" r="${d / 2}" fill="${st.color}"${translucent ? ' fill-opacity="0.5"' : ''} stroke="#000" stroke-width="1.5"/></svg>`;
  brushCursorKey = key;
  brushCursorValue = `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.floor(c)} ${Math.floor(c)}, crosshair`;
  return brushCursorValue;
}

// Yakınlaştırma ya da fırça ayarı değişince imleci son fare konumuna göre yeniler.
function refreshCursor() {
  updateCursor(pointer ? { clientX: pointer.x, clientY: pointer.y } : undefined);
}

function updateCursor(e) {
  const t = activeTool();
  let c = 'default';
  if (drag?.kind === 'pan' || drag?.kind === 'rotate') c = 'grabbing';
  else if (t === 'hand') c = 'grab';
  else if (t === 'pen' || t === 'highlighter' || t === 'tempHighlighter') c = brushCursor(styles[t], t !== 'pen');
  else if (SHAPE_TOOLS.includes(t) || t === 'note' || t === 'cover' || t === 'cut' || t === 'sticker') c = 'crosshair';
  else if (t === 'eraser' || t === 'laser') c = 'none';
  else if (t === 'text') c = 'text';
  const ph = protractor && e && !drag && t !== 'hand' ? protractorHit(protractor, e.clientX, e.clientY) : null;
  if (crop) {
    const part = drag?.kind === 'crop' ? drag.part : e ? cropHit(e.clientX, e.clientY) : null;
    canvas.style.cursor = part ? cropCursor(part) : 'default';
    return;
  }
  if (drag?.kind === 'rulerMove' || drag?.kind === 'protMove') c = 'grabbing';
  else if (ruler && e && !drag && t !== 'hand' && rulerHit(ruler, e.clientX, e.clientY)) {
    c = rulerHit(ruler, e.clientX, e.clientY) === 'knob' ? 'grab' : 'move';
  } else if (ph) {
    c = ph === 'body' ? 'move' : 'grab';
  } else if (t === 'compass' && e && compassHandle(e.clientX, e.clientY)) {
    c = 'move';
  } else if (t === 'cover' && e && coverAt(toWorld(e.clientX, e.clientY))) {
    c = 'pointer';
  } else if (t === 'select' && e) {
    const h = hitHandle(e.clientX, e.clientY);
    if (h === 'nw' || h === 'se') c = 'nwse-resize';
    else if (h === 'ne' || h === 'sw') c = 'nesw-resize';
    else if (h === 'rot') c = 'grab';
    else if (h) c = 'move';
    else if (topHit(toWorld(e.clientX, e.clientY))) c = 'move';
  }
  canvas.style.cursor = c;
}

// ---------- Metin düzenleyici ----------

// Biçimle ilgili alanların imzası: düzenleme sırasında yalnızca biçim değiştiyse de kaydedilsin diye.
const styleSig = (el) => JSON.stringify([el.color, el.fontSize, ...FMT_PROPS.map((k) => el[k] ?? null)]);

// cell { r, c } verilirse tablonun o hücresi düzenlenir.
function openEditor(el, isNew, cell = null) {
  if (!isNew) checkpoint();
  const text = cell ? el.cells[cell.r][cell.c] : el.text;
  editing = { el, isNew, text, h: el.h, cell, sig: styleSig(el) };
  selection.clear();
  editor.value = text;
  editor.className = el.type === 'note' || cell ? 'note' : '';
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
  const cell = editing.cell;
  const z = board.view.zoom;
  const p = toScreen(el.x, el.y);
  const st = editor.style;
  // Biçim düzenleyiciye de uygulanır; liste işaretleri yazarken görünmez, yeri soldan boşluk olarak kalır.
  const fmt = cell ? cellFmt(el, cell.r) : el;
  st.fontSize = el.fontSize * z + 'px';
  st.fontWeight = fmt.bold ? '700' : '';
  st.fontStyle = fmt.italic ? 'italic' : '';
  st.textDecoration = fmt.underline ? 'underline' : '';
  st.textAlign = fmt.align || '';
  const indent = listIndent(editor.value, el.fontSize, fmt) * z;
  st.paddingLeft = indent + 'px';
  if (cell) {
    const r = cellRect(el, cell.r, cell.c);
    const q = toScreen(r.x, r.y);
    st.color = el.color;
    st.left = q.x + CELL_PAD * z + 'px';
    st.top = q.y + CELL_PAD * z + 'px';
    st.width = Math.max(4, (r.w - CELL_PAD * 2) * z - indent) + 'px';
    st.height = Math.max(4, (r.h - CELL_PAD * 2) * z) + 'px';
    st.transform = '';
    return;
  }
  if (el.type === 'note') {
    st.color = '#1f2328';
    st.left = p.x + NOTE_PADDING * z + 'px';
    st.top = p.y + NOTE_PADDING * z + 'px';
    st.width = Math.max(4, (el.w - NOTE_PADDING * 2) * z - indent) + 'px';
    st.height = (el.h - NOTE_PADDING * 2) * z + 'px';
  } else {
    const m = measureText(editor.value + ' ', el.fontSize, el);
    st.color = el.color;
    st.left = p.x + 'px';
    st.top = p.y + 'px';
    st.width = (m.w + el.fontSize) * z - indent + 'px';
    st.height = m.h * z + 'px';
  }
  // Dönmüş öğenin düzenleyicisi de öğenin merkezi etrafında dönük durur.
  const pad = el.type === 'note' ? NOTE_PADDING : 0;
  editor.style.transformOrigin = `${(el.w / 2 - pad) * z}px ${(el.h / 2 - pad) * z}px`;
  editor.style.transform = el.rot ? `rotate(${el.rot}rad)` : '';
}

// Not, yazılan metne göre aşağı doğru büyür.
function fitNoteHeight(el, text) {
  const need = wrappedHeight(text, el.fontSize, el.w - NOTE_PADDING * 2, el) + NOTE_PADDING * 2;
  if (need > el.h) resizeBox(el, el.w, need);
}

editor.addEventListener('input', () => {
  if (!editing) return;
  if (editing.cell) fitTable(editing.el, { ...editing.cell, text: editor.value });
  else if (editing.el.type === 'note') fitNoteHeight(editing.el, editor.value);
  requestRender();
});

editor.addEventListener('blur', () => commitEditor());

editor.addEventListener('keydown', (e) => {
  e.stopPropagation();
  const fmtKey = { b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()];
  if ((e.ctrlKey || e.metaKey) && fmtKey) {
    e.preventDefault();
    toggleFmt(fmtKey);
    return;
  }
  if (e.key === 'Tab' && editing?.cell) {
    e.preventDefault();
    moveCell(e.shiftKey ? -1 : 1);
    return;
  }
  if (e.key === 'Escape' || (e.key === 'Enter' && e.ctrlKey)) {
    e.preventDefault();
    commitEditor();
  }
});

function commitEditor() {
  if (!editing) return;
  const { el, isNew, text: oldText, h: oldH, cell, sig } = editing;
  editing = null;
  editor.style.display = 'none';
  const text = editor.value.replace(/\s+$/, '');

  if (cell) {
    if (text !== oldText && el.cells[cell.r]?.[cell.c] !== undefined) {
      // Hücre dizileri yerinde değiştirilmez (geri alma kopyası paylaşıyor).
      el.cells = el.cells.map((row, r) => (r === cell.r ? row.map((v, c) => (c === cell.c ? text : v)) : row));
    }
    fitTable(el);
    if (!isNew && text === oldText && el.h === oldH && styleSig(el) === sig) {
      undoStack.pop();
      changed(false);
      return;
    }
    changed();
    return;
  }

  if (el.type === 'text' && !text.trim()) {
    board.elements.splice(board.elements.indexOf(el), 1);
    if (isNew) undoStack.pop();
  } else {
    el.text = text;
    // Formül resmi hâlâ aynı yazıya aitse boyutu korunur; değilse yeni resim gelene kadar düz metin ölçüsü.
    if (el.type === 'text' && el.math?.text !== text) {
      const m = measureText(text, el.fontSize, el);
      resizeBox(el, m.w, m.h);
    }
    else if (el.type === 'note') fitNoteHeight(el, text);
    if (!isNew && text === oldText && el.h === oldH && styleSig(el) === sig) {
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
  if (crop) return { crop: true };
  if (editing) {
    const el = editing.el;
    if (editing.cell) return { colors: INK_COLORS, font: true, textFmt: true, table: el, values: el };
    return el.type === 'note'
      ? { noteColors: true, font: true, textFmt: true, values: { ...el, noteColor: el.color } }
      : { colors: INK_COLORS, font: true, textFmt: true, values: el };
  }
  if (selectionIsEditable()) {
    const sel = selectedEls();
    const has = (...types) => sel.some((el) => types.includes(el.type));
    const first = (...types) => sel.find((el) => types.includes(el.type)) || {};
    const ctx = { arrange: true, rotatable: sel.every((el) => canRotate(el) && !el.locked), values: { locked: sel.every((el) => el.locked) } };
    if (has('stroke', 'line', 'arrow', 'rect', 'ellipse', 'polygon', 'text', 'cover', 'axes', 'table')) {
      ctx.colors = sel.every((el) => el.highlighter) ? HIGHLIGHT_COLORS
        : sel.every((el) => el.type === 'cover') ? COVER_COLORS : INK_COLORS;
      ctx.values.color = first('stroke', 'line', 'arrow', 'rect', 'ellipse', 'polygon', 'text', 'cover', 'axes', 'table').color;
    }
    // Yalnızca galaksi çizgileri seçiliyse renk satırı galaksi renklerini gösterir.
    if (sel.every((el) => el.type === 'stroke' && !el.highlighter && el.brush === 'galaxy')) {
      ctx.colors = GALAXY_TINTS;
      ctx.colorProp = 'galaxy';
      const g = sel[0].galaxy || 'classic';
      ctx.values.color = sel.every((el) => (el.galaxy || 'classic') === g) ? g : null;
    }
    ctx.cover = has('cover');
    ctx.axes = sel.length === 1 && sel[0].type === 'axes' ? sel[0] : null;
    ctx.cropable = sel.length === 1 && sel[0].type === 'image' && !sel[0].locked;
    if (has('stroke', 'line', 'arrow', 'rect', 'ellipse', 'polygon')) {
      ctx.widths = sel.every((el) => el.highlighter) ? HIGHLIGHT_WIDTHS
        : sel.every((el) => el.brush === 'tape') ? TAPE_WIDTHS : PEN_WIDTHS;
      ctx.values.width = first('stroke', 'line', 'arrow', 'rect', 'ellipse', 'polygon').width;
    }
    if (sel.every((el) => el.type === 'stroke' && !el.highlighter)) {
      ctx.brushes = true;
      const b = sel[0].brush || 'normal';
      ctx.values.brush = sel.every((el) => (el.brush || 'normal') === b) ? b : null;
      if (sel.every((el) => el.brush === 'hatch')) {
        ctx.hatch = true;
        const h = sel[0].hatch || 'fwd';
        ctx.values.hatch = sel.every((el) => (el.hatch || 'fwd') === h) ? h : null;
      }
    }
    if (has('rect', 'ellipse', 'polygon')) {
      ctx.fill = true;
      ctx.values.fill = first('rect', 'ellipse', 'polygon').fill;
    }
    if (has(...TEXT_TYPES)) {
      ctx.font = true;
      ctx.textFmt = true;
      const f = first(...TEXT_TYPES);
      ctx.values.fontSize = f.fontSize;
      for (const k of FMT_PROPS) ctx.values[k] = f[k];
    }
    if (has('note')) {
      ctx.noteColors = true;
      ctx.values.noteColor = first('note').color;
    }
    ctx.table = sel.length === 1 && sel[0].type === 'table' ? sel[0] : null;
    if (sel.every((el) => el.type === 'sticker')) {
      ctx.stickers = true;
      ctx.values.emoji = sel[0].emoji;
    }
    ctx.link = sel.length === 1 && sel[0].type === 'link';
    // Hizalama ve gruplama birimleri: her grup bir birim sayılır.
    const units = unitsOf(sel.filter((el) => !el.locked)).length;
    ctx.align = units >= 2 ? units : 0;
    ctx.canGroup = units >= 2;
    ctx.canUngroup = sel.some((el) => el.groupId);
    ctx.obsidian = sel.some((el) => el.obsidian);
    ctx.obsidianOne = sel.length === 1 && !!sel[0].obsidian;
    return ctx;
  }
  const t = activeTool();
  if (t === 'pen') {
    const brush = BRUSHES.find((b) => b.id === styles.pen.brush) || BRUSHES[0];
    const galaxy = brush.id === 'galaxy';
    return {
      colors: brush.noColor ? null : galaxy ? GALAXY_TINTS : INK_COLORS,
      colorProp: galaxy ? 'galaxy' : 'color',
      widths: brush.id === 'tape' ? TAPE_WIDTHS : PEN_WIDTHS,
      brushes: true,
      hatch: brush.id === 'hatch',
      toShape: brush.id !== 'arrow' && brush.id !== 'dashedarrow' && brush.id !== 'hatch',
      values: galaxy ? { ...styles.pen, color: styles.pen.galaxy || 'classic' } : styles.pen,
    };
  }
  if (t === 'highlighter') return { colors: HIGHLIGHT_COLORS, widths: HIGHLIGHT_WIDTHS, values: styles.highlighter };
  if (t === 'tempHighlighter') return { colors: HIGHLIGHT_COLORS, widths: HIGHLIGHT_WIDTHS, values: styles.tempHighlighter };
  if (SHAPE_TOOLS.includes(t)) {
    const fill = t === 'rect' || t === 'ellipse' || POLY_SHAPES.includes(t);
    return { colors: INK_COLORS, widths: SHAPE_WIDTHS, fill, compass: t === 'compass', values: styles.shape };
  }
  if (t === 'cover') return { colors: COVER_COLORS, cover: true, coverTool: true, values: styles.cover };
  if (t === 'text') return { colors: INK_COLORS, font: true, textFmt: true, values: styles.text };
  if (t === 'note') return { noteColors: true, font: true, textFmt: true, values: { ...styles.note, noteColor: styles.note.color } };
  if (t === 'sticker') return { stickers: true, values: styles.sticker };
  if (t === 'eraser') return { eraser: true };
  if (t === 'laser') return { colors: LASER_COLORS, values: styles.laser };
  return null;
}

function updateProps() {
  document.body.style.setProperty('--laser-color', styles.laser.color);
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
  toggle.title = propsUi.collapsed ? t('Paneli göster') : t('Paneli gizle');
  let dotColor = c.colors ? v.color : c.noteColors ? v.noteColor : null;
  if (dotColor === 'classic') dotColor = GALAXY_CLASSIC_BG;
  const dot = toggle.querySelector('.tab-dot');
  dot.classList.toggle('hidden', !propsUi.collapsed || !dotColor);
  if (dotColor) dot.style.background = dotColor;
  const pin = $('#propsPin');
  pin.classList.toggle('on', propsUi.pinned);
  pin.title = propsUi.pinned
    ? t('Sabit: panel yalnızca okla gizlenir (kapatınca çizerken kendiliğinden gizlenir)')
    : t('Sabit değil: çizmeye başlayınca panel gizlenir (tıkla, sabitle)');

  const brushRow = $('#brushRow');
  brushRow.classList.toggle('hidden', !c.brushes);
  if (c.brushes) {
    brushRow.innerHTML = BRUSHES.map((b, i) =>
      `<button class="brush-btn${b.id === v.brush ? ' selected' : ''}" data-brush="${b.id}" title="${b.label} — ${b.title}${i < 10 ? ` (Alt+${(i + 1) % 10})` : ''}"><svg viewBox="0 0 32 16">${b.icon}</svg></button>`,
    ).join('');
  }

  const hatchRow = $('#hatchRow');
  hatchRow.classList.toggle('hidden', !c.hatch);
  if (c.hatch) {
    hatchRow.innerHTML = HATCH_DIRS.map((h) =>
      `<button class="brush-btn${h.id === (v.hatch || 'fwd') ? ' selected' : ''}" data-hatch="${h.id}" title="${h.label}"><svg viewBox="0 0 32 17" stroke="currentColor" stroke-width="1.6">${h.icon}</svg></button>`,
    ).join('');
  }

  const colorRow = $('#colorRow');
  colorRow.classList.toggle('hidden', !c.colors);
  colorRow.dataset.prop = c.colorProp || 'color';
  if (c.colors) {
    const custom = v.color != null && !c.colors.includes(v.color);
    colorRow.innerHTML = c.colors.map((col) => {
      const classic = col === 'classic';
      return `<button class="swatch${col === v.color ? ' selected' : ''}" data-color="${col}" style="background:${classic ? GALAXY_CLASSIC_BG : col}" title="${classic ? t('Klasik galaksi') : col}"></button>`;
    }).join('') +
      `<label class="swatch custom${custom ? ' selected' : ''}" title="${t('Özel renk')}"><input type="color" value="${/^#[0-9a-f]{6}$/i.test(v.color || '') ? v.color : '#000000'}" /></label>`;
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
      `<button class="chip${f === v.fontSize ? ' selected' : ''}" data-font="${f}" title="${t('Yazı boyutu {n}', { n: f })}">${f}</button>`,
    ).join('');
  }

  const fmtRow = $('#textFmtRow');
  fmtRow.classList.toggle('hidden', !c.textFmt);
  if (c.textFmt) {
    fmtRow.querySelectorAll('[data-fmt]').forEach((b) => b.classList.toggle('selected', !!v[b.dataset.fmt]));
    fmtRow.querySelectorAll('[data-align]').forEach((b) => b.classList.toggle('selected', (v.align || 'left') === b.dataset.align));
    fmtRow.querySelectorAll('[data-list]').forEach((b) => b.classList.toggle('selected', v.list === b.dataset.list));
  }

  $('#tableRow').classList.toggle('hidden', !c.table);
  if (c.table) $('[data-table="header"]').classList.toggle('selected', !!c.table.header);

  const stickerRow = $('#stickerRow');
  stickerRow.classList.toggle('hidden', !c.stickers);
  if (c.stickers) {
    stickerRow.innerHTML = STICKERS.map((e) =>
      `<button class="emoji-btn${e === v.emoji ? ' selected' : ''}" data-emoji="${e}">${e}</button>`,
    ).join('');
  }
  $('#linkRow').classList.toggle('hidden', !c.link);
  $('#alignRow').classList.toggle('hidden', !c.align);
  document.querySelectorAll('[data-align-op^="dist"]').forEach((b) => b.classList.toggle('hidden', c.align < 3));

  const fillRow = $('#fillRow');
  fillRow.classList.toggle('hidden', !c.fill);
  fillRow.querySelectorAll('[data-fill]').forEach((b) => b.classList.toggle('selected', b.dataset.fill === v.fill));

  $('#coverRow').classList.toggle('hidden', !c.cover);
  $('[data-cover="toggle"]').classList.toggle('hidden', !!c.coverTool);
  $('#compassRow').classList.toggle('hidden', !c.compass);
  const ax = c.axes;
  $('#axesRow').classList.toggle('hidden', !ax);
  $('#fnList').classList.toggle('hidden', !ax?.fns?.length);
  // Düzenlenen grafik başka bir öğeye ya da artık olmayan bir satıra aitse düzenlemeden çık.
  if (fnEdit && (!ax || fnEdit.id !== ax.id || !ax.fns?.[fnEdit.i])) fnEdit = null;
  if (ax) {
    $('[data-axes-grid]').classList.toggle('selected', !!ax.grid);
    // Çip içinde yazılırken listeyi yeniden kurma; yoksa kutu ve imleç kaybolur.
    const live = $('#fnList .fninline');
    if (!(fnEdit && live && Number(live.dataset.fnInline) === fnEdit.i)) {
      $('#fnList').innerHTML = (ax.fns || []).map((f, i) => (fnEdit?.i === i
        ? `<span class="fnchip editing"><span class="chip fnedit"><span class="fndot" style="background:${f.color}"></span><input class="fninline" data-fn-inline="${i}" type="text" value="${escHtml(functionLabel(f.expr))}" spellcheck="false" autocomplete="off" title="${t('Enter: kaydet — Esc: vazgeç')}" /></span></span>`
        : `<span class="fnchip"><button class="chip fnedit" data-fn-edit="${i}" title="${t('Denklemi düzenle')}"><span class="fndot" style="background:${f.color}"></span>${escHtml(functionLabel(f.expr))}</button><button class="chip fnremove" data-fn-remove="${i}" title="${t('Bu grafiği kaldır')}">×</button></span>`),
      ).join('');
    }
  }
  const lockChip = $('[data-arrange="lock"]');
  lockChip.textContent = v.locked ? t('Kilidi aç') : t('Kilitle');
  lockChip.classList.toggle('selected', !!v.locked);
  lockChip.classList.toggle('hidden', !studentMode && !v.locked);
  $('#arrangeRow').classList.toggle('hidden', !c.arrange);
  const one = c.arrange && selection.size === 1 ? selectedEls()[0] : null;
  const commentChip = $('[data-arrange="comment"]');
  commentChip.classList.toggle('hidden', !one);
  if (one) {
    const n = commentsOf(one).length;
    commentChip.textContent = n ? t('Yorumlar ({n})', { n }) : t('Yorum');
    commentChip.classList.toggle('selected', commentFor === one.id);
  }
  for (const b of document.querySelectorAll('[data-arrange^="rot"]')) b.classList.toggle('hidden', !c.rotatable);
  $('[data-arrange="group"]').classList.toggle('hidden', !c.canGroup);
  $('[data-arrange="ungroup"]').classList.toggle('hidden', !c.canUngroup);
  $('#cropRow').classList.toggle('hidden', !c.crop);
  $('#imageRow').classList.toggle('hidden', !c.cropable);
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
    if (prop === 'color' && (el.type === 'text' || el.type === 'table')) el.color = value;
    if (prop === 'noteColor' && el.type === 'note') el.color = value;
    if (prop === 'fontSize') el.fontSize = value;
    if (FMT_PROPS.includes(prop)) setFmt(el, prop, value);
    if (editing.cell) fitTable(el, { ...editing.cell, text: editor.value }, prop === 'fontSize');
    else if (el.type === 'note') fitNoteHeight(el, editor.value);
    requestRender();
    updateProps();
    setTimeout(() => editor.focus());
    return;
  }
  if (selectionIsEditable()) {
    checkpoint();
    for (const el of selectedEls()) {
      if (prop === 'color' && !['note', 'image', 'sticker', 'link'].includes(el.type)) el.color = value;
      if (prop === 'noteColor' && el.type === 'note') el.color = value;
      if (prop === 'width' && ['stroke', 'line', 'arrow', 'rect', 'ellipse', 'polygon'].includes(el.type)) el.width = value;
      if (prop === 'fill' && ['rect', 'ellipse', 'polygon'].includes(el.type)) el.fill = value;
      if (prop === 'galaxy' && el.type === 'stroke' && el.brush === 'galaxy') {
        if (value === 'classic') delete el.galaxy;
        else el.galaxy = value;
      }
      if (prop === 'hatch' && el.type === 'stroke' && el.brush === 'hatch') {
        if (value === 'fwd') delete el.hatch;
        else el.hatch = value;
      }
      if (prop === 'brush' && el.type === 'stroke' && !el.highlighter) {
        if (value === 'normal') delete el.brush;
        else el.brush = value;
      }
      if (prop === 'fontSize' && el.type === 'text') {
        el.fontSize = value;
        const m = measureText(el.text, value, el);
        resizeBox(el, m.w, m.h);
      }
      if (prop === 'fontSize' && el.type === 'note') {
        el.fontSize = value;
        fitNoteHeight(el, el.text);
      }
      if (prop === 'fontSize' && el.type === 'table') {
        el.fontSize = value;
        fitTable(el, null, true);
      }
      if (FMT_PROPS.includes(prop) && TEXT_TYPES.includes(el.type)) {
        setFmt(el, prop, value);
        // Formül resmi gösterilen metnin kutusu resme aittir; ölçüsü değişmez.
        if (el.type === 'text' && !el.math) {
          const m = measureText(el.text, el.fontSize, el);
          resizeBox(el, m.w, m.h);
        }
        if (el.type === 'note') fitNoteHeight(el, el.text);
        if (el.type === 'table') fitTable(el);
      }
      if (prop === 'emoji' && el.type === 'sticker') el.emoji = value;
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
  refreshCursor();
}

// Kalın / italik / altı çizili düğmesi ya da Ctrl+B/I/U: o anki değerin tersini uygular.
function toggleFmt(prop) {
  const c = propsContext();
  if (!c?.textFmt) return;
  applyStyle(prop, !c.values?.[prop]);
}

// Alt+1 … Alt+0 kısayolu: seçili kalem çizgileri varsa onlara, yoksa kaleme geçip fırçayı uygular.
function pickBrush(brush) {
  if (!brush) return;
  if (!propsContext()?.brushes) setTool('pen');
  applyStyle('brush', brush.id);
  toast(t('Fırça: {name}', { name: brush.label }));
}

$('#props').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.color) applyStyle($('#colorRow').dataset.prop || 'color', b.dataset.color);
  else if (b.dataset.noteColor) applyStyle('noteColor', b.dataset.noteColor);
  else if (b.dataset.width) applyStyle('width', Number(b.dataset.width));
  else if (b.dataset.font) applyStyle('fontSize', Number(b.dataset.font));
  else if (b.dataset.fill) applyStyle('fill', b.dataset.fill);
  else if (b.dataset.brush) applyStyle('brush', b.dataset.brush);
  else if (b.dataset.hatch) applyStyle('hatch', b.dataset.hatch);
  else if (b.dataset.arrange) arrange(b.dataset.arrange);
  else if (b.dataset.fmt) toggleFmt(b.dataset.fmt);
  else if (b.dataset.align) applyStyle('align', b.dataset.align);
  else if (b.dataset.list) applyStyle('list', propsContext()?.values?.list === b.dataset.list ? null : b.dataset.list);
  else if (b.dataset.alignOp) alignSelection(b.dataset.alignOp);
  else if (b.dataset.table) tableAction(b.dataset.table);
  else if (b.dataset.emoji) applyStyle('emoji', b.dataset.emoji);
  else if (b.dataset.link === 'open') openLinkEl(selectedEls()[0]);
  else if (b.dataset.link === 'refresh') fetchLinkInfo(selectedEls()[0], true);
  else if (b.dataset.crop === 'start') startCrop();
  else if (b.dataset.crop === 'apply') applyCrop();
  else if (b.dataset.crop === 'cancel') cancelCrop();
  else if (b.dataset.crop === 'reset' && cropEl()) {
    const el = cropEl();
    crop.r = { x: el.x, y: el.y, w: el.w, h: el.h };
    requestRender();
  }
  else if (b.dataset.cover === 'toggle') {
    const covers = selectedEls().filter((el) => el.type === 'cover');
    const show = covers.some((el) => !revealedCovers.has(el.id));
    for (const el of covers) toggleCover(el, show);
  } else if (b.dataset.cover) setAllCovers(b.dataset.cover === 'showAll');
  else if (b.dataset.compass === 'reset') {
    compass = null;
    requestRender();
  } else if ('axesGrid' in b.dataset) {
    const ax = selectedEls()[0];
    checkpoint();
    ax.grid = !ax.grid;
    changed();
  } else if ('axesAdd' in b.dataset) addFunction();
  else if (b.dataset.fnEdit) {
    const ax = selectedEls()[0];
    const i = Number(b.dataset.fnEdit);
    closeFnEdit();
    fnEdit = { id: ax.id, i };
    updateProps();
    const input = $('#fnList .fninline');
    input.focus();
    input.select();
  } else if (b.dataset.fnRemove) {
    const ax = selectedEls()[0];
    const i = Number(b.dataset.fnRemove);
    closeFnEdit();
    checkpoint();
    ax.fns = ax.fns.filter((_, k) => k !== i); // dizi yerinde değiştirilmez (geri alma kopyası paylaşıyor)
    changed();
  }
  else if ('propsToggle' in b.dataset) setPropsCollapsed(!propsUi.collapsed);
  else if ('propsPin' in b.dataset) {
    propsUi.pinned = !propsUi.pinned;
    savePrefs();
    updateProps();
    toast(propsUi.pinned ? t('Panel sabitlendi') : t('Panel çizerken kendiliğinden gizlenecek'));
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
    toast(styles.pen.toShape ? t('Şekil algılama açık') : t('Şekil algılama kapalı'));
  }
});

$('#props').addEventListener('change', (e) => {
  if (e.target.type === 'color') applyStyle($('#colorRow').dataset.prop || 'color', e.target.value);
});

// Çip içindeki düzenlemeyi bitirir: save ise geçerli denklemi yazar, değilse vazgeçer.
function finishFnEdit(save) {
  if (!fnEdit) return;
  const input = $('#fnList .fninline');
  const ax = selectedEls()[0];
  const i = fnEdit.i;
  if (save && input && ax?.type === 'axes' && ax.fns?.[i]) {
    const expr = input.value.trim().replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/, '');
    const r = compileFunction(expr);
    if (r.error) {
      input.classList.add('invalid');
      toast(t('Fonksiyon anlaşılamadı: {hata}', { hata: r.error }));
      return false;
    }
    fnEdit = null;
    if (ax.fns[i].expr !== expr) {
      checkpoint();
      // dizi yerinde değiştirilmez (geri alma kopyası paylaşıyor)
      ax.fns = ax.fns.map((f, k) => (k === i ? { ...f, expr } : f));
      changed();
      return true;
    }
  }
  fnEdit = null;
  updateProps();
  return true;
}

$('#fnList').addEventListener('keydown', (e) => {
  if (!e.target.classList.contains('fninline')) return;
  e.stopPropagation();
  if (e.key === 'Enter') {
    e.preventDefault();
    finishFnEdit(true);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    finishFnEdit(false);
  }
});
$('#fnList').addEventListener('input', (e) => e.target.classList.remove('invalid'));
// Açık düzenlemeyi kapatır: geçerliyse kaydeder, geçersizse eski hâline döner.
function closeFnEdit() {
  if (fnEdit && finishFnEdit(true) === false) finishFnEdit(false);
}

// Kutudan çıkınca düzenlemeyi kapat. Tıklama yeni hedefine ulaşsın diye bir sonraki adıma ertelenir;
// o arada başka bir çip düzenlemeyi kendisi kapatıp yenisini açtıysa dokunma.
$('#fnList').addEventListener('focusout', (e) => {
  if (!e.target.classList.contains('fninline') || !fnEdit) return;
  const ed = fnEdit;
  setTimeout(() => {
    if (fnEdit === ed) closeFnEdit();
  });
});

// Koordinat sistemine fonksiyon grafiği ekler (paneldeki kutudan).
function addFunction() {
  const input = $('#fnInput');
  const ax = selectedEls()[0];
  if (!ax || ax.type !== 'axes') return;
  const expr = input.value.trim();
  const r = compileFunction(expr);
  if (r.error) {
    input.classList.add('invalid');
    return toast(t('Fonksiyon anlaşılamadı: {hata}', { hata: r.error }));
  }
  input.classList.remove('invalid');
  const fns = ax.fns || [];
  const color = FN_COLORS.find((c) => !fns.some((f) => f.color === c)) || FN_COLORS[fns.length % FN_COLORS.length];
  checkpoint();
  ax.fns = [...fns, { expr, color }];
  input.value = '';
  changed();
}

$('#fnInput').addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') {
    e.preventDefault();
    addFunction();
  } else if (e.key === 'Escape') e.target.blur();
});
$('#fnInput').addEventListener('input', (e) => e.target.classList.remove('invalid'));

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

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
  if (action === 'lock') return toggleLock();
  if (action === 'comment') return commentOnSelection();
  if (action === 'group') return groupSelection();
  if (action === 'ungroup') return ungroupSelection();
  if (action === 'rotl') return rotateSelection(-Math.PI / 2);
  if (action === 'rotr') return rotateSelection(Math.PI / 2);
  checkpoint();
  const rest = board.elements.filter((el) => !selection.has(el.id));
  board.elements = action === 'front' ? [...rest, ...sel] : [...sel, ...rest];
  changed();
}

// Seçimi, çerçevesinin merkezi etrafında döndürür (panel düğmeleri).
function rotateSelection(a) {
  const sel = selectedEls();
  if (!sel.length || !sel.every((el) => canRotate(el) && !el.locked)) return;
  const b = unionBBox(sel);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  checkpoint();
  for (const el of sel) rotateAround(el, cloneEl(el), cx, cy, a);
  changed();
}

// Seçili nesneleri kilitler; hepsi zaten kilitliyse kilitlerini açar.
function toggleLock() {
  const sel = selectedEls();
  if (!sel.length) return;
  const lock = !sel.every((el) => el.locked);
  checkpoint();
  for (const el of sel) {
    if (lock) el.locked = true;
    else delete el.locked;
  }
  if (lock) selection.clear();
  changed();
  toast(lock
    ? (sel.length > 1 ? t('{n} nesne kilitlendi', { n: sel.length }) : t('Kilitlendi')) + t(' — seçmek için çift tıkla')
    : t('Kilit açıldı'));
}

function unlockAll() {
  const locked = board.elements.filter((el) => el.locked);
  if (!locked.length) return toast(t('Tahtada kilitli nesne yok'));
  checkpoint();
  for (const el of locked) delete el.locked;
  changed();
  toast(t('{n} nesnenin kilidi açıldı', { n: locked.length }));
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
  // Kopyalanan gruplar yeni grup kimliği alır; kopya asıl grupla birleşmez.
  const gids = new Map();
  const copies = els.map((el) => {
    const c = cloneEl(el);
    c.id = newId();
    if (c.groupId) {
      if (!gids.has(c.groupId)) gids.set(c.groupId, newId());
      c.groupId = gids.get(c.groupId);
    }
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
  insertCopies(sel.map(withoutComments), { x: d, y: d });
}

// ---------- Araç çubuğu ----------

function setTool(t) {
  commitEditor();
  cancelCrop();
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
  main.title = m.title + ' — ' + grp.el.dataset.title + t(': sağ tıkla veya basılı tut');
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
  if (STUDENT_TARGETS.includes(a) && !studentOnly()) return;
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
    case 'protractor':
      protractor = protractor ? null : createProtractor(innerWidth / 2, innerHeight / 2 + PROT_R / 2);
      $('[data-action="protractor"]').classList.toggle('active', !!protractor);
      return requestRender();
    case 'axes': return insertAxes();
    case 'table': return insertTable();
    case 'template': return openTemplates();
    case 'link': return insertLink();
    case 'webImage': return searchWebImages();
  }
}

// Ekranın ortasına, başlangıç noktası kareli arka planın bir köşesine oturan koordinat sistemi ekler.
function insertAxes() {
  commitEditor();
  const U = GRID_UNIT;
  const o = snapGrid(toWorld(innerWidth / 2, innerHeight / 2));
  const el = {
    id: newId(), type: 'axes', x: o.x - 7 * U, y: o.y - 5 * U, w: 14 * U, h: 10 * U,
    ox: o.x, oy: o.y, unit: U, color: '#1f2328', grid: false, fns: [],
  };
  checkpoint();
  board.elements.push(el);
  setTool('select');
  selection = new Set([el.id]);
  changed();
  toast(t('Koordinat sistemi eklendi — panelden fonksiyon grafiği çizebilirsin'));
  setTimeout(() => $('#fnInput').focus());
}

// ---------- Tablo ----------
// colW / rowH dünya birimiyle sütun genişlikleri ve satır yükseklikleri, cells[satır][sütun] metinler.
// Diziler yerinde değiştirilmez, her değişiklikte yenisi atanır (geri alma yüzeysel kopyaya dayanır).
// Hücreye çift tıklayınca (ya da Metin aracıyla tıklayınca) düzenlenir; Tab sonraki hücreye geçer.

const TABLE_FONT = 18;
const minRowH = (el) => el.fontSize * 1.25 + CELL_PAD * 2;
const cellFmt = (el, r) => ({ ...el, bold: el.bold || (el.header && r === 0) });

function cellRect(el, r, c) {
  let x = el.x, y = el.y;
  for (let i = 0; i < c; i++) x += el.colW[i];
  for (let i = 0; i < r; i++) y += el.rowH[i];
  return { x, y, w: el.colW[c], h: el.rowH[r] };
}

function cellAt(el, w) {
  const find = (sizes, start, v) => {
    let acc = start;
    for (let i = 0; i < sizes.length; i++) {
      acc += sizes[i];
      if (v < acc) return i;
    }
    return sizes.length - 1;
  };
  return { r: find(el.rowH, el.y, w.y), c: find(el.colW, el.x, w.x) };
}

// Satırlar hücrelerindeki yazıya yetecek kadar uzar. shrink ise (yazı boyutu değişince) yazıya göre
// kısalır da. edit { r, c, text }: düzenlenmekte olan hücrenin canlı metni.
function fitTable(el, edit = null, shrink = false) {
  let grew = false;
  const rowH = el.rowH.map((h, r) => {
    let need = minRowH(el);
    const fmt = cellFmt(el, r);
    el.colW.forEach((cw, c) => {
      const text = edit && edit.r === r && edit.c === c ? edit.text : el.cells[r][c];
      if (text) need = Math.max(need, wrappedHeight(text, el.fontSize, cw - CELL_PAD * 2, fmt) + CELL_PAD * 2);
    });
    if (need > h + 0.5 || (shrink && Math.abs(need - h) > 0.5)) {
      grew = true;
      return need;
    }
    return h;
  });
  if (grew) {
    el.rowH = rowH;
    el.h = rowH.reduce((a, b) => a + b, 0);
  }
}

function insertTable() {
  commitEditor();
  const cols = 3, rows = 3, cw = 160;
  const rh = TABLE_FONT * 1.25 + CELL_PAD * 2;
  const c = toWorld(innerWidth / 2, innerHeight / 2);
  const el = {
    id: newId(), type: 'table', x: c.x - (cols * cw) / 2, y: c.y - (rows * rh) / 2, w: cols * cw, h: rows * rh,
    colW: Array(cols).fill(cw), rowH: Array(rows).fill(rh), cells: Array.from({ length: rows }, () => Array(cols).fill('')),
    color: '#1f2328', fontSize: TABLE_FONT, header: true,
  };
  checkpoint();
  board.elements.push(el);
  setTool('select');
  openEditor(el, true, { r: 0, c: 0 });
  toast(t('Tablo eklendi — Tab ile sonraki hücreye geç, hücreye çift tıklayınca düzenlenir'), 3500);
}

// Satır / sütun ekler ya da siler; ekleme `at` satırının (sütununun) ardına yapılır.
function tableOp(el, op, at) {
  const rows = el.rowH.length, cols = el.colW.length;
  if ((op === 'delRow' && rows < 2) || (op === 'delCol' && cols < 2)) {
    toast(t('Tabloda en az bir satır ve bir sütun kalmalı'));
    return false;
  }
  checkpoint();
  const insert = (list, i, v) => [...list.slice(0, i + 1), v, ...list.slice(i + 1)];
  if (op === 'addRow') {
    el.rowH = insert(el.rowH, at, minRowH(el));
    el.cells = insert(el.cells, at, Array(cols).fill(''));
  } else if (op === 'delRow') {
    el.rowH = el.rowH.filter((_, i) => i !== at);
    el.cells = el.cells.filter((_, i) => i !== at);
  } else if (op === 'addCol') {
    el.colW = insert(el.colW, at, el.colW[at]);
    el.cells = el.cells.map((row) => insert(row, at, ''));
  } else if (op === 'delCol') {
    el.colW = el.colW.filter((_, i) => i !== at);
    el.cells = el.cells.map((row) => row.filter((_, i) => i !== at));
  }
  el.w = el.colW.reduce((a, b) => a + b, 0);
  el.h = el.rowH.reduce((a, b) => a + b, 0);
  fitTable(el);
  changed();
  return true;
}

// Paneldeki tablo düğmeleri. Hücre düzenlenirken işlem o hücrenin satırına / sütununa uygulanır ve
// düzenleme uygun hücrede sürer; yalnızca tablo seçiliyken son satır / sütun kullanılır.
function tableAction(op) {
  const cell = editing?.cell;
  const el = cell ? editing.el : selectedEls()[0];
  if (el?.type !== 'table') return;
  commitEditor();
  if (op === 'header') {
    checkpoint();
    el.header = !el.header;
    fitTable(el, null, true);
    changed();
  } else {
    const row = op.endsWith('Row');
    const at = cell ? (row ? cell.r : cell.c) : row ? el.rowH.length - 1 : el.colW.length - 1;
    if (!tableOp(el, op, at) || !cell) return;
    const r = op === 'addRow' ? cell.r + 1 : Math.min(cell.r, el.rowH.length - 1);
    const c = op === 'addCol' ? cell.c + 1 : Math.min(cell.c, el.colW.length - 1);
    return openEditor(el, false, { r, c });
  }
  if (cell) openEditor(el, false, cell);
  else selection = new Set([el.id]);
}

// Tab: sonraki (Shift ile önceki) hücre; son hücrede Tab yeni satır ekler.
function moveCell(d) {
  const { el, cell } = editing;
  const cols = el.colW.length;
  const i = cell.r * cols + cell.c + d;
  commitEditor();
  if (i < 0) return openEditor(el, false, { r: 0, c: 0 });
  if (i >= el.rowH.length * cols) tableOp(el, 'addRow', el.rowH.length - 1);
  openEditor(el, false, { r: Math.floor(i / cols), c: i % cols });
}

// ---------- Bağlantı kartları ve web'den resim ----------
// Bağlantı kartı web sayfasının başlığını, açıklamasını ve alan adını gösterir; çift tıklayınca
// varsayılan tarayıcıda açılır. Başlık ana süreçte sayfadan okunur (geri alma adımı oluşturmaz).

function normalizeUrl(text) {
  let s = text.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  return URL_RE.test(s) ? s : null;
}

async function insertLink() {
  commitEditor();
  const input = await askText({ title: t('Bağlantı ekle'), placeholder: 'https://…', hint: t('Bir web adresini yapıştır; sayfanın başlığı karta yazılır.'), ok: t('Ekle') });
  if (input === null) return;
  const url = normalizeUrl(input);
  if (!url) return toast(t('Geçerli bir web adresi yaz'));
  addLinkCard(url, toWorld(innerWidth / 2, innerHeight / 2));
}

function addLinkCard(url, at) {
  const z = board.view.zoom;
  const w = LINK_SIZE.w / z, h = LINK_SIZE.h / z;
  const el = { id: newId(), type: 'link', x: at.x - w / 2, y: at.y - h / 2, w, h, url, title: '' };
  checkpoint();
  board.elements.push(el);
  setTool('select');
  selection = new Set([el.id]);
  changed();
  fetchLinkInfo(el);
}

async function fetchLinkInfo(el, manual = false) {
  if (el?.type !== 'link') return;
  const { id, url } = el;
  if (manual) toast(t('Sayfa bilgisi alınıyor…'));
  const r = await api.linkInfo(url);
  // Beklerken kart silinmiş ya da değişmiş olabilir: güncel nesne kimlikle bulunur.
  const cur = board.elements.find((e) => e.id === id);
  if (!cur || cur.url !== url) return;
  if (r?.error) {
    if (manual) toast(t('Sayfa bilgisi alınamadı: {hata}', { hata: r.error }));
    return;
  }
  if (manual) toast(t('Bağlantı kartı güncellendi'));
  if (cur.title === r.title && (cur.desc || '') === r.desc) return;
  cur.title = r.title;
  if (r.desc) cur.desc = r.desc;
  else delete cur.desc;
  sceneCacheValid = false;
  requestRender();
  updateProps();
  scheduleSave();
}

async function openLinkEl(el) {
  if (el?.type !== 'link') return;
  if (!(await api.openLink(el.url))) toast(t('Bağlantı açılamadı'));
}

// Bing Görseller'de arar; bulunan resim tarayıcıdan sürüklenir ya da kopyalanıp yapıştırılır.
async function searchWebImages() {
  commitEditor();
  const q = await askText({ title: t("Web'de resim ara"), placeholder: t('Ne arıyorsun?'), hint: t('Arama varsayılan tarayıcıda açılır.'), ok: t('Ara') });
  if (!q?.trim()) return;
  api.openLink('https://www.bing.com/images/search?q=' + encodeURIComponent(q.trim()));
  toast(t('Beğendiğin resmi tarayıcıdan tahtaya sürükle ya da sağ tık → Resmi kopyala, sonra Ctrl+V'), 7000);
}

function insertImageUrl(url, at) {
  toast(t('Resim indiriliyor…'));
  const name = url.length > 60 ? url.slice(0, 60) + '…' : url;
  return placeImages([{
    name,
    load: async () => {
      const r = await api.fetchImage(url);
      if (r?.error) throw new Error(r.error);
      return r.src;
    },
  }], at);
}

// ---------- Metin sorma penceresi ----------

const askDlg = $('#askDlg');
const askDialogOpen = () => !askDlg.classList.contains('hidden');
$('#askForm').addEventListener('submit', (e) => e.preventDefault());

// Tek satırlık metin sorar; onaylanırsa metni, vazgeçilirse null döndürür.
function askText({ title, placeholder = '', hint = '', ok = t('Tamam'), value = '' }) {
  const input = $('#askInput');
  $('#askTitle').textContent = title;
  $('#askHint').textContent = hint;
  $('#askOk').firstChild.textContent = ok + ' ';
  input.placeholder = placeholder;
  input.value = value;
  return new Promise((resolve) => {
    const finish = (res) => {
      askDlg.classList.add('hidden');
      $('#askForm').removeEventListener('submit', onSubmit);
      askDlg.removeEventListener('keydown', onKey);
      askDlg.removeEventListener('pointerdown', onBackdrop);
      $('#askCancel').removeEventListener('click', onCancel);
      resolve(res);
    };
    const onSubmit = () => finish(input.value);
    const onKey = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(null);
      }
    };
    const onBackdrop = (e) => { if (e.target === askDlg) finish(null); };
    const onCancel = () => finish(null);
    $('#askForm').addEventListener('submit', onSubmit);
    askDlg.addEventListener('keydown', onKey);
    askDlg.addEventListener('pointerdown', onBackdrop);
    $('#askCancel').addEventListener('click', onCancel);
    askDlg.classList.remove('hidden');
    input.focus();
    input.select();
  });
}

// ---------- Şablonlar ----------
// Hazır düzenler: çerçeveler ve başlıklar kilitli eklenir (notlar üzerlerinde rahatça taşınır),
// notlar ve tablolar serbesttir. Şablon ekranın ortasına konur ve gerekirse ekrana sığdırılır.

function tplFrame(x, y, w, h, color) {
  return { id: newId(), type: 'rect', x, y, w, h, color, width: 2, fill: 'soft', locked: true };
}

function tplText(x, y, text, size = 28, color = '#1f2328', extra = {}) {
  const el = { id: newId(), type: 'text', x, y, text, color, fontSize: size, bold: true, locked: true, ...extra };
  if (!el.locked) delete el.locked;
  return Object.assign(el, measureText(text, size, el));
}

function tplNote(x, y, color = NOTE_COLORS[0], w = 220, h = 140) {
  return { id: newId(), type: 'note', x, y, w, h, text: '', color, fontSize: 20 };
}

// Başlıklı sütunlar (Kanban, retrospektif); her sütunda notlar.
function tplColumns(cols, notes) {
  const W = 300, H = 720, gap = 32;
  return cols.flatMap(([title, color], i) => {
    const x = i * (W + gap);
    const out = [tplFrame(x, 0, W, H, color), tplText(x + 20, 18, title, 26, color)];
    for (let k = 0; k < notes; k++) out.push(tplNote(x + 40, 90 + k * 170, NOTE_COLORS[i % NOTE_COLORS.length]));
    return out;
  });
}

const TEMPLATES = [
  {
    id: 'kanban', name: t('Kanban'), desc: t('Yapılacak, yapılıyor, bitti sütunları'),
    preview: '<rect x="6" y="8" width="32" height="56" rx="3" fill="#1971c2" opacity=".15"/><rect x="44" y="8" width="32" height="56" rx="3" fill="#f08c00" opacity=".15"/><rect x="82" y="8" width="32" height="56" rx="3" fill="#2f9e44" opacity=".15"/><rect x="11" y="18" width="22" height="12" rx="2" fill="#fff3a3"/><rect x="11" y="34" width="22" height="12" rx="2" fill="#fff3a3"/><rect x="49" y="18" width="22" height="12" rx="2" fill="#ffd6e0"/><rect x="87" y="18" width="22" height="12" rx="2" fill="#c9f2d0"/>',
    build: () => tplColumns([[t('Yapılacak'), '#1971c2'], [t('Yapılıyor'), '#f08c00'], [t('Bitti'), '#2f9e44']], 2),
  },
  {
    id: 'retro', name: t('Retrospektif'), desc: t('İyi gidenler, geliştirilecekler, aksiyonlar'),
    preview: '<rect x="6" y="8" width="32" height="56" rx="3" fill="#2f9e44" opacity=".15"/><rect x="44" y="8" width="32" height="56" rx="3" fill="#e8590c" opacity=".15"/><rect x="82" y="8" width="32" height="56" rx="3" fill="#7048e8" opacity=".15"/><rect x="11" y="18" width="22" height="12" rx="2" fill="#fff3a3"/><rect x="49" y="18" width="22" height="12" rx="2" fill="#ffd6e0"/><rect x="87" y="18" width="22" height="12" rx="2" fill="#c9f2d0"/>',
    build: () => tplColumns([[t('İyi gidenler'), '#2f9e44'], [t('Geliştirilecekler'), '#e8590c'], [t('Aksiyonlar'), '#7048e8']], 2),
  },
  {
    id: 'swot', name: t('SWOT analizi'), desc: t('Güçlü ve zayıf yönler, fırsatlar, tehditler'),
    preview: '<rect x="14" y="6" width="45" height="29" rx="3" fill="#2f9e44" opacity=".2"/><rect x="61" y="6" width="45" height="29" rx="3" fill="#e03131" opacity=".2"/><rect x="14" y="37" width="45" height="29" rx="3" fill="#1971c2" opacity=".2"/><rect x="61" y="37" width="45" height="29" rx="3" fill="#f08c00" opacity=".2"/>',
    build: () => {
      const W = 440, H = 340, gap = 24;
      const parts = [[t('Güçlü yönler'), '#2f9e44'], [t('Zayıf yönler'), '#e03131'], [t('Fırsatlar'), '#1971c2'], [t('Tehditler'), '#f08c00']];
      return [
        tplText(0, -70, t('SWOT analizi'), 36),
        ...parts.flatMap(([title, color], i) => {
          const x = (i % 2) * (W + gap), y = Math.floor(i / 2) * (H + gap);
          return [tplFrame(x, y, W, H, color), tplText(x + 20, y + 18, title, 26, color)];
        }),
      ];
    },
  },
  {
    id: 'brainstorm', name: t('Beyin fırtınası'), desc: t('Ortada konu, çevresinde fikir notları'),
    preview: '<ellipse cx="60" cy="36" rx="18" ry="11" fill="#7048e8" opacity=".25"/><g stroke="#7048e8" stroke-width="1.2" opacity=".6"><path d="M42 33 24 18M78 33l18-15M42 39 24 54M78 39l18 15M60 25V12M60 47v13"/></g><rect x="10" y="10" width="16" height="12" rx="2" fill="#fff3a3"/><rect x="94" y="10" width="16" height="12" rx="2" fill="#ffd6e0"/><rect x="10" y="50" width="16" height="12" rx="2" fill="#c9f2d0"/><rect x="94" y="50" width="16" height="12" rx="2" fill="#cfe6ff"/>',
    build: () => {
      const center = { id: newId(), type: 'ellipse', x: -150, y: -85, w: 300, h: 170, color: '#7048e8', width: 3, fill: 'soft' };
      const label = tplText(0, 0, t('Ana fikir'), 32, '#7048e8', { locked: false, align: 'center' });
      label.x = -label.w / 2;
      label.y = -label.h / 2;
      const gid = newId();
      center.groupId = gid;
      label.groupId = gid;
      const out = [center, label];
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
        const nx = Math.cos(a) * 470, ny = Math.sin(a) * 300;
        out.push({ id: newId(), type: 'line', x1: Math.cos(a) * 160, y1: Math.sin(a) * 95, x2: nx * 0.78, y2: ny * 0.72, color: '#7048e8', width: 2 });
        out.push(tplNote(nx - 110, ny - 70, NOTE_COLORS[i % NOTE_COLORS.length]));
      }
      return out;
    },
  },
  {
    id: 'week', name: t('Haftalık plan'), desc: t('Günlere bölünmüş tablo'),
    preview: '<rect x="6" y="12" width="108" height="50" rx="2" fill="none" stroke="#1f2328" stroke-width="1.2" opacity=".6"/><rect x="6" y="12" width="108" height="9" fill="#1f2328" opacity=".12"/><path d="M21.4 12v50M36.9 12v50M52.3 12v50M67.7 12v50M83.1 12v50M98.6 12v50M6 21h108M6 41.5h108" stroke="#1f2328" stroke-width="1" opacity=".45"/>',
    build: () => {
      const days = [t('Pazartesi'), t('Salı'), t('Çarşamba'), t('Perşembe'), t('Cuma'), t('Cumartesi'), t('Pazar')];
      const cw = 170, head = TABLE_FONT * 1.25 + CELL_PAD * 2, rh = 150;
      const rowH = [head, rh, rh, rh];
      return [
        tplText(0, -70, t('Haftalık plan'), 36),
        {
          id: newId(), type: 'table', x: 0, y: 0, w: cw * 7, h: rowH.reduce((a, b) => a + b, 0),
          colW: Array(7).fill(cw), rowH, cells: [days, ...Array.from({ length: 3 }, () => Array(7).fill(''))],
          color: '#1f2328', fontSize: TABLE_FONT, header: true,
        },
      ];
    },
  },
  {
    id: 'notegrid', name: t('Not ızgarası'), desc: t('Düzenli dizilmiş boş yapışkan notlar'),
    preview: '<g fill="#fff3a3"><rect x="30" y="6" width="18" height="18" rx="2"/><rect x="51" y="6" width="18" height="18" rx="2"/><rect x="72" y="6" width="18" height="18" rx="2"/><rect x="30" y="27" width="18" height="18" rx="2"/><rect x="51" y="27" width="18" height="18" rx="2"/><rect x="72" y="27" width="18" height="18" rx="2"/><rect x="30" y="48" width="18" height="18" rx="2"/><rect x="51" y="48" width="18" height="18" rx="2"/><rect x="72" y="48" width="18" height="18" rx="2"/></g>',
    build: () => {
      const size = 200, gap = 24;
      const out = [tplText(0, -70, t('Fikirler'), 36)];
      for (let i = 0; i < 9; i++) out.push(tplNote((i % 3) * (size + gap), Math.floor(i / 3) * (size + gap), NOTE_COLORS[0], size, size));
      return out;
    },
  },
];

const templateDlg = $('#templateDlg');
const templateDialogOpen = () => !templateDlg.classList.contains('hidden');

$('#templateGrid').innerHTML = TEMPLATES.map((tp) =>
  `<button class="tpl-card" data-template="${tp.id}"><svg viewBox="0 0 120 72">${tp.preview}</svg><b>${escHtml(tp.name)}</b><span class="muted">${escHtml(tp.desc)}</span></button>`,
).join('');

function openTemplates() {
  commitEditor();
  templateDlg.classList.remove('hidden');
  templateDlg.querySelector('.tpl-card').focus();
}

function closeTemplates() {
  templateDlg.classList.add('hidden');
}

templateDlg.addEventListener('click', (e) => {
  if (e.target === templateDlg || e.target.closest('#tplClose')) return closeTemplates();
  const card = e.target.closest('[data-template]');
  if (!card) return;
  closeTemplates();
  insertTemplate(card.dataset.template);
});
templateDlg.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape') {
    e.preventDefault();
    closeTemplates();
  }
});

function insertTemplate(id) {
  const tp = TEMPLATES.find((x) => x.id === id);
  if (!tp) return;
  const els = tp.build();
  const b = unionBBox(els);
  const c = toWorld(innerWidth / 2, innerHeight / 2);
  for (const el of els) translate(el, c.x - (b.x + b.w / 2), c.y - (b.y + b.h / 2));
  checkpoint();
  board.elements.push(...els);
  setTool('select');
  selection.clear();
  // Şablon ekrana sığmıyorsa uzaklaşılır.
  const v = board.view;
  const pad = 90;
  const z = Math.min(v.zoom, (innerWidth - pad * 2) / b.w, (innerHeight - pad * 2) / b.h);
  if (z < v.zoom) {
    v.zoom = Math.max(MIN_ZOOM, z);
    v.x = innerWidth / 2 - c.x * v.zoom;
    v.y = innerHeight / 2 - c.y * v.zoom;
    sceneCacheValid = false;
    scheduleViewSave();
  }
  changed();
  toast(els.some((el) => el.locked)
    ? t('Şablon eklendi — çerçeve ve başlıklar kilitli; seçmek için çift tıkla, kilidi Ctrl+L ile aç')
    : t('Şablon eklendi'), 4500);
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
  } else if ('student' in b.dataset) {
    setStudentMode(!studentMode);
  } else if ('commentsToggle' in b.dataset) {
    setShowComments(!showComments);
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
  } else if (b.dataset.lang) {
    setLanguage(b.dataset.lang);
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

// Arayüz dili: metinler sayfa yüklenirken kurulduğu için dil değişince tahta kaydedilip sayfa yeniden yüklenir.
document.querySelectorAll('#langRow [data-lang]').forEach((b) => b.classList.toggle('selected', b.dataset.lang === lang));

async function setLanguage(next) {
  if (next === lang) return;
  commitEditor();
  // Vazgeçilirse yerel menüdeki seçim de eski dile döner.
  if (!(await leaveBoard())) return api.setLang(lang);
  await api.setLang(next);
  reloadingForLang = true;
  location.reload();
}

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
    `<label class="swatch custom${custom ? ' selected' : ''}" title="${t('Özel renk')}"><input type="color" id="bgCustomColor" value="${board.bgColor}" /></label>`;
  document.body.style.background = board.bgColor;
}

async function handleCommand(cmd) {
  commitEditor();
  if ((STUDENT_COMMANDS.includes(cmd) || STUDENT_TARGETS.includes(cmd)) && !studentOnly()) return;
  switch (cmd) {
    case 'new':
      if (!(await leaveBoard())) return;
      await api.newBoard();
      loadBoard(emptyBoard());
      zoomFit();
      closeGallery();
      toast(t('Yeni tahta oluşturuldu'));
      break;
    case 'open': {
      if (!(await leaveBoard())) return;
      const res = await api.open();
      if (res) {
        loadBoard(res.data);
        toast(t('Tahta açıldı'));
      }
      break;
    }
    case 'save':
      dirty = true;
      await saveNow();
      toast(t('Kaydedildi'));
      break;
    case 'saveAs': {
      const p = await api.saveAs(serialize());
      if (p) {
        dirty = false;
        setSaveState(t('Kaydedildi'));
        toast(t('Kaydedildi'));
      }
      break;
    }
    case 'exportPng':
      return exportPng();
    case 'exportPdf':
      return exportPages('pdf');
    case 'print':
      return exportPages('print');
    case 'unlockAll':
      return unlockAll();
    case 'coversHide':
      return setAllCovers(false);
    case 'coversShow':
      return setAllCovers(true);
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
      if (board.elements.length && confirm(t('Tahtadaki her şey silinsin mi? (Ctrl+Z ile geri alınabilir)'))) {
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
    case 'lang:tr':
    case 'lang:en':
      return setLanguage(cmd.slice(5));
    default:
      runAction(cmd);
  }
}

api.onMenu(handleCommand);
async function openBoardPath(p) {
  commitEditor();
  if (!(await leaveBoard())) return;
  const res = await api.openPath(p);
  if (res) {
    loadBoard(res.data);
    closeGallery();
    toast(t('Tahta açıldı'));
  }
}
api.onOpenPath(openBoardPath);

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
  toast(t('Tahta başka bir cihazda güncellenmiş; son hâli yüklendi'));
});
// ---------- Rehber (F1) ----------

const help = $('#help');
const helpSearch = $('#helpSearch');
const helpTabs = [...document.querySelectorAll('#helpNav [data-help-tab]')];
const helpSections = [...document.querySelectorAll('#helpContent [data-help-section]')];
const helpOpen = () => !help.classList.contains('hidden');

// Araç hedeflerinin rehberdeki adları (SHORTCUTS tablosunun tek eksiği bu etiketler).
const TOOL_LABELS = {
  select: t('Seç'), cut: t('Makas (parça kes / kopyala)'), pen: t('Kalem'), highlighter: t('Fosforlu kalem'), tempHighlighter: t('Geçici fosforlu kalem'), laser: t('Lazer işaretçi'),
  eraser: t('Silgi'), ruler: t('Cetveli aç / kapat'), protractor: t('Açıölçeri aç / kapat'), rect: t('Dikdörtgen'),
  ellipse: t('Elips'), line: t('Çizgi'), arrow: t('Ok'), compass: t('Pergel'), text: t('Metin'), note: t('Yapışkan not'),
  cover: t('Gizleme bandı'), image: t('Resim veya PDF ekle'), obsidian: t("Obsidian'dan ekle"), axes: t('Koordinat sistemi ekle'),
  sticker: t('Çıkartma (emoji)'), table: t('Tablo ekle'), template: t('Şablon ekle'), link: t('Bağlantı kartı ekle'),
};
// Menü hızlandırıcıları ve fare/klavye kombinasyonları (araç kısayolları dışındakiler).
const GENERAL_KEYS = [
  [['Ctrl+Z'], t('Geri al')], [['Ctrl+Y', 'Ctrl+Shift+Z'], t('Yinele')],
  [['Ctrl+C', 'Ctrl+X', 'Ctrl+V'], t('Kopyala / kes / yapıştır')], [['Ctrl+D'], t('Seçileni çoğalt')],
  [['Ctrl+Shift+M'], t('Seçili nesneye yorum ekle / yorumlarını aç')],
  [['Ctrl+F'], t('Tahtada ara (Enter: sonraki, Shift+Enter: önceki)')],
  [['Ctrl+A'], t('Tümünü seç (kilitliler hariç)')], [['Delete', 'Backspace'], t('Seçileni sil')],
  [['Ctrl+L'], t('Seçileni kilitle / kilidini aç')], [[t('Çift tık')], t('Kilitli nesneyi seç; bandı aç / kapat')],
  [['Ctrl+Shift+G'], t('Seçileni grupla / grubu çöz')], [['Ctrl', t('tıklama')], t('Gruptaki tek nesneyi seç')],
  [['Ctrl', t('sürükle')], t('Taşırken hizalama kılavuzlarına yapışma')],
  [['Ctrl+B', 'Ctrl+I', 'Ctrl+U'], t('Kalın / italik / altı çizili')],
  [['Tab', 'Shift+Tab'], t('Tabloda sonraki / önceki hücre (son hücrede Tab yeni satır ekler)')],
  [[t('Ok tuşları')], t('Seçileni 1 piksel kaydır (Shift ile 10)')], [['['], t('Arkaya gönder')], [[']'], t('Öne getir')],
  [['Esc'], t('Seçimi bırak, açık pencereyi kapat')], [['Shift', t('tıklama')], t('Seçime ekle / çıkar')],
  [[t('Boşluk'), t('sürükle')], t('Tahtayı kaydır')], [['Ctrl', t('tekerlek')], t('Yakınlaştır / uzaklaştır')],
  [['Shift', t('tekerlek')], t('Yatay kaydır')], [['Ctrl+=', 'Ctrl+-'], t('Yakınlaştır / uzaklaştır')],
  [['Ctrl+0'], t('%100 yakınlık')], [['Ctrl+1'], t('Tümünü ekrana sığdır')],
  [['Shift', 'Ctrl'], t('Kalemle çizerken basılı tut: dümdüz çizgi')],
  ...BRUSHES.slice(0, 10).map((b, i) => [[`Alt+${(i + 1) % 10}`], t('Fırça: {name}', { name: b.label })]),
  [['Shift'], t('Şekil çizerken: kare / daire, 15° adım')],
  [['Esc', 'Ctrl+Enter'], t('Metin / not yazmayı bitir')],
  [['Enter', 'Esc'], t('Resim kırparken: uygula / vazgeç')],
  [['Ctrl+G'], t('Tahtalarım')], [['Ctrl+N'], t('Yeni tahta')], [['Ctrl+O'], t('Aç')], [['Ctrl+S'], t('Kaydet')],
  [['Ctrl+Shift+S'], t('Farklı kaydet')], [['Ctrl+E'], t('PNG olarak dışa aktar')],
  [['Ctrl+Shift+E'], t('PDF olarak dışa aktar')], [['Ctrl+P'], t('Yazdır')],
  [['Shift'], t('Pergelde: merkezi kare köşesine, yarıçapı yarım karelere oturt')],
  [['F2'], t('Galeride seçili tahtayı yeniden adlandır')], [['F1'], t('Bu rehber')], [['F12'], t('Geliştirici araçları')],
];

const kbd = (k) => `<kbd>${k}</kbd>`;

// Düzenlenen kısayol yuvası: { target, slot } ya da null.
let capturing = null;

function buildHelpKeys() {
  $('#helpToolKeys').innerHTML = SHORTCUTS.filter((s) => studentMode || !STUDENT_TARGETS.includes(s.target)).map((s) => {
    const keys = SLOTS.filter((slot) => s[slot]).map((slot) => {
      const on = capturing && capturing.target === s.target && capturing.slot === slot;
      return `<button class="keychip${on ? ' capturing' : ''}" data-target="${s.target}" data-slot="${slot}" ` +
        `title="${t('Değiştirmek için tıkla')}">${on ? t('Tuşa bas…') : s[slot].toUpperCase()}</button>`;
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
        toast(t('"{tus}" tuşu "{arac}" aracındaydı; tuşlar yer değiştirdi', { tus: newKey.toUpperCase(), arac: TOOL_LABELS[o.target] }));
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
    toast(t('Bu tuş kısayol olarak kullanılamaz; tek bir harf, rakam ya da simge seç'));
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
  toast(t('Kısayollar varsayılana döndürüldü'));
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
  return galleryOpen() || modalOpen();
}

// Tahtanın üstündeki pencerelerden biri (Obsidian seçicisi, PDF, dışa aktarma, metin sorma, şablon) açık mı.
function modalOpen() {
  return obsidianPickerOpen() || pdfDialogOpen() || exportDialogOpen() || askDialogOpen() || templateDialogOpen();
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
    chip.title = v.path + (v.missing ? t(' (bulunamadı)') : '');
    const name = document.createElement('span');
    name.className = 'vname';
    name.textContent = v.name;
    chip.appendChild(name);
    if (!v.current) {
      const rm = document.createElement('button');
      rm.className = 'vremove';
      rm.dataset.gcmd = 'removeVault';
      rm.title = t('Listeden kaldır (dosyalar silinmez)');
      rm.textContent = '×';
      chip.appendChild(rm);
    }
    list.appendChild(chip);
  }
}

function relativeTime(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return t('az önce');
  if (s < 3600) return t('{n} dakika önce', { n: Math.floor(s / 60) });
  if (s < 86400) return t('{n} saat önce', { n: Math.floor(s / 3600) });
  if (s < 86400 * 7) return t('{n} gün önce', { n: Math.floor(s / 86400) });
  return new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
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
  add.innerHTML = '<div class="gthumb"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></div><div class="gname">' + t('Yeni tahta') + '</div>';
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
      thumb.innerHTML = `<span class="muted">${t('Önizleme yok')}</span>`;
    }
    const name = document.createElement('div');
    name.className = 'gname';
    name.textContent = b.name;
    name.title = b.name;
    const meta = document.createElement('div');
    meta.className = 'gmeta';
    meta.textContent = (b.path === galleryData.current ? t('Açık · ') : '') + relativeTime(b.mtime);
    const actions = document.createElement('div');
    actions.className = 'gactions';
    actions.innerHTML = `<button class="tool" data-gcmd="rename" title="${t('Yeniden adlandır')}">${ICON_RENAME}</button>` +
      `<button class="tool" data-gcmd="delete" title="${t('Sil')}">${ICON_DELETE}</button>`;
    card.append(thumb, actions, name, meta);
    galleryGrid.appendChild(card);
  }

  if (!list.length && q) {
    const empty = document.createElement('p');
    empty.className = 'muted gempty';
    empty.textContent = t('Aramaya uyan tahta yok.');
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
  if (!confirm(t('"{ad}" silinsin mi?', { ad: name }))) return;
  if (autoSave) await saveNow();
  const res = await api.deleteBoard(card.dataset.path);
  if (res.deleted && res.wasCurrent) {
    loadBoard(emptyBoard());
    zoomFit();
  }
  if (res.deleted) toast(t('Tahta silindi'));
  refreshGallery();
}

// Vault'a geçince oradaki tahta açılır; galeri açıksa açık kalır ki yeni vault'un tahtaları görülsün.
function vaultOpened(res, message = t('Vault açıldı')) {
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
  vaultOpened(await api.createVault(), t('Yeni vault oluşturuldu'));
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
  if (!b) return toast(t('Dışa aktarılacak bir şey yok'));
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
  if (p) toast(t('Resim kaydedildi'));
}

// ---------- PDF olarak dışa aktarma ve yazdırma ----------
// Tahta A4 sayfalara bölünüp her sayfa resim olarak çizilir; ana süreç bunları gizli bir
// pencerede PDF'e çevirir (printToPDF) ya da yazdırma penceresini açar.

const PAGE_A4 = { w: 794, h: 1123 }; // CSS pikseli (96 dpi)
const PAGE_MARGIN = 36;
const PAGE_RES = 2; // sayfa resimleri ~190 dpi
const MAX_PAGE_SCALE = 2; // küçük çizimler sayfaya sığdırılırken en fazla bu kadar büyütülür

function pageGeometry(els, opts) {
  const land = opts.orient === 'landscape';
  const pw = land ? PAGE_A4.h : PAGE_A4.w;
  const ph = land ? PAGE_A4.w : PAGE_A4.h;
  const aw = pw - PAGE_MARGIN * 2;
  const ah = ph - PAGE_MARGIN * 2;
  const b = unionBBox(els);
  if (opts.fit === 'page') {
    const s = Math.min(aw / b.w, ah / b.h, MAX_PAGE_SCALE);
    return { pw, ph, aw, ah, b, s, slices: [[b.y, b.y + b.h]] };
  }
  const s = Math.min(aw / b.w, MAX_PAGE_SCALE);
  return { pw, ph, aw, ah, b, s, slices: pageSlices(els, b, ah / s) };
}

// Sayfa sınırlarını mümkünse hiçbir nesneyi kesmeyen bir yükseklikte seçer (ör. PDF sayfaları
// arasındaki boşluk); sayfanın son %65'inde böyle bir yer yoksa tam sayfa boyunda keser.
function pageSlices(els, b, sliceH) {
  const boxes = els.map(bbox);
  const crosses = (y) => boxes.some((r) => r.y < y - 0.01 && r.y + r.h > y + 0.01);
  const out = [];
  const end = b.y + b.h;
  let y = b.y;
  while (y < end - 0.5 && out.length < 500) {
    let cut = Math.min(end, y + sliceH);
    if (cut < end && crosses(cut)) {
      const lo = y + sliceH * 0.35;
      const candidates = boxes.flatMap((r) => [r.y, r.y + r.h]).filter((c) => c >= lo && c < cut).sort((p, q) => q - p);
      const free = candidates.find((c) => !crosses(c));
      if (free !== undefined) {
        // Boşluğun ortasından kesilir; komşu nesnenin kenarı sayfanın dibine taşmasın.
        const above = Math.max(lo, ...boxes.map((r) => r.y + r.h).filter((v) => v <= free + 0.01));
        const below = Math.min(cut, ...boxes.map((r) => r.y).filter((v) => v >= free - 0.01));
        cut = (above + below) / 2;
      }
    }
    out.push([y, cut]);
    y = cut;
  }
  return out;
}

function renderPages(els, opts) {
  const g = pageGeometry(els, opts);
  const { pw, ph, aw, ah, b, s } = g;
  return g.slices.map(([y0, y1]) => {
    const c = document.createElement('canvas');
    c.width = Math.round(pw * PAGE_RES);
    c.height = Math.round(ph * PAGE_RES);
    const cx = c.getContext('2d');
    const contentH = (y1 - y0) * s;
    const ox = PAGE_MARGIN + (aw - b.w * s) / 2;
    const oy = PAGE_MARGIN + (opts.fit === 'page' ? (ah - contentH) / 2 : 0);
    const view = { x: (ox - b.x * s) * PAGE_RES, y: (oy - y0 * s) * PAGE_RES, zoom: s * PAGE_RES };
    if (opts.bg) drawBackground(cx, view, c.width, c.height, board.background, board.bgColor);
    else {
      cx.fillStyle = '#ffffff';
      cx.fillRect(0, 0, c.width, c.height);
    }
    // Sayfaya düşen dilimin dışı kesilir; kenar boşlukları temiz kalır.
    cx.beginPath();
    cx.rect(PAGE_MARGIN * PAGE_RES, oy * PAGE_RES, aw * PAGE_RES, Math.ceil(contentH * PAGE_RES));
    cx.clip();
    cx.setTransform(view.zoom, 0, 0, view.zoom, view.x, view.y);
    const slice = { x: b.x, y: y0, w: b.w, h: y1 - y0 };
    for (const el of els) if (rectsIntersect(bbox(el), slice)) drawElement(cx, el);
    return c.toDataURL('image/jpeg', 0.9);
  });
}

const exportDlg = $('#exportDlg');
const exportDialogOpen = () => !exportDlg.classList.contains('hidden');
// Form hiçbir zaman gerçekten gönderilmez (gönderilirse sayfa yeniden yüklenirdi).
$('#exportForm').addEventListener('submit', (e) => e.preventDefault());

// Seçenek penceresini gösterir; onaylanırsa { scope, orient, fit, bg } döner, vazgeçilirse null.
function askExportOptions(mode) {
  const form = $('#exportForm');
  const hasSel = selection.size > 0;
  $('#exportTitle').textContent = mode === 'print' ? t('Yazdır') : t('PDF olarak dışa aktar');
  $('#exportOk').firstChild.textContent = (mode === 'print' ? t('Yazdır…') : t('Kaydet…')) + ' ';
  $('#exScopeSel').classList.toggle('hidden', !hasSel);
  form.exScope.value = hasSel ? 'selection' : 'all';
  form.exOrient.value = exportOpts.orient;
  form.exFit.value = exportOpts.fit;
  $('#exBg').checked = exportOpts.bg;
  const read = () => ({ scope: form.exScope.value, orient: form.exOrient.value, fit: form.exFit.value, bg: $('#exBg').checked });
  const update = () => {
    const o = read();
    const els = o.scope === 'selection' ? selectedEls() : board.elements;
    const n = pageGeometry(els, o).slices.length;
    $('#exSummary').textContent = t('{n} sayfa', { n });
  };

  return new Promise((resolve) => {
    const finish = (res) => {
      exportDlg.classList.add('hidden');
      form.removeEventListener('change', update);
      form.removeEventListener('submit', onSubmit);
      exportDlg.removeEventListener('keydown', onKey);
      exportDlg.removeEventListener('pointerdown', onBackdrop);
      $('#exCancel').removeEventListener('click', onCancel);
      resolve(res);
    };
    const onSubmit = (e) => {
      e.preventDefault();
      const o = read();
      exportOpts = { orient: o.orient, fit: o.fit, bg: o.bg };
      savePrefs();
      finish(o);
    };
    const onKey = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(null);
      }
    };
    const onBackdrop = (e) => { if (e.target === exportDlg) finish(null); };
    const onCancel = () => finish(null);
    form.addEventListener('change', update);
    form.addEventListener('submit', onSubmit);
    exportDlg.addEventListener('keydown', onKey);
    exportDlg.addEventListener('pointerdown', onBackdrop);
    $('#exCancel').addEventListener('click', onCancel);
    exportDlg.classList.remove('hidden');
    update();
    $('#exportOk').focus();
  });
}

async function exportPages(mode) {
  if (!board.elements.length) return toast(t('Dışa aktarılacak bir şey yok'));
  hideMenu();
  const o = await askExportOptions(mode);
  if (!o) return;
  const els = o.scope === 'selection' ? selectedEls() : board.elements;
  toast(t('Sayfalar hazırlanıyor…'));
  // Toast'un görünmesi için çizime bir kare izin verilir.
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
  const pages = renderPages(els, o);
  const landscape = o.orient === 'landscape';
  if (mode === 'print') {
    const res = await api.printPages(pages, landscape);
    if (res?.error) toast(t('Yazdırılamadı: {hata}', { hata: res.error }));
    else if (res) toast(t('Yazıcıya gönderildi'));
    else toast(t('Yazdırma iptal edildi'));
  } else {
    const res = await api.exportPdf(pages, landscape);
    if (res?.error) toast(t('PDF oluşturulamadı: {hata}', { hata: res.error }));
    else if (res) toast(`PDF kaydedildi (${pages.length} sayfa)`);
  }
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
      const cx = c.getContext('2d');
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(img, 0, 0, w, h);
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
  if (!parts.length) return { error: t('Sayfa numarası yaz') };
  for (const part of parts) {
    const m = /^(\d+)?(?:\s*[-–]\s*(\d+)?)?$/.exec(part);
    if (!m || (!m[1] && !m[2])) return { error: t('Anlaşılmadı: "{x}"', { x: part }) };
    const isRange = part.includes('-') || part.includes('–');
    const a = m[1] ? +m[1] : 1;
    const b = isRange ? (m[2] ? +m[2] : max) : a;
    if (a < 1 || b < 1 || a > max || b > max) return { error: t('PDF {n} sayfa; "{x}" dışarıda kalıyor', { n: max, x: part }) };
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
  $('#pdfLock').checked = pdfLock;

  const pick = () => {
    const mode = form.pdfMode.value;
    if (mode === 'all') return { pages: Array.from({ length: count }, (_, i) => i + 1) };
    if (mode === 'range') return parsePageRanges(range.value, count);
    const s = Math.floor(+from.value);
    const n = Math.floor(+take.value);
    if (!(s >= 1 && s <= count)) return { error: t('Başlangıç 1 ile {n} arasında olmalı', { n: count }), field: from };
    if (!(n >= 1)) return { error: t('Sayfa sayısı en az 1 olmalı'), field: take };
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
      const which = p.length === 1 ? t('{n}. sayfa', { n: p[0] }) : t('{n} sayfa', { n: p.length }) + ` (${describePages(p)})`;
      summary.textContent = t('{x} eklenecek', { x: which }) + (r.clipped ? t(' — PDF burada bitiyor') : '') +
        (p.length > 30 ? t('. Biraz sürebilir.') : '');
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
      if (r.error) return;
      if (studentMode) pdfLock = $('#pdfLock').checked;
      savePrefs();
      finish(r.pages);
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
    return toast(t('PDF açılamadı: {ad}', { ad: file.name }));
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
    created.push({
      id: newId(), type: 'image', src: c.toDataURL('image/jpeg', 0.9), x: center.x - w / 2, y, w, h,
      ...(studentMode && pdfLock ? { locked: true } : {}),
    });
    y += h + 24 / z;
    page.cleanup();
  }
  doc.destroy();
  checkpoint();
  board.elements.push(...created);
  // Kilitli sayfalar seçilmez: üzerine hemen yazılabilir, Seç aracıyla kement de kaydırmaz.
  if (studentMode && pdfLock) {
    changed();
    return toast(t('{n} sayfa eklendi ve kilitlendi — taşımak için çift tıklayıp kilidini aç (Ctrl+L)', { n: count }));
  }
  setTool('select');
  selection = new Set(created.map((el) => el.id));
  changed();
  toast(t('{n} sayfa eklendi', { n: count }));
}

async function insertImageFiles(files, at) {
  for (const f of [...files].filter(isPdf)) await insertPdf(f, at);
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  await placeImages(list.map((f) => ({ name: f.name, load: () => readAsDataURL(f) })), at);
}

// list: [{ name, load: () => Promise<data URL> }]; resimler alt alta hafif kaydırılarak eklenir.
async function placeImages(list, at) {
  if (!list.length) return;
  const z = board.view.zoom;
  const center = at || (pointer ? toWorld(pointer.x, pointer.y) : toWorld(innerWidth / 2, innerHeight / 2));
  const created = [];
  let offset = 0;
  for (const f of list) {
    try {
      const { src, w, h } = await prepareImage(await f.load());
      const k = Math.min(1 / z, (innerWidth * 0.5) / z / w, (innerHeight * 0.5) / z / h);
      created.push({
        id: newId(), type: 'image', src,
        x: center.x - (w * k) / 2 + offset, y: center.y - (h * k) / 2 + offset, w: w * k, h: h * k,
      });
      offset += 24 / z;
    } catch {
      toast(t('Resim açılamadı: {ad}', { ad: f.name }));
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
  if (!list.length) return toast(t("Tahtada Obsidian'dan eklenmiş bölüm yok"));
  toast(list.length > 1 ? t('{n} bölüm yenileniyor…', { n: list.length }) : t('Yenileniyor…'));
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
  else if (updated) toast(updated > 1 ? t('{n} bölüm güncellendi', { n: updated }) : t('Bölüm güncellendi'));
  else toast(t('Bölümler zaten güncel'));
}

async function openInObsidian(el) {
  if (!el?.obsidian) return;
  const ok = await api.obsidianOpen(el.obsidian);
  if (!ok) toast(t('Not bulunamadı; vault bağlı olmayabilir'));
}

$('#imageInput').addEventListener('change', (e) => {
  insertImageFiles(e.target.files, toWorld(innerWidth / 2, innerHeight / 2));
  e.target.value = '';
});

// Electron'un bırakılan dosyaya "gitmesini" engelle.
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  // Masaüstünden sürüklenen .tahta dosyası: tahtayı aç (galeri açıkken de çalışır)
  const boardFile = [...(e.dataTransfer?.files || [])].find((f) => /\.tahta$/i.test(f.name));
  if (boardFile && !modalOpen()) {
    const p = api.pathForFile(boardFile);
    if (p) openBoardPath(p);
    return;
  }
  if (overlayOpen()) return;
  const at = toWorld(e.clientX, e.clientY);
  if (e.dataTransfer?.files.length) return insertImageFiles(e.dataTransfer.files, at);
  // Tarayıcıdan sürüklenen resim ya da bağlantı: resim indirilir, sayfa bağlantısı kart olur.
  const html = e.dataTransfer?.getData('text/html') || '';
  const img = /<img[^>]+src="(https?:[^"]+)"/i.exec(html)?.[1];
  const uri = (e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain') || '').split(/\r?\n/)[0].trim();
  if (img) insertImageUrl(img.replace(/&amp;/g, '&'), at);
  else if (URL_RE.test(uri)) {
    if (IMAGE_URL_RE.test(uri)) insertImageUrl(uri, at);
    else addLinkCard(uri, at);
  }
});

// ---------- Pano (kopyala / yapıştır) ----------

document.addEventListener('copy', (e) => {
  if (editing || isTyping(e) || !selection.size || overlayOpen()) return;
  const sel = selectedEls();
  // Kopya yorumsuzdur; kes-yapıştır ise nesneyi yorumlarıyla taşır.
  e.clipboardData.setData(CLIP_MIME, JSON.stringify(sel.map(withoutComments)));
  e.clipboardData.setData('text/plain', sel.map(ownText).filter(Boolean).join('\n\n'));
  e.preventDefault();
});

document.addEventListener('cut', (e) => {
  if (editing || isTyping(e) || !selection.size || overlayOpen()) return;
  const sel = selectedEls();
  e.clipboardData.setData(CLIP_MIME, JSON.stringify(sel));
  e.preventDefault();
  deleteSelection();
});

document.addEventListener('paste', (e) => {
  if (editing || isTyping(e) || overlayOpen()) return;
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
  // Tek başına bir web adresi: resim adresiyse resim, değilse bağlantı kartı.
  if (URL_RE.test(text)) return IMAGE_URL_RE.test(text) ? insertImageUrl(text, at) : addLinkCard(text, at);
  if (text) {
    checkpoint();
    const fs = styles.text.fontSize;
    const fmt = fmtOf(styles.text);
    const el = { id: newId(), type: 'text', x: at.x, y: at.y, text, color: styles.text.color, fontSize: fs, ...fmt, ...measureText(text, fs, fmt) };
    board.elements.push(el);
    setTool('select');
    selection = new Set([el.id]);
    changed();
  }
});

// ---------- Klavye ----------

let nudgeTime = 0;

function isTyping(e) {
  const t = e.target;
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

window.addEventListener('keydown', (e) => {
  if (e.target === editor || modalOpen()) return;
  // Paneldeki yazı kutusuna (ör. fonksiyon) yazılan harfler araç seçmesin, Delete nesne silmesin.
  if (isTyping(e) && !galleryOpen() && !helpOpen()) return;
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

  // Kırpma sürerken yalnızca Enter (uygula) ve Esc (vazgeç) çalışır; Delete resmi silmesin.
  if (crop) {
    if (e.key === 'Enter') applyCrop();
    else if (e.key === 'Escape') cancelCrop();
    if (!['Shift', 'Control', 'Alt'].includes(e.key) && !((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase()))) {
      e.preventDefault();
      return;
    }
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
    if (k === 'f') { e.preventDefault(); openSearch(); }
    else if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    else if (k === 'a') {
      e.preventDefault();
      setTool('select');
      selection = new Set(board.elements.filter((el) => !el.locked).map((el) => el.id));
      updateProps();
      requestRender();
    } else if (k === 'd') { e.preventDefault(); duplicateSelection(); }
    else if (k === 'g' && e.shiftKey) { e.preventDefault(); toggleGroup(); }
    else if ((k === 'b' || k === 'i' || k === 'u') && !e.shiftKey && selectionIsEditable()) {
      e.preventDefault();
      toggleFmt({ b: 'bold', i: 'italic', u: 'underline' }[k]);
    }
    else if (k === 'm' && e.shiftKey) { e.preventDefault(); commentOnSelection(); }
    else if (k === 'l') { e.preventDefault(); if (studentMode || selectedEls().some((el) => el.locked)) toggleLock(); }
    else if ((k === 'c' || k === 'x') && selection.size) {
      // Seçili metin olmasa da "copy" olayının tetiklenmesini garanti eder.
      e.preventDefault();
      document.execCommand(k === 'c' ? 'copy' : 'cut');
    }
    return;
  }

  const brushDigit = e.altKey && /^(?:Digit|Numpad)(\d)$/.exec(e.code);
  if (brushDigit) {
    e.preventDefault();
    pickBrush(BRUSHES[(Number(brushDigit[1]) + 9) % 10]);
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteSelection();
  } else if (e.key === 'Escape') {
    if (commentFor) return closeComments();
    selection.clear();
    if (activeTool() === 'compass') compass = null;
    closeFlyout();
    hideMenu();
    updateProps();
    requestRender();
  } else if (e.key.startsWith('Arrow') && selectedEls().some((el) => !el.locked)) {
    e.preventDefault();
    const step = (e.shiftKey ? 10 : 1) / board.view.zoom;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (Date.now() - nudgeTime > 600) checkpoint();
    nudgeTime = Date.now();
    for (const el of selectedEls()) if (!el.locked) translate(el, d[0], d[1]);
    changed();
  } else if (e.key === ']') arrange('front');
  else if (e.key === '[') arrange('back');
  else if (!e.altKey && KEYMAP.has(k) && (studentMode || !STUDENT_TARGETS.includes(KEYMAP.get(k)))) {
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
  updateCommentsToggleUI();
  applyStudentMode();
  const res = await api.loadInitial();
  if (res.data) loadBoard(res.data);
  else {
    loadBoard(emptyBoard());
    zoomFit();
  }
  // Uygulama "Tahtalarım" ile açılır; son tahta arkada yüklü kalır (Esc onu gösterir).
  // Bir .tahta dosyasına çift tıklanarak açıldıysa doğrudan o tahta gösterilir.
  if (!res.fromArgv) openGallery();
}

init();
