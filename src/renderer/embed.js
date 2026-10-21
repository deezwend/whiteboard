// Gömülü web sayfaları (embed): Desmos, GeoGebra, YouTube gibi siteler tahtada canlı açılır.
// Öğe tahtada son ekran görüntüsüyle (el.thumb) çizilir; böylece üstüne çizim yapılabilir ve dışa
// aktarmada görünür. Çift tıklayınca aynı yerde canlı bir iframe açılır. Aynı anda yalnızca bir
// embed canlıdır (her iframe ayrı bir web sayfası olduğu için bellek ve işlemci harcar).
//
// Öğe: { type: 'embed', x, y, w, h, url, src, provider, title, thumb? }
//   url: kullanıcının verdiği adres, src: iframe'e verilen gömülmeye uygun adres.

import { t } from './i18n.js';

// Bilinen siteler: normal adresi gömülmeye uygun adrese çevirir. Eşleşmeyen adres olduğu gibi denenir.
const PROVIDERS = [
  {
    id: 'desmos', name: 'Desmos', size: { w: 900, h: 560 },
    // desmos.com/calculator, desmos.com/calculator/abc123 (geometry, 3d, scientific de olur).
    // ?embed kullanılmaz: o modda ifade listesi gizlenir ve grafiğe fonksiyon yazılamaz.
    map: (u) => {
      const m = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(calculator|geometry|3d|scientific|fourfunction|matrix)(?:\/([\w-]+))?\/?$/i.exec(u.pathname);
      return host(u, 'desmos.com') && m ? `https://www.desmos.com/${m[1]}${m[2] ? '/' + m[2] : ''}` : null;
    },
  },
  {
    id: 'geogebra', name: 'GeoGebra', size: { w: 800, h: 520 },
    // geogebra.org/m/ID, geogebra.org/calculator/ID, geogebra.org/material/show/id/ID …
    map: (u) => {
      if (!host(u, 'geogebra.org')) return null;
      const m = /^\/(?:m|material\/(?:show|iframe)\/id|classic|calculator|graphing|geometry|3d|cas|notes)\/([\w-]+)/.exec(u.pathname);
      if (m) return `https://www.geogebra.org/material/iframe/id/${m[1]}`;
      // Boş uygulama: geogebra.org/graphing, /geometry, /3d, /classic …
      const app = /^\/(classic|calculator|graphing|geometry|3d|cas|scientific)\/?$/.exec(u.pathname);
      return app ? `https://www.geogebra.org/${app[1]}` : null;
    },
  },
  {
    id: 'youtube', name: 'YouTube', size: { w: 640, h: 360 },
    map: (u) => {
      let id = null;
      if (host(u, 'youtu.be')) id = u.pathname.slice(1).split('/')[0];
      else if (host(u, 'youtube.com') || host(u, 'youtube-nocookie.com')) {
        id = u.searchParams.get('v') || /^\/(?:embed|shorts|live)\/([\w-]+)/.exec(u.pathname)?.[1];
      }
      if (!id || !/^[\w-]{6,}$/.test(id)) return null;
      const start = parseInt(u.searchParams.get('t') || u.searchParams.get('start') || '', 10);
      return `https://www.youtube-nocookie.com/embed/${id}${start > 0 ? '?start=' + start : ''}`;
    },
  },
  {
    id: 'vimeo', name: 'Vimeo', size: { w: 640, h: 360 },
    map: (u) => {
      const id = host(u, 'vimeo.com') && /^\/(?:video\/)?(\d+)/.exec(u.pathname)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    },
  },
  {
    id: 'figma', name: 'Figma', size: { w: 800, h: 450 },
    map: (u) => host(u, 'figma.com') && /^\/(file|design|proto|board|slides)\//.test(u.pathname)
      ? `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(u.href)}` : null,
  },
  {
    id: 'codepen', name: 'CodePen', size: { w: 800, h: 450 },
    map: (u) => {
      const m = host(u, 'codepen.io') && /^\/([\w-]+)\/(?:pen|full|details|embed)\/(\w+)/.exec(u.pathname);
      return m ? `https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result` : null;
    },
  },
  {
    id: 'gdocs', name: 'Google Docs', size: { w: 720, h: 540 },
    // Paylaşılan Google dokümanı, tablosu ve sunusu.
    map: (u) => {
      const m = host(u, 'docs.google.com') && /^\/(document|spreadsheets|presentation)\/d\/([\w-]+)/.exec(u.pathname);
      if (!m) return null;
      return `https://docs.google.com/${m[1]}/d/${m[2]}/${m[1] === 'presentation' ? 'embed' : 'preview'}`;
    },
  },
  {
    id: 'gmaps', name: 'Google Maps', size: { w: 720, h: 480 },
    map: (u) => {
      if (!/(^|\.)google\.[a-z.]+$/.test(u.hostname) || !u.pathname.startsWith('/maps')) return null;
      const at = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(u.pathname);
      const place = /\/place\/([^/]+)/.exec(u.pathname)?.[1];
      const q = at ? `${at[1]},${at[2]}` : place ? decodeURIComponent(place.replace(/\+/g, ' ')) : u.searchParams.get('q');
      return q ? `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed` : null;
    },
  },
  {
    id: 'spotify', name: 'Spotify', size: { w: 480, h: 352 },
    map: (u) => {
      const m = host(u, 'open.spotify.com') && /^\/(?:intl-\w+\/)?(track|album|playlist|episode|show|artist)\/(\w+)/.exec(u.pathname);
      return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
    },
  },
  {
    id: 'loom', name: 'Loom', size: { w: 640, h: 400 },
    map: (u) => {
      const id = host(u, 'loom.com') && /^\/(?:share|embed)\/(\w+)/.exec(u.pathname)?.[1];
      return id ? `https://www.loom.com/embed/${id}` : null;
    },
  },
];

