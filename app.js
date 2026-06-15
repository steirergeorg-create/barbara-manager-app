/* ===== PASSWORT ===== */
const APP_PASSWORD_HASH = 'bef599fdc77300324c38dc150d9caf8859087aae59e6837973f0a531b51a139b';
const AUTH_KEY = 'bf_auth';

async function hashPassword(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function checkPassword() {
  const input = document.getElementById('passwordInput');
  const val = input?.value || '';
  const hash = await hashPassword(val);
  if (hash === APP_PASSWORD_HASH) {
    localStorage.setItem(AUTH_KEY, '1');
    document.getElementById('passwordScreen').style.display = 'none';
    initApp();
  } else {
    document.getElementById('passwordError').style.display = 'block';
    input.value = '';
    input.focus();
  }
}

function initApp() {
  buildGallery(KNOWN_BILDER);
  setTimeout(() => initDragDrop(), 200);
  setTimeout(() => loadGalleryFromGitHub(), 100);
  loadTexteLocal();
  updateTokenStatus();
  updateDashboard();
}

// Beim Start prüfen
(function() {
  const screen = document.getElementById('passwordScreen');
  if (localStorage.getItem(AUTH_KEY) === '1') {
    screen.style.display = 'none';
    // initApp wird unten normal aufgerufen
  } else {
    screen.style.display = 'flex';
    // Verhindere dass die App lädt
    document.querySelector('.app-layout') && (document.querySelector('.app-layout').style.display = 'none');
    setTimeout(() => document.getElementById('passwordInput')?.focus(), 100);
  }
})();

/* ===== NAVIGATION ===== */
const titles = {
  dashboard: 'Dashboard',
  galerie:   'Galerie verwalten',
  texte:     'Texte bearbeiten',
  kontakt:   'Kontaktdaten',
  publish:   'Publizieren',
};

function switchView(name) {
  if (name === 'dashboard') updateDashboard();
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === name);
  });
  document.querySelectorAll('[id^="view-"]').forEach(el => {
    el.classList.remove('active');
  });
  const view = document.getElementById('view-' + name);
  if (view) view.classList.add('active');
  document.getElementById('topbarTitle').textContent = titles[name] || name;
  if (name === 'publish') { updatePendingChanges(); updateTokenStatus(); }
}

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => switchView(el.dataset.view));
});

/* ===== BILDER HINZUFÜGEN ===== */
// Modal-Queue für mehrere Bilder
let _modalQueue = [];
let _modalResolve = null;

function openImgModal(file) {
  return new Promise((resolve) => {
    _modalResolve = resolve;
    document.getElementById('imgModalPreview').src = file.dataUrl;
    // Dateiname als Vorschlag für Titel
    const guess = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g,' ').replace(/\b\w/g, l => l.toUpperCase());
    document.getElementById('imgTitle').value = guess;
    document.getElementById('imgJahr').value = new Date().getFullYear();
    document.getElementById('imgBreite').value = '';
    document.getElementById('imgHoehe').value = '';
    document.getElementById('imgModal').style.display = 'flex';
    document.getElementById('imgTitle').focus();
  });
}

function confirmImgModal() {
  const titel   = document.getElementById('imgTitle').value.trim() || 'Untitled';
  const technik = document.getElementById('imgTechnik').value;
  const jahr    = document.getElementById('imgJahr').value || new Date().getFullYear();
  const breite  = document.getElementById('imgBreite').value;
  const hoehe   = document.getElementById('imgHoehe').value;
  const groesse = (breite && hoehe) ? `${breite}×${hoehe} cm` : '';
  document.getElementById('imgModal').style.display = 'none';
  if (_modalResolve) { _modalResolve({ titel, technik, jahr, groesse }); _modalResolve = null; }
}

function cancelImgModal() {
  document.getElementById('imgModal').style.display = 'none';
  if (_modalResolve) { _modalResolve(null); _modalResolve = null; }
}

// Enter-Taste bestätigt das Modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('imgModal').classList.contains('open')) {
    confirmImgModal();
  }
  if (e.key === 'Escape' && document.getElementById('imgModal').classList.contains('open')) {
    cancelImgModal();
  }
});

async function processModalQueue() {
  if (_modalQueue.length === 0) return;
  const { file, resolve } = _modalQueue.shift();
  const info = await openImgModal(file);
  resolve(info);
}

async function addNewImages() {
  let files = [];
  if (!window.electronAPI) {
    files = await new Promise(res => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
      input.onchange = (e) => {
        const results = [];
        let done = 0;
        Array.from(e.target.files).forEach(file => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            results.push({ name: file.name, dataUrl: ev.target.result, base64: ev.target.result.split(',')[1], mime: file.type });
            if (++done === e.target.files.length) res(results);
          };
          reader.readAsDataURL(file);
        });
      };
      input.click();
    });
  } else {
    files = await window.electronAPI.openFileDialog();
  }
  if (!files || files.length === 0) return;

  // Jedes Bild einzeln durch Modal
  for (const file of files) {
    const info = await openImgModal(file);
    if (info) addImageToGallery(file, info);
  }
}

/* ===== GALERIE DATEN ===== */
const OWNER = 'steirergeorg-create';
const REPO  = 'barbara-friehs-website';

