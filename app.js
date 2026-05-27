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
      <span class="title">${p.title[L]}</span>
      <span class="meta">${p.year} · ${p.place[L]}<br>${p.works} ${L==="pl"?"prac":"works"}</span>
    </li>
  `).join("");

  // VARIANT 2 — INDEX TABLE
  $("#homeListIndex").innerHTML = projs.map(p => `
    <div class="row" data-slug="${p.slug}">
      <div class="no col">${p.no}</div>
      <div class="title">${p.title[L]}</div>
      <div class="col">${p.category[L]}</div>
      <div class="col">${p.year}</div>
      <div class="col">${String(p.works).padStart(2,"0")}</div>
    </div>
  `).join("");

  // VARIANT 3 — STACK
  $("#homeListStack").innerHTML = projs.map(p => `
    <div class="row" data-slug="${p.slug}">
      <div class="title">${p.title[L]}</div>
      <div class="side">${p.year}<br>${p.works} ${L==="pl"?"prac":"works"}<br>${p.place[L]}</div>
    </div>
  `).join("");

  // VARIANT 4 — POSTER GRID
  $("#homeListPoster").innerHTML = projs.map((p, i) => {
    const randomImg = p.images[Math.floor(Math.random() * p.images.length)];
    return `
    <div class="cell c${i+1}" data-slug="${p.slug}">
      <div class="num">${p.no} / ${L==="pl"?"PRACE":"WORKS"}</div>
      <div class="title">
        <span class="title-text">${p.title[L]}</span>
        <div class="thumb-frame" style="background-image:url('${randomImg}')"></div>
      </div>
      <div class="meta">${p.year} · ${p.place[L]} · ${p.works} ${L==="pl"?"prac":"works"}</div>
    </div>
  `;}).join("");

  // Re-randomise the poster thumbnail each time user hovers a cell
  $$(".home-poster .cell").forEach(cell => {
    cell.addEventListener("mouseenter", () => {
      const p = window.PROJECTS.find(x => x.slug === cell.dataset.slug);
      if (!p) return;
      const img = p.images[Math.floor(Math.random() * p.images.length)];
      const frame = cell.querySelector(".thumb-frame");
      if (frame) frame.style.backgroundImage = `url('${img}')`;
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

  // Build track
  const track = $("#pjTrack");
  track.innerHTML = p.images.map((src, i) =>
    `<div class="proj-slide"><img src="${src}" alt="${p.title[L]} ${i+1}" data-index="${i}"></div>`
  ).join("");

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
  state.slideIndex = Math.max(0, Math.min(state.slideIndex, total - 1));
  track.style.transform = `translateX(-${state.slideIndex * 100}%)`;
  const counterStr = `${String(state.slideIndex+1).padStart(2,"0")} / ${String(total).padStart(2,"0")}`;
  $("#pjCounter").textContent = counterStr;
  const cm = $("#pjCounterMobile");
  if (cm) cm.textContent = counterStr;
}

function navProjectPrev() { state.slideIndex--; updateSlide(); }
function navProjectNext() { state.slideIndex++; updateSlide(); }

/* ============================================================
   LIGHTBOX
   ============================================================ */
let lbIndex = 0;
function openLightbox(i) {
  const p = window.PROJECTS.find(x => x.slug === state.projectSlug);
  if (!p) return;
  lbIndex = i;
  $("#lbImg").src = p.images[lbIndex];
  $("#lbCounter").textContent =
    `${String(lbIndex+1).padStart(2,"0")} / ${String(p.images.length).padStart(2,"0")}`;
  $("#lightbox").classList.add("active");
}
function closeLightbox() { $("#lightbox").classList.remove("active"); }
function lbNext() {
  const p = window.PROJECTS.find(x => x.slug === state.projectSlug);
  if (!p) return;
  lbIndex = (lbIndex + 1) % p.images.length;
  openLightbox(lbIndex);
}
function lbPrev() {
  const p = window.PROJECTS.find(x => x.slug === state.projectSlug);
  if (!p) return;
  lbIndex = (lbIndex - 1 + p.images.length) % p.images.length;
  openLightbox(lbIndex);
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
   ROUTING
   ============================================================ */
function setRoute(route) {
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
}

function navigateProject(slug) {
  state.projectSlug = slug;
  renderProject();
  setRoute("project");
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
}

function setLang(lang) {
  state.lang = lang;
  applyI18n();
  renderHome();
  renderTextPages();
  if (state.route === "project") renderProject();
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
      if (r === "home") setRoute("home");
      else if (r === "about") setRoute("about");
      else if (r === "contact") setRoute("contact");
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

  // lightbox
  $("#lightbox").addEventListener("click", (e) => {
    if (e.target.id === "lbImg") { lbNext(); return; }
    closeLightbox();
  });

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

  // initial render
  applyI18n();
  renderHome();
  renderTextPages();
  setRoute("home");
}

document.addEventListener("DOMContentLoaded", init);
