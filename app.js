/* ============================================================
   STATE
   ============================================================ */
const state = {
  route: "home",
  projectSlug: null,
  slideIndex: 0,
  lang: "pl",
  homeVariant: "poster", // vignelli | index | stack | poster
};

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

/* ============================================================
   PREFERENCES — localStorage persistence
   ============================================================ */
const LS = {
  lang:    "ps-portfolio-lang",
  variant: "ps-portfolio-variant"
};

function loadPrefs() {
  try {
    const lang = localStorage.getItem(LS.lang);
    if (lang === "pl" || lang === "en") state.lang = lang;
    const variant = localStorage.getItem(LS.variant);
    if (["vignelli","index","stack","poster"].includes(variant)) state.homeVariant = variant;
  } catch (e) { /* localStorage może być niedostępny — ignoruj */ }
}

function savePref(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}

/* ============================================================
   HASH ROUTING — URL ↔ state synchronization
   Przykłady URL-i:
     /              → home
     /#/about       → about
     /#/contact     → contact
     /#/labirynt    → project labirynt
   ============================================================ */
function parseHash() {
  const hash = (window.location.hash || "").replace(/^#\/?/, "");
  if (!hash) return { route: "home" };
  if (hash === "about" || hash === "contact") return { route: hash };
  // PL i EN slug dla osiągnięć (zachowujemy oba)
  if (hash === "achievements" || hash === "osiagniecia") return { route: "achievements" };
  // Sprawdzamy czy to slug projektu
  if (window.PROJECTS && window.PROJECTS.find(p => p.slug === hash)) {
    return { route: "project", slug: hash };
  }
  return { route: "home" };
}

function writeHash(route, slug) {
  let target = "";
  if (route === "about")             target = "#/about";
  else if (route === "contact")      target = "#/contact";
  else if (route === "achievements") target = "#/achievements";
  else if (route === "project" && slug) target = "#/" + slug;
  // home → bez hasha
  const current = window.location.hash;
  if (current !== target) {
    if (target) history.pushState(null, "", target);
    else        history.pushState(null, "", window.location.pathname + window.location.search);
  }
}

/* ============================================================
   I18N
   ============================================================ */
function applyI18n() {
  document.documentElement.lang = state.lang;
  $$("[data-i18n]").forEach(el => {
    const k = el.getAttribute("data-i18n");
    const dict = window.I18N[state.lang] || {};
    if (dict[k] != null) el.textContent = dict[k];
  });
  // sidebar lang buttons
  $$(".sidefoot .langs button").forEach(b =>
    b.classList.toggle("active", b.dataset.lang === state.lang));
  // tweaks lang buttons
  $$("#twLangOptions button").forEach(b =>
    b.classList.toggle("active", b.dataset.lang === state.lang));
}

/* ============================================================
   HOME LISTS — render all 4 variants
   ============================================================ */
function renderHome() {
  const projs = window.PROJECTS;
  const L = state.lang;

  // VARIANT 1 — VIGNELLI
  const ol = $("#homeListVignelli");
  ol.innerHTML = projs.map(p => `
    <li data-slug="${p.slug}">
      <span class="num">${p.no}</span>
      <h2 class="title">${p.title[L]}</h2>
      <span class="meta">${p.year} · ${p.place[L]}<br>${p.works} ${L==="pl"?"prac":"works"}</span>
    </li>
  `).join("");

  // VARIANT 2 — INDEX TABLE
  $("#homeListIndex").innerHTML = projs.map(p => `
    <div class="row" data-slug="${p.slug}">
      <div class="no col">${p.no}</div>
      <h2 class="title">${p.title[L]}</h2>
      <div class="col">${p.category[L]}</div>
      <div class="col">${p.year}</div>
      <div class="col">${String(p.works).padStart(2,"0")}</div>
    </div>
  `).join("");

  // VARIANT 3 — STACK
  $("#homeListStack").innerHTML = projs.map(p => `
    <div class="row" data-slug="${p.slug}">
      <h2 class="title">${p.title[L]}</h2>
      <div class="side">${p.year}<br>${p.works} ${L==="pl"?"prac":"works"}<br>${p.place[L]}</div>
    </div>
  `).join("");

  // VARIANT 4 — POSTER GRID
  $("#homeListPoster").innerHTML = projs.map((p, i) => {
    const randomImg = p.images[Math.floor(Math.random() * p.images.length)];
    return `
    <article class="cell c${i+1}" data-slug="${p.slug}" itemscope itemtype="https://schema.org/CreativeWork">
      <div class="num">${p.no} / ${L==="pl"?"PRACE":"WORKS"}</div>
      <div class="title">
        <h2 class="title-text" itemprop="name">${p.title[L]}</h2>
        <div class="thumb-frame" style="background-image:url('${randomImg}')" role="img" aria-label="${p.title[L]} — podgląd"></div>
      </div>
      <div class="meta"><span itemprop="dateCreated">${p.year}</span> · <span itemprop="contentLocation">${p.place[L]}</span> · ${p.works} ${L==="pl"?"prac":"works"}</div>
    </article>
  `;}).join("");

  // Re-randomise the poster thumbnail each time user hovers a cell
  $$(".home-poster .cell").forEach(cell => {
    cell.addEventListener("mouseenter", () => {
      const p = window.PROJECTS.find(x => x.slug === cell.dataset.slug);
      if (!p) return;
      const frame = cell.querySelector(".thumb-frame");
      if (!frame) return;

      // For projects with few images (like danie-dnia), show 3 random thumbnails
      if (p.works <= 4) {
        const shuffled = [...p.images].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, 3);
        frame.innerHTML = selected.map(img =>
          `<div class="thumb-item" style="background-image:url('${img}')"></div>`
        ).join("");
        frame.style.backgroundImage = "";
        const meta = cell.querySelector(".meta");
        if (meta) meta.style.opacity = "0";
        return;
      }

      // Otherwise randomise single image
      const img = p.images[Math.floor(Math.random() * p.images.length)];
      frame.innerHTML = "";
      frame.style.backgroundImage = `url('${img}')`;
    });

    // Reset styles on mouse leave
    cell.addEventListener("mouseleave", () => {
      const meta = cell.querySelector(".meta");
      if (meta) meta.style.opacity = "";
    });
  });

  // Click handlers for ALL variants (delegated)
  $$(".home-variant [data-slug]").forEach(el => {
    el.onclick = () => navigateProject(el.dataset.slug);
  });

  // Show active variant only
  $$(".home-variant").forEach(el => {
    el.style.display = (el.dataset.variant === state.homeVariant) ? "" : "none";
  });
  $("#homeVariantLabel").textContent = variantLabel(state.homeVariant);
}

