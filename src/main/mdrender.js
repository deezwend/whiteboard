// Obsidian notundan alınan bölümü HTML'e çevirir ve gizli (offscreen) bir pencerede resme dönüştürür.
// Resim tahtaya normal "image" öğesi olarak eklenir; böylece yakınlaştırma, dışa aktarma ve
// geri al/yinele hiçbir değişiklik gerekmeden çalışır.
const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const MarkdownIt = require('markdown-it');
const katex = require('katex');
const obs = require('./obsidian');

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;
const MAX_EMBED_DEPTH = 3;
const SCALE = 2; // resim, ekrandaki boyutun iki katı çözünürlükte üretilir
const MAX_PIXEL_H = 16000; // tuvalin güvenle çizebileceği en uzun resim
const MIN_WIDTH = 320;
const MAX_WIDTH = 1200;

// ---------- Markdown → HTML ----------

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function tex(src, display) {
  try {
    return katex.renderToString(src, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'html', trust: false });
  } catch {
    return `<code class="math-error">${esc(src)}</code>`;
  }
}

function fileUrl(p) {
  return pathToFileURL(p).href;
}

// Obsidian callout türleri ve renkleri (Obsidian'ın varsayılan temasındaki gibi).
const CALLOUT_COLORS = {
  note: '8, 109, 221', info: '8, 109, 221', todo: '8, 109, 221',
  abstract: '0, 191, 188', summary: '0, 191, 188', tldr: '0, 191, 188',
  tip: '0, 191, 188', hint: '0, 191, 188', important: '0, 191, 188',
  success: '8, 185, 78', check: '8, 185, 78', done: '8, 185, 78',
  question: '236, 117, 0', help: '236, 117, 0', faq: '236, 117, 0',
  warning: '236, 117, 0', caution: '236, 117, 0', attention: '236, 117, 0',
  failure: '233, 49, 71', fail: '233, 49, 71', missing: '233, 49, 71',
  danger: '233, 49, 71', error: '233, 49, 71', bug: '233, 49, 71',
  example: '120, 82, 238', quote: '158, 158, 158', cite: '158, 158, 158',
};

// Satır içi $…$ ve $$…$$ formülleri. Açılıştan sonra / kapanıştan önce boşluk olamaz,
// kapanıştan sonra rakam gelemez ("$5 ile $10" formül sayılmaz).
function mathInline(state, silent) {
  const src = state.src;
  const pos = state.pos;
  if (src.charCodeAt(pos) !== 0x24) return false;
  const display = src.charCodeAt(pos + 1) === 0x24;
  const mark = display ? '$$' : '$';
  const start = pos + mark.length;
  if (!display && (start >= state.posMax || /\s/.test(src[start]))) return false;
  let end = start;
  for (;;) {
    end = src.indexOf(mark, end);
    if (end === -1 || end >= state.posMax) return false;
    if (src[end - 1] === '\\' || (!display && (/\s/.test(src[end - 1]) || /\d/.test(src[end + 1] || '')))) {
      end++;
      continue;
    }
    break;
  }
  if (end === start) return false;
  if (!silent) {
    const t = state.push('math_inline', 'math', 0);
    t.content = src.slice(start, end);
    t.markup = mark;
  }
  state.pos = end + mark.length;
  return true;
}

