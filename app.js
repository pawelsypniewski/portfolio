/* ============================================================
   STATE
   ============================================================ */
const state = {
  route: "home",
  projectSlug: null,
  newsSlug: null,
  slideIndex: 0,
  lang: "pl",
};

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

// Tekst wstawiany do ATRYBUTU w szablonie. Angielskie tytuły aktualności
// zawierają cudzysłowy („"Night Birds" at…"), które bez tego zamykały
// atrybut w połowie i psuły znacznik.
const attr = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/* ============================================================
   PREFERENCES — localStorage persistence
   ============================================================ */
const LS = {
  lang: "ps-portfolio-lang"
};

// O języku decyduje ADRES (/labirynt/ vs /en/labirynt/), nie zapamiętany
// wybór — inaczej polska strona potrafiłaby wyświetlić się po angielsku,
// zaprzeczając własnemu canonical i myląc zarówno Google, jak i człowieka,
// który kliknął w polski link. Zapamiętany wybór zostaje w localStorage
// (przełącznik go zapisuje), ale nie nadpisuje tego, co mówi adres.
function loadPrefs() { /* język ustawia parseRoute() na podstawie adresu */ }

function savePref(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}

/* ============================================================
   ROUTING — prawdziwe adresy (URL ↔ stan widoku)
   Przykłady URL-i:
     /                  → home
     /o-autorze/        → about
     /kontakt/          → contact
     /aktualnosci/      → achievements
     /aktualnosci/offoto-opole-2026/ → newsItem (jedna aktualność)
     /labirynt/         → projekt „Labirynt”

   Każdy z tych adresów to osobny plik wygenerowany przez
   tools/build-pages.js — dzięki temu Google widzi je jako osobne
   strony (wcześniej wszystko żyło pod „/” za znakiem #, którego
   wyszukiwarki nie indeksują).

   ZGODNOŚĆ WSTECZNA: stare linki z hashem (/#/labirynt, /#/about)
   nadal działają — parseRoute() je rozumie, a init() podmienia je
   w pasku adresu na nowy odpowiednik.
   ============================================================ */
const PATH_BY_ROUTE = {
  pl: {
    home:         "/",
    about:        "/o-autorze/",
    contact:      "/kontakt/",
    achievements: "/aktualnosci/",
  },
  en: {
    home:         "/en/",
    about:        "/en/about/",
    contact:      "/en/contact/",
    achievements: "/en/news/",
  },
};
// Ścieżka (bez ukośników na brzegach) → widok i język
const ROUTE_BY_PATH = {
  "o-autorze":   { route: "about",        lang: "pl" },
  "kontakt":     { route: "contact",      lang: "pl" },
  "aktualnosci": { route: "achievements", lang: "pl" },
  "en":          { route: "home",         lang: "en" },
  "en/about":    { route: "about",        lang: "en" },
  "en/contact":  { route: "contact",      lang: "en" },
  "en/news":     { route: "achievements", lang: "en" },
};
// Stare hashe → nazwa widoku (PL i EN slug dla osiągnięć — zachowujemy oba)
const ROUTE_BY_HASH = {
  about:        "about",
  contact:      "contact",
  achievements: "achievements",
  osiagniecia:  "achievements",
};

function isProjectSlug(slug) {
  return !!(window.PROJECTS && window.PROJECTS.find(p => p.slug === slug));
}

// Adres pojedynczej aktualności bierze się z pola `id` w content/news/*.json —
// to samo, którego używa tools/build-pages.js przy generowaniu podstrony.
function isNewsSlug(slug) {
  return !!(window.ACHIEVEMENTS && window.ACHIEVEMENTS.find(a => a.id === slug));
}

function findNews(slug) {
  return (window.ACHIEVEMENTS || []).find(a => a.id === slug) || null;
}

// Slug bieżącego widoku — projekty i aktualności trzymają go w osobnych
// polach stanu, a adres i przełącznik języka potrzebują tego jednego.
function currentSlug() {
  if (state.route === "project") return state.projectSlug;
  if (state.route === "newsItem") return state.newsSlug;
  return null;
}