function variantLabel(v) {
  return {
    vignelli: "[01] Vignelli — Lista",
    index:    "[02] Indeks — Tabela",
    stack:    "[03] Stack — Bloki",
    poster:   "[04] Poster — Grid"
  }[v] || v;
}

/* ============================================================
   PROJECT VIEW
   ============================================================ */
function renderProject() {
  const p = window.PROJECTS.find(x => x.slug === state.projectSlug);
  if (!p) return;
  const L = state.lang;

  $("#pjTitle").textContent = p.title[L];
  $("#pjSub").textContent   = `${p.no} / ${p.category[L]}`;
  $("#pjMeta").innerHTML    = `${p.year}<br>${p.place[L]}<br>${p.works} ${L==="pl"?"prac":"works"}`;
  $("#pjCaption").textContent = p.caption[L];

  // Nawigacja między projektami — prev/next w kolejności PROJECTS
  const idx = window.PROJECTS.findIndex(x => x.slug === p.slug);
  const total = window.PROJECTS.length;
  const prev = window.PROJECTS[(idx - 1 + total) % total];
  const next = window.PROJECTS[(idx + 1) % total];
  const prevBtn = $("#pjProjPrev");
  const nextBtn = $("#pjProjNext");
  if (prevBtn && nextBtn) {
    prevBtn.innerHTML = `<span class="pn-arrow">←</span> <span class="pn-label">${prev.no} ${prev.title[L]}</span>`;
    prevBtn.onclick = () => navigateProject(prev.slug);
    prevBtn.setAttribute("aria-label", (L==="pl"?"Poprzedni projekt: ":"Previous project: ") + prev.title[L]);
    nextBtn.innerHTML = `<span class="pn-label">${next.no} ${next.title[L]}</span> <span class="pn-arrow">→</span>`;
    nextBtn.onclick = () => navigateProject(next.slug);
    nextBtn.setAttribute("aria-label", (L==="pl"?"Następny projekt: ":"Next project: ") + next.title[L]);
  }

  // Build track — semantyczny alt + lazy loading dla wydajności / SEO
  const track = $("#pjTrack");
  track.innerHTML = p.images.map((src, i) =>
    `<div class="proj-slide"><img src="${src}" alt="${p.title[L]} — zdjęcie ${i+1} z ${p.images.length}, ${p.year}, ${p.category[L]}" data-index="${i}" loading="${i === 0 ? 'eager' : 'lazy'}" fetchpriority="${i === 0 ? 'high' : 'auto'}" decoding="async"></div>`
  ).join("");

  // Flash mode — wyłącz płynne przesuwanie slajdów dla projektów z lampą błyskową.
  // Slajd ma się PRZEŁĄCZYĆ natychmiast (pod białym mignięciem), nie ślizgać.
  if (p.flashEffect) {
    track.classList.add("flash-mode");
  } else {
    track.classList.remove("flash-mode");
  }

  // Lightbox click
  $$("#pjTrack img").forEach(img => {
    img.onclick = () => openLightbox(parseInt(img.dataset.index, 10));
  });

  state.slideIndex = 0;
  updateSlide();
}