// $$ ile başlayan satırdan kapanış $$'a kadar blok formül.
function mathBlock(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (state.src.slice(pos, pos + 2) !== '$$') return false;
  const first = state.src.slice(pos + 2, max);
  let content;
  let next = startLine;
  const close = first.indexOf('$$');
  if (close !== -1) {
    content = first.slice(0, close);
  } else {
    let found = false;
    for (next = startLine + 1; next < endLine; next++) {
      pos = state.bMarks[next] + state.tShift[next];
      max = state.eMarks[next];
      if (pos < max && state.sCount[next] < state.blkIndent) break;
      const line = state.src.slice(pos, max);
      const idx = line.indexOf('$$');
      if (idx !== -1) {
        const middle = state.getLines(startLine + 1, next, state.blkIndent, true);
        content = first + '\n' + middle + line.slice(0, idx);
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  if (silent) return true;
  const t = state.push('math_block', 'math', 0);
  t.block = true;
  t.content = content;
  t.map = [startLine, next + 1];
  state.line = next + 1;
  return true;
}

// [[hedef#alt|takma ad]] ve ![[gömme]]
function wikiLink(state, silent) {
  const src = state.src;
  let pos = state.pos;
  let embed = false;
  if (src.charCodeAt(pos) === 0x21) {
    embed = true;
    pos++;
  }
  if (!src.startsWith('[[', pos)) return false;
  const end = src.indexOf(']]', pos + 2);
  if (end === -1 || end > state.posMax) return false;
  const inner = src.slice(pos + 2, end);
  if (!inner.trim() || inner.includes('\n') || inner.includes('[[')) return false;
  if (!silent) {
    const t = state.push(embed ? 'wiki_embed' : 'wiki_link', '', 0);
    t.content = inner.replace(/\\\|/g, '|'); // tablo içinde kaçışlı | kullanılır
  }
  state.pos = end + 2;
  return true;
}

function parseWiki(inner) {
  const bar = inner.indexOf('|');
  const alias = bar === -1 ? '' : inner.slice(bar + 1).trim();
  const link = bar === -1 ? inner : inner.slice(0, bar);
  const hash = link.indexOf('#');
  return {
    target: (hash === -1 ? link : link.slice(0, hash)).trim(),
    sub: hash === -1 ? '' : link.slice(hash + 1).trim(),
    alias,
  };
}

// ==vurgu==
function highlight(state, silent) {
  const src = state.src;
  if (!src.startsWith('==', state.pos)) return false;
  const start = state.pos + 2;
  const end = src.indexOf('==', start);
  if (end === -1 || end <= start || end > state.posMax) return false;
  if (/\s/.test(src[start]) || /\s/.test(src[end - 1])) return false;
  if (!silent) {
    state.push('mark_open', 'mark', 1);
    const oldMax = state.posMax;
    state.pos = start;
    state.posMax = end;
    state.md.inline.tokenize(state);
    state.posMax = oldMax;
    state.push('mark_close', 'mark', -1);
  }
  state.pos = end + 2;
  return true;
}

// #etiket (önünde boşluk ya da satır başı olmalı, yalnızca rakamdan oluşamaz)
const TAG_RE = /^#([\p{L}\p{N}_\-/]+)/u;
function tag(state, silent) {
  const src = state.src;
  const pos = state.pos;
  if (src.charCodeAt(pos) !== 0x23) return false;
  if (pos > 0 && !/\s/.test(src[pos - 1])) return false;
  const m = TAG_RE.exec(src.slice(pos, state.posMax));
  if (!m || /^\d+$/.test(m[1])) return false;
  if (!silent) {
    const t = state.push('tag', '', 0);
    t.content = m[1];
  }
  state.pos += m[0].length;
  return true;
}

// > [!tür] Başlık  →  renkli callout kutusu
function callouts(state) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'blockquote_open') continue;
    const p = tokens[i + 1];
    const inl = tokens[i + 2];
    if (!p || p.type !== 'paragraph_open' || !inl || inl.type !== 'inline') continue;
    const m = /^\[!([^\]\s]+)\]([+-]?)[ \t]*(.*)(?:\n|$)/.exec(inl.content);
    if (!m) continue;
    const type = m[1].toLowerCase().replace(/[^a-z0-9-]/g, '');
    const color = CALLOUT_COLORS[type] || CALLOUT_COLORS.note;
    // [!tür]- katlanmış: Obsidian'daki gibi yalnızca başlık görünür (ör. "Cevaplar" gizli kalır).
    const fold = m[2];
    tokens[i].attrSet('class', `callout callout-${type}${fold === '-' ? ' collapsed' : ''}`);
    tokens[i].attrSet('style', `--cc: ${color}`);
    const title = new state.Token('html_block', '', 0);
    const titleText = m[3] || type.charAt(0).toUpperCase() + type.slice(1);
    const arrow = fold ? `<span class="fold">${fold === '-' ? '▸' : '▾'}</span>` : '';
    title.content = `<div class="callout-title">${state.md.renderInline(titleText, state.env)}${arrow}</div>\n`;
    const rest = inl.content.slice(m[0].length);
    if (rest.trim()) {
      inl.content = rest;
      tokens.splice(i + 1, 0, title);
    } else {
      tokens.splice(i + 1, 3, title); // yalnızca başlık satırı varsa boş paragrafı at
    }
  }
}

