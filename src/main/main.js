const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const obsidian = require('./obsidian');
const mdrender = require('./mdrender');

const FILE_EXT = 'tahta';
const BOARD_FILTERS = [{ name: 'Beyaz Tahta', extensions: [FILE_EXT] }];
const THEMES = ['light', 'dark', 'system'];

let win = null;
let currentPath = null;
// Açık tahtanın diskte en son bildiğimiz hâli; başka bir cihazdan (ör. Google Drive senkronu)
// gelen değişikliği fark etmek için kullanılır.
let known = null; // { path, mtimeMs, hash }

// ---------- Dosya / ayar yardımcıları ----------

function defaultBoardsDir() {
  return path.join(app.getPath('documents'), 'Beyaz Tahta');
}

// Vault: tahtaların saklandığı klasör (ör. Google Drive içindeki bir klasör). Açılan her klasör
// vault listesine eklenir; aralarında galeriden geçilir. Ayar bu bilgisayara özeldir; Drive başka
// bilgisayarda farklı sürücü harfiyle bağlanmış olabilir. ("boardsDir" eski sürümlerin ayarıdır.)
function configuredVault() {
  const s = readSettings();
  return s.vault || s.boardsDir || defaultBoardsDir();
}

function boardsDir() {
  const dir = configuredVault();
  if (fs.existsSync(dir)) return dir;
  const def = defaultBoardsDir();
  fs.mkdirSync(def, { recursive: true });
  return def;
}

function vaultList() {
  const s = readSettings();
  const list = Array.isArray(s.vaults) ? s.vaults.filter((v) => typeof v === 'string') : [];
  const cur = configuredVault();
  if (!list.some((v) => samePath(v, cur))) list.unshift(cur);
  return list;
}

// Klasörü açık vault yapar ve listeye ekler (zaten varsa yerinde bırakılır).
function setVault(dir) {
  const vaults = vaultList();
  if (!vaults.some((v) => samePath(v, dir))) vaults.push(dir);
  writeSettings({ vault: dir, vaults });
}

function inDir(p, dir) {
  return samePath(path.dirname(p), dir);
}

// Vault'a geçince açılacak tahta: o vault'ta en son açık olan, yoksa en son değiştirilen.
function boardToOpenIn(dir) {
  const last = (readSettings().vaultLast || {})[path.resolve(dir).toLowerCase()];
  if (last && inDir(last, dir) && fs.existsSync(last)) return last;
  let best = null;
  for (const p of listBoardFiles(dir)) {
    try {
      const m = fs.statSync(p).mtimeMs;
      if (!best || m > best.m) best = { p, m };
    } catch { /* okunamayanı atla */ }
  }
  return best?.p || null;
}

// Vault'a geçer ve oradaki tahtayı açar; tahta yoksa (kaydedilince oluşacak) yeni boş tahta.
function openVault(dir) {
  if (!fs.existsSync(dir)) return { error: 'Bu klasör bulunamadı (sürücü bağlı olmayabilir).' };
  setVault(dir);
  const p = boardToOpenIn(dir);
  const opened = p && openBoardFile(p);
  if (opened) return opened;
  setCurrentPath(newBoardPath());
  known = null;
  return { path: currentPath, data: null };
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
}

function timeStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function newBoardPath() {
  return path.join(boardsDir(), `Tahta ${timeStamp()}.${FILE_EXT}`);
}

function isBoardFile(p) {
  return typeof p === 'string' && p.toLowerCase().endsWith('.' + FILE_EXT);
}

function samePath(a, b) {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

function hashOf(text) {
  return crypto.createHash('sha1').update(text).digest('hex');
}

function remember(filePath, text) {
  try {
    known = { path: filePath, mtimeMs: fs.statSync(filePath).mtimeMs, hash: hashOf(text) };
  } catch {
    known = null;
  }
}

// Dosyayı okur; açık tahta olarak hatırlanabilmesi için metnini de döndürür.
function loadFile(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return { text, data: JSON.parse(text) };
  } catch {
    return null;
  }
}