function updateSlide() {
  const track = $("#pjTrack");
  if (!track) return;
  const total = track.children.length;
  if (!total) return;
  // Cyrkularnie: -1 → total-1, total → 0
  if (state.slideIndex < 0) state.slideIndex = total - 1;
  if (state.slideIndex >= total) state.slideIndex = 0;
  track.style.transform = `translateX(-${state.slideIndex * 100}%)`;
  const counterStr = `${String(state.slideIndex+1).padStart(2,"0")} / ${String(total).padStart(2,"0")}`;
  $("#pjCounter").textContent = counterStr;
  const cm = $("#pjCounterMobile");
  if (cm) cm.textContent = counterStr;
}

// Pomocnik: gdy slajd wraca do skrajnego (8→1 lub 1→8) — wykonaj instant jump
// bez animacji, żeby user nie widział brzydkiego przewijania przez wszystkie zdjęcia.
function jumpSlideInstant() {
  const track = $("#pjTrack");
  if (!track) return;
  // Projekty z flashEffect i tak mają transition: none (klasa flash-mode)
  if (track.classList.contains("flash-mode")) { updateSlide(); return; }
  const orig = track.style.transition;
  track.style.transition = "none";
  updateSlide();
  // double rAF żeby na pewno reflow się zakończył przed re-enable
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      track.style.transition = orig;
    });
  });
}

/* ============================================================
   CAMERA FLASH — efekt lampy błyskowej
   ============================================================ */
function currentProjectHasFlash() {
  const p = window.PROJECTS.find(x => x.slug === state.projectSlug);
  return !!(p && p.flashEffect);
}

function triggerCameraFlash() {
  const flash = document.getElementById("cameraFlash");
  if (!flash) return;
  // Reset animacji żeby zadziałała przy kolejnym wywołaniu
  flash.classList.remove("flash-active");
  void flash.offsetWidth; // wymuszenie reflow
  flash.classList.add("flash-active");
  // Cleanup po animacji
  setTimeout(() => flash.classList.remove("flash-active"), 320);
}

function navProjectPrev() {
  if (currentProjectHasFlash()) triggerCameraFlash();
  const track = $("#pjTrack");
  const total = track ? track.children.length : 0;
  const wrapping = state.slideIndex === 0 && total > 1;
  state.slideIndex--;
  if (wrapping) jumpSlideInstant(); else updateSlide();
}
function navProjectNext() {
  if (currentProjectHasFlash()) triggerCameraFlash();
  const track = $("#pjTrack");
  const total = track ? track.children.length : 0;
  const wrapping = state.slideIndex === total - 1 && total > 1;
  state.slideIndex++;
  if (wrapping) jumpSlideInstant(); else updateSlide();
}