// - [ ] / - [x] görev listeleri ve yalnızca bir gömmeden oluşan paragraflar.
function afterInline(state) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'inline' || !t.children || !t.children.length) continue;
    const first = t.children[0];
    if (i >= 2 && tokens[i - 1].type === 'paragraph_open' && tokens[i - 2].type === 'list_item_open' && first.type === 'text') {
      const m = /^\[([ xX/\-])\][ \t]+/.exec(first.content);
      if (m) {
        const done = m[1] !== ' ';
        first.content = first.content.slice(m[0].length);
        const box = new state.Token('html_inline', '', 0);
        box.content = `<span class="cb${done ? ' on' : ''}"></span>`;
        t.children.unshift(box);
        tokens[i - 2].attrSet('class', done ? 'task done' : 'task');
      }
    }
    // Tek başına duran ![[not]] gömmesi <p> içine konmaz (içinde başlıklar, tablolar olabilir).
    const real = t.children.filter((c) => !(c.type === 'text' && !c.content.trim()) && c.type !== 'softbreak');
    if (real.length === 1 && real[0].type === 'wiki_embed' && tokens[i - 1]?.type === 'paragraph_open') {
      tokens[i - 1].hidden = true;
      if (tokens[i + 1]?.type === 'paragraph_close') tokens[i + 1].hidden = true;
    }
  }
}

