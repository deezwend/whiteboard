// Beyaz Tahta — "Obsidian'dan ekle" seçicisi.
//
// Tek giriş noktası: openObsidianPicker(api).
// Tam ekran bir katman kurar; kullanıcı bir not/bölüm seçip "Tahtaya ekle"ye
// basınca ya da kapatınca çözülen bir Promise döner:
//   { vault, rel, section, width, result } | null
// 'result', api.obsidianRender'in döndürdüğü { src, w, h, title } nesnesidir.
//
// Notlar/başlıklar/blok önizlemeleri kullanıcı içeriğidir; bu yüzden
// innerHTML yerine her zaman textContent/createElement kullanılır.

import { t } from './i18n.js';

const LS_WIDTH = 'obsidianPickerWidth';
const LS_LAST = 'obsidianPickerLast';
// [etiket, piksel] — api.obsidianRender'a gönderilen CSS genişliği.
const WIDTHS = [[t('Dar'), 480], [t('Orta'), 640], [t('Geniş'), 860]];
const DEFAULT_WIDTH = 640;
const MAX_ROWS = 300;
const RENDER_DEBOUNCE = 150;

// Aynı anda tek seçici açık olur; ikinci çağrı aynı Promise'i alır.
let picker = null;

// Kısa DOM kurucu.
function mk(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

function errMsg(err) {
  return (err && err.message) ? err.message : String(err);
}

// Bir bölümü karşılaştırılabilir tek bir anahtara çevirir.
function sectionKey(section) {
  if (!section) return '';
  if (section.kind === 'whole') return 'whole';
  if (section.kind === 'heading') return 'heading:' + JSON.stringify([section.path || [], section.line]);
  if (section.kind === 'block') return 'block:' + String(section.id);
  return 'other:' + JSON.stringify(section);
}

// "YKS/Matematik/Türev.md" -> "YKS/Matematik"
function folderOf(rel) {
  const i = String(rel).lastIndexOf('/');
  return i < 0 ? '' : String(rel).slice(0, i);
}

// Türkçe küçük harf duyarlı arama. Sorgudaki her kelime 'rel' içinde geçmeli.
// Sıralama: adı sorgunun ilk kelimesiyle başlayanlar, sonra adında geçenler,
// en sonda yalnızca klasör yolunda geçenler.
function filterNotes(notes, query) {
  const q = String(query || '').trim().toLocaleLowerCase('tr');
  if (!q) return notes.slice();
  const words = q.split(/\s+/).filter(Boolean);
  const first = words[0];
  const ranked = [];
  for (const note of notes) {
    const rel = String(note.rel || '').toLocaleLowerCase('tr');
    if (!words.every((w) => rel.includes(w))) continue;
    const name = String(note.name || '').toLocaleLowerCase('tr');
    const rank = name.startsWith(first) ? 0 : (name.includes(first) ? 1 : 2);
    ranked.push({ note, rank });
  }
  ranked.sort((a, b) => a.rank - b.rank); // ES2019+ sıralama kararlıdır
  return ranked.map((r) => r.note);
}

function readWidth() {
  try {
    const w = parseInt(localStorage.getItem(LS_WIDTH), 10);
    if (WIDTHS.some(([, v]) => v === w)) return w;
  } catch { /* localStorage kapalı olabilir */ }
  return DEFAULT_WIDTH;
}

function saveWidth(w) {
  try { localStorage.setItem(LS_WIDTH, String(w)); } catch { /* yok say */ }
}

function readLast() {
  try {
    const m = JSON.parse(localStorage.getItem(LS_LAST));
    return (m && typeof m === 'object') ? m : {};
  } catch { return {}; }
}

function saveLast(vault, rel) {
  if (!vault) return;
  try {
    const m = readLast();
    if (rel) m[vault] = rel;
    else delete m[vault];
    localStorage.setItem(LS_LAST, JSON.stringify(m));
  } catch { /* yok say */ }
}

export function openObsidianPicker(api) {
  if (picker) return picker.promise;

  const state = {
    api,
    vaults: [],
    vault: null,
    notes: [],
    notesLoading: true,
    notesError: '',
    query: '',
    shown: [],
    highlight: 0,
    noteEls: [],
    rel: null,
    outline: null,
    outlineLoading: false,
    outlineError: '',
    entryEls: [],
    sectionByKey: new Map(),
    section: null,
    width: readWidth(),
    result: null,
    previewState: 'idle',
    previewError: '',
    renderSeq: 0,
    renderTimer: 0,
    insertOnReady: false,
  };

  let resolveFn;
  const promise = new Promise((res) => { resolveFn = res; });
  state.promise = promise;
  state.resolve = resolveFn;
  picker = state;

  // ---------- DOM ----------

  const root = mk('div');
  root.id = 'obsidianPicker';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', t("Obsidian'dan ekle"));
  document.body.appendChild(root);

  const card = mk('div', 'panel obsidian-card');
  root.appendChild(card);

  // Başlık satırı
  const head = mk('div', 'obsidian-head');
  head.appendChild(mk('h2', null, t("Obsidian'dan ekle")));
  const vaultSel = mk('select', 'obsidian-vault');
  vaultSel.title = t('Vault seç');
  head.appendChild(vaultSel);
  const closeBtn = mk('button', 'chip', t('Kapat'));
  closeBtn.type = 'button';
  head.appendChild(closeBtn);
  card.appendChild(head);

  // Üç sütun
  const body = mk('div', 'obsidian-body');
  card.appendChild(body);

  // 1) Notlar
  const notesCol = mk('div', 'obsidian-col obsidian-notes');
  const search = mk('input', 'obsidian-search');
  search.type = 'search';
  search.placeholder = t('Not ara…');
  search.spellcheck = false;
  search.autocomplete = 'off';
  notesCol.appendChild(search);
  const noteList = mk('div', 'obsidian-list');
  notesCol.appendChild(noteList);
  body.appendChild(notesCol);

  // 2) Başlıklar / bloklar
  const outlineCol = mk('div', 'obsidian-col obsidian-outline');
  const outlineList = mk('div', 'obsidian-list');
  outlineCol.appendChild(outlineList);
  body.appendChild(outlineCol);

  // 3) Önizleme
  const previewCol = mk('div', 'obsidian-col obsidian-preview-col');
  const widthRow = mk('div', 'obsidian-widths');
  const widthBtns = [];
  for (const [label, w] of WIDTHS) {
    const b = mk('button', 'chip', label);
    b.type = 'button';
    b.dataset.width = String(w);
    b.title = t('{n} piksel', { n: w });
    b.addEventListener('click', () => setWidth(w));
    widthBtns.push(b);
    widthRow.appendChild(b);
  }
  previewCol.appendChild(widthRow);
  const previewBox = mk('div', 'obsidian-preview msg');
  previewCol.appendChild(previewBox);
  const addBtn = mk('button', 'chip obsidian-add', t('Tahtaya ekle'));
  addBtn.type = 'button';
  addBtn.disabled = true;
  previewCol.appendChild(addBtn);
  body.appendChild(previewCol);

  // Vault yokken gösterilen orta bloğu
  const none = mk('div', 'obsidian-none hidden');
  const noneMsg = mk('p', 'muted obsidian-msg', t("Obsidian vault'u bulunamadı."));
  none.appendChild(noneMsg);
  const pickBtn = mk('button', 'chip', t('Vault klasörünü seç…'));
  pickBtn.type = 'button';
  none.appendChild(pickBtn);
  card.appendChild(none);

  // ---------- Kapatma / yaşam döngüsü ----------

  function close(result) {
    if (picker !== state) return;
    picker = null;
    clearTimeout(state.renderTimer);
    window.removeEventListener('keydown', onKeydown, true);
    root.remove();
    state.resolve(result || null);
  }

  function finishInsert() {
    if (picker !== state) return;
    if (state.previewState !== 'ready' || !state.result) return;
    close({
      vault: state.vault,
      rel: state.rel,
      section: state.section,
      width: state.width,
      result: state.result,
    });
  }

  // ---------- Klavye ----------
  // Yakalama (capture) fazında pencereye bağlanır: uygulamanın tek tuş
  // kısayollarına (document/window keydown) olay hiç ulaşmaz. stopPropagation
  // varsayılan davranışı engellemez, bu yüzden yazı yazma çalışmaya devam eder;
  // bu katmandaki tüm tuş işlemleri burada, tek yerde yapılır.

  function onKeydown(e) {
    e.stopPropagation();
    const key = e.key;

    if (key === 'Escape') {
      if (document.activeElement === search && search.value) {
        // İlk Esc yalnızca aramayı temizler.
        e.preventDefault();
        search.value = '';
        state.query = '';
        state.highlight = 0;
        renderNotes();
        return;
      }
      e.preventDefault();
      close(null);
      return;
    }

    if (key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      if (!addBtn.disabled) {
        e.preventDefault();
        finishInsert();
      }
      return;
    }

    if (document.activeElement === search) {
      if (key === 'ArrowDown') { e.preventDefault(); moveHighlight(1); }
      else if (key === 'ArrowUp') { e.preventDefault(); moveHighlight(-1); }
      else if (key === 'Enter') { e.preventDefault(); selectHighlighted(); }
    }
  }
  window.addEventListener('keydown', onKeydown, true);

  // Arka plana tıklayınca kapat (kart içinde başlayan sürüklemeler kapatmasın).
  let downOnBackdrop = false;
  root.addEventListener('pointerdown', (e) => { downOnBackdrop = (e.target === root); });
  root.addEventListener('click', (e) => {
    const wasBackdrop = downOnBackdrop && e.target === root;
    downOnBackdrop = false;
    if (wasBackdrop) close(null);
  });
  closeBtn.addEventListener('click', () => close(null));
  addBtn.addEventListener('click', finishInsert);
  pickBtn.addEventListener('click', chooseVaultFolder);

  vaultSel.addEventListener('change', () => {
    const v = vaultSel.value;
    if (v === '__pick') chooseVaultFolder();
    else changeVault(v);
  });

  search.addEventListener('input', () => {
    state.query = search.value;
    state.highlight = 0;
    renderNotes();
  });

  noteList.addEventListener('click', (e) => {
    const row = e.target.closest('.obsidian-note');
    if (!row) return;
    selectNote(row.dataset.rel, false);
    search.focus();
  });
  noteList.addEventListener('mouseover', (e) => {
    const row = e.target.closest('.obsidian-note');
    if (!row) return;
    const i = Number(row.dataset.index);
    if (i !== state.highlight && Number.isFinite(i)) {
      state.highlight = i;
      syncNoteClasses();
    }
  });

  outlineList.addEventListener('click', (e) => {
    const row = e.target.closest('.obsidian-entry');
    if (!row) return;
    const section = state.sectionByKey.get(row.dataset.key);
    if (section) chooseSection(section, false);
  });
  // Çift tık: seç ve (görüntü hazır olur olmaz) hemen ekle.
  outlineList.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.obsidian-entry');
    if (!row) return;
    const section = state.sectionByKey.get(row.dataset.key);
    if (section) chooseSection(section, true);
  });

  // ---------- Vault ----------

  async function chooseVaultFolder() {
    let p = null;
    try { p = await state.api.obsidianPickVault(); } catch { p = null; }
    if (picker !== state) return;
    if (!p) {
      const fallback = state.vault || (state.vaults[0] && state.vaults[0].path) || '__pick';
      vaultSel.value = fallback;
      return;
    }
    try { await state.api.obsidianSetVault(p); } catch { /* yok say */ }
    if (picker !== state) return;
    await loadVaults();
  }

  async function changeVault(path) {
    if (path === state.vault) return;
    try { await state.api.obsidianSetVault(path); } catch { /* yok say */ }
    if (picker !== state) return;
    await setVault(path);
  }

  async function loadVaults() {
    let res = null;
    try { res = await state.api.obsidianVaults(); } catch (err) { res = { error: errMsg(err) }; }
    if (picker !== state) return;

    if (!res || res.error) {
      showNoVaults(res && res.error ? res.error : t("Obsidian vault'u bulunamadı."));
      return;
    }

    state.vaults = Array.isArray(res.vaults) ? res.vaults.filter((v) => v && v.path) : [];
    if (!state.vaults.length) {
      showNoVaults();
      return;
    }

    showBody();
    const cur = (res.current && state.vaults.some((v) => v.path === res.current))
      ? res.current
      : state.vaults[0].path;
    fillVaultSelect(cur);
    await setVault(cur);
  }

  function fillVaultSelect(current) {
    vaultSel.textContent = '';
    for (const v of state.vaults) {
      const o = document.createElement('option');
      o.value = v.path;
      o.textContent = v.name || v.path;
      o.title = v.path;
      vaultSel.appendChild(o);
    }
    const pick = document.createElement('option');
    pick.value = '__pick';
    pick.textContent = t('Başka klasör seç…');
    vaultSel.appendChild(pick);
    if (current) vaultSel.value = current;
  }

  function showNoVaults(errorText) {
    state.vaults = [];
    fillVaultSelect(null);
    vaultSel.disabled = true;
    body.classList.add('hidden');
    none.classList.remove('hidden');
    noneMsg.textContent = errorText || t("Obsidian vault'u bulunamadı.");
    pickBtn.focus();
  }

  function showBody() {
    none.classList.add('hidden');
    body.classList.remove('hidden');
    vaultSel.disabled = false;
  }

  async function setVault(path) {
    state.vault = path;
    // Önceki seçimleri sıfırla.
    state.rel = null;
    state.section = null;
    state.outline = null;
    state.outlineError = '';
    state.outlineLoading = false;
    state.entryEls = [];
    state.sectionByKey = new Map();
    state.result = null;
    state.previewError = '';
    state.previewState = 'idle';
    state.insertOnReady = false;
    state.renderSeq++;
    clearTimeout(state.renderTimer);
    renderOutline();
    renderPreview();
    await loadNotes();
  }

  // ---------- Notlar ----------

  async function loadNotes() {
    const vault = state.vault;
    state.notesLoading = true;
    state.notesError = '';
    state.notes = [];
    state.shown = [];
    state.highlight = 0;
    renderNotes();

    let res = null;
    try { res = await state.api.obsidianNotes(vault); } catch (err) { res = { error: errMsg(err) }; }
    if (picker !== state || state.vault !== vault) return;

    state.notesLoading = false;
    if (res && res.error) {
      state.notesError = res.error;
    } else {
      state.notes = Array.isArray(res && res.notes) ? res.notes : [];
    }
    renderNotes();

    // Bu vault için son seçilen notu geri getir.
    const last = readLast()[vault];
    if (last && state.notes.some((n) => n.rel === last)) selectNote(last, true);
  }

  function renderNotes() {
    noteList.textContent = '';
    state.noteEls = [];

    if (state.notesLoading) {
      noteList.appendChild(mk('p', 'muted obsidian-msg', t('Yükleniyor…')));
      return;
    }
    if (state.notesError) {
      noteList.appendChild(mk('p', 'obsidian-error', state.notesError));
      return;
    }

    state.shown = filterNotes(state.notes, state.query);

    if (!state.notes.length) {
      noteList.appendChild(mk('p', 'muted obsidian-msg', t('Not bulunamadı.')));
      return;
    }
    if (!state.shown.length) {
      noteList.appendChild(mk('p', 'muted obsidian-msg', t('Aramaya uyan not yok.')));
      return;
    }

    const count = Math.min(state.shown.length, MAX_ROWS);
    if (state.highlight >= count) state.highlight = 0;

    for (let i = 0; i < count; i++) {
      const n = state.shown[i];
      const row = mk('div', 'obsidian-note');
      row.dataset.rel = n.rel;
      row.dataset.index = String(i);
      const name = mk('div', 'nname', n.name || n.rel);
      name.title = n.rel;
      row.appendChild(name);
      const folder = folderOf(n.rel);
      if (folder) row.appendChild(mk('div', 'npath', folder));
      state.noteEls.push(row);
      noteList.appendChild(row);
    }

    if (state.shown.length > MAX_ROWS) {
      noteList.appendChild(mk('p', 'muted obsidian-msg', `… ve ${state.shown.length - MAX_ROWS} not daha`));
    }

    syncNoteClasses();
  }

  function syncNoteClasses() {
    for (let i = 0; i < state.noteEls.length; i++) {
      const el = state.noteEls[i];
      el.classList.toggle('active', i === state.highlight);
      el.classList.toggle('selected', el.dataset.rel === state.rel);
    }
  }

  function moveHighlight(d) {
    if (!state.noteEls.length) return;
    const max = state.noteEls.length - 1;
    state.highlight = Math.max(0, Math.min(max, state.highlight + d));
    syncNoteClasses();
    const el = state.noteEls[state.highlight];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function selectHighlighted() {
    const n = state.shown[state.highlight];
    if (n) selectNote(n.rel, true);
  }

  function scrollNoteIntoView(rel) {
    // rAF kullanmıyoruz: pencere arka plandayken rAF durur, kaydırma da
    // yapılmaz. Liste satırları bu noktada zaten DOM'da.
    const el = state.noteEls.find((x) => x.dataset.rel === rel);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function selectNote(rel, scroll) {
    if (state.rel === rel) {
      if (scroll) scrollNoteIntoView(rel);
      return;
    }
    state.rel = rel;
    state.section = { kind: 'whole' };
    state.outline = null;
    state.outlineError = '';
    state.outlineLoading = true;
    state.entryEls = [];
    state.sectionByKey = new Map();
    const idx = state.shown.findIndex((n) => n.rel === rel);
    if (idx >= 0) state.highlight = idx;
    saveLast(state.vault, rel);
    syncNoteClasses();
    renderOutline();
    invalidatePreview();
    loadOutline(rel, state.vault);
    if (scroll) scrollNoteIntoView(rel);
  }

  // ---------- Başlıklar / bloklar ----------

  async function loadOutline(rel, vault) {
    let res = null;
    try { res = await state.api.obsidianOutline(vault, rel); } catch (err) { res = { error: errMsg(err) }; }
    if (picker !== state || state.vault !== vault || state.rel !== rel) return;

    state.outlineLoading = false;
    if (res && res.error) {
      state.outlineError = res.error;
      state.outline = null;
    } else {
      state.outline = (res && typeof res === 'object') ? res : { headings: [], blocks: [] };
    }
    renderOutline();
  }

  function addEntry(section, text, indent, level) {
    const key = sectionKey(section);
    const row = mk('div', 'obsidian-entry');
    row.dataset.key = key;
    if (indent) row.style.paddingLeft = `${8 + indent}px`;
    if (level) row.appendChild(mk('span', 'obsidian-h', 'H' + level));
    const label = mk('span', 'obsidian-entry-text', text);
    row.appendChild(label);
    row.title = text;
    state.entryEls.push(row);
    state.sectionByKey.set(key, section);
    outlineList.appendChild(row);
    return row;
  }

  function renderOutline() {
    outlineList.textContent = '';
    state.entryEls = [];
    state.sectionByKey = new Map();

    if (!state.rel) {
      outlineList.appendChild(mk('p', 'muted obsidian-msg', t('Bir not seç.')));
      return;
    }
    if (state.outlineLoading) {
      outlineList.appendChild(mk('p', 'muted obsidian-msg', t('Yükleniyor…')));
      return;
    }
    if (state.outlineError) {
      outlineList.appendChild(mk('p', 'obsidian-error', state.outlineError));
      return;
    }

    const out = state.outline || {};
    // İlk satır her zaman notun tamamı.
    addEntry({ kind: 'whole' }, t('Notun tamamı'), 0, null);

    for (const h of out.headings || []) {
      const section = { kind: 'heading', path: h.path, line: h.line };
      const level = Number(h.level) || 1;
      addEntry(section, h.text || t('(başlıksız)'), (level - 1) * 14, level);
    }

    const blocks = out.blocks || [];
    if (blocks.length) {
      outlineList.appendChild(mk('div', 'muted obsidian-label', t('Bloklar')));
      for (const b of blocks) {
        const section = { kind: 'block', id: b.id };
        const row = addEntry(section, `^${b.id} — ${b.preview || ''}`, 0, null);
        row.classList.add('obsidian-block');
      }
    }

    syncEntryClasses();
  }

  function syncEntryClasses() {
    const key = state.section ? sectionKey(state.section) : '';
    for (const el of state.entryEls) el.classList.toggle('selected', el.dataset.key === key);
  }

  function chooseSection(section, insert) {
    const same = state.section && sectionKey(state.section) === sectionKey(section);
    state.section = section;
    syncEntryClasses();
    if (same && state.previewState === 'ready' && state.result) {
      // Zaten hazır: yeniden görüntülemeye gerek yok.
      if (insert) finishInsert();
      return;
    }
    state.insertOnReady = !!insert;
    invalidatePreview();
  }

  // ---------- Önizleme ----------

  function setWidth(w) {
    if (w === state.width) return;
    state.width = w;
    saveWidth(w);
    syncWidths();
    if (state.rel && state.section) invalidatePreview();
    else renderPreview();
  }

  function syncWidths() {
    for (const b of widthBtns) b.classList.toggle('selected', Number(b.dataset.width) === state.width);
  }

  // Her seçim/genişlik değişiminde: eski isteği geçersiz kıl, görüntüyü
  // "hazırlanıyor" durumuna al, 150 ms sonra isteği gönder.
  function invalidatePreview() {
    state.renderSeq++;
    clearTimeout(state.renderTimer);
    state.result = null;
    if (!state.vault || !state.rel || !state.section) {
      state.previewState = 'idle';
      state.previewError = '';
      renderPreview();
      return;
    }
    state.previewState = 'loading';
    state.previewError = '';
    renderPreview();
    state.renderTimer = setTimeout(runRender, RENDER_DEBOUNCE);
  }

  async function runRender() {
    if (picker !== state) return;
    if (!state.vault || !state.rel || !state.section) return;

    const seq = state.renderSeq;
    const req = { vault: state.vault, rel: state.rel, section: state.section, width: state.width };

    let res = null;
    try { res = await state.api.obsidianRender(req); } catch (err) { res = { error: errMsg(err) }; }
    // Bu arada seçim değiştiyse veya katman kapandıysa yanıtı yok say.
    if (picker !== state || seq !== state.renderSeq) return;

    if (!res || res.error) {
      state.result = null;
      state.previewState = 'error';
      state.previewError = (res && res.error) || t('Önizleme oluşturulamadı.');
      renderPreview();
      return;
    }

    state.result = res;
    state.previewState = 'ready';
    state.previewError = '';
    renderPreview();

    if (state.insertOnReady) {
      state.insertOnReady = false;
      finishInsert();
    }
  }

  function renderPreview() {
    previewBox.textContent = '';
    if (state.previewState === 'loading') {
      previewBox.classList.add('msg');
      previewBox.appendChild(mk('p', 'muted obsidian-msg', t('Hazırlanıyor…')));
    } else if (state.previewState === 'error') {
      previewBox.classList.add('msg');
      previewBox.appendChild(mk('p', 'obsidian-error', state.previewError || t('Önizleme oluşturulamadı.')));
    } else if (state.previewState === 'ready' && state.result) {
      previewBox.classList.remove('msg');
      const img = document.createElement('img');
      img.src = state.result.src;
      img.alt = state.result.title || '';
      if (state.result.title) img.title = state.result.title;
      previewBox.appendChild(img);
    } else {
      previewBox.classList.add('msg');
      previewBox.appendChild(mk('p', 'muted obsidian-msg', t('Önizleme için bir not ve bölüm seç.')));
    }
    addBtn.disabled = !(state.previewState === 'ready' && state.result);
  }

  // ---------- Başlangıç ----------

  syncWidths();
  renderPreview();
  search.focus();
  loadVaults();

  return promise;
}