/* ============================================================
   LIGHTBOX — generyczny, przyjmuje dowolny zestaw obrazów
   ============================================================ */
let lbImages = [];          // aktualny zestaw obrazów w lightboxie
let lbIndex = 0;
let lbHistoryEntry = false; // czy dodaliśmy wpis do history przy otwarciu
let lbWithFlash = false;    // czy nawigacja w tym lightboxie ma triggerować flash

function openLightbox(images, index, opts = {}) {
  // Backward-compat: jeśli pierwszy arg to liczba, użyj projektu z state
  if (typeof images === "number") {
    const p = window.PROJECTS.find(x => x.slug === state.projectSlug);
    if (!p) return;
    opts = { flash: !!p.flashEffect };
    index = images;
    images = p.images;
  }
  if (!Array.isArray(images) || !images.length) return;
  const lb = $("#lightbox");
  const wasOpen = lb.classList.contains("active");
  lbImages = images;
  lbIndex = Math.max(0, Math.min(index || 0, images.length - 1));
  lbWithFlash = !!opts.flash;
  $("#lbImg").src = lbImages[lbIndex];
  $("#lbCounter").textContent =
    `${String(lbIndex+1).padStart(2,"0")} / ${String(lbImages.length).padStart(2,"0")}`;
  if (!wasOpen) {
    history.pushState({ lb: true }, "", window.location.hash || window.location.pathname);
    lbHistoryEntry = true;
  }
  lb.classList.add("active");
  document.body.style.overflow = "hidden";

  // Ukryj strzałki jeśli tylko jedno zdjęcie
  const singleImage = lbImages.length <= 1;
  const navPrev = document.getElementById("lbNavPrev");
  const navNext = document.getElementById("lbNavNext");
  if (navPrev) navPrev.style.display = singleImage ? "none" : "";
  if (navNext) navNext.style.display = singleImage ? "none" : "";
}

function closeLightbox() {
  $("#lightbox").classList.remove("active");
  document.body.style.overflow = "";
  if (lbHistoryEntry) {
    lbHistoryEntry = false;
    history.back();
  }
}
function lbNext() {
  if (!lbImages.length) return;
  if (lbWithFlash) triggerCameraFlash();
  lbIndex = (lbIndex + 1) % lbImages.length;
  $("#lbImg").src = lbImages[lbIndex];
  $("#lbCounter").textContent =
    `${String(lbIndex+1).padStart(2,"0")} / ${String(lbImages.length).padStart(2,"0")}`;
}
function lbPrev() {
  if (!lbImages.length) return;
  if (lbWithFlash) triggerCameraFlash();
  lbIndex = (lbIndex - 1 + lbImages.length) % lbImages.length;
  $("#lbImg").src = lbImages[lbIndex];
  $("#lbCounter").textContent =
    `${String(lbIndex+1).padStart(2,"0")} / ${String(lbImages.length).padStart(2,"0")}`;
}

/* ============================================================
   ABOUT / CONTACT
   ============================================================ */
function renderTextPages() {
  $("#aboutBody").innerHTML   = window.ABOUT[state.lang].body;
  $("#aboutSide").innerHTML   = window.ABOUT[state.lang].side;
  $("#contactBody").innerHTML = window.CONTACT[state.lang].body;
  $("#contactSide").innerHTML = window.CONTACT[state.lang].side;
}

/* ============================================================
   ACHIEVEMENTS / AKTUALNOŚCI — render chronologicznej listy
   Auto-sort: malejąco po dateISO (najnowsze u góry)
   ============================================================ */