const mdi = new MarkdownIt({ html: true, linkify: true, breaks: true });
mdi.inline.ruler.after('escape', 'math_inline', mathInline);
mdi.inline.ruler.before('link', 'wikilink', wikiLink);
mdi.inline.ruler.before('emphasis', 'highlight', highlight);
mdi.inline.ruler.push('tag', tag);
mdi.block.ruler.after('blockquote', 'math_block', mathBlock, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
mdi.core.ruler.after('block', 'callouts', callouts);
mdi.core.ruler.after('inline', 'after_inline', afterInline);

mdi.renderer.rules.math_inline = (tokens, i) => tex(tokens[i].content, tokens[i].markup === '$$');
mdi.renderer.rules.math_block = (tokens, i) => `<div class="math-block">${tex(tokens[i].content, true)}</div>\n`;
mdi.renderer.rules.tag = (tokens, i) => `<span class="tag">#${esc(tokens[i].content)}</span>`;
mdi.renderer.rules.wiki_link = (tokens, i) => {
  const { target, sub, alias } = parseWiki(tokens[i].content);
  const shown = alias || [target, sub.replace(/^\^/, '').split('#').filter(Boolean).join(' › ')].filter(Boolean).join(' › ');
  return `<span class="wikilink">${esc(shown)}</span>`;
};
mdi.renderer.rules.wiki_embed = (tokens, i, _opts, env) => renderEmbed(parseWiki(tokens[i].content), env);

// Markdown resimleri: göreli yollar notun klasörüne, sonra vault köküne göre çözülür.
const defaultImage = mdi.renderer.rules.image;
mdi.renderer.rules.image = (tokens, i, opts, env, self) => {
  const t = tokens[i];
  const src = t.attrGet('src') || '';
  if (!/^(https?:|data:)/i.test(src)) {
    let target = src;
    try { target = decodeURI(src); } catch { /* olduğu gibi kullan */ }
    const abs = resolveFile(env, target);
    if (abs) t.attrSet('src', fileUrl(abs));
  }
  // ![açıklama|300](resim.png) Obsidian'da genişlik verir.
  const m = /\|(\d+)(?:x(\d+))?$/.exec(t.content);
  if (m) {
    t.attrSet('style', `width: ${m[1]}px` + (m[2] ? `; height: ${m[2]}px` : ''));
    t.children = t.children.length ? [Object.assign(t.children[0], { content: t.content.slice(0, m.index) })] : [];
  }
  return defaultImage(tokens, i, opts, env, self);
};

function resolveFile(env, target) {
  if (!target) return null;
  const noteDir = path.posix.dirname(env.rel);
  for (const rel of [path.posix.join(noteDir, target), target]) {
    const abs = path.resolve(env.vault, rel);
    if (insideVault(env.vault, abs) && fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  return obs.resolveLink(env.vault, env.rel, target, env.files);
}

function insideVault(vault, abs) {
  const rel = path.relative(path.resolve(vault), path.resolve(abs));
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function relOf(vault, abs) {
  return path.relative(vault, abs).split(path.sep).join('/');
}

// Obsidian alt yolunu (#Başlık#Alt ya da #^blok) bölüm tanımına çevirir.
function sectionFromSub(sub) {
  if (!sub) return { kind: 'whole' };
  if (sub.startsWith('^')) return { kind: 'block', id: sub.slice(1) };
  return { kind: 'heading', path: sub.split('#').map((s) => s.trim()).filter(Boolean) };
}

function renderEmbed({ target, sub, alias }, env) {
  const name = target || path.posix.basename(env.rel, '.md');
  if (target && IMAGE_RE.test(target)) {
    const abs = resolveFile(env, target);
    if (!abs) return `<span class="wikilink unresolved">${esc(target)}</span>`;
    const m = /^(\d+)(?:x(\d+))?$/.exec(alias);
    const size = m ? ` style="width: ${m[1]}px${m[2] ? `; height: ${m[2]}px` : ''}"` : '';
    return `<img src="${esc(fileUrl(abs))}" alt="${esc(m ? target : alias || target)}"${size}>`;
  }
  const abs = target ? resolveFile(env, target) : path.resolve(env.vault, env.rel);
  if (!abs || !/\.md$/i.test(abs)) {
    return `<span class="wikilink${abs ? '' : ' unresolved'}">${esc(alias || name)}</span>`;
  }
  if (env.depth >= MAX_EMBED_DEPTH) return `<span class="wikilink">${esc(alias || name)}</span>`;
  let md = null;
  try {
    md = obs.extractSection(fs.readFileSync(abs, 'utf8'), sectionFromSub(sub));
  } catch { /* okunamadı */ }
  if (md == null) return `<span class="wikilink unresolved">${esc(alias || name)}</span>`;
  const inner = mdi.render(preprocess(md), { ...env, rel: relOf(env.vault, abs), depth: env.depth + 1 });
  const label = [path.basename(abs, path.extname(abs)), sub.replace(/^\^/, '').split('#').filter(Boolean).join(' › ')].filter(Boolean).join(' › ');
  return `<div class="embed"><div class="embed-title">${esc(label)}</div>${inner}</div>`;
}

// Kod blokları dışında %%yorumları%% ve satır sonundaki ^blok-kimliklerini temizler.
function preprocess(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let chunk = [];
  let fence = null;
  const flush = () => {
    if (!chunk.length) return;
    out.push(chunk.join('\n').replace(/%%[\s\S]*?%%/g, '').replace(/(^|[ \t])\^[A-Za-z0-9-]+[ \t]*$/gm, '$1'));
    chunk = [];
  };
  for (const line of lines) {
    const m = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      out.push(line);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && !line.trim().slice(m[1].length).trim()) fence = null;
    } else if (m) {
      flush();
      fence = m[1];
      out.push(line);
    } else chunk.push(line);
  }
  flush();
  return out.join('\n');
}

// ---------- HTML sayfası ----------

const KATEX_CSS = fileUrl(path.join(path.dirname(require.resolve('katex')), 'katex.min.css'));

const PAGE_CSS = `
html, body { margin: 0; background: #ffffff; }
#c { box-sizing: border-box; padding: 20px 26px 22px; background: #ffffff; color: #222428;
  font: 16px/1.6 "Segoe UI", system-ui, sans-serif; border: 1px solid #e1e4ea; overflow-wrap: anywhere; }
#c > :first-child, .callout > :first-child, .embed > .embed-title + * { margin-top: 0; }
#c > :last-child, .callout > :last-child, .embed > :last-child, blockquote > :last-child, li > :last-child { margin-bottom: 0; }
.source { font-size: 12px; color: #8a8f99; margin: -6px 0 10px; }
h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 0.9em 0 0.4em; font-weight: 700; }
h1 { font-size: 1.8em; } h2 { font-size: 1.5em; } h3 { font-size: 1.3em; }
h4 { font-size: 1.15em; } h5 { font-size: 1.05em; } h6 { font-size: 1em; color: #555; }
p { margin: 0.5em 0; }
ul, ol { padding-left: 1.6em; margin: 0.4em 0; }
li > p { margin: 0; }
code { font-family: Consolas, "Cascadia Mono", monospace; font-size: 0.88em; background: #f2f3f5; padding: 0.1em 0.35em; border-radius: 4px; -webkit-box-decoration-break: clone; }
pre { background: #f6f7f9; border: 1px solid #eceef1; border-radius: 6px; padding: 10px 12px; white-space: pre-wrap; }
pre code { background: none; padding: 0; }
blockquote { margin: 0.6em 0; padding: 0.1em 0 0.1em 1em; border-left: 3px solid #d0d4db; color: #555a63; }
table { border-collapse: collapse; margin: 0.6em 0; }
th, td { border: 1px solid #d9dce1; padding: 4px 10px; vertical-align: top; }
th { background: #f6f7f9; }
img { max-width: 100%; }
hr { border: none; border-top: 1px solid #e1e3e8; margin: 1em 0; }
mark { background: rgba(255, 208, 0, 0.4); color: inherit; padding: 0 0.1em; border-radius: 2px; }
a, .wikilink { color: #7c3aed; text-decoration: none; }
.unresolved { opacity: 0.6; }
.tag { background: rgba(124, 58, 237, 0.1); color: #7c3aed; border-radius: 999px; padding: 0 0.5em; font-size: 0.88em; }
.math-block { margin: 0.6em 0; }
.katex-display { margin: 0; }
.math-error { color: #c4271d; }
.callout { margin: 0.7em 0; padding: 10px 14px; border: none; border-radius: 6px; background: rgba(var(--cc), 0.1); color: inherit; }
.callout-title { font-weight: 600; color: rgb(var(--cc)); margin-bottom: 4px; }
.callout.collapsed > :not(.callout-title) { display: none; }
.callout.collapsed > .callout-title { margin-bottom: 0; }
.fold { margin-left: 0.4em; font-weight: 400; }
.embed { border-left: 3px solid #c4b5fd; padding: 2px 0 2px 14px; margin: 0.6em 0; }
.embed-title { font-size: 12px; color: #8a8f99; margin-bottom: 4px; }
li.task { list-style: none; margin-left: -1.3em; }
li.task.done { color: #8a8f99; text-decoration: line-through; }
.cb { display: inline-block; box-sizing: border-box; width: 0.95em; height: 0.95em; border: 1.5px solid #9aa0aa; border-radius: 3px; margin-right: 0.45em; vertical-align: -0.12em; position: relative; }
.cb.on { background: #7c3aed; border-color: #7c3aed; }
.cb.on::after { content: ""; position: absolute; left: 0.27em; top: 0.08em; width: 0.22em; height: 0.48em; border: solid #fff; border-width: 0 0.12em 0.12em 0; transform: rotate(45deg); }
`;

// Not içindeki ham HTML'de betik çalışmasın: sayfanın CSP'si betiği, çerçeveyi ve ağ isteklerini kapatır
// (resimler hariç). Ölçüm için main process'ten çalıştırılan kod CSP'den etkilenmez.
const PAGE_CSP = "default-src 'none'; img-src file: data: https: http:; style-src 'unsafe-inline' file:; font-src file: data:";

function buildPage(bodyHtml, sourceLabel, width) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${PAGE_CSP}">
<link rel="stylesheet" href="${esc(KATEX_CSS)}"><style>${PAGE_CSS}</style></head>
<body><article id="c" style="width: ${width}px"><div class="source">${esc(sourceLabel)}</div>${bodyHtml}</article></body></html>`;
}

// ---------- Resme dönüştürme ----------

let renderWin = null;
let idleTimer = null;
let queue = Promise.resolve();

function renderWindow() {
  if (renderWin && !renderWin.isDestroyed()) return renderWin;
  renderWin = new BrowserWindow({
    show: false,
    width: 800,
    height: 200,
    frame: false,
    useContentSize: true,
    webPreferences: {
      offscreen: true,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      partition: 'beyaz-tahta-render',
    },
  });
  const wc = renderWin.webContents;
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (e) => e.preventDefault());
  return renderWin;
}

// Pencere bir süre kullanılmazsa kapatılır; açık kalması bellek harcar.
function scheduleClose() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (renderWin && !renderWin.isDestroyed()) renderWin.destroy();
    renderWin = null;
  }, 60000);
}

const MEASURE_JS = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const imgs = Array.from(document.images).map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }));
  await Promise.race([Promise.all([document.fonts.ready, ...imgs]), wait(5000)]);
  const c = document.getElementById('c');
  // Geniş tablo/formül sığmıyorsa kart genişletilir; kırpılmaz.
  if (c.scrollWidth > c.clientWidth + 1) c.style.width = Math.min(c.scrollWidth + 2, 2400) + 'px';
  const r = c.getBoundingClientRect();
  return [Math.ceil(r.width), Math.ceil(r.height)];
})()`;

function waitPaint(wc, w, h) {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      wc.removeListener('paint', onPaint);
      setTimeout(resolve, 30);
    };
    const onPaint = (_e, _dirty, image) => {
      const s = image.getSize();
      if (s.width >= w && s.height >= h) done();
    };
    const timer = setTimeout(done, 1500);
    wc.on('paint', onPaint);
    wc.invalidate();
  });
}

