// Ana süreç için dil desteği. Metinler kodda Türkçe yazılır; Türkçe metin anahtardır,
// İngilizce karşılığı EN tablosundadır. Tabloda olmayan metin Türkçe kalır.
// {ad} biçimindeki yer tutucular params nesnesiyle doldurulur.

const LANGS = ['tr', 'en'];
let lang = 'tr';

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
};

function setLang(l) {
  lang = LANGS.includes(l) ? l : 'tr';
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