function renderAchievements() {
  const list = $("#achievementsList");
  if (!list || !window.ACHIEVEMENTS) return;
  const L = state.lang;

  // Sortuj malejąco po dateISO. Fallback: legacy `year` field.
  const sorted = [...window.ACHIEVEMENTS].sort((a, b) => {
    const aKey = a.dateISO || (a.year ? a.year + "-00-00" : "0000-00-00");
    const bKey = b.dateISO || (b.year ? b.year + "-00-00" : "0000-00-00");
    return bKey.localeCompare(aKey);
  });

  // Trzymaj referencję do posortowanej listy dla click handlera
  window._achievementsSorted = sorted;

  list.innerHTML = sorted.map((a, ai) => {
    const photos = (a.images || []).map((src, i) =>
      `<div class="achievement-photo" style="background-image:url('${src}')" data-achievement="${ai}" data-photo="${i}" role="button" tabindex="0" aria-label="${a.title[L]} — ${i+1}"></div>`
    ).join("");
    // Linki — obsługa zarówno pojedynczego `url` jak i tablicy `links`
    let link = "";
    if (a.links && a.links.length) {
      const items = a.links.map(l =>
        `<a class="achievement-link" href="${l.url}" target="_blank" rel="noopener noreferrer">${l.label[L]} →</a>`
      ).join("");
      link = `<div class="achievement-links">${items}</div>`;
    } else if (a.url) {
      const fallback = L === "pl" ? "Zobacz więcej →" : "Learn more →";
      link = `<a class="achievement-link" href="${a.url}" target="_blank" rel="noopener noreferrer">${fallback}</a>`;
    }
    // Data wyświetlana — preferuj `date` (string PL/EN), fallback do `year`
    const displayDate = a.date ? a.date[L] : (a.year || "");
    const addressBlock = a.address ? `<div class="achievement-address">${a.address[L]}</div>` : "";

    return `
      <article class="achievement" itemscope itemtype="https://schema.org/Event">
        <meta itemprop="startDate" content="${a.dateISO || ""}">
        <div class="achievement-meta">
          <span class="date">${displayDate}</span>
          <span class="type">${a.type[L]}</span>
        </div>
        <div class="achievement-content">
          <h2 class="achievement-title" itemprop="name">${a.title[L]}</h2>
          <div class="achievement-place" itemprop="location">${a.place[L]}</div>
          ${addressBlock}
          <p class="achievement-desc" itemprop="description">${a.description[L]}</p>
          ${photos ? `<div class="achievement-photos">${photos}</div>` : ""}
          ${link}
        </div>
      </article>
    `;
  }).join("");

  // Click handlers — otwieranie lightboxa z konkretnym zestawem zdjęć
  $$(".achievement-photo").forEach(el => {
    el.onclick = () => {
      const ai = parseInt(el.dataset.achievement, 10);
      const pi = parseInt(el.dataset.photo, 10);
      const a = (window._achievementsSorted || window.ACHIEVEMENTS)[ai];
      if (!a) return;
      openLightbox(a.images, pi, { flash: false });
    };
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        el.click();
      }
    });
  });
}

/* ============================================================
   ROUTING + DYNAMIC SEO META
   ============================================================ */
const BASE_URL = "https://pawelsypniewski.pl";

