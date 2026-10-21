const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeTheme, net, session } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const obsidian = require('./obsidian');
const mdrender = require('./mdrender');
const i18n = require('./i18n');
const updater = require('./updater');
const { L } = i18n;

const FILE_EXT = 'tahta';
const BOARD_FILTERS = [{ get name() { return L('Beyaz Tahta'); }, extensions: [FILE_EXT] }];
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

// Ayarlı vault bulunamazsa (ör. Drive sürücüsü bağlı değil) varsayılan klasör kullanılır; vault
// ayarı değiştirilmez. Kullanıcı yeni tahtaların başka klasöre gittiğini bilsin diye oturumda bir kez uyarılır.
let missingVaultWarned = false;

function boardsDir() {
  const dir = configuredVault();
  if (fs.existsSync(dir)) return dir;
  const def = defaultBoardsDir();
  fs.mkdirSync(def, { recursive: true });
  if (!missingVaultWarned && win && !samePath(dir, def)) {
    missingVaultWarned = true;
    dialog.showMessageBox(win, {
      type: 'warning',
      title: L('Vault bulunamadı.'),
      message: L('Vault klasörü bulunamadı: {yol}', { yol: dir }),
      detail: L('Sürücü bağlı olmayabilir. Şimdilik tahtalar şu klasöre kaydedilecek: {yol}', { yol: def }),
    });
  }
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
  if (!fs.existsSync(dir)) return { error: L('Bu klasör bulunamadı (sürücü bağlı olmayabilir).') };
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

function parseSettings(file) {
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  return s && typeof s === 'object' && !Array.isArray(s) ? s : null;
}

// Ayar dosyası bozulursa son sağlam kopya (settings.json.bak) kullanılır; böylece bir sonraki
// yazma vault listesini ve diğer ayarları silmez. Bozuk dosya incelenebilsin diye bir kez saklanır.
let brokenSettingsSaved = false;

function readSettings() {
  const file = settingsPath();
  try {
    const s = parseSettings(file);
    if (s) return s;
  } catch (err) {
    if (err.code === 'ENOENT') return {};
  }
  if (!brokenSettingsSaved) {
    brokenSettingsSaved = true;
    try { fs.copyFileSync(file, path.join(path.dirname(file), 'settings.broken.json')); } catch { /* yoksay */ }
  }
  try {
    return parseSettings(file + '.bak') || {};
  } catch {
    return {};
  }
}

function writeSettings(patch) {
  const file = settingsPath();
  const next = { ...readSettings(), ...patch };
  // Mevcut dosya sağlamsa yedeklenir; bozuksa eski yedek korunur.
  try {
    if (parseSettings(file)) fs.copyFileSync(file, file + '.bak');
  } catch { /* dosya yok ya da bozuk */ }
  writeFileAtomic(file, JSON.stringify(next, null, 2));
}

function timeStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function newBoardPath() {
  return path.join(boardsDir(), `${L('Tahta {zaman}', { zaman: timeStamp() })}.${FILE_EXT}`);
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
    // Bildiğimiz dosya kaybolmuş (başka cihazda silinmiş / taşınmış ya da senkron aracı o an
    // değiştiriyor): üzerine yazmak yerine çakışma kopyası olarak kaydedilir.
    return true;
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
// olmazsa doğrudan yazılır. Doğrudan yazma yarıda kalırsa tam içerik .tmp dosyasında durur
// (açılırken asıl dosya bozuksa oradan kurtarılır: recoverBoard).
function writeFileAtomic(filePath, data) {
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

function writeBoard(filePath, data) {
  writeFileAtomic(filePath, data);
}

function recoveryDir() {
  const dir = path.join(app.getPath('userData'), 'recovery');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Asıl dosya okunamıyorsa yarıda kalmış kaydın .tmp dosyasından kurtarmayı dener. Bozuk dosya
// silinmez, kurtarma klasörüne kopyalanır; tahta asıl yoluyla açılır, ilk kayıtta düzelir.
function recoverBoard(p) {
  const f = loadFile(p + '.tmp');
  if (!f) return null;
  try {
    fs.copyFileSync(p, path.join(recoveryDir(), `${path.basename(p, '.' + FILE_EXT)} (${L('bozuk')} ${timeStamp()}).${FILE_EXT}`));
  } catch { /* yoksay */ }
  setCurrentPath(p);
  known = null; // bozuk dosya çakışma sayılmasın, üzerine yazılsın
  return { path: p, data: f.data, recovered: true };
}

// Kaydetmeden önce dosya başka cihazda değişmişse üzerine yazmayız: bizim sürüm ayrı bir
// "çakışma" kopyası olarak kaydedilir ve bundan sonra o kopya düzenlenir.
function saveCurrent(json) {
  if (!currentPath) setCurrentPath(newBoardPath());
  let conflict = false;
  if (changedOnDisk(currentPath)) {
    const base = path.basename(currentPath, '.' + FILE_EXT);
    setCurrentPath(path.join(path.dirname(currentPath), `${L('{ad} (çakışma {zaman})', { ad: base, zaman: timeStamp() })}.${FILE_EXT}`));
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
  if (!f) return recoverBoard(p);
  setCurrentPath(p);
  remember(p, f.text);
  return { path: p, data: f.data };
}

function updateTitle() {
  if (!win) return;
  const name = currentPath ? path.basename(currentPath, '.' + FILE_EXT) : L('Yeni tahta');
  win.setTitle(`${name} — ${L('Beyaz Tahta')}`);
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
  const argFile = fileFromArgv(process.argv);
  const candidates = [argFile, readSettings().lastPath];
  let loadError = null;
  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      const res = openBoardFile(p);
      // fromArgv: dosyaya çift tıklanarak açıldı; aksi halde renderer galeriyi gösterir.
      if (res) return { ...res, fromArgv: p === argFile };
      // Bozuk dosyaya dokunulmaz; kullanıcıya bildirilir, yeni boş tahta açılır.
      if (!loadError) loadError = path.basename(p, '.' + FILE_EXT);
    }
  }
  setCurrentPath(newBoardPath());
  known = null;
  return { path: currentPath, data: null, loadError };
});

ipcMain.handle('board:save', (_e, json) => saveCurrent(json));

// Pencere kapanırken kaydeder. Kaydedilemezse içerik kurtarma klasörüne yazılır ve kullanıcıya
// sorulur; true dönerse pencere kapanır.
ipcMain.on('board:saveSync', (e, json) => {
  try {
    if (currentPath) saveCurrent(json);
    e.returnValue = true;
    return;
  } catch (err) {
    let copy = null;
    try {
      const base = currentPath ? path.basename(currentPath, '.' + FILE_EXT) : L('Tahta');
      copy = path.join(recoveryDir(), `${base} ${timeStamp()}.${FILE_EXT}`);
      fs.writeFileSync(copy, json);
    } catch {
      copy = null;
    }
    const r = dialog.showMessageBoxSync(win, {
      type: 'error',
      buttons: [L('Yine de kapat'), L('Vazgeç')],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: L('Kaydedilemedi'),
      message: L('Tahta kaydedilemedi: {hata}', { hata: err.message }),
      detail: copy
        ? L('Değişikliklerin bir kopyası şuraya kaydedildi: {yol}', { yol: copy })
        : L('Değişikliklerin kopyası da alınamadı. Kapatırsan kaydedilmemiş değişiklikler kaybolur.'),
    });
    e.returnValue = r === 0;
  }
});

// Otomatik kaydetme kapalıyken kaydedilmemiş değişiklik için sorulur: 'save' | 'discard' | 'cancel'.
// Senkron, çünkü pencere kapanırken (beforeunload) de kullanılır.
ipcMain.on('board:askUnsaved', (e) => {
  const r = dialog.showMessageBoxSync(win, {
    type: 'question',
    buttons: [L('Kaydet'), L('Kaydetme'), L('Vazgeç')],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    title: L('Kaydedilmemiş değişiklikler'),
    message: L('Tahtada kaydedilmemiş değişiklikler var. Kaydedilsin mi?'),
  });
  e.returnValue = ['save', 'discard', 'cancel'][r] || 'cancel';
});

ipcMain.handle('board:saveAs', async (_e, json) => {
  const res = await dialog.showSaveDialog(win, {
    title: L('Tahtayı farklı kaydet'),
    defaultPath: currentPath || newBoardPath(),
    filters: BOARD_FILTERS,
  });
  if (res.canceled || !res.filePath) return null;
  try {
    writeBoard(res.filePath, json);
  } catch (err) {
    dialog.showErrorBox(L('Kaydedilemedi'), err.message);
    return null;
  }
  setCurrentPath(res.filePath);
  remember(res.filePath, json);
  return res.filePath;
});

ipcMain.handle('board:open', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: L('Tahta aç'),
    defaultPath: boardsDir(),
    filters: BOARD_FILTERS,
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const opened = openBoardFile(res.filePaths[0]);
  if (!opened) dialog.showErrorBox(L('Açılamadı'), L('Bu dosya okunamadı veya bozuk.'));
  return opened;
});

// Explorer'da çift tıklanan dosyayı (uygulama zaten açıkken) ve galeriden seçileni açar.
ipcMain.handle('board:openPath', (_e, p) => {
  if (!isBoardFile(p)) return null;
  const opened = openBoardFile(p);
  if (!opened) dialog.showErrorBox(L('Açılamadı'), L('Bu dosya okunamadı veya bozuk.'));
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
  if (!isBoardFile(p) || !fs.existsSync(p)) return { error: L('Tahta bulunamadı.') };
  const name = safeName(newName);
  if (!name) return { error: L('Geçerli bir ad yaz.') };
  const target = path.join(path.dirname(p), `${name}.${FILE_EXT}`);
  if (target === p) return { path: p };
  if (fs.existsSync(target) && !samePath(target, p)) return { error: L('Bu adda bir tahta zaten var.') };
  try {
    fs.renameSync(p, target);
  } catch (err) {
    return { error: L('Yeniden adlandırılamadı: {hata}', { hata: err.message }) };
  }
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
      buttons: [L('Kalıcı olarak sil'), L('Vazgeç')],
      defaultId: 1,
      cancelId: 1,
      title: L('Çöp kutusuna taşınamadı'),
      message: L('Bu tahta çöp kutusuna taşınamadı.'),
      detail: L('Kalıcı olarak silinsin mi? Google Drive klasöründeyse Drive kendi çöp kutusunda bir süre saklar.'),
    });
    if (r.response !== 0) return { deleted: false };
    try {
      fs.unlinkSync(p);
    } catch (err) {
      return { deleted: false, error: L('Silinemedi: {hata}', { hata: err.message }) };
    }
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
    title: L('Vault olarak açılacak klasörü seç'),
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
    title: L('Yeni vault oluştur — konumu seç ve klasöre ad ver'),
    defaultPath: path.join(path.dirname(boardsDir()), L('Yeni vault')),
    buttonLabel: L('Oluştur'),
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  });
  if (res.canceled || !res.filePath) return null;
  const dir = res.filePath;
  try {
    if (fs.existsSync(dir)) {
      if (!fs.statSync(dir).isDirectory()) return { error: L('Bu adla bir dosya zaten var.') };
    } else {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    return { error: L('Klasör oluşturulamadı: {hata}', { hata: err.message }) };
  }
  return openVault(dir);
});