const KNOWN_BILDER = [
  { name:'barbara-friehs-magick-oil-painting-graz.webp',                          titel:'Magick',                      technik:'oil on canvas',    jahr:'2024', groesse:'120×80 cm'  },
  { name:'barbara-friehs-fiddle-leaf-fig-oil-painting-graz.webp',                 titel:'Fiddle Leaf Fig',             technik:'oil on canvas',    jahr:'2026', groesse:'40×40 cm'   },
  { name:'barbara-friehs-liecken-acrylic-painting-graz.webp',                     titel:'Liecken',                     technik:'acrylic on canvas',jahr:'2021', groesse:'50×60 cm'   },
  { name:'barbara-friehs-room-in-milan-acrylic-painting-graz.webp',               titel:'Room in Milán',               technik:'acrylic on canvas',jahr:'2024', groesse:'40×50 cm'   },
  { name:'barbara-friehs-pears-and-tea-acrylic-painting-graz.webp',               titel:'Pears and Tea',               technik:'acrylic on canvas',jahr:'2021', groesse:'40×50 cm'   },
  { name:'barbara-friehs-books-oil-painting-graz.webp',                           titel:'Books',                       technik:'oil on canvas',    jahr:'2025', groesse:'40×40 cm'   },
  { name:'barbara-friehs-anna-theke-by-herself-acrylic-painting-graz.webp',       titel:'Anna Theke by Herself',       technik:'acrylic on canvas',jahr:'2024', groesse:'60×80 cm'   },
  { name:'barbara-friehs-beaten-down-the-path-acrylic-painting-graz.webp',        titel:'Beaten Down the Path',        technik:'acrylic on canvas',jahr:'2024', groesse:'60×80 cm'   },
  { name:'barbara-friehs-bridge-in-greece-acrylic-painting-graz.webp',            titel:'Bridge in Greece',            technik:'acrylic on canvas',jahr:'2021', groesse:'40×40 cm'   },
  { name:'barbara-friehs-cactus-love-acrylic-painting-graz.webp',                 titel:'Cactus Love',                 technik:'acrylic on canvas',jahr:'2025', groesse:'20×30 cm'   },
  { name:'barbara-friehs-cat-in-a-box-acrylic-painting-graz.webp',                titel:'Cat in a Box',                technik:'acrylic on canvas',jahr:'2020', groesse:'40×30 cm'   },
  { name:'barbara-friehs-chickens-acrylic-painting-graz.webp',                    titel:'Chickens',                    technik:'acrylic on canvas',jahr:'2025', groesse:'30×40 cm'   },
  { name:'barbara-friehs-christmas-cactus-acrylic-painting-graz.webp',            titel:'Christmas Cactus',            technik:'acrylic on canvas',jahr:'2020', groesse:'18×24 cm'   },
  { name:'barbara-friehs-coconut-blood-orange-acrylic-painting-graz.webp',        titel:'Coconut Blood Orange',        technik:'acrylic on canvas',jahr:'2021', groesse:'30×40 cm'   },
  { name:'barbara-friehs-diving-on-the-seychelles-oil-painting-graz.webp',        titel:'Diving on the Seychelles',    technik:'oil on canvas',    jahr:'2026', groesse:'60×80 cm'   },
  { name:'barbara-friehs-fluffy-cat-acrylic-painting-graz.webp',                  titel:'Fluffy Cat',                  technik:'acrylic on canvas',jahr:'2025', groesse:'30×40 cm'   },
  { name:'barbara-friehs-goethes-faust-oil-painting-graz.webp',                   titel:"Goethe's Faust",              technik:'oil on canvas',    jahr:'2025', groesse:'100×100 cm' },
  { name:'barbara-friehs-in-the-deserts-of-san-diego-oil-painting-graz.webp',     titel:'In the Deserts of San Diego', technik:'oil on canvas',    jahr:'2026', groesse:'50×100 cm'  },
  { name:'barbara-friehs-in-the-shadows-oil-painting-graz.webp',                  titel:'In the Shadows',              technik:'oil on canvas',    jahr:'2025', groesse:'50×60 cm'   },
  { name:'barbara-friehs-in-the-sunshine-oil-painting-graz.webp',                 titel:'In the Sunshine',             technik:'oil on canvas',    jahr:'2026', groesse:'50×70 cm'   },
  { name:'barbara-friehs-look-on-me-oil-painting-graz.webp',                      titel:'Look on Me',                  technik:'oil on canvas',    jahr:'2024', groesse:'50×60 cm'   },
  { name:'barbara-friehs-looking-ahead-acrylic-painting-graz.webp',               titel:'Looking Ahead',               technik:'acrylic on canvas',jahr:'2024', groesse:'60×80 cm'   },
  { name:'barbara-friehs-opulence-and-common-ground-acrylic-painting-graz.webp',  titel:'Opulence and Common Ground',  technik:'acrylic on canvas',jahr:'2025', groesse:'50×70 cm'   },
  { name:'barbara-friehs-plantains-and-oranges-acrylic-painting-graz.webp',       titel:'Plantains and Oranges',       technik:'acrylic on canvas',jahr:'2021', groesse:'40×40 cm'   },
  { name:'barbara-friehs-province-in-france-acrylic-painting-graz.webp',          titel:'Province in France',          technik:'acrylic on canvas',jahr:'2024', groesse:'30×40 cm'   },
  { name:'barbara-friehs-room-at-the-baltic-sea-acrylic-painting-graz.webp',      titel:'Room at the Baltic Sea',      technik:'acrylic on canvas',jahr:'2025', groesse:'80×80 cm'   },
  { name:'barbara-friehs-room-in-paris-acrylic-painting-graz.webp',               titel:'Room in Paris',               technik:'acrylic on canvas',jahr:'2025', groesse:'80×100 cm'  },
  { name:'barbara-friehs-room-in-utah-acrylic-painting-graz.webp',                titel:'Room in Utah',                technik:'acrylic on canvas',jahr:'2025', groesse:'40×60 cm'   },
  { name:'barbara-friehs-room-in-venice-acrylic-painting-graz.webp',              titel:'Room in Venice',              technik:'acrylic on canvas',jahr:'2024', groesse:'40×60 cm'   },
  { name:'barbara-friehs-section-of-a-forest-oil-painting-graz.webp',             titel:'Section of a Forest',         technik:'oil on canvas',    jahr:'2025', groesse:'30×90 cm'   },
  { name:'barbara-friehs-selfportrait-with-a-cat-oil-painting-graz.webp',         titel:'Self-Portrait with a Cat',    technik:'oil on canvas',    jahr:'2025', groesse:'140×100 cm' },
  { name:'barbara-friehs-spring-is-around-the-corner-oil-painting-graz.webp',     titel:'Spring Is Around the Corner', technik:'oil on canvas',    jahr:'2026', groesse:'50×70 cm'   },
  { name:'barbara-friehs-still-life-number-four-acrylic-painting-graz.webp',      titel:'Still Life No. 4',            technik:'acrylic on canvas',jahr:'2026', groesse:'30×40 cm'   },
  { name:'barbara-friehs-still-life-number-one-acrylic-painting-graz.webp',       titel:'Still Life No. 1',            technik:'acrylic on canvas',jahr:'2026', groesse:'30×40 cm'   },
  { name:'barbara-friehs-still-life-number-three-acrylic-painting-graz.webp',     titel:'Still Life No. 3',            technik:'acrylic on canvas',jahr:'2026', groesse:'30×30 cm'   },
  { name:'barbara-friehs-still-life-number-two-acrylic-painting-graz.webp',       titel:'Still Life No. 2',            technik:'acrylic on canvas',jahr:'2026', groesse:'30×40 cm'   },
  { name:'barbara-friehs-succulents-in-the-sunset-acrylic-painting-graz.webp',    titel:'Succulents in the Sunset',    technik:'acrylic on canvas',jahr:'2021', groesse:'40×40 cm'   },
  { name:'barbara-friehs-sunflowers-acrylic-painting-graz.webp',                  titel:'Sunflowers',                  technik:'acrylic on canvas',jahr:'2024', groesse:'60×80 cm'   },
  { name:'barbara-friehs-tamed-jimi-hendrix-oil-painting-graz.webp',              titel:'Tamed Jimi Hendrix',          technik:'oil on canvas',    jahr:'2024', groesse:'50×60 cm'   },
  { name:'barbara-friehs-upwards-acrylic-painting-graz.webp',                     titel:'Upwards',                     technik:'acrylic on canvas',jahr:'2025', groesse:'40×50 cm'   },
  { name:'barbara-friehs-visiting-the-market-acrylic-painting-graz.webp',         titel:'Visiting the Market',         technik:'acrylic on canvas',jahr:'2023', groesse:'60×80 cm'   },
  { name:'barbara-friehs-waiting-for-the-bus-acrylic-painting-graz.webp',         titel:'Waiting for the Bus',         technik:'acrylic on canvas',jahr:'2024', groesse:'50×70 cm'   },
];