// Nazwa widoku → adres. Używane i przy zmianie URL-a, i przy canonical/OG.
// Adresy projektów mają w obu wersjach ten sam slug — to nazwa własna cyklu,
// a angielskie słowa kluczowe niesie tytuł i opis strony.
function routeToPath(route, slug, lang) {
  const L = lang || state.lang;
  if (route === "project" && slug) return (L === "en" ? "/en/" : "/") + slug + "/";
  // Aktualność mieszka POD listą aktualności — adres pokazuje tę zależność
  // i człowiekowi, i wyszukiwarce (/aktualnosci/ → /aktualnosci/wpis/).
  if (route === "newsItem") {
    const list = (PATH_BY_ROUTE[L] || PATH_BY_ROUTE.pl).achievements;
    return slug ? list + slug + "/" : list;
  }
  return (PATH_BY_ROUTE[L] || PATH_BY_ROUTE.pl)[route] || (L === "en" ? "/en/" : "/");
}

// Adres → widok i język. Zwraca null dla ścieżek, których nie znamy
// (np. /google98eb…html) — takie linki zostawiamy przeglądarce.
function routeFromPath(pathname) {
  const seg = (pathname || "/").replace(/^\/+|\/+$/g, "");
  if (!seg) return { route: "home", lang: "pl" };
  if (ROUTE_BY_PATH[seg]) return Object.assign({}, ROUTE_BY_PATH[seg]);
  // Pojedyncza aktualność — sprawdzamy PRZED projektami, bo ścieżka jest
  // dłuższa (dwa człony) i nie ma szans pomylić się ze slugiem cyklu.
  if (seg.startsWith("aktualnosci/") && isNewsSlug(seg.slice(12))) {
    return { route: "newsItem", slug: seg.slice(12), lang: "pl" };
  }
  if (seg.startsWith("en/news/") && isNewsSlug(seg.slice(8))) {
    return { route: "newsItem", slug: seg.slice(8), lang: "en" };
  }
  if (isProjectSlug(seg)) return { route: "project", slug: seg, lang: "pl" };
  if (seg.startsWith("en/") && isProjectSlug(seg.slice(3))) {
    return { route: "project", slug: seg.slice(3), lang: "en" };
  }
  return null;
}