ipcMain.handle('vaults:switch', (_e, dir) => {
  if (typeof dir !== 'string' || !vaultList().some((v) => samePath(v, dir))) return { error: L('Vault bulunamadı.') };
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
    title: L('Obsidian vault klasörünü seç'),
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
  if (!v) return { error: L('Vault bulunamadı.') };
  return { notes: obsidian.listNotes(v) };
});

ipcMain.handle('obsidian:outline', (_e, dir, rel) => {
  const v = knownObsidianVault(dir);
  const abs = v && obsidianNotePath(v, rel);
  if (!abs) return { error: L('Not bulunamadı.') };
  try {
    return obsidian.parseOutline(fs.readFileSync(abs, 'utf8'));
  } catch {
    return { error: L('Not okunamadı.') };
  }
});

ipcMain.handle('obsidian:render', (_e, opts) => {
  const v = knownObsidianVault(opts?.vault);
  if (!v) return { error: L('Vault bulunamadı (sürücü bağlı olmayabilir).') };
  return mdrender.renderSection({ vault: v, rel: opts.rel, section: opts.section, width: opts.width });
});

// Notu (ve varsa bölümü) Obsidian uygulamasında açar.
ipcMain.handle('obsidian:open', (_e, opts) => {
  const v = knownObsidianVault(opts?.vault);
  if (!v || !obsidianNotePath(v, opts.rel)) return false;
  shell.openExternal(obsidian.obsidianUri(path.basename(v), opts.rel, opts.section));
  return true;
});