let ALL_GALLERY_ITEMS = [];

function getTechLabel(t) {
  if (!t) return '';
  if (t.includes('oil'))   return 'Öl';
  if (t.includes('acrylic')) return 'Acryl';
  if (t.includes('water')) return 'Aquarell';
  return t;
}

// Pending uploads die beim Publizieren hochgeladen werden
const pendingUploads = [];

function makeSeoFilename(titel, technik) {
  const slug = titel
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const medium = (technik || '').includes('oil') ? 'oil' : 'acrylic';
  return `barbara-friehs-${slug}-${medium}-painting-graz.webp`;
}

function convertToWebP(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const webpDataUrl = canvas.toDataURL('image/webp', 0.82);
      const base64 = webpDataUrl.split(',')[1];
      resolve({ dataUrl: webpDataUrl, base64, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = dataUrl;
  });
}

async function addImageToGallery(file, info = {}) {
  const grid    = document.getElementById('galleryGrid');
  const name    = info.titel    || file.name.replace(/\.[^.]+$/, '');
  const technik = info.technik  || 'acrylic on canvas';
  const jahr    = info.jahr     || new Date().getFullYear();
  const groesse = info.groesse  || '';
  const meta    = [getTechLabel(technik), jahr, groesse].filter(Boolean).join(' · ');

  // SEO-Dateiname generieren und in WebP konvertieren
  const seoName = makeSeoFilename(name, technik);
  const { dataUrl, base64, width, height } = await convertToWebP(file.dataUrl);

  pendingUploads.push({ name: seoName, dataUrl, base64, mime: 'image/webp', titel: name, technik, jahr, groesse, width, height });

  const item = makeGalleryItem({ name: seoName, titel: name, technik, jahr, groesse, dataUrl, isNew: true });
  const first = grid.querySelector('.gallery-item');
  if (first) grid.insertBefore(item, first);
  else grid.appendChild(item);

  updatePositions();
  updatePendingChanges();
  addActivity('🖼️', 'img', `„${name}" hinzugefügt`, `Galerie · ${meta}`);
  initDragDrop();
}

/* Einheitliche Funktion für alle Gallery Items */
function makeGalleryItem(bild) {
  const filename = bild.name || bild.bild || '';
  const name     = bild.titel || filename.replace(/\.[^.]+$/, '');
  const technik  = bild.technik || 'acrylic on canvas';
  const meta     = [getTechLabel(technik), bild.jahr, bild.groesse].filter(Boolean).join(' · ');
  const imgSrc   = bild.dataUrl
    ? bild.dataUrl
    : filename
      ? `https://raw.githubusercontent.com/steirergeorg-create/barbara-friehs-website/main/${encodeURIComponent(filename)}`
      : '';

  const item = document.createElement('div');
  item.className = 'gallery-item';
  item.dataset.filename = filename;
  item.dataset.titel    = name.toLowerCase();
  item.dataset.technik  = technik.toLowerCase();
  item.dataset.jahr     = bild.jahr || '';
  item.dataset.groesse  = bild.groesse || '';

  item.innerHTML = `
    <div class="gallery-thumb">
      ${imgSrc
        ? `<img src="${imgSrc}" alt="${name}" loading="lazy" onerror="this.style.opacity='.2'">`
        : `<div style="height:120px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:2rem">🖼️</div>`}
    </div>
    <div class="sold-stamp">SOLD</div>
    <div class="sold-badge">Verkauft</div>
    <div class="gallery-info">
      <div class="gallery-name">${name}</div>
      <div class="gallery-meta">${bild.isNew ? `<span style="color:var(--accent)">● Neu</span> · ` : ''}${meta}</div>
    </div>
    <div class="gallery-overlay">
      <button class="overlay-btn sold-btn" title="Verkauft">SOLD</button>
      <button class="overlay-btn feat-btn" title="Titelbild">★</button>
      <button class="overlay-btn edit-btn" title="Bearbeiten">✏️</button>
      <button class="overlay-btn delete-btn" title="Löschen" style="color:var(--red)">🗑️</button>
    </div>`;

  item.querySelector('.sold-btn').addEventListener('click', e => {
    e.stopPropagation();
    const sold = item.classList.toggle('is-sold');
    item.querySelector('.sold-btn').textContent = sold ? '↩' : 'SOLD';
    showToast(sold ? `"${name}" als verkauft markiert` : `"${name}" wieder verfügbar`, 'success');
  });

  item.querySelector('.feat-btn').addEventListener('click', e => {
    e.stopPropagation();
    document.querySelectorAll('#galleryGrid .gallery-item').forEach(el => el.classList.remove('is-featured'));
    item.classList.add('is-featured');
    localStorage.setItem('bf_titelbild', filename);
    showToast(`★ "${name}" ist jetzt das Titelbild`, 'success');
    addActivity('★', 'publish', `„${name}" als Titelbild gesetzt`, '');
  });

  item.querySelector('.edit-btn').addEventListener('click', e => {
    e.stopPropagation();
    openEditModal(item);
  });

  item.querySelector('.delete-btn').addEventListener('click', e => {
    e.stopPropagation();
    confirmDelete(name, () => {
      item.style.transition = 'opacity .25s, transform .25s';
      item.style.opacity = '0';
      item.style.transform = 'scale(.9)';
      setTimeout(() => { item.remove(); updatePositions(); filterGallery(); updateDashboard(); }, 260);
      showToast(`"${name}" gelöscht`, 'error');
      addActivity('🗑️', 'text', `„${name}" gelöscht`, 'Galerie');
    });
  });

  if (bild.sold) item.classList.add('is-sold');
  return item;
}

