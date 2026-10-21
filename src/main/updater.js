// Otomatik güncelleme: GitHub Releases'teki latest.yml denetlenir, yeni sürüm arka planda indirilir.
// İndirme bitince kullanıcıya sorulur; "Sonra" derse uygulama kapanırken sessizce kurulur.
// Kurmadan önce tahta renderer'da kaydedilir (menü komutu 'installUpdate'), sonra install() çağrılır.
// Geliştirirken (npm start) çalışmaz; denetim yalnızca kurulu uygulamada yapılır.

const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { L } = require('./i18n');

const FIRST_CHECK_DELAY = 10 * 1000;
const CHECK_INTERVAL = 4 * 60 * 60 * 1000;

let getWin = () => null;
let send = () => {};
let state = 'idle'; // 'checking' | 'downloading' | 'ready'
let manual = false; // kullanıcı menüden denetlediyse "güncel" / hata sonucu da gösterilir
let readyVersion = null;
let percent = 0; // indirme yüzdesi (rehberdeki durum satırı için)
let result = null; // son denetimin sonucu: 'uptodate' | 'error'
let errorText = '';
let lastProgressNotify = 0;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = null;

function message(opts) {
  const win = getWin();
  return win ? dialog.showMessageBox(win, { noLink: true, ...opts }) : dialog.showMessageBox({ noLink: true, ...opts });
}

function setProgress(p) {
  const win = getWin();
  if (win) win.setProgressBar(p);
}

// Rehberdeki "Güncellemeleri denetle" sekmesi durumu buradan okur. Sekme kapalıyken gönderilen
// olaylar kaybolur; sekme açılınca 'update:info' ile son durum bir bütün olarak alınır.
function status() {
  return { state, readyVersion, percent, result, error: errorText };
}

function notify() {
  const win = getWin();
  if (win && !win.isDestroyed()) win.webContents.send('update:state', status());
}

async function askInstall() {
  const { response } = await message({
    type: 'info',
    buttons: [L('Yeniden başlat ve kur'), L('Sonra')],
    defaultId: 0,
    cancelId: 1,
    title: L('Güncelleme hazır'),
    message: L('Beyaz Tahta {surum} indirildi.', { surum: readyVersion }),
    detail: L('Şimdi yeniden başlatılabilir. "Sonra" dersen uygulamayı kapattığında kurulur.'),
  });
  if (response === 0) send('installUpdate');
}

autoUpdater.on('update-available', (info) => {
  state = 'downloading';
  percent = 0;
  notify();
  if (manual) {
    message({
      type: 'info',
      title: L('Güncelleme bulundu'),
      message: L('Beyaz Tahta {surum} bulundu.', { surum: info.version }),
      detail: L('Arka planda indiriliyor; hazır olunca haber verilecek.'),
    });
  }
  manual = false;
});

autoUpdater.on('update-not-available', () => {
  state = 'idle';
  result = 'uptodate';
  errorText = '';
  notify();
  if (manual) {
    message({
      type: 'info',
      title: L('Güncelleme yok'),
      message: L('Beyaz Tahta güncel.'),
      detail: L('Sürüm {surum}', { surum: app.getVersion() }),
    });
  }
  manual = false;
});

autoUpdater.on('download-progress', (p) => {
  setProgress(p.percent / 100);
  percent = p.percent;
  const now = Date.now();
  if (now - lastProgressNotify >= 250) { lastProgressNotify = now; notify(); }
});

autoUpdater.on('update-downloaded', (info) => {
  state = 'ready';
  readyVersion = info.version;
  percent = 100;
  setProgress(-1);
  notify();
  askInstall();
});

// Otomatik denetimdeki hatalar (ör. internet yok) sessizce geçilir.
autoUpdater.on('error', (err) => {
  state = readyVersion ? 'ready' : 'idle';
  result = 'error';
  errorText = err?.message || String(err);
  setProgress(-1);
  notify();
  if (manual) {
    message({
      type: 'error',
      title: L('Güncelleme denetlenemedi'),
      message: L('Güncelleme denetlenemedi.'),
      detail: errorText,
    });
  }
  manual = false;
});

// quiet: rehberdeki sekmeden yapılan denetim; pencere açılmaz, sonuç sekmede yazılır.
function check(byUser = false, quiet = false) {
  const dialogs = byUser && !quiet;
  if (!app.isPackaged) {
    if (dialogs) message({ type: 'info', title: L('Güncelleme'), message: L('Geliştirme modunda güncelleme denetlenmez.') });
    return;
  }
  if (state === 'ready') {
    if (dialogs) askInstall();
    return;
  }
  if (state !== 'idle') {
    if (dialogs) message({ type: 'info', title: L('Güncelleme'), message: L('Güncelleme zaten denetleniyor ya da indiriliyor.') });
    return;
  }
  state = 'checking';
  manual = dialogs;
  result = null;
  errorText = '';
  percent = 0;
  notify();
  autoUpdater.checkForUpdates().catch(() => {}); // hata 'error' olayında ele alınır
}

// Renderer tahtayı kaydettikten sonra çağırır. Kurulum sessizdir, bitince uygulama yeniden açılır.
function install() {
  if (state === 'ready') autoUpdater.quitAndInstall(true, true);
}

// isEnabled: ayarlardaki "otomatik denetle" seçeneği; her denetimde yeniden okunur.
function init(opts) {
  getWin = opts.getWin;
  send = opts.send;
  if (!app.isPackaged) return;
  const auto = () => { if (opts.isEnabled()) check(false); };
  setTimeout(auto, FIRST_CHECK_DELAY);
  setInterval(auto, CHECK_INTERVAL);
}

module.exports = { init, check, install, status };