// Dosya, biz son okuduğumuzdan/yazdığımızdan beri başka biri tarafından değiştirildi mi?
// Senkron araçları bazen yalnızca tarihi günceller; bu yüzden tarih değiştiyse içeriğe de bakılır.
function changedOnDisk(filePath) {
  if (!known || known.path !== filePath) return false;
  let st;
  try {
    st = fs.statSync(filePath);
  } catch {
    return false; // dosya silinmişse yeniden oluşturulur
  }
  if (st.mtimeMs === known.mtimeMs) return false;
  try {
    const hash = hashOf(fs.readFileSync(filePath, 'utf8'));
    if (hash === known.hash) {
      known.mtimeMs = st.mtimeMs;
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Yarım kalmış yazmada dosyanın bozulmaması için önce geçici dosyaya yazıp sonra taşıyoruz.
// Google Drive / OneDrive dosyayı yüklerken kısa süre kilitleyebilir; taşıma birkaç kez denenir,
// olmazsa doğrudan yazılır.
function writeBoard(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, data);
  for (let i = 0; i < 6; i++) {
    try {
      fs.renameSync(tmp, filePath);
      return;
    } catch (err) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
      sleepSync(60 * (i + 1));
    }
  }
  fs.writeFileSync(filePath, data);
  try { fs.unlinkSync(tmp); } catch { /* yoksay */ }
}

// Kaydetmeden önce dosya başka cihazda değişmişse üzerine yazmayız: bizim sürüm ayrı bir
// "çakışma" kopyası olarak kaydedilir ve bundan sonra o kopya düzenlenir.
function saveCurrent(json) {
  if (!currentPath) setCurrentPath(newBoardPath());
  let conflict = false;
  if (changedOnDisk(currentPath)) {
    const base = path.basename(currentPath, '.' + FILE_EXT);
    setCurrentPath(path.join(path.dirname(currentPath), `${base} (çakışma ${timeStamp()}).${FILE_EXT}`));
    conflict = true;
  }
  writeBoard(currentPath, json);
  remember(currentPath, json);
  return { path: currentPath, conflict };
}

function setCurrentPath(p) {
  currentPath = p;
  const patch = { lastPath: p };
  // Her vault kendi son açık tahtasını hatırlar; vault dışından açılan dosyalar bunu değiştirmez.
  const vault = boardsDir();
  if (inDir(p, vault)) {
    patch.vaultLast = { ...(readSettings().vaultLast || {}), [path.resolve(vault).toLowerCase()]: p };
  }
  writeSettings(patch);
  updateTitle();
}

// Açık tahtanın dosyası taşındığında / yeniden adlandırıldığında yolu günceller.
function currentMoved(from, to) {
  if (!currentPath || !samePath(currentPath, from)) return;
  setCurrentPath(to);
  if (known) known.path = to;
}

function openBoardFile(p) {
  const f = loadFile(p);
  if (!f) return null;
  setCurrentPath(p);
  remember(p, f.text);
  return { path: p, data: f.data };
}

function updateTitle() {
  if (!win) return;
  const name = currentPath ? path.basename(currentPath, '.' + FILE_EXT) : 'Yeni tahta';
  win.setTitle(`${name} — Beyaz Tahta`);
}

function fileFromArgv(argv) {
  return argv.find((a) => isBoardFile(a) && fs.existsSync(a));
}

// Galeri için küçük resim: kaydedilen JSON "thumb" alanıyla başlar, böylece büyük dosyaların
// tamamını okumadan yalnızca başından alınabilir.
const THUMB_RE = /^\{"thumb":"(data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+)"/;

function readThumb(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(256 * 1024);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    const m = THUMB_RE.exec(buf.toString('utf8', 0, n));
    return m ? m[1] : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// Dosya adında Windows'un kabul etmediği karakterleri temizler.
function safeName(name) {
  return String(name).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/[. ]+$/, '').trim().slice(0, 120);
}

function listBoardFiles(dir) {
  try {
    return fs.readdirSync(dir).filter(isBoardFile).map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

// ---------- IPC ----------

ipcMain.handle('board:loadInitial', () => {
  const candidates = [fileFromArgv(process.argv), readSettings().lastPath];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      const res = openBoardFile(p);
      if (res) return res;
    }
  }
  setCurrentPath(newBoardPath());
  known = null;
  return { path: currentPath, data: null };
});

ipcMain.handle('board:save', (_e, json) => saveCurrent(json));

ipcMain.on('board:saveSync', (e, json) => {
  try {
    if (currentPath) saveCurrent(json);
    e.returnValue = true;
  } catch {
    e.returnValue = false;
  }
});

// Otomatik kaydetme kapalıyken kaydedilmemiş değişiklik için sorulur: 'save' | 'discard' | 'cancel'.
// Senkron, çünkü pencere kapanırken (beforeunload) de kullanılır.
ipcMain.on('board:askUnsaved', (e) => {
  const r = dialog.showMessageBoxSync(win, {
    type: 'question',
    buttons: ['Kaydet', 'Kaydetme', 'Vazgeç'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    title: 'Kaydedilmemiş değişiklikler',
    message: 'Tahtada kaydedilmemiş değişiklikler var. Kaydedilsin mi?',
  });
  e.returnValue = ['save', 'discard', 'cancel'][r] || 'cancel';
});

ipcMain.handle('board:saveAs', async (_e, json) => {
  const res = await dialog.showSaveDialog(win, {
    title: 'Tahtayı farklı kaydet',
    defaultPath: currentPath || newBoardPath(),
    filters: BOARD_FILTERS,
  });
  if (res.canceled || !res.filePath) return null;
  writeBoard(res.filePath, json);
  setCurrentPath(res.filePath);
  remember(res.filePath, json);
  return res.filePath;
});

ipcMain.handle('board:open', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Tahta aç',
    defaultPath: boardsDir(),
    filters: BOARD_FILTERS,
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const opened = openBoardFile(res.filePaths[0]);
  if (!opened) dialog.showErrorBox('Açılamadı', 'Bu dosya okunamadı veya bozuk.');
  return opened;
});

// Explorer'da çift tıklanan dosyayı (uygulama zaten açıkken) ve galeriden seçileni açar.
ipcMain.handle('board:openPath', (_e, p) => {
  if (!isBoardFile(p)) return null;
  const opened = openBoardFile(p);
  if (!opened) dialog.showErrorBox('Açılamadı', 'Bu dosya okunamadı veya bozuk.');
  return opened;
});

ipcMain.handle('board:new', () => {
  setCurrentPath(newBoardPath());
  known = null;
  return currentPath;
});

// Pencere odaklandığında: açık tahta başka cihazda güncellendiyse yeni hâlini döndürür.
ipcMain.handle('board:checkExternal', () => {
  if (!currentPath || !changedOnDisk(currentPath)) return null;
  const f = loadFile(currentPath);
  if (!f) return null;
  remember(currentPath, f.text);
  return { path: currentPath, data: f.data };
});

ipcMain.handle('board:showFolder', () => {
  if (currentPath && fs.existsSync(currentPath)) shell.showItemInFolder(currentPath);
  else shell.openPath(boardsDir());
});

// ---------- Galeri ----------

ipcMain.handle('boards:list', () => {
  const dir = boardsDir();
  const boards = [];
  for (const p of listBoardFiles(dir)) {
    try {
      const st = fs.statSync(p);
      boards.push({
        path: p,
        name: path.basename(p, '.' + FILE_EXT),
        mtime: st.mtimeMs,
        thumb: readThumb(p),
      });
    } catch { /* okunamayanı atla */ }
  }
  boards.sort((a, b) => b.mtime - a.mtime);
  const list = vaultList();
  if (!list.some((v) => samePath(v, dir))) list.push(dir); // ayarlı vault yoksa varsayılan klasör
  const vaults = list.map((v) => ({
    path: v,
    name: path.basename(v) || v,
    current: samePath(v, dir),
    missing: !fs.existsSync(v),
  }));
  return { dir, current: currentPath, boards, vaults };
});

ipcMain.handle('boards:rename', (_e, p, newName) => {
  if (!isBoardFile(p) || !fs.existsSync(p)) return { error: 'Tahta bulunamadı.' };
  const name = safeName(newName);
  if (!name) return { error: 'Geçerli bir ad yaz.' };
  const target = path.join(path.dirname(p), `${name}.${FILE_EXT}`);
  if (target === p) return { path: p };
  if (fs.existsSync(target) && !samePath(target, p)) return { error: 'Bu adda bir tahta zaten var.' };
  fs.renameSync(p, target);
  currentMoved(p, target);
  return { path: target };
});

ipcMain.handle('boards:delete', async (_e, p) => {
  if (!isBoardFile(p) || !fs.existsSync(p)) return { deleted: false };
  try {
    await shell.trashItem(p);
  } catch {
    // Bazı senkron klasörleri (ör. Google Drive sürücüsü) Windows çöp kutusunu desteklemez.
    const r = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Kalıcı olarak sil', 'Vazgeç'],
      defaultId: 1,
      cancelId: 1,
      title: 'Çöp kutusuna taşınamadı',
      message: 'Bu tahta çöp kutusuna taşınamadı.',
      detail: 'Kalıcı olarak silinsin mi? Google Drive klasöründeyse Drive kendi çöp kutusunda bir süre saklar.',
    });
    if (r.response !== 0) return { deleted: false };
    fs.unlinkSync(p);
  }
  const wasCurrent = !!currentPath && samePath(currentPath, p);
  if (wasCurrent) {
    setCurrentPath(newBoardPath());
    known = null;
  }
  return { deleted: true, wasCurrent };
});