// Alias für Kompatibilität
function createGalleryItem(bild, isNew) { return makeGalleryItem({ ...bild, isNew }); }

/* ===== GALLERY VIEW TOGGLE ===== */
let currentView = 'grid';



function refreshGallery() {
  const btn = document.getElementById('refreshBtn');
  if (btn) { btn.textContent = '↻ Lädt...'; btn.disabled = true; }
  const grid = document.getElementById('galleryGrid');
  if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--muted);font-size:.85rem">Galerie wird aktualisiert…</div>';
  ALL_GALLERY_ITEMS = [];
  loadGalleryFromGitHub().then(() => {
    if (btn) { btn.textContent = '↻ Aktualisieren'; btn.disabled = false; }
    showToast('✓ Galerie aktualisiert', 'success');
    addActivity('↻', 'publish', 'Galerie aktualisiert', 'Neue Daten von GitHub geladen');
  });
}

function updatePositions() {
  const items = Array.from(document.querySelectorAll('#galleryGrid .gallery-item'));
  items.forEach((item, i) => {
    let badge = item.querySelector('.sort-num');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'sort-num';
      item.appendChild(badge);
    }
    badge.textContent = i + 1;
  });
  ALL_GALLERY_ITEMS = items;
}

/* ===== DRAG & DROP ===== */
let sortableInstance = null;

function initDragDrop() {
  const grid = document.getElementById('galleryGrid');
  if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }

  sortableInstance = new Sortable(grid, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    forceFallback: true,
    fallbackTolerance: 5,
    onEnd: () => {
      updatePositions();
      updatePendingChanges();
      showToast('Reihenfolge geändert — beim Publizieren übernommen', 'success');
    }
  });
}

function destroyDragDrop() {
  if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }
}

function buildGallery(bilder) {
  const grid = document.getElementById('galleryGrid');
  // Alle außer Upload-Zone entfernen
  Array.from(grid.querySelectorAll('.gallery-item')).forEach(el => el.remove());
  ALL_GALLERY_ITEMS = [];

  bilder.forEach(b => {
    const item = createGalleryItem(b, false);
    grid.appendChild(item);
    ALL_GALLERY_ITEMS.push(item);
  });

  // Badge aktualisieren
  const badge = document.querySelector('.nav-badge');
  if (badge) badge.textContent = bilder.length;

  // Sort-grid Klasse sicherstellen
  grid.classList.add('sort-grid');
  grid.classList.remove('masonry-preview');
  // Positionsnummern setzen
  updatePositions();
}

function filterGallery() {
  const search = (document.querySelector('.search-input')?.value || '').toLowerCase();
  const activeBtn = document.querySelector('.gallery-toolbar .filter-btn.active');
  const filter = activeBtn ? (activeBtn.dataset.filter || 'all') : 'all';
  const yearFilter = document.getElementById('yearFilter')?.value || '';
  const items = document.getElementById('galleryGrid').querySelectorAll('.gallery-item');

  items.forEach(item => {
    const titel   = item.dataset.titel   || '';
    const technik = item.dataset.technik || '';
    const jahr    = item.dataset.jahr    || '';

    const matchSearch = !search || titel.includes(search) || technik.includes(search);
    const matchFilter = filter === 'all' || technik.includes(filter);
    const matchYear   = !yearFilter || jahr === yearFilter;

    item.style.display = (matchSearch && matchFilter && matchYear) ? '' : 'none';
  });
}

// Suche Event
document.querySelector('.search-input')?.addEventListener('input', filterGallery);

// Filter Buttons
document.querySelectorAll('.gallery-toolbar .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gallery-toolbar .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterGallery();
  });
});

// Bilder von GitHub laden
async function loadGalleryFromGitHub() { // returns implicit Promise
  const token = getToken ? getToken() : '';
  const headers = token ? { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' } : {};

  // config.json laden — Galerie komplett aufbauen
  try {
    const res = await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/config.json', { headers });
    if (res.ok) {
      const file = await res.json();
      // Robustes UTF-8 Decoding via TextDecoder
      const base64 = file.content.replace(/\n/g, '');
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const decoded = new TextDecoder('utf-8').decode(bytes);
      const data = JSON.parse(decoded);
      if (data.bilder && data.bilder.length > 0) {
        // Galerie komplett neu aufbauen in config.json Reihenfolge
        const grid = document.getElementById('galleryGrid');
        grid.innerHTML = ''; // Ladeindikator und alte Items entfernen
        ALL_GALLERY_ITEMS = [];

        // KNOWN_BILDER als Lookup für fehlende Metadaten
        const knownLookup = {};
        KNOWN_BILDER.forEach(b => { knownLookup[b.name] = b; });

        data.bilder.forEach(b => {
          const known = knownLookup[b.bild] || {};
          const bild = {
            name: b.bild,
            titel: b.titel || known.titel || b.bild,
            technik: b.technik || known.technik || 'acrylic on canvas',
            jahr: b.jahr || known.jahr || '',
            groesse: b.groesse || known.groesse || '',
            sold: b.sold || false
          };
          const item = createGalleryItem(bild, false);
          grid.appendChild(item);
          ALL_GALLERY_ITEMS.push(item);
        });

        const badge = document.querySelector('.nav-badge');
        if (badge) badge.textContent = data.bilder.length;
      }
    }
  } catch(e) { console.log('config.json nicht geladen:', e); }
  // Gespeichertes Titelbild markieren
  const savedFeatured = localStorage.getItem('bf_titelbild');
  if (savedFeatured) {
    const featuredItem = Array.from(document.querySelectorAll('#galleryGrid .gallery-item'))
      .find(el => el.dataset.filename === savedFeatured);
    if (featuredItem) {
      featuredItem.classList.add('is-featured');
      const btn = featuredItem.querySelector('.featured-btn');
      if (btn) btn.style.color = 'var(--accent)';
    }
  }
  updatePositions();
  updateDashboard();
  // Jahr-Filter befüllen
  const years = [...new Set(
    Array.from(document.querySelectorAll('#galleryGrid .gallery-item'))
      .map(el => el.dataset.jahr).filter(Boolean)
  )].sort((a,b) => b-a);
  const sel = document.getElementById('yearFilter');
  if (sel) {
    const current = sel.value;
    sel.innerHTML = '<option value="">Alle Jahre</option>';
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      if (y === current) opt.selected = true;
      sel.appendChild(opt);
    });
  }
}