// HTML'i #c öğesinin boyutunda resme çevirir: { img (NativeImage), w, h } (w, h CSS pikseli).
async function rasterizeImage(html, maxScale = SCALE) {
  const dir = path.join(app.getPath('temp'), 'beyaz-tahta-render');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `bolum-${process.pid}.html`);
  fs.writeFileSync(file, html);
  const win = renderWindow();
  const wc = win.webContents;
  win.setContentSize(MAX_WIDTH * SCALE, 200);
  await wc.loadFile(file);
  wc.setZoomFactor(1);
  const [w, h] = await wc.executeJavaScript(MEASURE_JS);
  // Çok uzun bölümlerde çözünürlük düşürülür; yine sığmazsa resim alttan kesilir.
  const scale = Math.max(1, Math.min(maxScale, MAX_PIXEL_H / h));
  const pw = Math.ceil(w * scale);
  const ph = Math.min(Math.ceil(h * scale), MAX_PIXEL_H);
  wc.setZoomFactor(scale);
  win.setContentSize(pw, ph);
  await waitPaint(wc, pw, ph);
  const img = await wc.capturePage({ x: 0, y: 0, width: pw, height: ph });
  try { fs.unlinkSync(file); } catch { /* yoksay */ }
  return { img, w, h: Math.round(ph / scale) };
}