function parseRoute() {
  // Stary adres ?lang=en (deklarowany kiedyś w hreflang) — dziś wersja
  // angielska ma własne ścieżki, więc traktujemy go jak link do podmiany.
  let paramLang = null;
  try {
    const v = new URLSearchParams(window.location.search).get("lang");
    if (v === "pl" || v === "en") paramLang = v;
  } catch (e) { /* nietypowy URL — ignoruj */ }

  const withLang = (r) => {
    // Adres rozstrzyga o języku. Wyjątek: ?lang= na ścieżce bez przedrostka
    // /en/ — to stary link, więc honorujemy parametr i podmieniamy adres.
    if (paramLang && paramLang !== r.lang) {
      return Object.assign({}, r, { lang: paramLang, legacy: true });
    }
    return r;
  };

  // 1. Ścieżka — nowy, indeksowalny adres
  const fromPath = routeFromPath(window.location.pathname);
  if (fromPath) {
    // Ktoś wszedł na „/” ze starym hashem — obsłuż go niżej, nie jako home
    if (!(fromPath.route === "home" && window.location.hash)) return withLang(fromPath);
  }
  // 2. Stary hash (#/labirynt) — linki sprzed przejścia na prawdziwe adresy
  const hash = (window.location.hash || "").replace(/^#\/?/, "");
  if (hash) {
    const lang = paramLang || "pl";
    if (ROUTE_BY_HASH[hash]) return { route: ROUTE_BY_HASH[hash], lang, legacy: true };
    if (isProjectSlug(hash)) return { route: "project", slug: hash, lang, legacy: true };
  }
  return withLang(fromPath || { route: "home", lang: "pl" });
}

function writeUrl(route, slug) {
  // Bez ?lang= — o języku mówi sama ścieżka (/en/…), a duplikat adresu
  // z parametrem byłby dla wyszukiwarki osobnym, zbędnym URL-em.
  const target = routeToPath(route, slug);
  if (window.location.pathname !== target || window.location.search || window.location.hash) {
    history.pushState(null, "", target);
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
  // stan przełącznika PL/EN ustawia updateNavLinks() — zależy od adresu,
  // nie od samych tekstów interfejsu
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
        <h2 class="title-text"><a href="/${p.slug}/" itemprop="url"><span itemprop="name">${p.title[L]}</span></a></h2>
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

  // Click handlers — kliknięcie w dowolne miejsce kafelka otwiera projekt.
  // Kliknięcie w sam tytuł jest zwykłym linkiem: obsługuje je globalny
  // handler linków wewnętrznych (init), więc tutaj je pomijamy, żeby
  // nawigacja nie wykonała się dwa razy.
  $$(".home-poster .cell").forEach(el => {
    el.onclick = (e) => {
      if (e.target.closest("a")) return;
      navigateProject(el.dataset.slug);
    };
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

  // Czas obrotu kartki — musi zgadzać się z `transition` na .book-leaf
  // i z animacją `leaf-shade` w index.html.
  const TURN_MS = 1200;

  function goDesktop(dir) {
    if (animating) return;
    if (dir > 0 && cur >= leaves) return;
    if (dir < 0 && cur <= 0) return;
    animating = true;
    const idx = dir > 0 ? cur : cur - 1;
    const book = $b();
    const leaf = book.children[idx];
    if (leaf) { leaf.style.zIndex = 1000; leaf.classList.add("turning"); }
    if (dir > 0) { if (leaf) leaf.classList.add("turned"); cur++; }
    else { if (leaf) leaf.classList.remove("turned"); cur--; }
    setShift(true);
    updateChrome();
    setTimeout(() => {
      animating = false;
      if (leaf) leaf.classList.remove("turning");
      applyZ();
    }, TURN_MS + 40);
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
    card.style.transition = "transform 340ms cubic-bezier(.45,.05,.25,1)";
    card.style.transform = `rotateY(${dir > 0 ? -90 : 90}deg)`;
    setTimeout(() => {
      mIndex = ni;
      card.innerHTML = pageHTML(mobilePages[mIndex]);
      card.style.transition = "none";
      card.style.transform = `rotateY(${dir > 0 ? 90 : -90}deg)`;
      void card.offsetWidth;
      applyMobileSizing();
      card.style.transition = "transform 340ms cubic-bezier(.45,.05,.25,1)";
      card.style.transform = "rotateY(0deg)";
      updateChrome();
      setTimeout(() => { animating = false; }, 360);
    }, 340);
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
    prevBtn.setAttribute("href", routeToPath("project", prev.slug));
    prevBtn.setAttribute("aria-label", (L==="pl"?"Poprzedni projekt: ":"Previous project: ") + prev.title[L]);
    nextBtn.innerHTML = `<span class="pn-label">${next.no} ${next.title[L]}</span> <span class="pn-arrow">→</span>`;
    nextBtn.setAttribute("href", routeToPath("project", next.slug));
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
    history.pushState({ lb: true }, "", window.location.href);
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
/* Aktualności renderujemy dopiero przy pierwszym wejściu w ten widok.
   Zdjęcia w liście są tłem CSS (background-image), a tła nie da się
   ładować leniwie — widok siedzi w DOM z opacity: 0, więc przeglądarka
   uznawała je za widoczne i ściągała komplet od razu. Efekt: samo wejście
   na stronę główną pobierało ~8,5 MB zdjęć, których nikt tam nie widzi. */
/* Ten sam widok obsługuje dwa adresy: listę (/aktualnosci/) i pojedynczy
   wpis (/aktualnosci/wpis/). Zamiast flagi „brudne” trzymamy KLUCZ ostatniego
   renderu — język + to, co ma być pokazane. Dzięki temu przejście z listy na
   wpis (i z powrotem) przerysowuje widok, a powrót na tę samą listę nie. */
let achievementsKey = null;

function achievementsWantedKey() {
  return state.lang + "|" + (state.route === "newsItem" ? state.newsSlug : "*");
}

/* Nagłówek sekcji („Aktualności”) ma w wygenerowanym pliku właściwy poziom:
   na liście jest nagłówkiem głównym (h1), na pozostałych podstronach h2.
   Przy przejściu w obrębie SPA z listy na wpis trzeba go zdegradować — inaczej
   strona miałaby dwa h1 naraz: nazwę sekcji i tytuł wpisu. Pierwotny poziom
   zapamiętujemy, żeby powrót na listę go przywrócił, a nie zgadywał. */
let homeHeadingDemoted = false;

// Zamienia znacznik elementu, zachowując atrybuty i treść.
function retag(el, tag) {
  if (el.tagName.toLowerCase() === tag) return el;
  const next = document.createElement(tag);
  for (const at of Array.from(el.attributes)) next.setAttribute(at.name, at.value);
  next.innerHTML = el.innerHTML;
  el.replaceWith(next);
  return next;
}

function syncNewsHeading(single) {
  // Ukryty nagłówek strony głównej. Wchodząc na wpis z listy prac mielibyśmy
  // go w dokumencie obok tytułu wpisu — dwa h1 naraz. Generator rozwiązuje to
  // tak samo: na podstronach zamienia ten nagłówek na <p>. Przywracamy tylko
  // to, co sami zdegradowaliśmy — na wygenerowanych plikach ma zostać <p>.
  if (single) {
    const home = document.querySelector("h1.sr-only");
    if (home) { retag(home, "p"); homeHeadingDemoted = true; }
  } else if (homeHeadingDemoted) {
    const home = document.querySelector('p.sr-only[data-i18n="home.h1"]');
    if (home) retag(home, "h1");
    homeHeadingDemoted = false;
  }

  const el = document.querySelector(".achievements-page .page-h");
  if (!el) return;
  // Wpis ma własny tytuł jako h1, więc nazwa sekcji schodzi do h2. Na liście
  // nazwa sekcji jest nagłówkiem głównym — chyba że dokument ma już inny h1.
  const innyH1 = $$("h1").some((h) => h !== el && !h.closest("#achievementsList"));
  retag(el, single || innyH1 ? "h2" : "h1");
}

/* Siatka pokazuje kafelki 235 × 235 px, więc bierze miniaturę z podkatalogu
   thumbs/ (600 px, generowane przez tools/build-thumbs.js). Pełny plik
   zostaje dla lightboxa. Gdyby miniatury zabrakło — np. zdjęcie dodane bez
   przebudowy — obsługa błędu niżej podmienia źródło na oryginał. */
function thumbPath(src) {
  const str = String(src || "");
  if (!/\/images\/achievements\//.test("/" + str.replace(/^\//, ""))) return str;
  const i = str.lastIndexOf("/");
  return i < 0 ? str : str.slice(0, i) + "/thumbs" + str.slice(i);
}

function ensureAchievements() {
  const key = achievementsWantedKey();
  if (achievementsKey === key) return;
  renderAchievements();
  achievementsKey = key;
}

// Aktualności posortowane od najnowszej — używane i przy liście, i przy
// szukaniu sąsiadów pojedynczego wpisu.
function sortedAchievements() {
  return [...(window.ACHIEVEMENTS || [])].sort((a, b) => {
    const aKey = a.dateISO || (a.year ? a.year + "-00-00" : "0000-00-00");
    const bKey = b.dateISO || (b.year ? b.year + "-00-00" : "0000-00-00");
    return bKey.localeCompare(aKey);
  });
}

function renderAchievements() {
  const list = $("#achievementsList");
  if (!list || !window.ACHIEVEMENTS) return;
  const L = state.lang;
  const single = state.route === "newsItem" ? findNews(state.newsSlug) : null;

  // Na podstronie wpisu pokazujemy tylko jego — inaczej każdy z ośmiu
  // adresów miałby tę samą treść i Google uznałby je za duplikaty.
  const sorted = single ? [single] : sortedAchievements();

  // Trzymaj referencję do posortowanej listy dla click handlera
  window._achievementsSorted = sorted;

  const backLink = single
    ? `<a class="achievement-back" href="${routeToPath("achievements", null, L)}" data-route="achievements">${
        (window.I18N[L] && window.I18N[L]["news.back"]) || "←"
      }</a>`
    : "";

  list.classList.toggle("single-item", !!single);
  syncNewsHeading(!!single);

  list.innerHTML = backLink + sorted.map((a, ai) => {
    const photos = (a.images || []).map((src, i) =>
      `<div class="achievement-photo" data-achievement="${ai}" data-photo="${i}" role="button" tabindex="0" aria-label="${attr(a.title[L])} — ${i+1}"><img src="${attr(thumbPath(src))}" data-full="${attr(src)}" alt="" loading="lazy" decoding="async"></div>`
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

    // Na liście tytuł jest linkiem do własnej podstrony wpisu — to jedyna
    // droga, którą wyszukiwarka może do niej dojść. Na samej podstronie
    // tytuł jest nagłówkiem głównym (h1), więc linku już nie ma.
    const href = a.id ? routeToPath("newsItem", a.id, L) : null;
    const titleTag = single
      ? `<h1 class="achievement-title" itemprop="name">${a.title[L]}</h1>`
      : `<h2 class="achievement-title" itemprop="name">${
          href ? `<a href="${href}">${a.title[L]}</a>` : a.title[L]
        }</h2>`;

    return `
      <article class="achievement${single ? " single" : ""}" itemscope itemtype="https://schema.org/Event">
        <meta itemprop="startDate" content="${a.dateISO || ""}">
        ${href ? `<meta itemprop="url" content="${BASE_URL}${href}">` : ""}
        <div class="achievement-meta">
          <span class="date">${displayDate}</span>
          <span class="type">${a.type[L]}</span>
        </div>
        <div class="achievement-content">
          ${titleTag}
          <div class="achievement-place" itemprop="location">${a.place[L]}</div>
          ${addressBlock}
          <p class="achievement-desc" itemprop="description">${a.description[L]}</p>
          ${photos ? `<div class="achievement-photos">${photos}</div>` : ""}
          ${link}
        </div>
      </article>
    `;
  }).join("");

  // Brak miniatury (nowe zdjęcie bez przebudowy) — pokaż pełny plik
  $$(".achievement-photo img").forEach(img => {
    img.addEventListener("error", () => {
      const full = img.dataset.full;
      if (full && img.getAttribute("src") !== full) img.setAttribute("src", full);
    }, { once: true });
  });

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
      url   = BASE_URL + routeToPath("project", p.slug);
    }
  } else if (route === "about") {
    title = L === "pl"
      ? "O autorze — Paweł Sypniewski, fotograf i artysta wizualny"
      : "About — Paweł Sypniewski, photographer and visual artist";
    desc  = L === "pl"
      ? "Paweł Sypniewski (ur. 1987) — fotograf i artysta wizualny z Warszawy, członek ZPAF. Edukacja: ITF Opawa, Sputnik Photos."
      : "Paweł Sypniewski (b. 1987) — photographer and visual artist from Warsaw, ZPAF member. Education: ITF Opava, Sputnik Photos.";
    url   = BASE_URL + routeToPath("about");
  } else if (route === "newsItem" && state.newsSlug) {
    const a = findNews(state.newsSlug);
    if (a) {
      title = `${a.title[L]} — ${a.type[L]} · Paweł Sypniewski`;
      const src = String((a.description && a.description[L]) || "").replace(/\s+/g, " ").trim();
      desc = src.length > 160 ? src.substring(0, 157).trimEnd() + "…" : src;
      url = BASE_URL + routeToPath("newsItem", a.id);
    }
  } else if (route === "achievements") {
    title = L === "pl"
      ? "Aktualności — Paweł Sypniewski"
      : "News — Paweł Sypniewski";
    desc  = L === "pl"
      ? "Aktualne wystawy, pokazy festiwalowe i wydarzenia z udziałem Pawła Sypniewskiego — fotografa i artysty wizualnego z Warszawy."
      : "Current exhibitions, festival screenings and events featuring Paweł Sypniewski — photographer and visual artist based in Warsaw.";
    url   = BASE_URL + routeToPath("achievements");
  } else if (route === "contact") {
    title = L === "pl"
      ? "Kontakt — Paweł Sypniewski"
      : "Contact — Paweł Sypniewski";
    desc  = L === "pl"
      ? "Limitowane odbitki autorskie. Skontaktuj się mailowo w sprawie nakładu, formatów i cen."
      : "Limited-edition artist prints available. Get in touch by email for sizes and pricing.";
    url   = BASE_URL + routeToPath("contact");
  } else {
    title = L === "pl"
      ? "Paweł Sypniewski — Fotograf i Artysta Wizualny | Warszawa, ZPAF"
      : "Paweł Sypniewski — Photographer and Visual Artist | Warsaw, ZPAF";
    desc  = L === "pl"
      ? "Paweł Sypniewski — fotograf i artysta wizualny z Warszawy. Portfolio prac dokumentalnych, reportażowych i kreacyjnych. Członek ZPAF, Okręg Warszawski."
      : "Paweł Sypniewski — photographer and visual artist from Warsaw. Documentary, reportage and constructed works. Member of ZPAF, Warsaw Branch.";
    url   = BASE_URL + routeToPath("home");
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

  // Wersja językowa strony — dla Facebooka/LinkedIna i dla wyszukiwarek
  setMeta('meta[property="og:locale"]', L === "pl" ? "pl_PL" : "en_US");
  setMeta('meta[property="og:locale:alternate"]', L === "pl" ? "en_US" : "pl_PL");
  const contentLang = document.querySelector('meta[http-equiv="content-language"]');
  if (contentLang) contentLang.setAttribute("content", L);

  // hreflang — para adresów siostrzanych dla bieżącego widoku
  const selfPl = BASE_URL + routeToPath(route, currentSlug(), "pl");
  const selfEn = BASE_URL + routeToPath(route, currentSlug(), "en");
  const setAlt = (lang, href) => {
    const el = document.querySelector(`link[rel="alternate"][hreflang="${lang}"]`);
    if (el) el.setAttribute("href", href);
  };
  setAlt("pl", selfPl);
  setAlt("en", selfEn);
  setAlt("x-default", selfPl);

  // Google Analytics 4 — virtual page_view dla SPA
  if (typeof window.gtag === "function" && url) {
    window.gtag('event', 'page_view', {
      page_title: title,
      page_location: url,
      page_path: url.replace("https://pawelsypniewski.pl", "") || "/"
    });
  }
}

/* ============================================================
   PRZEWIJANIE PANELU WIDOKU
   Dokument stoi w miejscu — .main ma overflow: hidden, a przewija się
   panel wewnątrz aktywnego widoku. Wynikały z tego dwa braki:
   1) kółko myszy / gest trackpada nad lewą kolumną (300 px, jedna piąta
      ekranu na 13") albo nad marginesem layoutu nie miały czego
      przewijać — przekazujemy scroll do panelu;
   2) panel bez tabindex nie przyjmuje fokusu, więc Spacja i PageDown
      nic nie robiły — nadajemy tabindex, gdy panel faktycznie przewija
      (WCAG 2.1.1: obszar przewijalny musi być dostępny z klawiatury).
   ============================================================ */
const SCROLL_PANE = ".text-page, .achievements-page, .project";

function activePane() {
  const view = document.querySelector(".view.active");
  if (!view) return null;
  const pane = view.querySelector(SCROLL_PANE);
  if (!pane) return null;
  return pane.scrollHeight > pane.clientHeight + 1 ? pane : null;
}

function syncPaneFocusability() {
  $$(SCROLL_PANE).forEach(pane => {
    const view = pane.closest(".view");
    const scrolls = pane.scrollHeight > pane.clientHeight + 1;
    if (scrolls && view && view.classList.contains("active")) {
      pane.setAttribute("tabindex", "0");
    } else {
      pane.removeAttribute("tabindex");
    }
  });
}

// Panel zaczyna się przewijać dopiero, gdy dorośnie treść — opis projektu
// renderuje się po zmianie widoku, a zdjęcia dociągają się jeszcze później.
// Pojedyncze sprawdzenie po przełączeniu widoku trafiało w moment, gdy panel
// jeszcze się mieścił, więc pilnujemy tego obserwatorem rozmiaru.
let paneObserver = null;

function watchPanes() {
  if (!("ResizeObserver" in window)) return;
  if (paneObserver) paneObserver.disconnect();
  else paneObserver = new ResizeObserver(() => syncPaneFocusability());
  $$(SCROLL_PANE).forEach(pane => {
    paneObserver.observe(pane);
    Array.from(pane.children).forEach(child => paneObserver.observe(child));
  });
}

function initPaneScroll() {
  document.addEventListener("wheel", (e) => {
    if (e.ctrlKey) return;                                    // pinch-zoom
    if (e.target.closest(SCROLL_PANE)) return;                // panel radzi sobie sam
    if (e.target.closest(".nav-preview, .lightbox")) return;  // mają własny scroll
    const pane = activePane();
    if (!pane) return;
    // deltaMode 1 = jednostką są linie (część myszy poza macOS)
    pane.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    e.preventDefault();
  }, { passive: false });

  window.addEventListener("resize", syncPaneFocusability);
  window.addEventListener("load", syncPaneFocusability);
  watchPanes();
}

// Nazwa widoku → id sekcji w HTML. Zwykle to po prostu „view-” + nazwa;
// wyjątkiem jest pojedyncza aktualność, która mieszka w tej samej sekcji
// co lista — różni je tylko to, co renderAchievements w niej narysuje.
const VIEW_BY_ROUTE = { newsItem: "view-achievements" };

function setRoute(route, opts = {}) {
  state.route = route;
  if (route !== "newsItem") state.newsSlug = null;
  if (route === "achievements" || route === "newsItem") ensureAchievements();
  $$(".view").forEach(v => v.classList.remove("active"));
  const id = VIEW_BY_ROUTE[route] || `view-${route}`;
  const el = document.getElementById(id);
  if (el) el.classList.add("active");

  // sidebar active state
  $$(".sidenav a").forEach(a => {
    const r = a.dataset.route;
    a.classList.toggle("active",
      r === route ||
      (route === "project" && r === "home") ||
      (route === "newsItem" && r === "achievements"));
  });

  // SEO: dynamic title/description per view
  updateSEO(route);
  updateNavLinks();

  // URL sync — chyba że woła nas popstate (back/forward)
  if (!opts.skipUrl) {
    writeUrl(route, currentSlug());
  }

  // Scroll do góry przy zmianie widoku (poprawia UX na mobile po przewinięciu)
  if (!opts.skipScroll) {
    window.scrollTo({ top: 0, behavior: "instant" });
    const main = document.querySelector(".main");
    if (main) main.scrollTop = 0;
    // Widoki przewijają się wewnętrznie (opis pod galerią, długa lista
    // aktualności) — przy zmianie widoku wracamy na górę każdego panelu
    $$(SCROLL_PANE).forEach(pane => { pane.scrollTop = 0; });
  }

  // Panel przewijalny musi przyjmować fokus. Synchronicznie, nie w
  // requestAnimationFrame — rAF nie odpala się w karcie otwartej w tle
  // (Cmd+klik), więc panel zostawałby bez tabindex aż do zmiany rozmiaru.
  // Treść widoku jest już wyrenderowana, bo renderProject/ensureAchievements
  // biegną przed tym miejscem; to, co dorasta później (zdjęcia), łapie
  // obserwator rozmiaru.
  watchPanes();
  syncPaneFocusability();
}

function navigateProject(slug, opts = {}) {
  state.projectSlug = slug;
  renderProject();
  setRoute("project", opts);
}

function navigateNews(slug, opts = {}) {
  state.newsSlug = slug;
  setRoute("newsItem", opts);
}

// Przerysowanie całej strony w danym języku — bez ruszania adresu.
function applyLang(lang) {
  state.lang = lang;
  document.documentElement.lang = lang;
  applyI18n();
  renderHome();
  renderTextPages();
  if (state.route === "achievements" || state.route === "newsItem") ensureAchievements();
  if (state.route === "project") renderProject();
  savePref(LS.lang, lang);
}

// Zmiana języka to przejście pod adres siostrzany (/labirynt/ ↔ /en/labirynt/),
// a nie przełącznik w miejscu: każda wersja językowa ma własny, indeksowalny
// adres i własny canonical.
function setLang(lang) {
  if (lang !== "pl" && lang !== "en") return;
  if (lang === state.lang) return;
  applyLang(lang);
  setRoute(state.route, { skipScroll: true });
}

// Menu i przełącznik PL/EN to prawdziwe linki, a ich adresy zależą od tego,
// gdzie jesteśmy i w jakim języku — odświeżamy je przy każdej zmianie widoku.
// Bez tego po przełączeniu na angielski menu wciąż prowadziłoby na polskie
// adresy i jedno kliknięcie cofałoby język z powrotem.
function updateNavLinks() {
  $$("[data-lang]").forEach(el => {
    const l = el.dataset.lang;
    el.setAttribute("href", routeToPath(state.route, currentSlug(), l));
    el.setAttribute("hreflang", l);
    el.classList.toggle("active", l === state.lang);
  });
  $$("a[data-route]").forEach(el => {
    const r = el.dataset.route;
    if (PATH_BY_ROUTE[state.lang] && PATH_BY_ROUTE[state.lang][r]) {
      el.setAttribute("href", routeToPath(r, null, state.lang));
    }
  });
}

/* ============================================================
   INIT + WIRING
   ============================================================ */
function init() {
  // Linki wewnętrzne — jeden handler dla całej strony.
  // Wszystkie odnośniki (menu, kafelki projektów, linki w wygenerowanych
  // podstronach) są prawdziwymi <a href="/…">, więc Google potrafi po nich
  // wejść. Dla użytkownika przechwytujemy kliknięcie i przełączamy widok
  // bez przeładowania strony — tak jak działało to wcześniej na hashu.
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;  // otwarcie w nowej karcie
    const a = e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;

    const url = new URL(a.getAttribute("href"), window.location.href);
    if (url.origin !== window.location.origin) return;             // link na zewnątrz

    const parsed = routeFromPath(url.pathname);
    if (!parsed) return;      // nieznana ścieżka — niech przeglądarka zrobi swoje

    e.preventDefault();
    // Link może prowadzić do innej wersji językowej (przełącznik PL/EN)
    if (parsed.lang && parsed.lang !== state.lang) applyLang(parsed.lang);
    if (parsed.route === "project") navigateProject(parsed.slug);
    else if (parsed.route === "newsItem") navigateNews(parsed.slug);
    else setRoute(parsed.route);
  });

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

  /* Gest dwoma palcami w bok — na trackpadzie MacBooka to najbardziej
     naturalny ruch przy galerii poziomej, a obsłużony był tylko dotyk
     (mobile). Gorzej: gestu nikt nie przechwytywał, więc przeglądarka
     traktowała go jako „wstecz" i potrafiła wyrzucić ze strony projektu.
     Pion zostawiamy w spokoju — tym przewija się opis pod galerią. */
  const projectPane = document.querySelector("#view-project .project");
  if (projectPane) {
    let swipeBusy = false;      // jedno przewinięcie = jedno zdjęcie
    let swipeAcc = 0;           // gest trackpada to seria drobnych zdarzeń
    let swipeReset = null;

    projectPane.addEventListener("wheel", (e) => {
      if (e.ctrlKey) return;                                 // pinch-zoom
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;  // pion = opis
      e.preventDefault();                                    // blokuj „wstecz"
      if (swipeBusy) return;

      swipeAcc += e.deltaX;
      clearTimeout(swipeReset);
      swipeReset = setTimeout(() => { swipeAcc = 0; }, 200);
      if (Math.abs(swipeAcc) < 60) return;                   // próg — bez drgań

      const dir = swipeAcc > 0 ? 1 : -1;
      swipeAcc = 0;
      swipeBusy = true;
      setTimeout(() => { swipeBusy = false; }, 420);

      if (DanieBook.isActive()) DanieBook.go(dir);
      else if (dir > 0) navProjectNext();
      else navProjectPrev();
    }, { passive: false });
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
    const parsed = parseRoute();
    if (parsed.lang && parsed.lang !== state.lang) applyLang(parsed.lang);
    if (parsed.route === "project" && parsed.slug) {
      state.projectSlug = parsed.slug;
      renderProject();
      setRoute("project", { skipUrl: true });
    } else if (parsed.route === "newsItem" && parsed.slug) {
      state.newsSlug = parsed.slug;
      setRoute("newsItem", { skipUrl: true });
    } else {
      setRoute(parsed.route || "home", { skipUrl: true });
    }
  });

  // 1. Sparsuj URL — co użytkownik chce zobaczyć (odświeżenie / link z zewnątrz)
  loadPrefs();
  const initial = parseRoute();

  // 2. Język bierzemy z adresu i ustawiamy PRZED pierwszym rysowaniem,
  //    inaczej strona mignęłaby po polsku, zanim przełączy się na angielski.
  state.lang = initial.lang || "pl";
  document.documentElement.lang = state.lang;

  // 3. Pierwszy render we właściwym języku
  applyI18n();
  renderHome();
  renderTextPages();
  // Aktualności dorenderuje setRoute w kroku 4 — tylko jeśli to ten widok

  // 3a. Stary link z hashem (#/labirynt) — podmień adres w pasku na nowy,
  //     bez dokładania wpisu do historii (replaceState, nie pushState).
  if (initial.legacy) {
    history.replaceState(
      null, "",
      routeToPath(initial.route, initial.slug, state.lang)
    );
  }

  // 4. Skieruj do żądanego widoku
  if (initial.route === "project" && initial.slug) {
    state.projectSlug = initial.slug;
    renderProject();
    setRoute("project", { skipUrl: true });
  } else if (initial.route === "newsItem" && initial.slug) {
    state.newsSlug = initial.slug;
    setRoute("newsItem", { skipUrl: true });
  } else {
    setRoute(initial.route || "home", { skipUrl: true });
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
        <span class="np-portrait" style="background-image:url('/images/about/portrait.webp')"></span>
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
  // Zgody reklamowe pozostają odrzucone niezależnie od decyzji w bannerze —
  // strona ich nie używa (patrz allow_google_signals w index.html).
  window.gtag("consent", "update", {
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
  initPaneScroll();
});