// Service Worker registrieren
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Galerie beim Start laden (nur wenn eingeloggt)
if (localStorage.getItem(AUTH_KEY) === '1') {
  // Ladeindikator zeigen statt falscher Reihenfolge
  const grid = document.getElementById('galleryGrid');
  if (grid) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--muted);font-size:.85rem">Galerie wird geladen…</div>';
  }
  loadGalleryFromGitHub();
}

/* ===== AUSSTEHENDE ÄNDERUNGEN ===== */
function updatePendingChanges() {
  const list = document.getElementById('pendingChangesList');
  if (!list) return;
  const items = [];
  const pending = typeof pendingUploads !== 'undefined' ? pendingUploads : [];
  if (pending.length > 0) {
    items.push({ color: 'var(--green)', text: `Galerie: ${pending.length} neue${pending.length === 1 ? 's Bild' : ' Bilder'}` });
  }
  if (localStorage.getItem(TEXTE_KEY)) {
    items.push({ color: 'var(--blue)', text: 'Texte & Kontakt: Änderungen gespeichert' });
  }
  if (items.length === 0) {
    list.innerHTML = '<div style="color:var(--muted)">Keine ausstehenden Änderungen</div>';
  } else {
    list.innerHTML = items.map(i =>
      `<div style="display:flex;align-items:center;gap:.6rem">
        <span style="color:${i.color}">●</span> ${i.text}
      </div>`
    ).join('');
  }
}

/* ===== BESTÄTIGUNGS-DIALOG ===== */
let _confirmCallback = null;

function confirmDelete(name, callback) {
  _confirmCallback = callback;
  document.getElementById('confirmText').textContent = `"${name}" wird aus der Galerie entfernt.`;
  const modal = document.getElementById('confirmModal');
  modal.style.display = 'flex';
}

function closeConfirm(confirmed) {
  document.getElementById('confirmModal').style.display = 'none';
  if (confirmed && _confirmCallback) _confirmCallback();
  _confirmCallback = null;
}

// ESC schließt den Dialog
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeConfirm(false);
});

/* ===== TOAST ===== */
let toastTimer;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const icon  = document.getElementById('toastIcon');
  const text  = document.getElementById('toastText');
  toast.className = `toast ${type}`;
  icon.textContent = type === 'success' ? '✓' : '✕';
  text.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ===== EINSTELLUNGEN — GitHub Token lokal speichern ===== */
const STORAGE_KEY = 'bf_github_token';

function getToken() {
  return localStorage.getItem(STORAGE_KEY) || '';
}
function saveToken(t) {
  localStorage.setItem(STORAGE_KEY, t.trim());
  // Nach Token-Speicherung Galerie neu laden
  setTimeout(() => loadGalleryFromGitHub(), 200);
}

// Einstellungs-Modal öffnen
function openSettings() {
  const m = document.getElementById('settingsModal');
  m.style.display = 'flex';
  document.getElementById('tokenInput').value = getToken();
}
function closeSettings() {
  document.getElementById('settingsModal').style.display = 'none';
}
function saveSettings() {
  const t = document.getElementById('tokenInput').value.trim();
  if (!t) { showToast('Bitte Token eingeben!', 'error'); return; }
  saveToken(t);
  closeSettings();
  showToast('✓ Token gespeichert!', 'success');
  updateTokenStatus();
}
function updateTokenStatus() {
  const t = getToken();
  const el = document.getElementById('tokenStatus');
  if (el) {
    el.textContent = t ? '✓' : '⚠';
    el.style.color = t ? 'var(--green)' : 'var(--red)';
  }
  const warning = document.getElementById('tokenWarning');
  if (warning) warning.style.display = t ? 'none' : 'flex';
}
updateTokenStatus();

/* ===== DASHBOARD ===== */
const ACTIVITY_KEY = 'bf_activities';
const PUBLISH_KEY  = 'bf_last_publish';

function getActivities() {
  try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]'); } catch(e) { return []; }
}
function saveActivities(arr) {
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(arr.slice(0, 20)));
}
function addActivity(icon, iconClass, title, sub) {
  const now = new Date();
  const time = now.toLocaleDateString('de-AT', { weekday:'short', day:'2-digit', month:'2-digit' })
    + ', ' + now.toLocaleTimeString('de-AT', { hour:'2-digit', minute:'2-digit' });
  const acts = getActivities();
  acts.unshift({ icon, iconClass, title, sub, time, ts: now.getTime() });
  saveActivities(acts);
  renderActivities();
}
function renderActivities() {
  const list = document.getElementById('activityList');
  if (!list) return;
  const acts = getActivities();
  if (acts.length === 0) {
    list.innerHTML = '<div style="color:var(--muted);padding:.8rem 0;font-size:.82rem">Noch keine Aktivitäten</div>';
    return;
  }
  list.innerHTML = acts.map(a => `
    <div class="activity-item">
      <div class="activity-icon ${a.iconClass}">${a.icon}</div>
      <div class="activity-text">
        <strong>${a.title}</strong>
        <span>${a.sub}</span>
      </div>
      <div class="activity-time">${a.time}</div>
    </div>`).join('');
}
function updateDashboard() {
  // Werke zählen
  const werkeEl = document.getElementById('dash-werke');
  if (werkeEl) {
    const count = document.querySelectorAll('#galleryGrid .gallery-item').length;
    werkeEl.textContent = count || '—';
  }
  // Verkauft zählen
  const soldEl = document.getElementById('dash-sold');
  if (soldEl) {
    const sold = document.querySelectorAll('#galleryGrid .gallery-item.is-sold').length;
    soldEl.textContent = sold;
  }
  // Letztes Publish
  const lastPublish = localStorage.getItem(PUBLISH_KEY);
  const valEl = document.getElementById('dash-update-val');
  const subEl = document.getElementById('dash-update-sub');
  if (valEl && subEl) {
    if (lastPublish) {
      const d = new Date(parseInt(lastPublish));
      const now = new Date();
      const diffMs = now - d;
      const diffMin = Math.floor(diffMs / 60000);
      const diffH   = Math.floor(diffMs / 3600000);
      const diffD   = Math.floor(diffMs / 86400000);
      let ago;
      if (diffMin < 1)       ago = 'Gerade eben';
      else if (diffMin < 60) ago = `vor ${diffMin} Min.`;
      else if (diffH < 24)   ago = `vor ${diffH} Std.`;
      else if (diffD === 1)  ago = 'Gestern';
      else                   ago = `vor ${diffD} Tagen`;
      valEl.textContent = d.toLocaleDateString('de-AT', { day:'2-digit', month:'2-digit' });
      subEl.textContent = ago;
    } else {
      valEl.textContent = '—';
      subEl.textContent = 'Noch nicht publiziert';
    }
  }
  renderActivities();
}