// ---------- Vault'lar ----------

// Bir klasörü vault olarak açar: tahtalar taşınmaz, o klasördeki tahtalarla çalışılır.
ipcMain.handle('vaults:open', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Vault olarak açılacak klasörü seç',
    defaultPath: boardsDir(),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return openVault(res.filePaths[0]);
});

// Yeni vault: seçilen konumda verilen adla boş bir klasör oluşturur ve onu vault olarak açar.
// Kaydetme penceresi hem konumu hem klasör adını tek adımda seçtirir.
ipcMain.handle('vaults:create', async () => {
  const res = await dialog.showSaveDialog(win, {
    title: 'Yeni vault oluştur — konumu seç ve klasöre ad ver',
    defaultPath: path.join(path.dirname(boardsDir()), 'Yeni vault'),
    buttonLabel: 'Oluştur',
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  });
  if (res.canceled || !res.filePath) return null;
  const dir = res.filePath;
  try {
    if (fs.existsSync(dir)) {
      if (!fs.statSync(dir).isDirectory()) return { error: 'Bu adla bir dosya zaten var.' };
    } else {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    return { error: 'Klasör oluşturulamadı: ' + err.message };
  }
  return openVault(dir);
});

ipcMain.handle('vaults:switch', (_e, dir) => {
  if (typeof dir !== 'string' || !vaultList().some((v) => samePath(v, dir))) return { error: 'Vault bulunamadı.' };
  return openVault(dir);
});

// Vault'u yalnızca listeden çıkarır; klasördeki dosyalara dokunulmaz.
ipcMain.handle('vaults:remove', (_e, dir) => {
  if (typeof dir !== 'string' || samePath(dir, configuredVault())) return false;
  const s = readSettings();
  const key = path.resolve(dir).toLowerCase();
  const vaultLast = { ...(s.vaultLast || {}) };
  delete vaultLast[key];
  writeSettings({ vaults: vaultList().filter((v) => !samePath(v, dir)), vaultLast });
  return true;
});

// ---------- Obsidian ----------

// Obsidian'ın kendi listesindeki vault'lar ve kullanıcının elle seçtiği klasörler.
function obsidianVaults() {
  const s = readSettings();
  const list = obsidian.detectVaults(app.getPath('appData')).map((v) => ({ path: v.path, name: v.name }));
  for (const p of Array.isArray(s.obsidianVaults) ? s.obsidianVaults : []) {
    if (typeof p === 'string' && fs.existsSync(p) && !list.some((v) => samePath(v.path, p))) {
      list.push({ path: p, name: path.basename(p) || p });
    }
  }
  const saved = list.find((v) => s.obsidianVault && samePath(v.path, s.obsidianVault));
  return { vaults: list, current: (saved || list[0])?.path || null };
}

// Renderer'dan gelen vault yolu yalnızca bilinen vault'lardan biriyse kabul edilir.
function knownObsidianVault(dir) {
  if (typeof dir !== 'string') return null;
  return obsidianVaults().vaults.find((v) => samePath(v.path, dir))?.path || null;
}

function obsidianNotePath(vault, rel) {
  const abs = path.resolve(vault, String(rel || ''));
  const r = path.relative(path.resolve(vault), abs);
  if (!r || r.startsWith('..') || path.isAbsolute(r) || !/\.md$/i.test(abs)) return null;
  return abs;
}

ipcMain.handle('obsidian:vaults', () => obsidianVaults());

ipcMain.handle('obsidian:pickVault', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Obsidian vault klasörünü seç',
    properties: ['openDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const dir = res.filePaths[0];
  const extra = (readSettings().obsidianVaults || []).filter((p) => typeof p === 'string' && !samePath(p, dir));
  writeSettings({ obsidianVaults: [...extra, dir], obsidianVault: dir });
  return dir;
});

ipcMain.handle('obsidian:setVault', (_e, dir) => {
  const v = knownObsidianVault(dir);
  if (v) writeSettings({ obsidianVault: v });
  return !!v;
});

ipcMain.handle('obsidian:notes', (_e, dir) => {
  const v = knownObsidianVault(dir);
  if (!v) return { error: 'Vault bulunamadı.' };
  return { notes: obsidian.listNotes(v) };
});

ipcMain.handle('obsidian:outline', (_e, dir, rel) => {
  const v = knownObsidianVault(dir);
  const abs = v && obsidianNotePath(v, rel);
  if (!abs) return { error: 'Not bulunamadı.' };
  try {
    return obsidian.parseOutline(fs.readFileSync(abs, 'utf8'));
  } catch {
    return { error: 'Not okunamadı.' };
  }
});

ipcMain.handle('obsidian:render', (_e, opts) => {
  const v = knownObsidianVault(opts?.vault);
  if (!v) return { error: 'Vault bulunamadı (sürücü bağlı olmayabilir).' };
  return mdrender.renderSection({ vault: v, rel: opts.rel, section: opts.section, width: opts.width });
});

// Notu (ve varsa bölümü) Obsidian uygulamasında açar.
ipcMain.handle('obsidian:open', (_e, opts) => {
  const v = knownObsidianVault(opts?.vault);
  if (!v || !obsidianNotePath(v, opts.rel)) return false;
  shell.openExternal(obsidian.obsidianUri(path.basename(v), opts.rel, opts.section));
  return true;
});

ipcMain.handle('export:png', async (_e, dataUrl) => {
  const base = currentPath ? path.basename(currentPath, '.' + FILE_EXT) : 'Tahta';
  const res = await dialog.showSaveDialog(win, {
    title: 'Resim olarak dışa aktar',
    defaultPath: path.join(app.getPath('pictures'), base + '.png'),
    filters: [{ name: 'PNG resmi', extensions: ['png'] }],
  });
  if (res.canceled || !res.filePath) return null;
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  fs.writeFileSync(res.filePath, buf);
  return res.filePath;
});

// ---------- Tema ----------

// nativeTheme.themeSource hem pencerenin CSS'teki prefers-color-scheme değerini hem de
// sistem öğelerini (kaydırma çubukları vb.) seçilen temaya göre değiştirir.
function applyTheme(mode) {
  nativeTheme.themeSource = THEMES.includes(mode) ? mode : 'system';
}

ipcMain.handle('theme:get', () => {
  const mode = readSettings().theme;
  return THEMES.includes(mode) ? mode : 'system';
});

ipcMain.handle('theme:set', (_e, mode) => {
  const next = THEMES.includes(mode) ? mode : 'system';
  writeSettings({ theme: next });
  applyTheme(next);
  return next;
});

// ---------- Menü ----------

function send(cmd) {
  if (win) win.webContents.send('menu', cmd);
}

function buildMenu() {
  const template = [
    {
      label: 'Dosya',
      submenu: [
        { label: 'Tahtalarım', accelerator: 'CmdOrCtrl+G', click: () => send('gallery') },
        { label: 'Yeni tahta', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: 'Aç…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { label: 'Kaydet', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: 'Farklı kaydet…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('saveAs') },
        { type: 'separator' },
        { label: 'Resim olarak dışa aktar (PNG)…', accelerator: 'CmdOrCtrl+E', click: () => send('exportPng') },
        { label: "Obsidian'dan ekle… (B)", click: () => send('obsidian') },
        { label: 'Obsidian bölümlerini yenile', click: () => send('obsidianRefreshAll') },
        { type: 'separator' },
        { label: 'Dosya konumunu göster', click: () => send('showFolder') },
        { label: 'Yeni vault oluştur…', click: () => send('createVault') },
        { label: 'Klasörü vault olarak aç…', click: () => send('openVault') },
        { type: 'separator' },
        { label: 'Çıkış', role: 'quit' },
      ],
    },
    {
      label: 'Görünüm',
      submenu: [
        { label: 'Yakınlaştır', accelerator: 'CmdOrCtrl+=', click: () => send('zoomIn') },
        { label: 'Uzaklaştır', accelerator: 'CmdOrCtrl+-', click: () => send('zoomOut') },
        { label: '%100', accelerator: 'CmdOrCtrl+0', click: () => send('zoomReset') },
        { label: 'Tümünü sığdır', accelerator: 'CmdOrCtrl+1', click: () => send('zoomFit') },
        { type: 'separator' },
        { label: 'Tam ekran', role: 'togglefullscreen' },
        { label: 'Geliştirici araçları', accelerator: 'F12', role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Yardım',
      submenu: [{ label: 'Rehber ve kısayollar', accelerator: 'F1', click: () => send('help') }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- Pencere ----------

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  updateTitle();
  win.on('closed', () => {
    win = null;
    mdrender.disposeRenderer();
  });
}

// Tek pencere: ikinci kez açılınca (ör. .tahta dosyasına çift tıklayınca) mevcut pencere kullanılır.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    const file = fileFromArgv(argv);
    if (file) win.webContents.send('openPath', file);
  });

  app.whenReady().then(() => {
    applyTheme(readSettings().theme);
    buildMenu();
    createWindow();
  });
}

app.on('window-all-closed', () => app.quit());