function updateSEO(route) {
  const L = state.lang;
  let title, desc, url;

  if (route === "project" && state.projectSlug) {
    const p = window.PROJECTS.find(x => x.slug === state.projectSlug);
    if (p) {
      title = `${p.title[L]} — ${p.year} · Paweł Sypniewski`;
      desc  = `${p.caption[L].substring(0, 155)}`;
      url   = `${BASE_URL}/#/${p.slug}`;
    }
  } else if (route === "about") {
    title = L === "pl"
      ? "O autorze — Paweł Sypniewski, fotograf i artysta wizualny"
      : "About — Paweł Sypniewski, photographer and visual artist";
    desc  = L === "pl"
      ? "Paweł Sypniewski (ur. 1987) — fotograf i artysta wizualny z Warszawy, członek ZPAF. Edukacja: ITF Opawa, Sputnik Photos."
      : "Paweł Sypniewski (b. 1987) — photographer and visual artist from Warsaw, ZPAF member. Education: ITF Opava, Sputnik Photos.";
    url   = `${BASE_URL}/#/about`;
  } else if (route === "achievements") {
    title = L === "pl"
      ? "Aktualności — Paweł Sypniewski"
      : "News — Paweł Sypniewski";
    desc  = L === "pl"
      ? "Aktualne wystawy, pokazy festiwalowe i wydarzenia z udziałem Pawła Sypniewskiego — fotografa i artysty wizualnego z Warszawy."
      : "Current exhibitions, festival screenings and events featuring Paweł Sypniewski — photographer and visual artist based in Warsaw.";
    url   = `${BASE_URL}/#/achievements`;
  } else if (route === "contact") {
    title = L === "pl"
      ? "Kontakt — Paweł Sypniewski"
      : "Contact — Paweł Sypniewski";
    desc  = L === "pl"
      ? "Limitowane odbitki autorskie. Skontaktuj się mailowo w sprawie nakładu, formatów i cen."
      : "Limited-edition artist prints available. Get in touch by email for sizes and pricing.";
    url   = `${BASE_URL}/#/contact`;
  } else {
    title = "Paweł Sypniewski — Fotograf i Artysta Wizualny | Warszawa, ZPAF";
    desc  = L === "pl"
      ? "Paweł Sypniewski — fotograf i artysta wizualny z Warszawy. Portfolio prac dokumentalnych, reportażowych i kreacyjnych. Członek ZPAF, Okręg Warszawski."
      : "Paweł Sypniewski — photographer and visual artist from Warsaw. Documentary, reportage and constructed works. Member of ZPAF, Warsaw Branch.";
    url   = `${BASE_URL}/`;
  }

  if (title) document.title = title;
  const setMeta = (sel, val) => { const el = document.querySelector(sel); if (el && val) el.setAttribute("content", val); };
  setMeta('meta[name="description"]', desc);
  setMeta('meta[property="og:title"]', title);
  setMeta('meta[property="og:description"]', desc);
  setMeta('meta[property="og:url"]', url);
  setMeta('meta[name="twitter:title"]', title);
  setMeta('meta[name="twitter:description"]', desc);
  // canonical do bieżącego widoku
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical && url) canonical.setAttribute("href", url);

  // Google Analytics 4 — virtual page_view dla SPA
  if (typeof window.gtag === "function" && url) {
    window.gtag('event', 'page_view', {
      page_title: title,
      page_location: url,
      page_path: url.replace("https://pawelsypniewski.pl", "") || "/"
    });
  }
}

function setRoute(route, opts = {}) {
  state.route = route;
  $$(".view").forEach(v => v.classList.remove("active"));
  const id = `view-${route}`;
  const el = document.getElementById(id);
  if (el) el.classList.add("active");

  // sidebar active state
  $$(".sidenav a").forEach(a => {
    const r = a.dataset.route;
    a.classList.toggle("active",
      r === route || (route === "project" && r === "home"));
  });

  // SEO: dynamic title/description per view
  updateSEO(route);

  // URL sync — chyba że woła nas popstate (back/forward)
  if (!opts.skipHash) {
    writeHash(route, state.projectSlug);
  }

  // Scroll do góry przy zmianie widoku (poprawia UX na mobile po przewinięciu)
  if (!opts.skipScroll) {
    window.scrollTo({ top: 0, behavior: "instant" });
    const main = document.querySelector(".main");
    if (main) main.scrollTop = 0;
  }
}

function navigateProject(slug, opts = {}) {
  state.projectSlug = slug;
  renderProject();
  setRoute("project", opts);
}

/* ============================================================
   TWEAKS PANEL
   ============================================================ */
function openTweaks() { $("#tweaks").classList.add("active"); }
function closeTweaks() { $("#tweaks").classList.remove("active"); }

function setHomeVariant(v) {
  state.homeVariant = v;
  renderHome();
  $$("#twHomeOptions button").forEach(b =>
    b.classList.toggle("active", b.dataset.variant === v));
  savePref(LS.variant, v);
}