// Dashboard aktualisieren wenn Galerie-Tab geöffnet wird

/* ===== ECHTE GITHUB PUBLISH FUNKTION ===== */
async function startPublish() {
  const token = getToken();
  if (!token) {
    showToast('⚠ Bitte zuerst GitHub Token in Einstellungen eingeben!', 'error');
    openSettings();
    return;
  }

  const btn  = document.getElementById('publishBtn');
  const fill = document.getElementById('progressFill');
  const log  = document.getElementById('deployLog');

  btn.disabled = true;
  btn.textContent = '⏳ Wird publiziert...';
  log.innerHTML = '';
  fill.style.width = '5%';

  function addLog(msg, color) {
    const line = document.createElement('div');
    line.textContent = msg;
    if (color) line.style.color = color;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  const OWNER = 'steirergeorg-create';
  const REPO  = 'barbara-friehs-website';
  const HEADERS = {
    'Authorization': `token ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github.v3+json'
  };

  try {
    addLog('→ Verbinde mit GitHub...');
    fill.style.width = '20%';

    // Schritt 1: Aktuelle config.json von GitHub holen
    addLog('→ Lade aktuelle Bilderliste...');
    const configAPI = `https://api.github.com/repos/${OWNER}/${REPO}/contents/config.json`;
    let configSha = null;
    let configData = { bilder: [] };
    try {
      const configRes = await fetch(configAPI, { headers: HEADERS });
      if (configRes.ok) {
        const configFile = await configRes.json();
        configSha = configFile.sha;
        const base64c = configFile.content.replace(/\n/g, '');
        const binaryc = atob(base64c);
        const bytesc = new Uint8Array(binaryc.length);
        for (let i = 0; i < binaryc.length; i++) bytesc[i] = binaryc.charCodeAt(i);
        configData = JSON.parse(new TextDecoder('utf-8').decode(bytesc));
      }
    } catch(e) { addLog('  → Neue config.json wird erstellt'); }
    fill.style.width = '30%';

    // Schritt 2: Neue Bilder hochladen und zur config hinzufügen
    if (typeof pendingUploads !== 'undefined' && pendingUploads.length > 0) {
      addLog(`→ ${pendingUploads.length} neue Bild(er) werden hochgeladen...`);
      let uploaded = 0;
      for (const img of pendingUploads) {
        const imgAPI = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(img.name)}`;
        let imgSha = null;
        try {
          const checkRes = await fetch(imgAPI, { headers: HEADERS });
          if (checkRes.ok) { const ex = await checkRes.json(); imgSha = ex.sha; }
        } catch(e) {}
        const body = { message: `Add image: ${img.name}`, content: img.base64 };
        if (imgSha) body.sha = imgSha;
        const res = await fetch(imgAPI, { method:'PUT', headers: HEADERS, body: JSON.stringify(body) });
        if (res.ok) {
          addLog(`  ✓ ${img.name}`);
          uploaded++;
          // Zur config hinzufügen
          const exists = configData.bilder.find(b => b.bild === img.name);
          if (!exists) {
            configData.bilder.push({
              bild:    img.name,
              titel:   img.titel   || img.name.replace(/\.[^.]+$/, ''),
              technik: img.technik || 'acrylic on canvas',
              jahr:    String(img.jahr || new Date().getFullYear()),
              groesse: img.groesse || '',
              farbe:   '#888888',
              sold:    false
            });
          }
        } else {
          addLog(`  ✗ ${img.name} fehlgeschlagen`, 'var(--red)');
        }
        fill.style.width = (30 + (uploaded / pendingUploads.length) * 40) + '%';
      }
      pendingUploads.length = 0;
      addLog(`✓ ${uploaded} Bild(er) hochgeladen`);
    }
    fill.style.width = '75%';

    // Schritt 3: Alle Änderungen aus App lesen
    addLog('→ Änderungen werden gesammelt...');
    const allItems = document.querySelectorAll('#galleryGrid .gallery-item');
    const itemChanges = {}; // filename → {titel, technik, jahr, groesse, sold}

    allItems.forEach(item => {
      const filename = item.dataset.filename;
      if (!filename) return;
      const metaText = item.querySelector('.gallery-meta')?.textContent || '';
      const parts = metaText.replace('● Neu · ', '').split(' · ');
      const techLabel = parts[0]?.trim() || '';
      const techMap = {'Öl':'oil on canvas','Acryl':'acrylic on canvas','Aquarell':'watercolour on paper','Mixed Media':'mixed media'};
      // data-technik enthält den vollen Technik-String (z.B. 'oil on canvas'),
      // techMap konvertiert nur Labels (Öl → oil on canvas) als Fallback
      const technikVal = item.dataset.technik && item.dataset.technik.includes(' ')
        ? item.dataset.technik   // z.B. 'oil on canvas' direkt
        : (techMap[techLabel] || 'acrylic on canvas');
      itemChanges[filename] = {
        titel:   item.querySelector('.gallery-name')?.textContent?.trim() || '',
        technik: technikVal,
        jahr:    item.dataset.jahr    || parts[1]?.trim() || '',
        groesse: item.dataset.groesse !== undefined && item.dataset.groesse !== ''
                   ? item.dataset.groesse
                   : (parts[2]?.trim() || ''),
        sold:    item.classList.contains('is-sold')
      };
    });

    // Reihenfolge aus DOM übernehmen — DOM ist die einzige Wahrheitsquelle
    // configData als Lookup für farbe und andere Felder die nicht im DOM sind
    const configLookup = {};
    configData.bilder.forEach(b => { configLookup[b.bild] = b; });
    const knownLookup = {};
    KNOWN_BILDER.forEach(b => { knownLookup[b.name] = b; });

    // configData.bilder in DOM-Reihenfolge aufbauen
    configData.bilder = Array.from(allItems)
      .map(item => {
        const filename = item.dataset.filename;
        if (!filename || !itemChanges[filename]) return null;
        const changes = itemChanges[filename];
        const existing = configLookup[filename] || {};
        const known = knownLookup[filename] || {};
        const pu = pendingUploads.find(p => p.name === filename);
        return {
          bild:    filename,
          titel:   changes.titel   || existing.titel   || known.titel   || filename,
          technik: changes.technik || existing.technik || known.technik || 'acrylic on canvas',
          jahr:    changes.jahr    || existing.jahr    || known.jahr    || String(new Date().getFullYear()),
          groesse: changes.groesse !== undefined ? changes.groesse : (existing.groesse || known.groesse || ''),
          farbe:   existing.farbe  || known.farbe  || '#888888',
          sold:    changes.sold,
          width:   pu?.width  || existing.width  || 0,
          height:  pu?.height || existing.height || 0,
        };
      })
      .filter(Boolean);

    // Titelbild speichern
    const titelbildFilename = localStorage.getItem('bf_titelbild');
    if (titelbildFilename) configData.titelbild = titelbildFilename;

    // Änderungen anwenden
    configData.bilder.forEach(b => {
      const changes = itemChanges[b.bild];
      if (changes) {
        if (changes.titel)   b.titel   = changes.titel;
        if (changes.technik) b.technik = changes.technik;
        if (changes.jahr)    b.jahr    = changes.jahr;
        // groesse immer übernehmen (auch wenn leer — user hat sie vielleicht gelöscht)
        b.groesse = changes.groesse;
        b.sold = changes.sold;
      }
    });

    // Schritt 3: config.json auf GitHub speichern
    addLog('→ Bilderliste wird gespeichert...');
    // btoa() kann mit Unicode (00d7, 00e4, 00f6 etc.) nicht umgehen 2192 UTF-8 Encoding n00f6tig
    const configJson = JSON.stringify(configData, null, 2);
    const configContent = btoa(unescape(encodeURIComponent(configJson)));
    const configBody = {
      message: 'Update config.json via Barbara Manager',
      content: configContent
    };
    if (configSha) configBody.sha = configSha;
    const configPut = await fetch(configAPI, {
      method: 'PUT', headers: HEADERS,
      body: JSON.stringify(configBody)
    });
    if (configPut.ok) addLog('✓ Bilderliste gespeichert');
    else addLog('✗ config.json Fehler', 'var(--red)');

    // Schritt 4: Website index.html holen, Texte einarbeiten, zurückspeichern
    addLog('→ Website-Texte werden aktualisiert...');
    fill.style.width = '82%';
    const indexAPI = `https://api.github.com/repos/${OWNER}/${REPO}/contents/index.html`;
    try {
      const indexRes = await fetch(indexAPI, { headers: HEADERS });
      if (indexRes.ok) {
        const indexFile = await indexRes.json();
        const indexBinary = atob(indexFile.content.replace(/\n/g, ''));
        const indexBytes = new Uint8Array(indexBinary.length);
        for (let i = 0; i < indexBinary.length; i++) indexBytes[i] = indexBinary.charCodeAt(i);
        let indexHtml = new TextDecoder('utf-8').decode(indexBytes);
        indexHtml = applyChangesToHTML(indexHtml);
        const encoder = new TextEncoder();
        const encoded = encoder.encode(indexHtml);
        let binary = '';
        encoded.forEach(b => binary += String.fromCharCode(b));
        const indexContent = btoa(binary);
        const indexPut = await fetch(indexAPI, {
          method: 'PUT', headers: HEADERS,
          body: JSON.stringify({
            message: 'Update website texts via Barbara Manager',
            content: indexContent,
            sha: indexFile.sha
          })
        });
        if (indexPut.ok) addLog('✓ Website-Texte gespeichert');
        else addLog('⚠ Texte konnten nicht gespeichert werden', 'var(--accent)');
      }
    } catch(e) { addLog('⚠ Texte übersprungen: ' + e.message, 'var(--accent)'); }

    fill.style.width = '90%';
    addLog('→ Cloudflare deployed automatisch...');
    await new Promise(r => setTimeout(r, 1500));
    fill.style.width = '100%';
    addLog('✓ barbarafriehs.at wird aktualisiert!', 'var(--green)');

    btn.disabled = false;
    btn.innerHTML = '✓ Erfolgreich publiziert!';
    btn.style.background = 'var(--green)';
    localStorage.setItem(PUBLISH_KEY, Date.now());
    addActivity('🚀', 'publish', 'Website publiziert', 'barbarafriehs.at · erfolgreich');
    updateDashboard();
    showToast('🎉 Website ist live auf barbarafriehs.at!', 'success');

    setTimeout(() => {
      btn.innerHTML = '🚀 Jetzt auf barbarafriehs.at veröffentlichen';
      btn.style.background = '';
      fill.style.width = '0%';
      log.innerHTML = '<span class="muted">Bereit zum Publizieren...</span>';
    }, 5000);

  } catch(err) {
    addLog('✕ Fehler: ' + err.message, 'var(--red)');
    btn.disabled = false;
    btn.innerHTML = '🚀 Jetzt auf barbarafriehs.at veröffentlichen';
    fill.style.width = '0%';
    showToast('Fehler: ' + err.message, 'error');
  }
}

/* Texte lokal zwischenspeichern */
const TEXTE_KEY = 'bf_texte';
function saveTexteLocal() {
  const data = getTexteValues();
  localStorage.setItem(TEXTE_KEY, JSON.stringify(data));
  addActivity('✏️', 'text', 'Texte gespeichert', 'Werden beim nächsten Publizieren übernommen');
  updatePendingChanges();
  showToast('✓ Gespeichert! Beim Publizieren wird die Website aktualisiert.', 'success');
}
function getTexteValues() {
  return {
    name:        document.getElementById('txt-name')?.value        || 'Barbara Friehs',
    standort:    document.getElementById('txt-standort')?.value    || 'Graz, Austria',
    tagline1:    document.getElementById('txt-tagline1')?.value    || 'Painting',
    tagline2:    document.getElementById('txt-tagline2')?.value    || 'with passion',
    beschreibung:document.getElementById('txt-beschreibung')?.value|| '',
    ueber_titel: document.getElementById('txt-ueber-titel')?.value || '',
    ueber_text1: document.getElementById('txt-ueber1')?.value      || '',
    ueber_text2: document.getElementById('txt-ueber2')?.value      || '',
    email:       document.getElementById('txt-email')?.value       || '',
    instagram:   document.getElementById('txt-instagram')?.value   || '',
    linkedin:    document.getElementById('txt-linkedin')?.value    || '',
  };
}
function loadTexteLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(TEXTE_KEY) || 'null');
    if (!saved) return;
    Object.entries({
      'txt-name': saved.name, 'txt-standort': saved.standort,
      'txt-tagline1': saved.tagline1, 'txt-tagline2': saved.tagline2,
      'txt-beschreibung': saved.beschreibung, 'txt-ueber-titel': saved.ueber_titel,
      'txt-ueber1': saved.ueber_text1, 'txt-ueber2': saved.ueber_text2,
      'txt-email': saved.email, 'txt-instagram': saved.instagram,
      'txt-linkedin': saved.linkedin,
    }).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    });
  } catch(e) {}
}
loadTexteLocal();

