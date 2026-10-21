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

autoUpdater.on('download-progress', (p) => setProgress(p.percent / 100));

autoUpdater.on('update-downloaded', (info) => {
  state = 'ready';
  readyVersion = info.version;
  setProgress(-1);
  askInstall();
});

// Otomatik denetimdeki hatalar (ör. internet yok) sessizce geçilir.
autoUpdater.on('error', (err) => {
  state = readyVersion ? 'ready' : 'idle';
  setProgress(-1);
  if (manual) {
    message({
      type: 'error',
      title: L('Güncelleme denetlenemedi'),
      message: L('Güncelleme denetlenemedi.'),
      detail: err?.message || String(err),
    });
  }
  manual = false;
});

function check(byUser = false) {
  if (!app.isPackaged) {
    if (byUser) message({ type: 'info', title: L('Güncelleme'), message: L('Geliştirme modunda güncelleme denetlenmez.') });
    return;
  }
  if (state === 'ready') {
    if (byUser) askInstall();
    return;
  }
  if (state !== 'idle') {
    if (byUser) message({ type: 'info', title: L('Güncelleme'), message: L('Güncelleme zaten denetleniyor ya da indiriliyor.') });
    return;
  }
  state = 'checking';
  manual = byUser;
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

module.exports = { init, check, install };