function setLang(lang) {
  state.lang = lang;
  applyI18n();
  renderHome();
  renderTextPages();
  renderAchievements();
  if (state.route === "project") renderProject();
  // Update SEO meta when language changes
  updateSEO(state.route);
  // Aktualizuj atrybut lang dokumentu dla wyszukiwarek
  document.documentElement.lang = lang;
  savePref(LS.lang, lang);
}

/* ============================================================
   INIT + WIRING
   ============================================================ */
function init() {
  // sidebar routes
  $$("[data-route]").forEach(el => {
    el.addEventListener("click", e => {
      e.preventDefault();
      const r = el.dataset.route;
      if (["home","about","contact","achievements"].includes(r)) setRoute(r);
    });
  });

  // langs (sidebar + tweaks)
  $$("[data-lang]").forEach(b =>
    b.addEventListener("click", () => setLang(b.dataset.lang)));

  // project nav arrows
  $("#pjPrev").addEventListener("click", navProjectPrev);
  $("#pjNext").addEventListener("click", navProjectNext);
  const prevMobile = $("#pjPrevMobile");
  const nextMobile = $("#pjNextMobile");
  if (prevMobile) prevMobile.addEventListener("click", navProjectPrev);
  if (nextMobile) nextMobile.addEventListener("click", navProjectNext);

  // touch swipe on project stage
  const stage = document.querySelector(".proj-stage");
  if (stage) {
    let touchStartX = 0, touchStartY = 0, touchMoved = false;
    stage.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchMoved = false;
    }, { passive: true });
    stage.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) touchMoved = true;
    }, { passive: true });
    stage.addEventListener("touchend", (e) => {
      if (!touchMoved) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      // only horizontal swipes
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (dx < 0) navProjectNext();
        else navProjectPrev();
      }
    });
  }

  // lightbox click — klik w ciemne tło zamyka, klik na strzałki/obrazek/close nie
  $("#lightbox").addEventListener("click", (e) => {
    // Strzałki nawigacji — obsługa osobno (z stopPropagation), tu ignorujemy
    if (e.target.classList && e.target.classList.contains("lb-nav")) return;
    // Klik na obrazek — nie zamykaj (user chce mu się przyjrzeć)
    if (e.target.id === "lbImg") return;
    // Klik na close button — zamknij
    if (e.target.classList && e.target.classList.contains("lb-close")) { closeLightbox(); return; }
    // Klik na pusty obszar (ciemne tło) — zamknij
    closeLightbox();
  });

  // Strzałki nawigacji w lightboxie
  const lbNavPrev = $("#lbNavPrev");
  const lbNavNext = $("#lbNavNext");
  if (lbNavPrev) lbNavPrev.addEventListener("click", (e) => { e.stopPropagation(); lbPrev(); });
  if (lbNavNext) lbNavNext.addEventListener("click", (e) => { e.stopPropagation(); lbNext(); });

  // lightbox touch swipe — następny/poprzedni gestem na mobile
  const lb = $("#lightbox");
  if (lb) {
    let lbStartX = 0, lbStartY = 0, lbMoved = false;
    lb.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      lbStartX = t.clientX; lbStartY = t.clientY; lbMoved = false;
    }, { passive: true });
    lb.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      if (Math.abs(t.clientX - lbStartX) > 10 || Math.abs(t.clientY - lbStartY) > 10) {
        lbMoved = true;
      }
    }, { passive: true });
    lb.addEventListener("touchend", (e) => {
      if (!lbMoved) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - lbStartX;
      const dy = t.clientY - lbStartY;
      // pionowy swipe w dół = zamknij; poziomy = nawigacja
      if (Math.abs(dy) > 80 && Math.abs(dy) > Math.abs(dx)) {
        if (dy > 0) closeLightbox();
        return;
      }
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (dx < 0) lbNext();
        else        lbPrev();
      }
    });
  }

  // keyboard
  document.addEventListener("keydown", (e) => {
    if ($("#lightbox").classList.contains("active")) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") lbNext();
      if (e.key === "ArrowLeft") lbPrev();
      return;
    }
    if (state.route === "project") {
      if (e.key === "ArrowRight") navProjectNext();
      if (e.key === "ArrowLeft") navProjectPrev();
      if (e.key === "Escape") setRoute("home");
    }
  });

  // tweaks
  $("#tweaksOpener").addEventListener("click", openTweaks);
  $("#tweaksClose").addEventListener("click", closeTweaks);
  $$("#twHomeOptions button").forEach(b =>
    b.addEventListener("click", () => setHomeVariant(b.dataset.variant)));

  // browser back/forward (popstate) — synchronizuj stan z URL
  window.addEventListener("popstate", () => {
    // Jeśli otwarty lightbox — zamknij go (back gest. już zdjął history entry)
    if ($("#lightbox").classList.contains("active")) {
      $("#lightbox").classList.remove("active");
      document.body.style.overflow = "";
      lbHistoryEntry = false;
      return;
    }
    const parsed = parseHash();
    if (parsed.route === "project" && parsed.slug) {
      state.projectSlug = parsed.slug;
      renderProject();
      setRoute("project", { skipHash: true });
    } else {
      setRoute(parsed.route || "home", { skipHash: true });
    }
  });

  // 1. Załaduj zapisane preferencje (język, wariant)
  loadPrefs();

  // 2. Sparsuj URL — co użytkownik chce zobaczyć (refresh / shared link)
  const initial = parseHash();

  // 3. Pierwszy render z odpowiednim językiem i wariantem
  applyI18n();
  renderHome();
  renderTextPages();
  renderAchievements();
  // ustaw aktywny przycisk wariantu w tweaks panelu
  $$("#twHomeOptions button").forEach(b =>
    b.classList.toggle("active", b.dataset.variant === state.homeVariant));

  // 4. Skieruj do żądanego widoku
  if (initial.route === "project" && initial.slug) {
    state.projectSlug = initial.slug;
    renderProject();
    setRoute("project", { skipHash: true });
  } else {
    setRoute(initial.route || "home", { skipHash: true });
  }
}