/* Änderungen in die Website index.html einarbeiten */
function applyChangesToHTML(html) {
  const t = getTexteValues();
  const esc = s => (s||'').replace(/"/g, '&quot;');
  try {
    html = html.replace(/name:\s*"[^"]*"/,         `name:         "${esc(t.name)}"`);
    html = html.replace(/standort:\s*"[^"]*"/,     `standort:     "${esc(t.standort)}"`);
    html = html.replace(/tagline1:\s*"[^"]*"/,     `tagline1:     "${esc(t.tagline1)}"`);
    html = html.replace(/tagline2:\s*"[^"]*"/,     `tagline2:     "${esc(t.tagline2)}"`);
    html = html.replace(/beschreibung:\s*"[^"]*"/, `beschreibung: "${esc(t.beschreibung)}"`);
    html = html.replace(/ueber_titel:\s*"[^"]*"/,  `ueber_titel:  "${esc(t.ueber_titel)}"`);
    html = html.replace(/ueber_text1:\s*"[^"]*"/,  `ueber_text1:  "${esc(t.ueber_text1)}"`);
    html = html.replace(/ueber_text2:\s*"[^"]*"/,  `ueber_text2:  "${esc(t.ueber_text2)}"`);
    html = html.replace(/email:\s*"[^"]*"/,        `email:        "${esc(t.email)}"`);
    html = html.replace(/instagram_handle:\s*"[^"]*"/, `instagram_handle: "${esc(t.instagram)}"`);
    html = html.replace(/instagram:\s*"[^"]*"/,    `instagram:    "https://instagram.com/${esc(t.instagram)}"`);
    html = html.replace(/linkedin:\s*"[^"]*"/,     `linkedin:     "${esc(t.linkedin)}"`);
  } catch(e) { console.log('applyChangesToHTML Fehler:', e); }
  return html;
}

// Modals initialisieren
document.getElementById('settingsModal').style.display = 'none';
if(document.getElementById('editModal')) document.getElementById('editModal').style.display = 'none';
if(document.getElementById('imgModal')) document.getElementById('imgModal').style.display = 'none';

/* ===== EDIT-MODAL LOGIK ===== */
let _editTarget = null;
function openEditModal(item) {
  document.getElementById('editModal').style.display = 'flex';
  _editTarget = item;
  const filename = item.dataset.filename || '';
  const known = KNOWN_BILDER.find(b => b.name === filename) || {};
  const currentName = item.querySelector('.gallery-name')?.textContent?.trim() || known.titel || '';
  const metaText = (item.querySelector('.gallery-meta')?.textContent || '').replace('● Neu · ','');
  const parts = metaText.split(' · ');
  const techLabel = parts[0]?.trim() || '';
  const techMap = {'Öl':'oil on canvas','Acryl':'acrylic on canvas','Aquarell':'watercolour on paper','Mixed Media':'mixed media'};
  const currentTech = techMap[techLabel] || known.technik || 'acrylic on canvas';
  const currentJahr = parts[1]?.trim() || known.jahr || String(new Date().getFullYear());
  const sizeMatch = metaText.match(/([0-9]+)×([0-9]+)/);
  const groesseMatch = (known.groesse||'').match(/([0-9]+)×([0-9]+)/);
  const currentB = sizeMatch ? sizeMatch[1] : (groesseMatch ? groesseMatch[1] : '');
  const currentH = sizeMatch ? sizeMatch[2] : (groesseMatch ? groesseMatch[2] : '');
  document.getElementById('editTitle').value   = currentName;
  document.getElementById('editTechnik').value = currentTech;
  document.getElementById('editJahr').value    = currentJahr;
  document.getElementById('editBreite').value  = currentB;
  document.getElementById('editHoehe').value   = currentH;
  document.getElementById('editTitle').focus();
}
function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
  _editTarget = null;
}
function confirmEditModal() {
  if (!_editTarget) return;
  var titel   = document.getElementById('editTitle').value.trim();
  var technik = document.getElementById('editTechnik').value;
  var jahr    = document.getElementById('editJahr').value;
  var breite  = document.getElementById('editBreite').value;
  var hoehe   = document.getElementById('editHoehe').value;
  var groesse = (breite && hoehe) ? breite + '×' + hoehe + ' cm' : '';
  var techLabel = technik === 'oil on canvas' ? 'Öl' : technik === 'acrylic on canvas' ? 'Acryl' : technik === 'watercolour on paper' ? 'Aquarell' : 'Mixed Media';
  var nameEl = _editTarget.querySelector('.gallery-name');
  var metaEl = _editTarget.querySelector('.gallery-meta');
  if (nameEl) nameEl.textContent = titel;
  if (metaEl) metaEl.textContent = [techLabel, jahr, groesse].filter(Boolean).join(' · ');
  _editTarget.setAttribute('aria-label', titel + ', ' + jahr);
  // data-Attribute aktualisieren — werden beim Publizieren gelesen
  _editTarget.dataset.titel   = titel.toLowerCase();
  _editTarget.dataset.technik = technik.toLowerCase();
  _editTarget.dataset.jahr    = jahr;
  _editTarget.dataset.groesse = groesse;
  var filename = _editTarget.dataset.filename;
  if (filename && typeof pendingUploads !== 'undefined') {
    var pu = pendingUploads.find(function(p){ return p.name === filename; });
    if (pu) { pu.titel=titel; pu.technik=technik; pu.jahr=jahr; pu.groesse=groesse; }
  }
  closeEditModal();
  showToast('"' + titel + '" aktualisiert', 'success');
  addActivity('✏️', 'text', `„${titel}“ bearbeitet`, 'Galerie · Metadaten aktualisiert');
}
document.addEventListener('keydown', function(e) {
  var em = document.getElementById('editModal');
  if (e.key === 'Escape' && em && em.classList.contains('open')) closeEditModal();
});