// Metin öğesindeki $…$ formüllerini şeffaf resme çevirir.
ipcMain.handle('math:render', (_e, opts) => {
  const text = typeof opts?.text === 'string' ? opts.text.slice(0, 5000) : '';
  const fontSize = Math.min(400, Math.max(4, Number(opts?.fontSize) || 24));
  const color = /^#[0-9a-f]{6}$/i.test(opts?.color) ? opts.color : '#1f2328';
  if (!text) return { error: L('Boş metin.') };
  return mdrender.renderMath({ text, fontSize, color });
});

// ---------- PDF ve yazdırma ----------
// Renderer tahtayı A4 sayfa resimlerine böler; burada resimler geçici bir HTML sayfasına konur ve
// gizli bir pencerede PDF'e çevrilir ya da yazdırılır.

function validPages(pages) {
  return Array.isArray(pages) && pages.length > 0 && pages.length <= 500 &&
    pages.every((p) => typeof p === 'string' && p.startsWith('data:image/jpeg;base64,'));
}

async function withPagesWindow(pages, landscape, run) {
  const dir = fs.mkdtempSync(path.join(app.getPath('temp'), 'beyaz-tahta-sayfa-'));
  let pw = null;
  try {
    const files = pages.map((p, i) => {
      const name = `sayfa-${i + 1}.jpg`;
      fs.writeFileSync(path.join(dir, name), Buffer.from(p.slice(p.indexOf(',') + 1), 'base64'));
      return name;
    });
    const [w, h] = landscape ? ['297mm', '210mm'] : ['210mm', '297mm'];
    // Sayfa yüksekliği bir tık kısa tutulur; tam A4 boyu yuvarlamayla araya boş sayfa sokabilir.
    const html = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file:; style-src 'unsafe-inline'">
<style>@page { size: ${w} ${h}; margin: 0 } html, body { margin: 0 }
.p { width: ${w}; height: calc(${h} - 0.5mm); overflow: hidden; break-after: page }
.p:last-child { break-after: auto } img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top }</style>
</head><body>${files.map((f) => `<div class="p"><img src="${f}"></div>`).join('')}</body></html>`;
    const file = path.join(dir, 'sayfalar.html');
    fs.writeFileSync(file, html);
    pw = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: 'beyaz-tahta-print' },
    });
    pw.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    await pw.loadFile(file);
    return await run(pw.webContents);
  } finally {
    if (pw && !pw.isDestroyed()) pw.destroy();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* yoksay */ }
  }
}

ipcMain.handle('export:pdf', async (_e, pages, landscape) => {
  if (!validPages(pages)) return { error: L('Geçersiz sayfa verisi.') };
  const base = currentPath ? path.basename(currentPath, '.' + FILE_EXT) : L('Tahta');
  const res = await dialog.showSaveDialog(win, {
    title: L('PDF olarak dışa aktar'),
    defaultPath: path.join(app.getPath('documents'), base + '.pdf'),
    filters: [{ name: 'PDF belgesi', extensions: ['pdf'] }],
  });
  if (res.canceled || !res.filePath) return null;
  try {
    const pdf = await withPagesWindow(pages, !!landscape, (wc) => wc.printToPDF({
      landscape: !!landscape,
      printBackground: true,
      preferCSSPageSize: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    }));
    fs.writeFileSync(res.filePath, pdf);
    return res.filePath;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('export:print', async (_e, pages, landscape) => {
  if (!validPages(pages)) return { error: L('Geçersiz sayfa verisi.') };
  try {
    return await withPagesWindow(pages, !!landscape, (wc) => new Promise((resolve) => {
      wc.print({ silent: false, printBackground: true, landscape: !!landscape, margins: { marginType: 'none' } }, (ok, reason) => {
        if (ok) resolve(true);
        else resolve(/cancel/i.test(reason || '') ? false : { error: reason || 'bilinmeyen hata' });
      });
    }));
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('export:png', async (_e, dataUrl) => {
  const base = currentPath ? path.basename(currentPath, '.' + FILE_EXT) : L('Tahta');
  const res = await dialog.showSaveDialog(win, {
    title: L('Resim olarak dışa aktar'),
    defaultPath: path.join(app.getPath('pictures'), base + '.png'),
    filters: [{ name: 'PNG resmi', extensions: ['png'] }],
  });
  if (res.canceled || !res.filePath) return null;
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  fs.writeFileSync(res.filePath, buf);
  return res.filePath;
});

// ---------- Web bağlantıları ----------
// Bağlantı kartı için sayfanın başlığını ve açıklamasını, tarayıcıdan sürüklenen resim için de resmin
// kendisini indirir. Yalnızca http(s) adresleri kabul edilir; okunan veri boyut ve süreyle sınırlıdır.

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/avif'];

function webUrl(u) {
  try {
    const x = new URL(String(u));
    return x.protocol === 'http:' || x.protocol === 'https:' ? x : null;
  } catch {
    return null;
  }
}

// En fazla maxBytes okur; truncate ise fazlası kesilir (sayfanın başı yeter), değilse hata verir.
async function fetchLimited(url, maxBytes, timeoutMs, truncate) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await net.fetch(url, { signal: ac.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const chunks = [];
    let total = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      chunks.push(Buffer.from(value));
      if (total > maxBytes) {
        reader.cancel().catch(() => {});
        if (!truncate) throw new Error(L('Dosya çok büyük.'));
        break;
      }
    }
    return { type: (res.headers.get('content-type') || '').toLowerCase(), buf: Buffer.concat(chunks), headers: res.headers };
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (_m, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" })[n])
    .replace(/\s+/g, ' ')
    .trim();
}

// <meta property/name="…" content="…"> etiketlerinden ve <title>'dan başlık ve açıklama.
function pageInfo(html) {
  const meta = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attr = (n) => new RegExp(String.raw`\b${n}\s*=\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag);
    const key = attr('property') || attr('name');
    const content = attr('content');
    if (key && content) meta[(key[2] ?? key[3]).toLowerCase()] ??= content[2] ?? content[3];
  }
  const title = meta['og:title'] || meta['twitter:title'] || /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '';
  const desc = meta['og:description'] || meta['twitter:description'] || meta.description || '';
  return { title: decodeEntities(title).slice(0, 200), desc: decodeEntities(desc).slice(0, 300) };
}