/* ============================================================
   COOKIE CONSENT — RODO / GDPR banner
   ============================================================ */
const COOKIE_LS_KEY = "ps-cookie-consent"; // 'granted' | 'denied' | null

function getCookieConsent() {
  try { return localStorage.getItem(COOKIE_LS_KEY); } catch (e) { return null; }
}
function setCookieConsent(value) {
  try { localStorage.setItem(COOKIE_LS_KEY, value); } catch (e) {}
}
function applyConsentToGtag(granted) {
  if (typeof window.gtag !== "function") return;
  const status = granted ? "granted" : "denied";
  window.gtag("consent", "update", {
    "ad_storage":              status,
    "ad_user_data":            status,
    "ad_personalization":      status,
    "analytics_storage":       status,
    "functionality_storage":   status,
    "personalization_storage": status
  });
}
function showCookieBanner() {
  const banner = $("#cookieBanner");
  if (banner) banner.hidden = false;
}
function hideCookieBanner() {
  const banner = $("#cookieBanner");
  if (banner) banner.hidden = true;
}
function initCookieBanner() {
  const banner = $("#cookieBanner");
  if (!banner) return;
  const accept = $("#cbAccept");
  const reject = $("#cbReject");
  const reopen = $("#cookieReopen");

  // Jeśli użytkownik jeszcze nie zdecydował — pokaż banner
  const current = getCookieConsent();
  if (current === null) {
    showCookieBanner();
  } else if (current === "granted") {
    // Restore poprzednią zgodę (gtag default już ją zaaplikował z localStorage)
    applyConsentToGtag(true);
  }

  if (accept) {
    accept.addEventListener("click", () => {
      setCookieConsent("granted");
      applyConsentToGtag(true);
      hideCookieBanner();
      // Wyślij od razu page_view dla aktualnego widoku
      updateSEO(state.route);
    });
  }
  if (reject) {
    reject.addEventListener("click", () => {
      setCookieConsent("denied");
      applyConsentToGtag(false);
      hideCookieBanner();
    });
  }
  if (reopen) {
    reopen.addEventListener("click", (e) => {
      e.preventDefault();
      showCookieBanner();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init();
  initCookieBanner();
});