const GENERIC = { id: 'web', name: '', size: { w: 800, h: 520 } };

function host(u, domain) {
  return u.hostname === domain || u.hostname.endsWith('.' + domain);
}

// Adres için gömme bilgisi: { src, provider, name, size, known }. Geçersiz adreste null.
export function embedFor(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  for (const p of PROVIDERS) {
    const src = p.map(u);
    if (src) return { src, provider: p.id, name: p.name, size: p.size, known: true };
  }
  // Uygulama yalnızca https sayfaları gömer (CSP); http adresi https ile denenir.
  u.protocol = 'https:';
  return { src: u.href, provider: GENERIC.id, name: u.hostname.replace(/^www\./, ''), size: GENERIC.size, known: false };
}

export function providerName(el) {
  return PROVIDERS.find((p) => p.id === el.provider)?.name || '';
}

// ---------- Canlı iframe ----------
// Katman canvas'ın ve araç çubuklarının üstündedir. Üstte küçük bir şerit (başlık, yenile,
// tarayıcıda aç, bitti) durur; odak iframe'deyken tuşlar tahtaya ulaşmadığı için çıkış buradandır.

const MIN_LAYOUT_W = 480; // iframe en az bu genişlikte yerleşir; daha küçük görünüyorsa ölçeklenir
const BAR_H = 30;

const ICONS = {
  reload: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/></svg>',
  open: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>',
};

// opts: { onDone(), onOpenExternal(url) }
export function createLiveEmbed(layer, opts) {
  let live = null; // { id, box, frame, bar, key }

  function open(el) {
    close();
    const box = document.createElement('div');
    box.className = 'embed-live';
    const frame = document.createElement('iframe');
    frame.src = el.src;
    // allow-top-navigation yok: sayfa uygulamanın penceresini başka bir adrese götüremez.
    // Açılan pencereler ana süreçte yakalanıp varsayılan tarayıcıya gönderilir.
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation');
    frame.setAttribute('allow', 'fullscreen; clipboard-write; encrypted-media; picture-in-picture');
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    box.append(frame);

    const bar = document.createElement('div');
    bar.className = 'embed-bar';
    const title = document.createElement('span');
    title.className = 'embed-title';
    title.textContent = el.title || providerName(el) || el.url;
    title.title = el.url;
    const reload = barButton(ICONS.reload, t('Sayfayı yeniden yükle'));
    reload.addEventListener('click', () => { frame.src = el.src; });
    const ext = barButton(ICONS.open, t('Tarayıcıda aç'));
    ext.addEventListener('click', () => opts.onOpenExternal(el.url));
    const done = document.createElement('button');
    done.className = 'embed-done';
    done.textContent = t('Bitti');
    done.title = t('Etkileşimden çık (Esc)');
    done.addEventListener('click', () => opts.onDone());
    bar.append(title, reload, ext, done);

    layer.append(box, bar);
    live = { id: el.id, box, frame, bar, key: '' };
  }

  // r: öğenin ekrandaki kutusu (CSS pikseli). Değişmediyse DOM'a dokunulmaz.
  function position(r) {
    if (!live) return;
    const k = Math.min(1, r.w / MIN_LAYOUT_W);
    const key = [r.x, r.y, r.w, r.h].map(Math.round).join(',');
    if (key === live.key) return;
    live.key = key;
    Object.assign(live.box.style, {
      transform: `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px)`,
      width: Math.round(r.w) + 'px',
      height: Math.round(r.h) + 'px',
    });
    Object.assign(live.frame.style, {
      width: r.w / k + 'px',
      height: r.h / k + 'px',
      transform: k < 1 ? `scale(${k})` : '',
    });
    // Şerit kutunun üstüne oturur; ekranın üstüne taşarsa kutunun içine iner.
    const by = r.y - BAR_H - 4 >= 0 ? r.y - BAR_H - 4 : Math.max(0, r.y) + 4;
    Object.assign(live.bar.style, {
      transform: `translate(${Math.round(Math.max(4, r.x))}px, ${Math.round(by)}px)`,
      width: Math.round(Math.max(220, Math.min(r.w, innerWidth - 8))) + 'px',
    });
  }

  function close() {
    if (!live) return;
    live.box.remove();
    live.bar.remove();
    live = null;
  }

  // Ekran görüntüsü için iframe'in pencerede tamamen görünen kutusu (yoksa null).
  function visibleRect() {
    if (!live) return null;
    const r = live.box.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) return null;
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  return {
    open,
    position,
    close,
    visibleRect,
    get id() { return live?.id ?? null; },
    hasFocus: () => !!live && document.activeElement === live.frame,
  };
}

function barButton(icon, title) {
  const b = document.createElement('button');
  b.className = 'embed-btn';
  b.innerHTML = icon;
  b.title = title;
  return b;
}