ipcMain.handle('link:info', async (_e, u) => {
  const url = webUrl(u);
  if (!url) return { error: L('Geçersiz adres.') };
  try {
    const { type, buf } = await fetchLimited(url.href, 512 * 1024, 8000, true);
    if (!type.includes('html')) return { title: '', desc: '' };
    return pageInfo(buf.toString('utf8'));
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('link:open', (_e, u) => {
  const url = webUrl(u);
  if (!url) return false;
  shell.openExternal(url.href);
  return true;
});

ipcMain.handle('net:image', async (_e, u) => {
  const url = webUrl(u);
  if (!url) return { error: L('Geçersiz adres.') };
  try {
    const { type, buf } = await fetchLimited(url.href, 20 * 1024 * 1024, 20000, false);
    const mime = type.split(';')[0].trim();
    if (!IMAGE_TYPES.includes(mime)) return { error: L('Adres bir resim değil.') };
    return { src: `data:${mime};base64,${buf.toString('base64')}` };
  } catch (err) {
    return { error: err.message };
  }
});

// ---------- Gömülü sayfalar (embed) ----------
// Embed, tahtada son ekran görüntüsüyle çizilir; çift tıklayınca aynı yerde canlı bir iframe açılır.
// Eklemeden önce sayfanın iframe içinde gösterilmeye izin verip vermediğine bakılır; izin vermeyen
// site bağlantı kartı olarak eklenir. Ekran görüntüsü, iframe kapanmadan hemen önce pencereden alınır.

const EMBED_SHOT_MAX = 1280; // ekran görüntüsünün en uzun kenarı (dosya boyutu küçük kalsın)
// Gömülü sayfaların isteyebileceği izinler; kamera, mikrofon, konum, bildirim vb. reddedilir.
const EMBED_PERMS = new Set(['fullscreen', 'clipboard-sanitized-write']);

// Sayfa iframe içinde gösterilmeyi yasaklıyor mu (X-Frame-Options ya da CSP frame-ancestors)?
// Uygulamanın kendi sayfası file:// adresinde olduğu için '*' dışındaki her frame-ancestors yasaktır.
function frameBlocked(headers) {
  const xfo = (headers.get('x-frame-options') || '').trim().toLowerCase();
  if (xfo && xfo !== 'allowall') return true;
  const fa = /(?:^|;)\s*frame-ancestors\s+([^;,]*)/i.exec(headers.get('content-security-policy') || '');
  return !!fa && !/(?:^|\s)\*(?:\s|$)/.test(fa[1]);
}

ipcMain.handle('embed:check', async (_e, u) => {
  const url = webUrl(u);
  if (!url) return { error: L('Geçersiz adres.') };
  try {
    const { type, buf, headers } = await fetchLimited(url.href, 512 * 1024, 8000, true);
    const info = type.includes('html') ? pageInfo(buf.toString('utf8')) : { title: '', desc: '' };
    return { blocked: frameBlocked(headers), title: info.title };
  } catch (err) {
    return { error: err.message };
  }
});

// r: iframe'in pencere içindeki yeri (CSS pikseli). Sonuç küçültülmüş bir JPEG.
ipcMain.handle('embed:capture', async (e, r) => {
  const z = e.sender.getZoomFactor();
  const rect = { x: Math.round(r.x * z), y: Math.round(r.y * z), width: Math.round(r.w * z), height: Math.round(r.h * z) };
  if (!(rect.width > 0 && rect.height > 0)) return { error: L('Geçersiz alan.') };
  try {
    // Pencere gizliyken (ör. simge durumunda) capturePage hiç dönmeyebilir.
    let img = await Promise.race([e.sender.capturePage(rect), new Promise((done) => setTimeout(done, 3000, null))]);
    if (!img || img.isEmpty()) return { error: L('Ekran görüntüsü alınamadı.') };
    const { width, height } = img.getSize();
    const k = Math.min(1, EMBED_SHOT_MAX / Math.max(width, height));
    if (k < 1) img = img.resize({ width: Math.round(width * k), height: Math.round(height * k), quality: 'good' });
    return { src: 'data:image/jpeg;base64,' + img.toJPEG(82).toString('base64') };
  } catch (err) {
    return { error: err.message };
  }
});

// Gömülü sayfalar uygulamanın kendi oturumunda çalışır; izinleri sınırlanır ve ana pencereyi
// başka bir adrese götüremez, yeni pencereleri varsayılan tarayıcıda açılır.
function setupEmbedSecurity() {
  const fromApp = (u) => String(u || '').startsWith('file:');
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, perm, cb, details) => cb(fromApp(details.requestingUrl) || EMBED_PERMS.has(perm)));
  ses.setPermissionCheckHandler((_wc, perm, origin) => fromApp(origin) || EMBED_PERMS.has(perm));
  // YouTube oynatıcısı gömen sayfayı Referer başlığından tanır; file:// sayfası bu başlığı
  // göndermediği için "Hata 153" verir. Yalnızca oynatıcı isteklerine uygulamanın adresi eklenir.
  const players = ['https://www.youtube-nocookie.com/embed/*', 'https://www.youtube.com/embed/*'];
  ses.webRequest.onBeforeSendHeaders({ urls: players }, (d, cb) => {
    if (!d.requestHeaders.Referer) d.requestHeaders.Referer = 'https://github.com/deezwend/beyaz-tahta';
    cb({ requestHeaders: d.requestHeaders });
  });
}

function guardWindow(w) {
  w.webContents.setWindowOpenHandler(({ url }) => {
    const u = webUrl(url);
    if (u) shell.openExternal(u.href);
    return { action: 'deny' };
  });
  w.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) e.preventDefault();
  });
}

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

