// Ana süreç için dil desteği. Metinler kodda Türkçe yazılır; Türkçe metin anahtardır,
// İngilizce karşılığı EN tablosundadır. Tabloda olmayan metin Türkçe kalır.
// {ad} biçimindeki yer tutucular params nesnesiyle doldurulur.

const LANGS = ['tr', 'en'];
let lang = 'en';

const EN = {
  // Menü
  'Dosya': 'File',
  'Tahtalarım': 'My boards',
  'Yeni tahta': 'New board',
  'Aç…': 'Open…',
  'Kaydet': 'Save',
  'Farklı kaydet…': 'Save as…',
  'Resim olarak dışa aktar (PNG)…': 'Export as image (PNG)…',
  'PDF olarak dışa aktar…': 'Export as PDF…',
  'Yazdır…': 'Print…',
  "Obsidian'dan ekle… (B)": 'Insert from Obsidian… (B)',
  'Obsidian bölümlerini yenile': 'Refresh Obsidian sections',
  'Dosya konumunu göster': 'Show file location',
  'Yeni vault oluştur…': 'Create new vault…',
  'Klasörü vault olarak aç…': 'Open folder as vault…',
  'Çıkış': 'Exit',
  'Görünüm': 'View',
  'Yakınlaştır': 'Zoom in',
  'Uzaklaştır': 'Zoom out',
  'Tümünü sığdır': 'Fit all',
  '%100': '100%',
  'Tam ekran': 'Full screen',
  'Geliştirici araçları': 'Developer tools',
  'Yardım': 'Help',
  'Rehber ve kısayollar': 'Guide and shortcuts',
  // Pencere başlığı, dosya adları
  'Beyaz Tahta': 'Whiteboard',
  'Tahta': 'Board',
  'Tahta {zaman}': 'Board {zaman}',
  '{ad} (çakışma {zaman})': '{ad} (conflict {zaman})',
  'Yeni vault': 'New vault',
  // Pencereler
  'Kaydetme': "Don't save",
  'Vazgeç': 'Cancel',
  'Kaydedilmemiş değişiklikler': 'Unsaved changes',
  'Tahtada kaydedilmemiş değişiklikler var. Kaydedilsin mi?': 'The board has unsaved changes. Save them?',
  'Tahtayı farklı kaydet': 'Save board as',
  'Tahta aç': 'Open board',
  'Açılamadı': 'Could not open',
  'Bu dosya okunamadı veya bozuk.': 'This file could not be read or is corrupted.',
  'Kalıcı olarak sil': 'Delete permanently',
  'Çöp kutusuna taşınamadı': 'Could not move to Recycle Bin',
  'Bu tahta çöp kutusuna taşınamadı.': 'This board could not be moved to the Recycle Bin.',
  'Kalıcı olarak silinsin mi? Google Drive klasöründeyse Drive kendi çöp kutusunda bir süre saklar.':
    'Delete it permanently? If it is in a Google Drive folder, Drive keeps it in its own trash for a while.',
  'Vault olarak açılacak klasörü seç': 'Choose the folder to open as a vault',
  'Yeni vault oluştur — konumu seç ve klasöre ad ver': 'Create new vault — choose a location and name the folder',
  'Oluştur': 'Create',
  'Obsidian vault klasörünü seç': 'Choose the Obsidian vault folder',
  'PDF olarak dışa aktar': 'Export as PDF',
  'Resim olarak dışa aktar': 'Export as image',
  // Hata iletileri (renderer'a dönenler)
  'Bu klasör bulunamadı (sürücü bağlı olmayabilir).': 'Folder not found (the drive may not be connected).',
  'Tahta bulunamadı.': 'Board not found.',
  'Geçerli bir ad yaz.': 'Enter a valid name.',
  'Bu adla bir dosya zaten var.': 'A file with this name already exists.',
  'Klasör oluşturulamadı: {hata}': 'Could not create folder: {hata}',
  'Vault bulunamadı.': 'Vault not found.',
  'Not bulunamadı.': 'Note not found.',
  'Not okunamadı.': 'Could not read note.',
  'Vault bulunamadı (sürücü bağlı olmayabilir).': 'Vault not found (the drive may not be connected).',
  'Boş metin.': 'Empty text.',
  'Geçersiz sayfa verisi.': 'Invalid page data.',
  'Geçersiz not yolu.': 'Invalid note path.',
  'Not bulunamadı; taşınmış ya da silinmiş olabilir.': 'Note not found; it may have been moved or deleted.',
  'Bölüm notta bulunamadı; başlığın adı değişmiş olabilir.': 'Section not found in the note; the heading may have been renamed.',
  'Bölüm resme dönüştürülemedi: {hata}': 'Could not render the section: {hata}',
  'Formül çizilemedi: {hata}': 'Could not render the formula: {hata}',
  'Geçersiz adres.': 'Invalid address.',
  'Dosya çok büyük.': 'The file is too large.',
  'Adres bir resim değil.': 'The address is not an image.',
  'Geçersiz alan.': 'Invalid area.',
  'Ekran görüntüsü alınamadı.': 'Could not take a snapshot.',
  'Bu adda bir tahta zaten var.': 'A board with this name already exists.',
  'Yeniden adlandırılamadı: {hata}': 'Could not rename: {hata}',
  'Silinemedi: {hata}': 'Could not delete: {hata}',
  // Veri kaybına karşı uyarılar
  'Vault klasörü bulunamadı: {yol}': 'Vault folder not found: {yol}',
  'Sürücü bağlı olmayabilir. Şimdilik tahtalar şu klasöre kaydedilecek: {yol}':
    'The drive may not be connected. For now, boards will be saved to: {yol}',
  'Kaydedilemedi': 'Could not save',
  'Yine de kapat': 'Close anyway',
  'Tahta kaydedilemedi: {hata}': 'The board could not be saved: {hata}',
  'Değişikliklerin bir kopyası şuraya kaydedildi: {yol}': 'A copy of your changes was saved to: {yol}',
  'Değişikliklerin kopyası da alınamadı. Kapatırsan kaydedilmemiş değişiklikler kaybolur.':
    'A copy of your changes could not be saved either. If you close, unsaved changes will be lost.',
  'bozuk': 'corrupted',
  // Güncelleme
  'Güncellemeleri denetle…': 'Check for updates…',
  'Güncellemeleri otomatik denetle': 'Check for updates automatically',
  'Sürüm {surum}': 'Version {surum}',
  'Güncelleme': 'Update',
  'Güncelleme hazır': 'Update ready',
  'Beyaz Tahta {surum} indirildi.': 'Whiteboard {surum} has been downloaded.',
  'Şimdi yeniden başlatılabilir. "Sonra" dersen uygulamayı kapattığında kurulur.':
    'You can restart now. If you choose "Later", it will be installed when you close the app.',
  'Yeniden başlat ve kur': 'Restart and install',
  'Sonra': 'Later',
  'Güncelleme bulundu': 'Update found',
  'Beyaz Tahta {surum} bulundu.': 'Whiteboard {surum} is available.',
  'Arka planda indiriliyor; hazır olunca haber verilecek.': "Downloading in the background; you'll be notified when it's ready.",
  'Güncelleme yok': 'No updates',
  'Beyaz Tahta güncel.': 'Whiteboard is up to date.',
  'Güncelleme denetlenemedi': 'Could not check for updates',
  'Güncelleme denetlenemedi.': 'Could not check for updates.',
  'Geliştirme modunda güncelleme denetlenmez.': 'Updates are not checked in development mode.',
  'Güncelleme zaten denetleniyor ya da indiriliyor.': 'An update is already being checked or downloaded.',
};

function setLang(l) {
  lang = LANGS.includes(l) ? l : 'en';
  return lang;
}

function getLang() {
  return lang;
}

function L(tr, params) {
  let s = (lang === 'en' && EN[tr]) || tr;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
  return s;
}

module.exports = { LANGS, setLang, getLang, L };