async function rasterize(html) {
  const { img, w, h } = await rasterizeImage(html);
  return { src: img.toDataURL(), w, h };
}

// Vault dosya listesi bağlantı çözümlemede sık kullanılır; kısa süre önbellekte tutulur.
const filesCache = new Map(); // vault -> { at, files }
function vaultFiles(vault) {
  const hit = filesCache.get(vault);
  if (hit && Date.now() - hit.at < 30000) return hit.files;
  const files = obs.listFiles(vault);
  filesCache.set(vault, { at: Date.now(), files });
  return files;
}

// Kaynak etiketi: "Not › Başlık › Alt başlık". Notun ilk başlığı çoğunlukla not adıyla aynıdır; tekrarlanmaz.
function sectionLabel(name, section) {
  if (!section || section.kind === 'whole') return name;
  if (section.kind === 'block') return `${name} › ^${section.id}`;
  const p = (section.path || []).slice();
  if (p[0] === name) p.shift();
  return [name, ...p].join(' › ');
}

// Bir notun bölümünü resme dönüştürür: { src, w, h, title } ya da { error }.
function renderSection({ vault, rel, section, width }) {
  const abs = path.resolve(vault, String(rel || ''));
  if (!insideVault(vault, abs) || !/\.md$/i.test(abs)) return Promise.resolve({ error: 'Geçersiz not yolu.' });
  let text;
  try {
    text = fs.readFileSync(abs, 'utf8');
  } catch {
    return Promise.resolve({ error: 'Not bulunamadı; taşınmış ya da silinmiş olabilir.' });
  }
  const md = obs.extractSection(text, section);
  if (md == null) return Promise.resolve({ error: 'Bölüm notta bulunamadı; başlığın adı değişmiş olabilir.' });
  const noteRel = relOf(vault, abs);
  const env = { vault, rel: noteRel, files: vaultFiles(vault), depth: 0 };
  const body = mdi.render(preprocess(md), env);
  const name = path.basename(abs, '.md');
  const title = sectionLabel(name, section);
  const cssWidth = Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(width) || 640)));
  const html = buildPage(body, title, cssWidth);
  // Tek gizli pencere kullanıldığından istekler sırayla işlenir.
  const job = queue.then(async () => {
    clearTimeout(idleTimer);
    try {
      return { ...(await rasterize(html)), title };
    } catch (err) {
      return { error: 'Bölüm resme dönüştürülemedi: ' + err.message };
    } finally {
      scheduleClose();
    }
  });
  queue = job.catch(() => {});
  return job;
}