// ---------- Dil ----------

// Kayıtlı bir tercih yoksa uygulama İngilizce açılır.
function initLang() {
  const saved = readSettings().lang;
  i18n.setLang(i18n.LANGS.includes(saved) ? saved : 'en');
}

// Preload sayfa yüklenirken senkron sorar; renderer metinleri bu dille kurulur.
ipcMain.on('lang:get', (e) => {
  e.returnValue = i18n.getLang();
});

// Renderer tahtayı kaydettikten sonra çağırır, ardından sayfayı yeniden yükler.
ipcMain.handle('lang:set', (_e, l) => {
  const next = i18n.setLang(l);
  writeSettings({ lang: next });
  buildMenu();
  updateTitle();
  return next;
});

// ---------- Güncelleme ----------

// Kayıtlı bir tercih yoksa otomatik denetim açıktır.
function autoUpdateEnabled() {
  return readSettings().autoUpdate !== false;
}

// Renderer tahtayı kaydettikten (ya da kullanıcı "Kaydetme" dedikten) sonra çağırır.
ipcMain.on('update:install', () => updater.install());

// Rehberdeki "Güncellemeleri denetle" sekmesi menüdeki ayarların aynısını gösterir. Denetim
// oradan sessizce yapılır; sonuç pencere (dialog) yerine sekmedeki durum satırında yazılır.
ipcMain.handle('update:info', () => ({
  version: app.getVersion(),
  auto: autoUpdateEnabled(),
  packaged: app.isPackaged,
  ...updater.status(),
}));
ipcMain.handle('update:auto', (_e, on) => {
  writeSettings({ autoUpdate: !!on });
  buildMenu(); // menüdeki onay imi sekmeyle aynı kalsın
  return autoUpdateEnabled();
});
ipcMain.on('update:check', () => updater.check(true, true));

