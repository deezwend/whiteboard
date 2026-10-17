# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Beyaz Tahta" — a personal Windows desktop replacement for Microsoft Whiteboard (Electron, plain JavaScript, no framework, no bundler, no build step for the app code). All UI text and code comments are in Turkish; keep new strings and comments in Turkish.

## Commands

```bash
npm start        # run the app in development (electron .)
npm run dist     # build the Windows NSIS installer -> dist/BeyazTahta-Kurulum-<version>.exe
node --check src/renderer/app.js   # quick syntax check (there is no linter or test suite)
```

- `npm run dist` may fail extracting `winCodeSign` with "Cannot create symbolic link" (no symlink privilege on this machine). Fix: extract the cached `.7z` from `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\` into a sibling folder named `winCodeSign-2.6.0` with `node_modules\7zip-bin\win\x64\7za.exe x` (the two macOS symlink errors are harmless), then rerun.
- The installer is unsigned, so Windows SmartScreen warns on install.

## Testing without the Electron window

The renderer only talks to the main process through `window.api` (see `src/main/preload.js`). To exercise the UI in a normal browser, serve `src/renderer/` over HTTP with a copy of `index.html` that defines a stub `window.api` (`loadInitial` returning `{ data: null }`, `save` capturing the JSON, etc.) before loading `app.js`, and drive it by dispatching `PointerEvent`s on `#board`. Don't leave such mock pages in `src/` — `electron-builder` packages everything under `src/**`.

When testing the real Electron app, launch with `--user-data-dir=<temp dir>` so the test does not overwrite the user's last-opened board setting; note it will still create a new `.tahta` file in `Documents\Beyaz Tahta\` which should be deleted afterwards. A hidden/background window pauses `requestAnimationFrame`, so anything gated on it stalls.

## Architecture

