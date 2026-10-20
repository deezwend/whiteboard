# Beyaz Tahta / Whiteboard

A personal, endless whiteboard app for Windows, built with Electron.
Draw, sketch, cut and annotate on a canvas that never ends, and work with your PDFs and Obsidian notes right next to it.

Kişisel, sonsuz bir beyaz tahta uygulaması. Windows için Electron ile yazıldı.
Sonsuz bir tuval üzerinde çizebilir, kesebilir ve not alabilir; PDF'lerinizi ve Obsidian notlarınızı yanı başınızda kullanabilirsiniz.

---

## English

### Features

- **Endless canvas** with a grid background, pan and zoom.
- **Drawing tools**: pen, eraser, shapes, text, and a ruler and protractor for geometry.
- **Paint bucket** to fill enclosed areas, with a thickness slider and an opacity slider for pen strokes and filled areas.
- **Scissors**: cut out parts of images and PDF pages.
- **PDF support**: import PDF pages onto the board and export pages back to PDF.
- **Obsidian integration**: pick a vault and attach or open notes from it.
- **Markdown and math**: render Markdown and LaTeX-style math (KaTeX).
- **Multiple boards** with a gallery view and search.
- **Themes**: Light, Dark, or System (follows Windows).
- **Languages**: English (default) and Türkçe, switchable from the menu or **View → Language**.
- **Built-in guide**: press `F1` at any time.

### Installation

1. Download `BeyazTahta-Kurulum-<version>.exe` from the [Releases](../../releases) page.
2. Run the installer and follow the steps. You can choose the install folder.
3. Launch **Beyaz Tahta** from the desktop or Start menu.

The app is unsigned, so Windows SmartScreen may show a warning. Choose **More info → Run anyway** if you trust the source.

### Build from source

Requirements: Node.js and npm on Windows.

```bash
npm install
npm start          # run in development
npm run dist       # build the Windows installer into dist/
```

### Project layout

```
src/main/       Electron main process (windows, menus, file access, PDF, Obsidian)
src/renderer/   UI, drawing engine, geometry, tools, styles
build/          App icon
```

### License

Personal project. No license has been specified yet.

---

## Türkçe

### Özellikler

- **Sonsuz tuval**: kareli arka plan, kaydırma ve yakınlaştırma.
- **Çizim araçları**: kalem, silgi, şekiller, metin; geometri için cetvel ve açıölçer.
- **Boya kovası**: kapalı alanları doldurur; kalınlık ve opaklık kaydırıcıları kalem çizgileri ve dolu alanlar için çalışır.
- **Makas**: resimlerden ve PDF sayfalarından parça kesip alır.
- **PDF desteği**: PDF sayfalarını tahtaya alır, sayfaları PDF olarak dışa aktarır.
- **Obsidian entegrasyonu**: bir vault seçip oradaki notları tahtaya ekleyebilir ya da açabilirsiniz.
- **Markdown ve matematik**: Markdown ve LaTeX biçimli formülleri (KaTeX) gösterir.
- **Çoklu tahta** desteği; galeri görünümü ve arama.
- **Temalar**: Açık, Koyu veya Sistem (Windows ayarını izler).
- **Diller**: İngilizce (varsayılan) ve Türkçe; menüden ya da **Görünüm → Dil / Language** üzerinden değiştirilebilir.
- **Yerleşik rehber**: istediğiniz zaman `F1` tuşuna basın.

### Kurulum

1. [Releases](../../releases) sayfasından `BeyazTahta-Kurulum-<sürüm>.exe` dosyasını indirin.
2. Kurulum dosyasını çalıştırın ve adımları izleyin. Kurulum klasörünü seçebilirsiniz.
3. **Beyaz Tahta**'yı masaüstü ya da Başlat menüsünden açın.

Uygulama dijital olarak imzalı değildir; Windows SmartScreen uyarı gösterebilir. Kaynağa güveniyorsanız **Ek bilgi → Yine de çalıştır** seçeneğini kullanın.

### Kaynaktan derleme

Gereksinimler: Windows üzerinde Node.js ve npm.

```bash
npm install
npm start          # geliştirme modunda çalıştır
npm run dist       # Windows kurulum dosyasını dist/ klasörüne derle
```

### Proje yapısı

```
src/main/       Electron ana süreci (pencereler, menüler, dosya erişimi, PDF, Obsidian)
src/renderer/   Arayüz, çizim motoru, geometri, araçlar, stiller
build/          Uygulama simgesi
```

### Lisans

Kişisel bir proje. Henüz bir lisans belirtilmedi.