// ---------- Tahtadaki metin formülleri ----------
// Formül beyaz zemine siyah çizilir, sonra parlaklık saydamlığa çevrilip istenen renge boyanır;
// böylece resim her arka planda (koyu tahta, not kâğıdı) doğru görünür.

const MATH_SCALE = 3; // yakınlaştırınca da keskin kalsın
const MATH_RE = /\$\$([^$]+?)\$\$|\$([^\s$](?:[^$]*?[^\s$])?)\$(?!\d)/g;

const MATH_CSS = `
html, body { margin: 0; background: #ffffff; overflow: hidden; }
#c { display: inline-block; vertical-align: top; padding: 0.12em 2px 0.2em; color: #000000;
  font-family: "Segoe UI", system-ui, sans-serif; line-height: 1.25; white-space: pre; }
.katex { font-size: 1.12em; }
.katex-display { display: inline-block; margin: 0; }
`;

function mathLine(line) {
  let out = '';
  let last = 0;
  for (const m of line.matchAll(MATH_RE)) {
    out += esc(line.slice(last, m.index));
    out += m[1] !== undefined ? tex(m[1], true) : tex(m[2], false);
    last = m.index + m[0].length;
  }
  return out + esc(line.slice(last));
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Siyah-beyaz görüntüyü renkli, saydam zeminli görüntüye çevirir (BGRA, önçarpımlı).
function inkToAlpha(img, color) {
  const { width, height } = img.getSize();
  const buf = img.toBitmap();
  const [r, g, b] = hexRgb(color);
  for (let i = 0; i < buf.length; i += 4) {
    const a = 255 - Math.round((buf[i] + buf[i + 1] + buf[i + 2]) / 3);
    buf[i] = Math.round((b * a) / 255);
    buf[i + 1] = Math.round((g * a) / 255);
    buf[i + 2] = Math.round((r * a) / 255);
    buf[i + 3] = a;
  }
  return nativeImage.createFromBitmap(buf, { width, height });
}

function renderMath({ text, fontSize, color }) {
  const body = String(text).split('\n').map(mathLine).join('\n');
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${PAGE_CSP}">
<link rel="stylesheet" href="${esc(KATEX_CSS)}"><style>${MATH_CSS}</style></head>
<body><span id="c" style="font-size: ${fontSize}px">${body}</span></body></html>`;
  const job = queue.then(async () => {
    clearTimeout(idleTimer);
    try {
      const { img, w, h } = await rasterizeImage(html, MATH_SCALE);
      return { src: inkToAlpha(img, color).toDataURL(), w, h };
    } catch (err) {
      return { error: 'Formül çizilemedi: ' + err.message };
    } finally {
      scheduleClose();
    }
  });
  queue = job.catch(() => {});
  return job;
}

// Ana pencere kapanınca gizli pencere de kapanmalı; yoksa uygulama kapanmaz.
function disposeRenderer() {
  clearTimeout(idleTimer);
  if (renderWin && !renderWin.isDestroyed()) renderWin.destroy();
  renderWin = null;
}

module.exports = { renderSection, renderMath, disposeRenderer };
