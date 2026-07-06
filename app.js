/* ============================================================
   STATE
   ============================================================ */
const state = {
  route: "home",
  projectSlug: null,
  slideIndex: 0,
  lang: "pl",
};

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

/* ============================================================
   PREFERENCES — localStorage persistence
   ============================================================ */
const LS = {
  lang: "ps-portfolio-lang"
};

function loadPrefs() {
  try {
    const lang = localStorage.getItem(LS.lang);
    if (lang === "pl" || lang === "en") state.lang = lang;
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
}

/* ============================================================
   HOME — poster grid
   ============================================================ */
function renderHome() {
  const projs = window.PROJECTS;
  const L = state.lang;

  // POSTER GRID — jedyny układ strony głównej
  $("#homeListPoster").innerHTML = projs.map((p, i) => {
    return `
    <article class="cell c${i+1}" data-slug="${p.slug}" itemscope itemtype="https://schema.org/CreativeWork">
      <div class="num">${p.no} / ${L==="pl"?"PRACE":"WORKS"}</div>
      <div class="title">
        <h2 class="title-text" itemprop="name">${p.title[L]}</h2>
        <div class="thumb-frame" role="img" aria-label="${p.title[L]} — podgląd"></div>
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

  // Click handlers
  $$(".home-poster .cell").forEach(el => {
    el.onclick = () => navigateProject(el.dataset.slug);
  });
}

/* ============================================================
   PROJECT VIEW
   ============================================================ */
/* ============================================================
   DANIE DNIA — FLIPBOOK (efekt przewracania kartek 3D)
   Desktop: rozkładówka (2 strony), obrót kartki rotateY wokół grzbietu.
   Mobile:  pojedyncza strona, pomijamy puste/czarne strony.
   ============================================================ */
const DanieBook = (function () {
  let data = null;
  let pages = [];
  let mobilePages = [];
  let leaves = 0;
  let cur = 0;          // liczba przewróconych kartek (desktop)
  let mIndex = 0;       // indeks strony (mobile)
  let animating = false;
  let mobile = false;
  let wired = false;
  let mq = null;

  const $b = () => document.getElementById("bookEl");
  const $stage = () => document.querySelector("#pjBook .book-stage");

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function pageHTML(pg) {
    if (!pg) return `<div class="bpage bpage-blank"></div>`;
    switch (pg.type) {
      case "cover":
        return `<div class="bpage bpage-text">
          <div class="bp-kicker">Książka kucharska</div>
          <div class="bp-covertitle">Danie<br>Dnia</div>
          <div class="bp-author">Paweł Sypniewski</div>
          <div class="bp-year">2025</div>
        </div>`;
      case "title":
        return `<div class="bpage bpage-text">
          <div class="bp-covertitle" style="font-size:clamp(26px,5vw,56px)">Danie<br>Dnia</div>
          <div class="bp-author">Paweł Sypniewski</div>
        </div>`;
      case "colophon":
        return `<div class="bpage bpage-text">
          <div class="bp-colophon">
            <div class="bp-cl-row"><span class="bp-cl-label">Projekt okładki i zdjęcia</span>Paweł Sypniewski</div>
            <div class="bp-cl-row"><span class="bp-cl-label">Korekta</span>Magdalena Chechelska</div>
            <div class="bp-cl-row"><span class="bp-cl-label">Mentoring</span>Michał Łuczak</div>
            <div class="bp-cl-row"><span class="bp-cl-label">Copyright</span>© Paweł Sypniewski</div>
            <div class="bp-cl-row"><span class="bp-cl-label">Wydanie I</span>Nakład 5 sztuk</div>
          </div>
        </div>`;
      case "photo":
        return `<div class="bpage bpage-photo" style="background-image:url('${pg.src}')"></div>`;
      case "blank":
        return `<div class="bpage bpage-blank"></div>`;
      case "recipe":
        return recipeHTML(pg.r);
      case "closing":
        return `<div class="bpage bpage-text">
          <div class="bp-closing">Wszystkie warzywa i owoce wykorzystane w książce zostały przeznaczone przez sklep do wyrzucenia, następnie sfotografowane i zjedzone po uprzednim usunięciu zepsutych fragmentów.</div>
        </div>`;
      case "backcover":
        return `<div class="bpage bpage-text bp-backcover">
          <div class="bp-mark">Danie Dnia</div>
          <div class="bp-year">Paweł Sypniewski · 2025</div>
        </div>`;
      default:
        return `<div class="bpage bpage-blank"></div>`;
    }
  }

  function recipeHTML(r) {
    const L = state.lang;
    const ing = r.ing.map(line => {
      const sub = /:\s*$/.test(line);
      return `<li class="${sub ? "bp-ing-sub" : ""}">${esc(line)}</li>`;
    }).join("");
    return `<div class="bpage bpage-recipe"><div class="bp-fit">
      <div class="bp-section">${esc(r.section[L] || r.section.pl)}</div>
      <div class="bp-recipe-title">${esc(r.title)}</div>
      <div class="bp-rule"></div>
      <div class="bp-ing-h">${L === "pl" ? "Składniki" : "Ingredients"}</div>
      <ul class="bp-ing">${ing}</ul>
      <div class="bp-steps-h">${L === "pl" ? "Wykonanie" : "Method"}</div>
      <p class="bp-steps">${esc(r.steps)}</p>
    </div></div>`;
  }

  /* ---------- DESKTOP (kartki) ---------- */
  function buildDesktop() {
    const book = $b();
    if (!book) return;
    book.classList.remove("book-mobile");
    const st = $stage();
    if (st) st.classList.remove("single");
    leaves = Math.ceil(pages.length / 2);
    let html = "";
    for (let i = 0; i < leaves; i++) {
      const front = pages[2 * i];
      const back = pages[2 * i + 1];
      html += `<div class="book-leaf" data-leaf="${i}">
        <div class="leaf-face leaf-front">${pageHTML(front)}</div>
        <div class="leaf-face leaf-back">${pageHTML(back)}</div>
      </div>`;
    }
    book.innerHTML = html;
    applyZ();
    setShift(false);
    updateChrome();
    fitRecipes();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitRecipes);
  }

  // Dopasuj tekst przepisu do wysokości strony (jak w PDF — wszystko na 1 stronie).
  // Wspólna skala dla wszystkich przepisów → spójna typografia.
  function fitRecipes() {
    const book = $b();
    if (!book || mobile) return;
    requestAnimationFrame(() => {
      book.querySelectorAll(".bpage-recipe").forEach(pg => {
        const inner = pg.querySelector(".bp-fit");
        if (!inner) return;
        inner.style.transform = "none";
        const avail = pg.clientHeight;
        const need = inner.scrollHeight;
        const scale = need > avail ? (avail / need) : 1;
        inner.style.transform = scale < 1 ? `scale(${scale.toFixed(4)})` : "none";
      });
    });
  }

  function applyZ() {
    const book = $b();
    if (!book) return;
    [...book.children].forEach((leaf, i) => {
      leaf.classList.toggle("turned", i < cur);
      leaf.style.zIndex = i < cur ? i : (leaves - i);
    });
  }

  function setShift(animate) {
    const book = $b();
    if (!book) return;
    if (!animate) book.style.transition = "none";
    let x = "0%";
    if (cur <= 0) x = "-25%";
    else if (cur >= leaves) x = "25%";
    book.style.transform = `translateX(${x})`;
    if (!animate) {
      // wymuś reflow i przywróć transition
      void book.offsetWidth;
      book.style.transition = "";
    }
  }

  function goDesktop(dir) {
    if (animating) return;
    if (dir > 0 && cur >= leaves) return;
    if (dir < 0 && cur <= 0) return;
    animating = true;
    const idx = dir > 0 ? cur : cur - 1;
    const book = $b();
    const leaf = book.children[idx];
    if (leaf) leaf.style.zIndex = 1000;
    if (dir > 0) { if (leaf) leaf.classList.add("turned"); cur++; }
    else { if (leaf) leaf.classList.remove("turned"); cur--; }
    setShift(true);
    updateChrome();
    setTimeout(() => { animating = false; applyZ(); }, 780);
  }

  /* ---------- MOBILE (pojedyncza strona) ---------- */
  function buildMobile() {
    const book = $b();
    if (!book) return;
    book.classList.add("book-mobile");
    const st = $stage();
    if (st) st.classList.add("single");
    mobilePages = pages.filter(p => p.type !== "blank");
    if (mIndex >= mobilePages.length) mIndex = 0;
    book.innerHTML = `<div class="mpage">${pageHTML(mobilePages[mIndex])}</div>`;
    applyMobileSizing();
    updateChrome();
  }

  // Strony tekstowe (przepis/stopka) bywają dłuższe niż format zdjęcia —
  // na mobile pozwalamy im rosnąć w pionie, zamiast przycinać treść.
  function applyMobileSizing() {
    const st = $stage();
    if (!st) return;
    const t = mobilePages[mIndex] ? mobilePages[mIndex].type : "";
    const flowing = (t === "recipe" || t === "colophon");
    st.classList.toggle("flow", flowing);
  }

  function goMobile(dir) {
    if (animating) return;
    const ni = mIndex + dir;
    if (ni < 0 || ni >= mobilePages.length) return;
    animating = true;
    const card = $b().querySelector(".mpage");
    card.style.transition = "transform 220ms ease-in";
    card.style.transform = `rotateY(${dir > 0 ? -88 : 88}deg)`;
    setTimeout(() => {
      mIndex = ni;
      card.innerHTML = pageHTML(mobilePages[mIndex]);
      card.style.transition = "none";
      card.style.transform = `rotateY(${dir > 0 ? 88 : -88}deg)`;
      void card.offsetWidth;
      applyMobileSizing();
      card.style.transition = "transform 220ms ease-out";
      card.style.transform = "rotateY(0deg)";
      updateChrome();
      setTimeout(() => { animating = false; }, 240);
    }, 220);
  }

  /* ---------- wspólne ---------- */
  function go(dir) { mobile ? goMobile(dir) : goDesktop(dir); }

  function updateChrome() {
    const prev = document.getElementById("bookPrev");
    const next = document.getElementById("bookNext");
    const counter = document.getElementById("bookCounter");
    if (mobile) {
      if (prev) prev.disabled = mIndex <= 0;
      if (next) next.disabled = mIndex >= mobilePages.length - 1;
      if (counter) counter.textContent =
        `${String(mIndex + 1).padStart(2, "0")} / ${String(mobilePages.length).padStart(2, "0")}`;
    } else {
      if (prev) prev.disabled = cur <= 0;
      if (next) next.disabled = cur >= leaves;
      if (counter) counter.textContent =
        `${String(cur).padStart(2, "0")} / ${String(leaves).padStart(2, "0")}`;
    }
  }

  function rebuild() {
    mobile = !!(mq && mq.matches);
    if (mobile) buildMobile(); else buildDesktop();
  }

  function wire() {
    if (wired) return;
    wired = true;
    const prev = document.getElementById("bookPrev");
    const next = document.getElementById("bookNext");
    if (prev) prev.addEventListener("click", () => go(-1));
    if (next) next.addEventListener("click", () => go(1));
    mq = window.matchMedia("(max-width: 820px)");
    mq.addEventListener("change", () => { if (!$b()) return; rebuild(); });

    // klik w połowy rozkładówki = przewracanie
    const stage = $stage();
    if (stage) {
      stage.addEventListener("click", (e) => {
        if (e.target.closest(".book-nav")) return;
        const rect = stage.getBoundingClientRect();
        go((e.clientX - rect.left) > rect.width / 2 ? 1 : -1);
      });
      // swipe
      let sx = 0, sy = 0, moved = false;
      stage.addEventListener("touchstart", (e) => {
        const t = e.touches[0]; sx = t.clientX; sy = t.clientY; moved = false;
      }, { passive: true });
      stage.addEventListener("touchmove", (e) => {
        const t = e.touches[0];
        if (Math.abs(t.clientX - sx) > 10 || Math.abs(t.clientY - sy) > 10) moved = true;
      }, { passive: true });
      stage.addEventListener("touchend", (e) => {
        if (!moved) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1);
      });
    }
  }

  function init(bookData) {
    data = bookData;
    pages = data.pages;
    cur = 0; mIndex = 0; animating = false;
    wire();
    rebuild();
  }

  function destroy() {
    const book = $b();
    if (book) book.innerHTML = "";
  }

  function isActive() {
    const w = document.getElementById("pjBook");
    return w && !w.hidden;
  }

  return { init, destroy, go, isActive };
})();

function renderProject() {
  const p = window.PROJECTS.find(x => x.slug === state.projectSlug);
  if (!p) return;
  const L = state.lang;

  $("#pjTitle").textContent = p.title[L];
  $("#pjSub").textContent   = `${p.no} / ${p.category[L]}`;
  $("#pjMeta").innerHTML    = `${p.year}<br>${p.place[L]}<br>${p.works} ${L==="pl"?"prac":"works"}`;
  $("#pjCaption").textContent = p.caption[L];

  const descEl = $("#pjDescription");
  if (p.description && p.description[L]) {
    descEl.innerHTML = p.description[L]
      .split("\n\n")
      .map(par => {
        const cls = par.length < 100 ? ' class="kw"' : "";
        return `<p${cls}>${par.replace(/\n/g, "<br>")}</p>`;
      })
      .join("");
    descEl.hidden = false;
  } else {
    descEl.innerHTML = "";
    descEl.hidden = true;
  }

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

  // --- Tryb KSIĄŻKI (flipbook) dla projektów z flagą `book` ---
  const bookWrap = $("#pjBook");
  const stageEl = document.querySelector(".proj-stage");
  const mobileNav = document.querySelector(".proj-mobile-nav");
  const bottomCounter = $("#pjCounter");
  if (p.book && window.DANIE_BOOK) {
    if (stageEl) stageEl.style.display = "none";
    if (mobileNav) mobileNav.style.display = "none";
    if (bottomCounter) bottomCounter.style.visibility = "hidden";
    if (bookWrap) bookWrap.hidden = false;
    DanieBook.init(window.DANIE_BOOK);
    return;
  } else {
    if (bookWrap) bookWrap.hidden = true;
    if (stageEl) stageEl.style.display = "";
    if (mobileNav) mobileNav.style.display = "";
    if (bottomCounter) bottomCounter.style.visibility = "";
    DanieBook.destroy();
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
      // Prefer richer `description` for snippet; fall back to short `caption`.
      const seoSrc = (p.description && p.description[L])
        ? p.description[L].replace(/\s+/g, " ").trim()
        : p.caption[L];
      desc  = seoSrc.length > 160 ? seoSrc.substring(0, 157).trimEnd() + "…" : seoSrc;
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
    // Widok projektu przewija się wewnętrznie (opis pod galerią) —
    // przy zmianie projektu/widoku wracamy na górę
    const proj = document.querySelector("#view-project .project");
    if (proj) proj.scrollTop = 0;
  }
}

function navigateProject(slug, opts = {}) {
  state.projectSlug = slug;
  renderProject();
  setRoute("project", opts);
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

  // langs (sidebar)
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
      if (DanieBook.isActive()) {
        if (e.key === "ArrowRight") DanieBook.go(1);
        else if (e.key === "ArrowLeft") DanieBook.go(-1);
        else if (e.key === "Escape") setRoute("home");
        return;
      }
      if (e.key === "ArrowRight") navProjectNext();
      if (e.key === "ArrowLeft") navProjectPrev();
      if (e.key === "Escape") setRoute("home");
    }
  });

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

  // 1. Załaduj zapisane preferencje (język)
  loadPrefs();

  // 2. Sparsuj URL — co użytkownik chce zobaczyć (refresh / shared link)
  const initial = parseHash();

  // 3. Pierwszy render z odpowiednim językiem
  applyI18n();
  renderHome();
  renderTextPages();
  renderAchievements();

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
   NAV PREVIEW — podgląd zawartości sekcji po najechaniu na link
   (tylko desktop z myszą — na dotyku hover nie ma sensu)
   ============================================================ */
function buildNavPreview(route, L) {
  if (route === "home") {
    const items = window.PROJECTS.map(p => `
      <button class="np-item" data-slug="${p.slug}" aria-label="${p.title[L]}">
        <span class="np-thumb" style="background-image:url('${p.thumb || p.images[0]}')"></span>
        <span class="np-text"><span class="np-no">${p.no}</span><span class="np-name">${p.title[L]}</span></span>
      </button>`).join("");
    return `<div class="np-head">${L === "pl" ? "Wybrane realizacje" : "Selected works"}</div>
      <div class="np-works">${items}</div>`;
  }

  if (route === "achievements") {
    const sorted = [...window.ACHIEVEMENTS].sort((a, b) => {
      const ak = a.dateISO || (a.year ? a.year + "-00-00" : "0000-00-00");
      const bk = b.dateISO || (b.year ? b.year + "-00-00" : "0000-00-00");
      return bk.localeCompare(ak);
    }).slice(0, 4);
    const items = sorted.map(a => `
      <div class="np-news">
        <span class="np-date">${a.date ? a.date[L] : (a.year || "")} · ${a.type[L]}</span>
        <span class="np-news-title">${a.title[L]}</span>
        <span class="np-news-place">${a.place[L]}</span>
      </div>`).join("");
    return `<div class="np-head">${L === "pl" ? "Najnowsze" : "Latest"}</div>${items}`;
  }

  if (route === "about") {
    const tmp = document.createElement("div");
    tmp.innerHTML = window.ABOUT[L].body;
    const firstP = tmp.querySelector("p");
    const intro = firstP ? firstP.textContent : "";
    const facts = L === "pl"
      ? ["ZPAF", "ITF Opawa", "Sputnik Photos", "Warszawa / Opawa"]
      : ["ZPAF", "ITF Opava", "Sputnik Photos", "Warsaw / Opava"];
    return `
      <div class="np-about">
        <span class="np-portrait" style="background-image:url('images/about/portrait.webp')"></span>
        <p class="np-bio">${intro}</p>
      </div>
      <div class="np-facts">${facts.map(f => `<span class="np-fact">${f}</span>`).join("")}</div>`;
  }

  if (route === "contact") {
    return `
      <div class="np-head">${L === "pl" ? "Kontakt" : "Get in touch"}</div>
      <div class="np-contact">
        <div class="np-cline">
          <span class="np-clabel">E-mail</span>
          <a href="mailto:katedranalogowa@gmail.com">katedranalogowa@gmail.com</a>
        </div>
        <div class="np-cline">
          <span class="np-clabel">Instagram</span>
          <a href="https://www.instagram.com/sypniewskistudio/" target="_blank" rel="noopener noreferrer">@sypniewskistudio</a>
        </div>
        <p class="np-cnote">${L === "pl"
          ? "Odbitki autorskie w limitowanych edycjach — napisz w sprawie formatów i cen."
          : "Limited-edition artist prints — get in touch about sizes and pricing."}</p>
      </div>`;
  }

  return "";
}

function initNavPreview() {
  const panel = document.getElementById("navPreview");
  if (!panel) return;
  // Tylko urządzenia z myszą — pomijamy dotyk
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const links = $$(".sidenav a[data-route]");
  let hideTimer = null;

  function position(link) {
    const sb = document.querySelector(".sidebar").getBoundingClientRect();
    const rect = link.getBoundingClientRect();
    panel.style.left = sb.right + "px";
    // tymczasowo pokaż żeby zmierzyć wysokość
    const h = panel.offsetHeight;
    let top = rect.top;
    const maxTop = window.innerHeight - h - 16;
    if (top > maxTop) top = Math.max(16, maxTop);
    panel.style.top = top + "px";
  }

  function show(link) {
    clearTimeout(hideTimer);
    panel.innerHTML = buildNavPreview(link.dataset.route, state.lang);
    panel.querySelectorAll(".np-item[data-slug]").forEach(b => {
      b.onclick = () => { navigateProject(b.dataset.slug); hide(true); };
    });
    panel.classList.add("active");
    panel.setAttribute("aria-hidden", "false");
    position(link);
  }

  function hide(immediate) {
    clearTimeout(hideTimer);
    const doHide = () => {
      panel.classList.remove("active");
      panel.setAttribute("aria-hidden", "true");
    };
    if (immediate) doHide();
    else hideTimer = setTimeout(doHide, 160);
  }

  links.forEach(link => {
    link.addEventListener("mouseenter", () => show(link));
    link.addEventListener("mouseleave", () => hide(false));
    link.addEventListener("focus", () => show(link));
    link.addEventListener("blur", () => hide(false));
    link.addEventListener("click", () => hide(true));
  });
  panel.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  panel.addEventListener("mouseleave", () => hide(false));
  window.addEventListener("scroll", () => hide(true), { passive: true });
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

document.addEventListener("DOMContentLoaded", async () => {
  // Treść (PROJECTS/ACHIEVEMENTS/ABOUT/CONTACT) jest wczytywana asynchronicznie
  // przez loader.js z plików content/*.json. Poczekaj, aż będzie gotowa.
  if (window.__DATA_READY) {
    try { await window.__DATA_READY; } catch (e) { console.error(e); }
  }
  init();
  initCookieBanner();
  initNavPreview();
});