// ---------- Menü ----------

function send(cmd) {
  if (win) win.webContents.send('menu', cmd);
}

function buildMenu() {
  const template = [
    {
      label: L('Dosya'),
      submenu: [
        { label: L('Tahtalarım'), accelerator: 'CmdOrCtrl+G', click: () => send('gallery') },
        { label: L('Yeni tahta'), accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: L('Aç…'), accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { label: L('Kaydet'), accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: L('Farklı kaydet…'), accelerator: 'CmdOrCtrl+Shift+S', click: () => send('saveAs') },
        { type: 'separator' },
        { label: L('Resim olarak dışa aktar (PNG)…'), accelerator: 'CmdOrCtrl+E', click: () => send('exportPng') },
        { label: L('PDF olarak dışa aktar…'), accelerator: 'CmdOrCtrl+Shift+E', click: () => send('exportPdf') },
        { label: L('Yazdır…'), accelerator: 'CmdOrCtrl+P', click: () => send('print') },
        { label: L("Obsidian'dan ekle… (B)"), click: () => send('obsidian') },
        { label: L('Obsidian bölümlerini yenile'), click: () => send('obsidianRefreshAll') },
        { type: 'separator' },
        { label: L('Dosya konumunu göster'), click: () => send('showFolder') },
        { label: L('Yeni vault oluştur…'), click: () => send('createVault') },
        { label: L('Klasörü vault olarak aç…'), click: () => send('openVault') },
        { type: 'separator' },
        { label: L('Çıkış'), role: 'quit' },
      ],
    },
    {
      label: L('Görünüm'),
      submenu: [
        { label: L('Yakınlaştır'), accelerator: 'CmdOrCtrl+=', click: () => send('zoomIn') },
        { label: L('Uzaklaştır'), accelerator: 'CmdOrCtrl+-', click: () => send('zoomOut') },
        { label: L('%100'), accelerator: 'CmdOrCtrl+0', click: () => send('zoomReset') },
        { label: L('Tümünü sığdır'), accelerator: 'CmdOrCtrl+1', click: () => send('zoomFit') },
        { type: 'separator' },
        { label: L('Tam ekran'), role: 'togglefullscreen' },
        { label: L('Geliştirici araçları'), accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        {
          // İki dilde de okunabilsin diye etiket sabittir.
          label: 'Dil / Language',
          submenu: [['tr', 'Türkçe'], ['en', 'English']].map(([code, label]) => ({
            label, type: 'radio', checked: i18n.getLang() === code, click: () => send('lang:' + code),
          })),
        },
      ],
    },
    {
      label: L('Yardım'),
      submenu: [
        { label: L('Rehber ve kısayollar'), accelerator: 'F1', click: () => send('help') },
        { type: 'separator' },
        { label: L('Güncellemeleri denetle…'), click: () => updater.check(true) },
        {
          label: L('Güncellemeleri otomatik denetle'),
          type: 'checkbox',
          checked: autoUpdateEnabled(),
          click: (item) => writeSettings({ autoUpdate: item.checked }),
        },
        { label: L('Sürüm {surum}', { surum: app.getVersion() }), enabled: false },
      ],
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
  guardWindow(win);
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
    initLang();
    setupEmbedSecurity();
    buildMenu();
    createWindow();
    updater.init({ getWin: () => win, send, isEnabled: autoUpdateEnabled });
  });
}

app.on('window-all-closed', () => app.quit());
