// Obsidian vault okuma yardımcıları: vault keşfi, not listeleme, başlık/blok çıkarma ve
// [[bağlantı]] çözümleme. Yalnızca Node çekirdek modülleri kullanılır; Electron'a bağımlı değildir.
const fs = require('fs');
const path = require('path');

const NOTE_EXT = '.md';
const NOTES_CAP = 20000;
const FILES_CAP = 50000;

// ---------- Metin / satır yardımcıları ----------

// \r\n ve \n karışık metni satırlara böler; indeksler orijinal metne göredir.
function splitLines(text) {
  return String(text == null ? '' : text)
    .split('\n')
    .map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
}

// Metnin başındaki YAML frontmatter'ın bittiği satırı (kapanış --- ya da ...) verir; yoksa -1.
function frontmatterEnd(lines) {
  if (!lines.length || !/^---[ \t]*$/.test(lines[0])) return -1;
  for (let i = 1; i < lines.length; i++) {
    if (/^(---|\.\.\.)[ \t]*$/.test(lines[i])) return i;
  }
  return -1;
}

// Her satır gizli mi (frontmatter, kod bloğu, $$ matematik, %% yorum) bilgisini döndürür.
function scanBlocks(lines) {
  const hidden = new Array(lines.length).fill(false);
  const fmEnd = frontmatterEnd(lines);
  for (let i = 0; i <= fmEnd; i++) hidden[i] = true;

  let fence = null; // { char, len }
  let math = false;
  let comment = false;
  for (let i = fmEnd + 1; i < lines.length; i++) {
    const line = lines[i];
    if (fence) {
      hidden[i] = true;
      const m = /^ {0,3}([`~]{3,})[ \t]*$/.exec(line.replace(/[ \t]+$/, ''));
      if (m && m[1][0] === fence.char && m[1].length >= fence.len) fence = null;
      continue;
    }
    if (math) {
      hidden[i] = true;
      if (line.includes('$$')) math = false;
      continue;
    }
    if (comment) {
      hidden[i] = true;
      if (line.trim() === '%%') comment = false;
      continue;
    }
    const fm = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fm) {
      fence = { char: fm[1][0], len: fm[1].length };
      hidden[i] = true;
      continue;
    }
    if (/^\$\$/.test(line)) {
      hidden[i] = true;
      if (!line.slice(2).includes('$$')) math = true;
      continue;
    }
    if (line.trim() === '%%') {
      comment = true;
      hidden[i] = true;
    }
  }
  return { hidden, fmEnd };
}

// ATX başlığı: "# " ile başlar; "#tag" başlık değildir. Kapanış #'leri yalnızca önlerinde boşluk
// varsa atılır ("# C#" başlığı "C#" kalır).
const HEADING_RE = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/;

function headingOf(line) {
  const m = HEADING_RE.exec(line);
  if (!m) return null;
  const text = (m[2] || '').replace(/(^|[ \t])#+[ \t]*$/, '').trim();
  if (!text) return null; // boş başlıklar yok sayılır
  return { level: m[1].length, text };
}

// Blok başlıklarını bitiren satır mı? (paragraf taramasında kullanılır)
function isHeadingLine(line) {
  return /^ {0,3}#{1,6}([ \t]|$)/.test(line);
}

const BLOCK_RE = /(?:^|\s)\^([A-Za-z0-9-]+)\s*$/;

function blockIdOf(line) {
  const m = BLOCK_RE.exec(line);
  return m ? m[1] : null;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Satır sonundaki ^id işaretini (ve öncesindeki boşluğu) temizler.
function removeMarker(line, id) {
  return line.replace(new RegExp('(?:^|[ \\t])\\^' + escapeRe(id) + '[ \\t]*$'), '');
}

// Blok kimliğinin bulunduğu satırdan bloğun metnini çıkarır; işaret temizlenir.
function blockText(lines, target, id) {
  const clean = removeMarker(lines[target], id);
  // a) işaret kendi satırındaysa: üstteki kesintisiz boş olmayan satır topluluğu
  if (clean.trim() === '') {
    let s = target - 1;
    while (s >= 0 && lines[s].trim() !== '') s--;
    s++;
    if (s >= target) return null;
    return lines.slice(s, target).join('\n').replace(/[ \t]+$/, '');
  }
  // b) liste öğesi: kendisi + kendisinden daha girintili alt satırlar
  const li = /^([ \t]*)([-*+]|\d+[.)])[ \t]/.exec(lines[target]);
  if (li) {
    const indent = li[1].length;
    let e = target + 1;
    while (e < lines.length && lines[e].trim() !== '') {
      const ind = /^[ \t]*/.exec(lines[e])[0].length;
      if (ind <= indent) break;
      e++;
    }
    const out = lines.slice(target, e);
    out[0] = clean;
    return out.join('\n');
  }
  // c) paragraf: kimlik satırının çevresindeki kesintisiz boş olmayan satırlar
  let s = target;
  let e = target + 1;
  while (s - 1 >= 0 && lines[s - 1].trim() !== '' && !isHeadingLine(lines[s - 1])) s--;
  while (e < lines.length && lines[e].trim() !== '' && !isHeadingLine(lines[e])) e++;
  const out = lines.slice(s, e);
  out[target - s] = clean;
  return out.join('\n');
}

// ---------- Vault keşfi ----------

// Electron userData klasöründeki obsidian.json'dan diskte var olan vault'ları verir.
// Sıralama: açık olanlar önce, sonra ts'e göre azalan.
function detectVaults(appDataDir) {
  try {
    const file = path.join(String(appDataDir || ''), 'obsidian', 'obsidian.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const vaults = data && data.vaults;
    if (!vaults || typeof vaults !== 'object') return [];
    const list = [];
    for (const id of Object.keys(vaults)) {
      const v = vaults[id];
      if (!v || typeof v.path !== 'string') continue;
      if (!fs.existsSync(v.path)) continue;
      list.push({ path: v.path, name: path.basename(v.path), open: !!v.open, ts: Number(v.ts) || 0 });
    }
    list.sort((a, b) => (b.open ? 1 : 0) - (a.open ? 1 : 0) || b.ts - a.ts);
    return list.map((v) => ({ path: v.path, name: v.name, open: v.open }));
  } catch {
    return [];
  }
}

// ---------- Dosya listeleme ----------

// Vault içindeki gizli olmayan dosyaların tam yollarını toplar. Sembolik bağlantılar
// (döngü riski) izlenmez; okunamayan klasörler atlanır.
function walkFiles(vault, onlyMd, cap) {
  const out = [];
  const stack = [vault];
  while (stack.length && out.length < cap) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // okunamayan klasörü atla
    }
    for (const ent of entries) {
      if (out.length >= cap) break;
      const name = ent.name;
      if (name.startsWith('.') || name === 'node_modules') continue;
      if (ent.isSymbolicLink()) continue; // bağlantıları izleme
      const full = path.join(dir, name);
      if (ent.isDirectory()) {
        stack.push(full);
      } else if (ent.isFile()) {
        if (!onlyMd || name.toLowerCase().endsWith(NOTE_EXT)) out.push(full);
      }
    }
  }
  return out;
}

function toRelSlash(rel) {
  return rel.split(path.sep).join('/');
}

// Vault'taki tüm (gizli olmayan) dosyaların vault'a göre yolları; ayraç olarak "/" kullanılır.
function listFiles(vault) {
  const v = String(vault || '');
  return walkFiles(v, false, FILES_CAP)
    .map((full) => toRelSlash(path.relative(v, full)))
    .sort((a, b) => a.localeCompare(b, 'tr'));
}

// Vault'taki .md notları (büyük/küçük harf duyarsız); rel yolları "/" ile ayrılır.
function listNotes(vault) {
  const v = String(vault || '');
  const notes = [];
  for (const full of walkFiles(v, true, NOTES_CAP)) {
    let mtime = 0;
    try {
      mtime = fs.statSync(full).mtimeMs;
    } catch {
      continue; // okunamayan dosyayı atla
    }
    const rel = toRelSlash(path.relative(v, full));
    const base = path.basename(rel);
    notes.push({ rel, name: base.slice(0, base.length - NOTE_EXT.length), mtime });
  }
  notes.sort((a, b) => a.rel.localeCompare(b.rel, 'tr'));
  return notes;
}

// ---------- Outline (başlık + blok) ----------

// Notun başlıklarını ve blok kimliklerini çıkarır; satırlar 0 tabanlıdır.
function parseOutline(text) {
  const lines = splitLines(text);
  const { hidden } = scanBlocks(lines);
  const headings = [];
  const blocks = [];
  const stack = [];
  for (let i = 0; i < lines.length; i++) {
    if (hidden[i]) continue;
    const h = headingOf(lines[i]);
    if (h) {
      while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
      const p = stack.map((s) => s.text).concat(h.text);
      headings.push({ level: h.level, text: h.text, line: i, path: p });
      stack.push({ level: h.level, text: h.text });
      continue;
    }
    const id = blockIdOf(lines[i]);
    if (id) {
      const block = blockText(lines, i, id);
      const preview = block ? block.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
      blocks.push({ id, line: i, preview });
    }
  }
  return { headings, blocks };
}

// ---------- Bölüm çıkarma ----------

// Notun bir bölümünü (tamamı, başlık ya da blok) markdown olarak verir; bulunamazsa null.
function extractSection(text, section) {
  if (!section || typeof section !== 'object') return null;
  const lines = splitLines(text);

  if (section.kind === 'whole') {
    return lines.slice(frontmatterEnd(lines) + 1).join('\n').trim();
  }

  if (section.kind === 'heading') {
    const outline = parseOutline(text);
    const req = Array.isArray(section.path) ? section.path : [];
    const samePath = (p) => p.length === req.length && p.every((v, i) => v === req[i]);

    let pick = null;
    const exact = outline.headings.filter((h) => samePath(h.path));
    if (exact.length) {
      pick = section.line != null ? exact.find((h) => h.line === section.line) || exact[0] : exact[0];
    } else if (req.length) {
      const last = req[req.length - 1];
      const cands = outline.headings.filter((h) => h.path[h.path.length - 1] === last);
      if (cands.length) {
        pick =
          section.line != null
            ? cands.slice().sort((a, b) => Math.abs(a.line - section.line) - Math.abs(b.line - section.line))[0]
            : cands[0];
      }
    }
    if (!pick) return null;

    let end = lines.length;
    for (const h of outline.headings) {
      if (h.line > pick.line && h.level <= pick.level) {
        end = h.line;
        break;
      }
    }
    return lines.slice(pick.line, end).join('\n').replace(/\s+$/, '');
  }

  if (section.kind === 'block') {
    const id = section.id;
    if (!id) return null;
    const { hidden } = scanBlocks(lines);
    for (let i = 0; i < lines.length; i++) {
      if (!hidden[i] && blockIdOf(lines[i]) === id) return blockText(lines, i, id);
    }
    return null;
  }

  return null;
}

// ---------- Bağlantı çözümleme ----------

function baseName(rel) {
  const i = rel.lastIndexOf('/');
  return i < 0 ? rel : rel.slice(i + 1);
}

// Dosya adında uzantı var mı? Baştaki nokta (.gitignore) uzantı sayılmaz.
function hasExtension(rel) {
  return baseName(rel).lastIndexOf('.') > 0;
}

function normalizeRel(p) {
  return path.posix.normalize(String(p).replace(/\\/g, '/').replace(/^\.\//, ''));
}

// Çözülen yolun hâlâ vault klasörünün içinde kaldığını doğrular.
function insideVault(vault, abs) {
  const rel = path.relative(path.resolve(vault), path.resolve(abs));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// [[hedef]] bağlantısını Obsidian kurallarına göre mutlak dosya yoluna çözer; yoksa null.
function resolveLink(vault, fromRel, target, notes) {
  if (!vault || typeof target !== 'string' || !target) return null;

  let t = target;
  try {
    t = decodeURIComponent(t); // %20 gibi kodlamaları çöz
  } catch {
    /* bozuk kodlamayı olduğu gibi bırak */
  }
  t = t.replace(/\\/g, '/').trim();
  if (!t) return null;

  const files = Array.isArray(notes) && notes.length ? notes : listFiles(vault);
  const map = new Map();
  for (const f of files) {
    const norm = normalizeRel(f);
    if (!map.has(norm.toLowerCase())) map.set(norm.toLowerCase(), norm);
  }

  const tryRel = (rel) => {
    const norm = normalizeRel(rel);
    if (!norm || norm === '..' || norm.startsWith('../') || norm.startsWith('/') || /^[a-zA-Z]:/.test(norm)) {
      return null; // vault dışına taşan yollar reddedilir
    }
    const hit = map.get(norm.toLowerCase());
    if (!hit) return null;
    const abs = path.join(vault, ...hit.split('/'));
    return insideVault(vault, abs) ? abs : null;
  };

  const fromFolder = (() => {
    const n = normalizeRel(fromRel || '');
    const i = n.lastIndexOf('/');
    return i < 0 ? '' : n.slice(0, i);
  })();

  const tries = [];
  if (!hasExtension(t)) tries.push(t + NOTE_EXT); // a) uzantısızsa önce .md dene
  tries.push(t); // b) vault köküne göre tam yol
  if (fromFolder) tries.push(fromFolder + '/' + t); // c) bağlantının bulunduğu klasöre göre

  for (const cand of tries) {
    const hit = tryRel(cand);
    if (hit) return hit;
  }

  // d) vault içinde dosya adına göre ara (büyük/küçük harf duyarsız)
  const wanted = new Set();
  const b = baseName(t);
  if (hasExtension(t)) {
    wanted.add(b.toLowerCase());
  } else {
    wanted.add((b + NOTE_EXT).toLowerCase());
    wanted.add(b.toLowerCase());
  }
  const cands = files.filter((f) => wanted.has(baseName(f).toLowerCase()));
  if (!cands.length) return null;
  cands.sort((a, c) => {
    const an = normalizeRel(a);
    const cn = normalizeRel(c);
    return an.length - cn.length || an.localeCompare(cn, 'tr');
  });
  const abs = path.join(vault, ...normalizeRel(cands[0]).split('/'));
  return insideVault(vault, abs) ? abs : null;
}

// ---------- URI ----------

// Obsidian uygulamasında not/bölüm açan obsidian:// bağlantısını üretir.
function obsidianUri(vaultName, rel, section) {
  let file = String(rel == null ? '' : rel)
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '');
  if (section && section.kind === 'heading') {
    const p = Array.isArray(section.path) ? section.path : [];
    file = file + '#' + (p.length ? p[p.length - 1] : '');
  } else if (section && section.kind === 'block' && section.id) {
    file = file + '#^' + section.id;
  }
  return 'obsidian://open?vault=' + encodeURIComponent(vaultName) + '&file=' + encodeURIComponent(file);
}

module.exports = {
  detectVaults,
  listNotes,
  listFiles,
  parseOutline,
  extractSection,
  resolveLink,
  obsidianUri,
};