**Main process** (`src/main/main.js`): owns all file I/O and dialogs. Tracks `currentPath` (the board file being edited) and persists `lastPath`, `vault`, `vaults` and `vaultLast` in `userData/settings.json` (per machine). A **vault** is the folder boards live in as `*.tahta` (JSON): the current one is `vault` (default `Documents\Beyaz Tahta\`; older settings used `boardsDir`, still read as fallback), `vaults` is the list of folders opened as vaults (e.g. a Google Drive folder), and `vaultLast` maps each vault (lower-cased path) to its last open board so switching vaults reopens it. Opening a folder as a vault never moves files; opening a single file from outside the vault does not change the vault. Writes are atomic (`.tmp` then rename, retried because sync clients briefly lock files). `known` holds the mtime + hash of the open file as last read/written: on save, if the file changed on disk (another device), the board is saved to a `(çakışma …)` copy instead of overwriting; on window focus the renderer calls `checkExternal` to reload it when it has no unsaved changes. The gallery ("Tahtalarım", `#gallery` in the renderer) uses `boards:list/rename/delete` and `vaults:open/switch/remove`. Single-instance lock: a second launch (e.g. double-clicking a `.tahta` file) forwards the path to the running window via the `openPath` channel. The native menu sends commands to the renderer over the `menu` channel; the renderer's `handleCommand` dispatches them. Keyboard shortcuts that also exist as menu accelerators (e.g. F1, Ctrl+S) must be handled only in one place, otherwise they fire twice.

**Obsidian import** ("Obsidian'dan ekle", key `B`): `src/main/obsidian.js` (pure Node: vault discovery from `%APPDATA%\obsidian\obsidian.json`, note listing, heading/block outline, `extractSection`, `[[link]]` resolution, `obsidian://` URIs) and `src/main/mdrender.js` (markdown-it + KaTeX + Obsidian syntax — callouts incl. collapsed `[!x]-`, `[[links]]`, `![[embeds]]` of images and note sections, `==mark==`, `#tags`, `%%comments%%`, task lists — rendered to HTML in one reused hidden **offscreen** `BrowserWindow` and captured with `capturePage` at 2× as a PNG). The page there has a CSP with no scripts; measuring is done via `executeJavaScript` from main. `markdown-it` and `katex` are runtime `dependencies` (required from main, packaged by electron-builder). The section lands on the board as a plain `image` element with an extra `obsidian: { vault, rel, section, width, title }` field — no new element type — so double-click opens it in Obsidian and the props panel's "Kaynaktan yenile" re-renders it. The picker UI is `src/renderer/obsidian-picker.js` + `obsidian.css`. IPC: `obsidian:*` channels; vault paths from the renderer are accepted only if they are a known vault. The hidden render window is destroyed when the main window closes (otherwise `window-all-closed` never fires).

**Renderer** (`src/renderer/`, ES modules loaded directly from `index.html`):
- `app.js` — the whole interactive layer: state, input, tools, undo/redo, autosave, props panel, clipboard, image/PDF import, export. Tool shortcuts live in the `SHORTCUTS` table (single source for the keydown handler, the shortcut badges drawn on the toolbar buttons and their tooltips); the F1 guide (`#help` in `index.html`: tabbed, searchable, static Turkish text in `data-help-section` blocks) builds its "Kısayollar" tab from `SHORTCUTS` plus `TOOL_LABELS`/`GENERAL_KEYS` in `app.js`, so a new tool only needs a label there; update the prose sections when a feature changes. Related toolbar buttons are wrapped in `.tgroup` divs in `index.html`; app.js turns each into one button showing the group's last-used tool (`groupPick`, saved in prefs) with the rest in a flyout (click the active button again, right-click or long-press).
- `geometry.js` — pure per-element-type geometry: `bbox`, `hitTest`, `translate`, `scaleFrom`, lasso test, eraser splitting.
- `render.js` — canvas drawing of elements and the background pattern; text measurement.
- `recognize.js` — ink-to-shape recognition (RDP simplification + polygon vs. ellipse fit error).
- `ruler.js` — ruler overlay geometry and drawing.
- `vendor/` — pdf.js copied from `node_modules/pdfjs-dist/build` (loaded lazily via dynamic `import`). If upgrading `pdfjs-dist`, re-copy both files.

### Data model

A board is `{ version, background, bgColor, view: {x, y, zoom}, elements: [] }`. `serialize()` prepends a `thumb` (small JPEG data URL, or null) as the **first** key so the main process can read gallery thumbnails from the start of the file without parsing it; `loadBoard` drops it. Element types: `stroke` (`points: [[x, y, pressure]]`, `highlighter`, `pressure` flags), `line`, `arrow` (`x1,y1,x2,y2`), `rect`, `ellipse` (`x,y,w,h`, `fill: 'none'|'soft'|'solid'`), `polygon` (`points: [[x,y]]`), `text`, `note`, `image` (`src` is an embedded data URL). **Adding a new element type means updating every `switch (el.type)` in `geometry.js` and `render.js`, plus the type lists in `app.js` `propsContext`/`applyStyle`.**

### Coordinates

Elements are in world coordinates; `screen = world * view.zoom + view.{x,y}` (`toWorld`/`toScreen` in `app.js`). The background pattern, selection handles, lasso, eraser cursor and the ruler are drawn in screen space. The ruler state is screen-space and is not saved with the board.

### Undo/redo invariant

`checkpoint()` pushes a **shallow** copy of the elements array. This is only correct because existing elements' `points` arrays are never mutated in place — `translate`/`scaleFrom`/eraser always assign new arrays; only the stroke currently being drawn (created after its checkpoint) is mutated. Preserve this when editing geometry code. Mutating operations call `checkpoint()` before the first change (lazily for drags), and pop it again if the action turns out to be a no-op.

### Rendering and saving

`requestRender()` coalesces into one `requestAnimationFrame`. While drawing a stroke/shape, the rest of the scene is cached in an offscreen canvas (`sceneCache`); set `sceneCacheValid = false` whenever the view changes. `changed()` re-renders, refreshes the props panel and schedules a debounced autosave; view-only changes use `scheduleViewSave()` instead. On window close, pending changes are flushed synchronously via `api.saveSync`.

### Pointer handling

`pointerdown` sets a `drag` object whose `kind` (`draw`, `shape`, `erase`, `move`, `resize`, `endpoint`, `lasso`, `pan`, `rulerMove`, `rulerRotate`) drives `pointermove` and `endPointer`. Pen strokes: Shift/Ctrl held = straight segment (`drag.usedStraight`), starting next to a ruler edge snaps to that edge (`drag.rulerSide`); strokes that used neither are passed to `recognizeShape` when "Şekle dönüştür" is on, as a separate undo step. The `tempHighlighter` tool draws into `tempStrokes`, which fade out and are never saved.

## Security / CSP

`index.html` has a strict CSP (`script-src 'self' 'wasm-unsafe-eval'`, `worker-src 'self' blob:`); no inline scripts or remote resources. The preload exposes a minimal `window.api` with context isolation on and node integration off; keep file-system access in the main process.
