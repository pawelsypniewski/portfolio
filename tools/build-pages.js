/**
 * Generuje PRAWDZIWE podstrony z szablonu index.html — w obu wersjach językowych.
 *
 *   node tools/build-pages.js        (albo: npm run pages)
 *
 * Po co: strona jest aplikacją jednostronicową (SPA) — wszystkie widoki żyją
 * w jednym pliku i przełącza je JavaScript. Wyszukiwarka odkrywa treść wyłącznie
 * idąc po linkach i traktuje każdy adres jako osobną stronę, więc każdy widok
 * musi istnieć jako osobny plik pod własnym adresem.
 *
 * Wejście:  index.html (szablon), content/*.json (treść), data.js (teksty UI)
 * Wyjście:  PL — /labirynt/, /o-autorze/, /kontakt/, /aktualnosci/ …
 *           EN — /en/, /en/labirynt/, /en/about/, /en/contact/, /en/news/ …
 *           każda aktualność osobno: /aktualnosci/offoto-opole-2026/
 *           oraz 404.html i sitemap.xml
 *
 * Adres projektu ma w obu wersjach ten sam slug (/labirynt/ i /en/labirynt/) —
 * slug jest nazwą własną cyklu, a angielskie słowa kluczowe niesie tytuł
 * i opis strony. Strony siostrzane wskazują na siebie przez hreflang.
 *
 * WAŻNE: plików wynikowych NIE edytuje się ręcznie — przy najbliższym
 * uruchomieniu zostaną nadpisane. Zmiany wprowadza się w index.html
 * (wygląd/nagłówek) albo w content/*.json (treść).
 *
 * Skrypt celowo przerywa działanie z błędem, gdy nie znajdzie w szablonie
 * któregoś ze znaczników — lepiej zatrzymać build niż wypuścić podstrony
 * z niepodmienionymi metadanymi.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const BASE = "https://pawelsypniewski.pl";
const AUTHOR = "Paweł Sypniewski";
const LANGS = ["pl", "en"];
const LOCALE = { pl: "pl_PL", en: "en_US" };
const INLANG = { pl: "pl-PL", en: "en-US" };

/* ------------------------------------------------------------------ */
/* Pomocnicze                                                          */
/* ------------------------------------------------------------------ */

const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Ścieżki w JSON są względne ("images/…"); strona działa pod adresami
// typu /labirynt/, więc muszą być bezwzględne — tak samo jak w loader.js.
const abs = (p) => (/^images\//.test(String(p)) ? "/" + p : String(p));
const absUrl = (p) => BASE + abs(p);

// Skrót opisu do meta description (Google i tak ucina ~160 znaków)
function shorten(text, limit = 160) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > limit ? t.slice(0, limit - 3).trimEnd() + "…" : t;
}

// Teksty interfejsu mieszkają w data.js jako window.I18N. Uruchamiamy ten
// plik w izolowanym kontekście z podstawionym `window`, żeby nie duplikować
// tłumaczeń w drugim miejscu — jedno źródło prawdy dla strony i generatora.
function loadI18n() {
  const box = { window: {} };
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "data.js"), "utf8"), box);
  const i18n = box.window.I18N;
  if (!i18n || !i18n.pl || !i18n.en) {
    throw new Error("data.js nie udostępnił window.I18N — sprawdź, czy plik się nie zmienił.");
  }
  return i18n;
}

/* Teksty „O autorze” i „Kontakt” to markdown w content/settings/*.json, który
   na HTML zamienia loader.js już w przeglądarce. Zamiast przepisywać ten
   konwerter drugi raz, uruchamiamy tu prawdziwy loader.js — w izolowanym
   kontekście, gdzie fetch czyta z dysku zamiast z sieci. Dzięki temu w pliku
   ląduje dokładnie ten HTML, który zobaczy przeglądarka, i nie ma czego
   rozjechać: jedno źródło prawdy zamiast dwóch bliźniaczych konwerterów. */
async function loadTexts() {
  const box = {
    window: {},
    console,
    fetch: async (url) => {
      const file = path.join(ROOT, String(url).replace(/^\/+/, ""));
      if (!fs.existsSync(file)) return { ok: false, status: 404, json: async () => null };
      return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(file, "utf8")) };
    },
  };
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "loader.js"), "utf8"), box);
  await box.window.__DATA_READY;
  const { ABOUT, CONTACT } = box.window;
  if (!ABOUT || !ABOUT.pl || !ABOUT.pl.side || !CONTACT || !CONTACT.pl) {
    throw new Error(
      "loader.js nie zbudował treści O autorze / Kontaktu — sprawdź, czy plik " +
      "albo content/settings/*.json się nie zmieniły."
    );
  }
  return { ABOUT, CONTACT };
}

// Adresy widoków. Musi zgadzać się z PATH_BY_ROUTE / routeToPath w app.js.
const PATHS = {
  pl: { home: "/", about: "/o-autorze/", contact: "/kontakt/", achievements: "/aktualnosci/" },
  en: { home: "/en/", about: "/en/about/", contact: "/en/contact/", achievements: "/en/news/" },
};
function pathFor(route, slug, lang) {
  if (route === "project") return (lang === "en" ? "/en/" : "/") + slug + "/";
  // Pojedyncza aktualność leży POD listą (/aktualnosci/wpis/) — adres pokazuje
  // przynależność, a wyszukiwarka dostaje czytelną hierarchię zamiast płaskiej
  // listy adresów w korzeniu witryny.
  if (route === "newsItem") return PATHS[lang].achievements + (slug ? slug + "/" : "");
  return PATHS[lang][route];
}

// Dzień ostatniej zmiany podanych plików/katalogów według git (RRRR-MM-DD).
// Zwraca null, gdy git nie ma historii (np. płytki checkout) albo nic nie
// znajdzie — wtedy mapa strony dostaje dzisiejszą datę, jak dawniej.
function gitDate(paths) {
  if (!paths || !paths.length) return null;
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", ...paths],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch (e) {
    return null;
  }
}

// Podmiana z kontrolą: jeśli wzorca nie ma w szablonie, przerywamy build.
// Sprawdzamy, czy wzorzec PASUJE — nie czy wynik się zmienił: wstawienie
// pustej treści w puste pole daje wynik identyczny z wejściem, a to nie błąd.
// Podmieniamy przez funkcję, żeby znak „$” w treści nie był interpretowany
// jako odwołanie do grupy (np. „$&” wklejałoby całe dopasowanie).
function replaceOnce(html, pattern, replacement, what) {
  const found = typeof pattern === "string" ? html.includes(pattern) : pattern.test(html);
  if (!found) {
    throw new Error(
      `Nie znaleziono w index.html: ${what}\n` +
      `Szablon zmienił się w sposób, którego generator nie rozumie — ` +
      `popraw tools/build-pages.js zanim wypuścisz zmiany.`
    );
  }
  return html.replace(pattern, typeof replacement === "function" ? replacement : () => replacement);
}

// Podmienia zawartość elementu o danym id. Nie da się tego zrobić prostym
// wyrażeniem regularnym: „pierwszy </div> od otwarcia" trafiałby w domknięcie
// zagnieżdżonego elementu, a nie tego właściwego. Dlatego szukamy domykającego
// znacznika licząc zagnieżdżenia — dzięki temu wynik jest taki sam niezależnie
// od tego, ile razy skrypt uruchomiono.
function setInner(html, id, value) {
  const idAt = html.indexOf(`id="${id}"`);
  if (idAt === -1) {
    throw new Error(
      `Nie znaleziono w index.html: element o id="${id}"\n` +
      `Szablon zmienił się w sposób, którego generator nie rozumie — ` +
      `popraw tools/build-pages.js zanim wypuścisz zmiany.`
    );
  }
  const tagStart = html.lastIndexOf("<", idAt);
  const tag = /^<([a-z0-9]+)/i.exec(html.slice(tagStart))[1].toLowerCase();
  const openEnd = html.indexOf(">", idAt) + 1;

  const scan = new RegExp(`<${tag}\\b|</${tag}>`, "gi");
  scan.lastIndex = openEnd;
  let depth = 1;
  let m;
  while ((m = scan.exec(html))) {
    if (m[0][1] === "/") {
      if (--depth === 0) return html.slice(0, openEnd) + value + html.slice(m.index);
    } else {
      depth++;
    }
  }
  throw new Error(`Element #${id} w index.html nie ma domknięcia </${tag}>`);
}

/* ------------------------------------------------------------------ */
/* Podmiany w <head>                                                   */
/* ------------------------------------------------------------------ */

function applyHead(html, page) {
  const lang = page.lang;
  const url = BASE + page.path;
  const selfPl = BASE + pathFor(page.route, page.slug, "pl");
  const selfEn = BASE + pathFor(page.route, page.slug, "en");
  const title = escapeHtml(page.title);
  const desc = escapeHtml(page.description);
  const img = escapeHtml(page.image.url);
  const imgAlt = escapeHtml(page.image.alt);

  html = replaceOnce(html, /<html lang="[^"]*">/,
    `<html lang="${lang}">`, "<html lang>");
  html = replaceOnce(html, /<meta http-equiv="content-language" content="[^"]*">/,
    `<meta http-equiv="content-language" content="${lang}">`, "content-language");

  html = replaceOnce(html, /<title>[\s\S]*?<\/title>/,
    `<title>${title}</title>`, "<title>");
  html = replaceOnce(html, /<meta name="description" content="[\s\S]*?">/,
    `<meta name="description" content="${desc}">`, 'meta name="description"');

  // Canonical wskazuje na SIEBIE. Wcześniej obie wersje językowe kanonizowały
  // się do polskiej strony głównej, więc angielska nie miała szans wejść
  // do indeksu — mówiła Google „jestem duplikatem tamtej".
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*">/,
    `<link rel="canonical" href="${url}">`, "link rel=canonical");

  // hreflang — para adresów siostrzanych; x-default kieruje na wersję polską
  html = replaceOnce(html,
    /<link rel="alternate" href="[^"]*" hreflang="pl">[\s\S]*?<link rel="alternate" href="[^"]*" hreflang="x-default">/,
    `<link rel="alternate" href="${selfPl}" hreflang="pl">\n` +
    `<link rel="alternate" href="${selfEn}" hreflang="en">\n` +
    `<link rel="alternate" href="${selfPl}" hreflang="x-default">`,
    "link rel=alternate hreflang");

  html = replaceOnce(html, /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${title}">`, "og:title");
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${desc}">`, "og:description");
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${url}">`, "og:url");
  html = replaceOnce(html, /<meta property="og:type" content="[^"]*">/,
    `<meta property="og:type" content="${page.ogType || "website"}">`, "og:type");
  html = replaceOnce(html, /<meta property="og:locale" content="[^"]*">/,
    `<meta property="og:locale" content="${LOCALE[lang]}">`, "og:locale");
  html = replaceOnce(html, /<meta property="og:locale:alternate" content="[^"]*">/,
    `<meta property="og:locale:alternate" content="${LOCALE[lang === "pl" ? "en" : "pl"]}">`,
    "og:locale:alternate");

  html = replaceOnce(html, /<meta property="og:image" content="[^"]*">/,
    `<meta property="og:image" content="${img}">`, "og:image");
  html = replaceOnce(html, /<meta property="og:image:secure_url" content="[^"]*">/,
    `<meta property="og:image:secure_url" content="${img}">`, "og:image:secure_url");
  html = replaceOnce(html, /<meta property="og:image:type" content="[^"]*">/,
    `<meta property="og:image:type" content="${page.image.type}">`, "og:image:type");
  html = replaceOnce(html, /<meta property="og:image:alt" content="[^"]*">/,
    `<meta property="og:image:alt" content="${imgAlt}">`, "og:image:alt");

  // Wymiary podajemy tylko dla okładki, której rozmiar znamy (1200×630).
  // Dla zdjęć z projektów usuwamy je, żeby nie podawać nieprawdy.
  if (!page.image.hasKnownSize) {
    html = replaceOnce(html, /\n<meta property="og:image:width" content="[^"]*">/, "", "og:image:width");
    html = replaceOnce(html, /\n<meta property="og:image:height" content="[^"]*">/, "", "og:image:height");
  }

  html = replaceOnce(html, /<meta name="twitter:title" content="[^"]*">/,
    `<meta name="twitter:title" content="${title}">`, "twitter:title");
  html = replaceOnce(html, /<meta name="twitter:description" content="[^"]*">/,
    `<meta name="twitter:description" content="${desc}">`, "twitter:description");
  html = replaceOnce(html, /<meta name="twitter:image" content="[^"]*">/,
    `<meta name="twitter:image" content="${img}">`, "twitter:image");
  html = replaceOnce(html, /<meta name="twitter:image:alt" content="[^"]*">/,
    `<meta name="twitter:image:alt" content="${imgAlt}">`, "twitter:image:alt");

  if (page.noindex) {
    html = replaceOnce(html, /<meta name="robots" content="[^"]*">/,
      `<meta name="robots" content="noindex, follow">`, "meta robots");
  }

  // Węzeł galerii w grafie witryny wymieniał prace, ale bez adresów — nie
  // było dokąd z niego pójść. Teraz każda praca wskazuje na swoją podstronę
  // i swoje zdjęcie. Opisy po polsku są pisane ręcznie w index.html (są
  // bogatsze niż podpisy w treści), więc zostawiamy je; wersja angielska
  // bierze nazwę, gatunek i opis z content/projects.json, żeby nie trzymać
  // angielskich tekstów w drugim miejscu.
  if (page.gallery) {
    html = enrichGallery(html, page.gallery, page.lang);
  }

  // Dane strukturalne właściwe dla tej podstrony — dokładane obok
  // istniejącego grafu (Person / WebSite), który opisuje całą witrynę.
  // Podstrona może mieć ich kilka (np. opis pracy i okruszki nawigacyjne).
  // Każdy dostaje własny znacznik <script> — czytelniej niż jedna tablica,
  // gdy trzeba coś sprawdzić w narzędziu Google albo w kodzie strony.
  const jsonLds = [].concat(page.jsonLd || []).filter(Boolean);
  if (jsonLds.length) {
    const bloki = jsonLds
      .map((ld) => `<script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n</script>`)
      .join("\n");
    html = replaceOnce(html, /<\/head>/, () => `${bloki}\n</head>`, "</head>");
  }

  return html;
}

// Wzbogaca węzeł ImageGallery w grafie witryny o adresy podstron i zdjęcia.
// Prace dopasowujemy po nazwie polskiej; gdy któraś nie pasuje, zostawiamy
// ją nietkniętą i mówimy o tym głośno, zamiast po cichu psuć dane.
function enrichGallery(html, projects, lang) {
  const wgTytulu = new Map(projects.map((p) => [p.title.pl, p]));
  const blok = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
  const m = blok.exec(html);
  if (!m) throw new Error("Nie znaleziono w index.html: grafu danych strukturalnych");

  const graf = JSON.parse(m[1]);
  const galeria = (graf["@graph"] || []).find((n) => n["@type"] === "ImageGallery");
  if (!galeria) throw new Error("W grafie danych strukturalnych brakuje węzła ImageGallery");

  galeria.url = BASE + pathFor("home", null, lang);
  galeria.inLanguage = INLANG[lang];
  galeria.hasPart = (galeria.hasPart || []).map((cz) => {
    const p = wgTytulu.get(cz.name);
    if (!p) {
      console.warn(`  ! praca „${cz.name}" z danych strukturalnych nie ma odpowiednika w content/projects.json — pomijam`);
      return cz;
    }
    const out = Object.assign({}, cz, {
      "@id": `${BASE}${pathFor("project", p.slug, lang)}#work`,
      url: BASE + pathFor("project", p.slug, lang),
      image: absUrl(p.thumb || p.images[0]),
    });
    if (lang === "en") {
      out.name = p.title.en;
      out.genre = p.category.en;
      out.description = String((p.description && p.description.en) || p.caption.en)
        .replace(/\s+/g, " ")
        .trim();
    }
    return out;
  });

  const nowy = JSON.stringify(graf, null, 2);
  return html.replace(blok, () => `<script type="application/ld+json">\n${nowy}\n</script>`);
}

/* ------------------------------------------------------------------ */
/* Podmiany w <body> — który widok jest widoczny i co w nim jest       */
/* ------------------------------------------------------------------ */

// Widok → klucz nagłówka sekcji w szablonie
const HEADING_KEY = {
  "view-about": "about.h",
  "view-contact": "contact.h",
  "view-achievements": "achievements.h",
};

function applyBody(html, page, i18n) {
  // Teksty interfejsu w języku strony. Bez tego angielskie podstrony miałyby
  // w kodzie polskie menu — a to właśnie menu jest tekstem linków wewnętrznych,
  // po których wyszukiwarka ocenia, dokąd prowadzą.
  const dict = i18n[page.lang] || {};
  for (const [key, text] of Object.entries(dict)) {
    const re = new RegExp(`(<([a-z0-9]+)[^>]*\\sdata-i18n="${key.replace(/\./g, "\\.")}"[^>]*>)[^<]*(</\\2>)`, "i");
    if (re.test(html)) {
      html = html.replace(re, (_m, open, _tag, close) => open + escapeHtml(text) + close);
    }
  }

  // Menu boczne w języku strony. Bez tego angielska podstrona linkowałaby
  // wyłącznie do polskich adresów — czyli wersja EN nie miałaby wewnętrznej
  // sieci linków, po której wyszukiwarka mogłaby ją obejść.
  html = html.replace(
    /<a href="[^"]*"(\s+data-route="(home|about|contact|achievements)")/g,
    (_m, tail, route) => `<a href="${pathFor(route, null, page.lang)}"${tail}`
  );

  // Przełącznik PL/EN — prawdziwe linki do adresu siostrzanego tej podstrony
  for (const l of LANGS) {
    const href = pathFor(page.route, page.slug, l);
    const re = new RegExp(`<a data-lang="${l}"[^>]*>`, "i");
    html = replaceOnce(html, re,
      `<a data-lang="${l}" href="${href}" hreflang="${l}"${l === page.lang ? ' class="active"' : ""}>`,
      `przełącznik języka [${l}]`);
  }

  // Widoczny od razu ma być widok tej podstrony, nie strona główna —
  // inaczej wchodzący z Google zobaczyłby najpierw listę prac.
  if (page.viewId !== "view-home") {
    html = replaceOnce(html, '<section class="view active" id="view-home">',
      '<section class="view" id="view-home">', "aktywny widok home");
    html = replaceOnce(html, `<section class="view" id="${page.viewId}">`,
      `<section class="view active" id="${page.viewId}">`, `widok ${page.viewId}`);
  }

  // Dokładnie JEDEN <h1> na podstronę. Wszystkie widoki żyją w jednym pliku,
  // więc bez tego każda strona miała ich kilka naraz. Nagłówkiem głównym jest
  // ten, który należy do widoku tej podstrony; ukryty nagłówek strony głównej
  // schodzi wtedy do <p> (dalej czyta go czytnik ekranu, ale nie konkuruje).
  if (page.viewId !== "view-home") {
    html = replaceOnce(html, /<h1 class="sr-only"([^>]*)>([\s\S]*?)<\/h1>/,
      (_m, attrs, inner) => `<p class="sr-only"${attrs}>${inner}</p>`, "ukryty h1 strony głównej");
  }
  if (page.viewId === "view-project") {
    html = replaceOnce(html, /<(?:div|h1) class="pj-title" id="pjTitle">[\s\S]*?<\/(?:div|h1)>/,
      `<h1 class="pj-title" id="pjTitle">${escapeHtml(page.project.title)}</h1>`, "#pjTitle");
  } else if (HEADING_KEY[page.viewId] && !page.h1InContent) {
    const key = HEADING_KEY[page.viewId].replace(/\./g, "\\.");
    html = replaceOnce(html,
      new RegExp(`<h2 class="page-h" data-i18n="${key}">([^<]*)</h2>`),
      (_m, inner) => `<h1 class="page-h" data-i18n="${HEADING_KEY[page.viewId]}">${inner}</h1>`,
      `nagłówek widoku ${page.viewId}`);
  }

  // Podstrona wpisu ma nad treścią tylko link powrotny, więc lista dostaje
  // węższy odstęp. Klasę ustawia też app.js po przerysowaniu widoku.
  if (page.listSingle) {
    html = replaceOnce(html, '<div id="achievementsList" class="achievements-list">',
      '<div id="achievementsList" class="achievements-list single-item">',
      "#achievementsList");
  }

  for (const [id, value] of Object.entries(page.fill || {})) {
    html = setInner(html, id, value);
  }

  if (page.viewId === "view-project" && page.project.description) {
    html = replaceOnce(html, /<div class="proj-description" id="pjDescription" hidden>/,
      '<div class="proj-description" id="pjDescription">', "#pjDescription (hidden)");
  }

  return html;
}

/* ------------------------------------------------------------------ */
/* Budowa opisów podstron                                              */
/* ------------------------------------------------------------------ */

const COVER = {
  url: `${BASE}/images/og-cover.jpg`,
  alt: `${AUTHOR} — fragment cyklu Superpozycja`,
  type: "image/jpeg",
  hasKnownSize: true,
};

// Siatka kafelków strony głównej — dokładnie ten sam kod, który generuje
// renderHome() w app.js. Wstawiamy ją do pliku, bo w wersji tylko-JS linki
// do projektów nie istniały w kodzie źródłowym: Google je wyrenderuje, ale
// roboty Bing i boty AI (GPTBot, ClaudeBot) zwykle JavaScriptu nie uruchamiają.
function homeGrid(projects, lang) {
  const works = lang === "pl" ? "PRACE" : "WORKS";
  const worksLabel = lang === "pl" ? "prac" : "works";
  return projects
    .map((p, i) => {
      const title = escapeHtml(p.title[lang]);
      const href = pathFor("project", p.slug, lang);
      return `
    <article class="cell c${i + 1}" data-slug="${escapeHtml(p.slug)}" itemscope itemtype="https://schema.org/CreativeWork">
      <div class="num">${escapeHtml(p.no)} / ${works}</div>
      <div class="title">
        <h2 class="title-text"><a href="${href}" itemprop="url"><span itemprop="name">${title}</span></a></h2>
        <div class="thumb-frame" role="img" aria-label="${title} — ${lang === "pl" ? "podgląd" : "preview"}"${thumbStyle(p.thumb || (p.images || [])[0])}></div>
      </div>
      <div class="meta"><span itemprop="dateCreated">${escapeHtml(p.year)}</span> · <span itemprop="contentLocation">${escapeHtml(p.place[lang])}</span> · ${p.works} ${worksLabel}</div>
    </article>
  `;
    })
    .join("");
}

/* Pole `thumb` ma dziś tylko część cykli, więc gdy go brak — bierzemy
   pierwsze zdjęcie z cyklu; pusta ramka byłaby gorsza od byle jakiej.
   Zdjęcie kafla wpisujemy już w plik, a nie dopiero JavaScriptem: na
   telefonie kafle pokazują zdjęcia (app.js zmienia je potem co 1,5 s), więc
   bez tego pierwszy ekran byłby pusty do czasu wczytania treści. Na
   desktopie ramka i tak czeka schowana na najechanie kursorem. */
function thumbStyle(src) {
  if (!src) return "";
  const str = String(src);
  const i = str.lastIndexOf("/");
  const thumb = i < 0 ? str : str.slice(0, i) + "/thumbs" + str.slice(i);
  return ` style="background-image:url('/${escapeHtml(thumb.replace(/^\//, ""))}')"`;
}

/* ------------------------------------------------------------------ */
/* Aktualności — lista i pojedynczy wpis                               */
/* ------------------------------------------------------------------ */

// Miniatura z podkatalogu thumbs/ — dokładnie tak samo liczy ją app.js.
function thumbPath(src) {
  const str = String(src || "");
  if (!/\/images\/achievements\//.test("/" + str.replace(/^\//, ""))) return str;
  const i = str.lastIndexOf("/");
  return i < 0 ? str : str.slice(0, i) + "/thumbs" + str.slice(i);
}

function newsSorted(news) {
  return news.slice().sort((a, b) => {
    const ak = a.dateISO || (a.year ? a.year + "-00-00" : "0000-00-00");
    const bk = b.dateISO || (b.year ? b.year + "-00-00" : "0000-00-00");
    return bk.localeCompare(ak);
  });
}

// Wystawy i pokazy to wydarzenia wystawiennicze; członkostwo w ZPAF czy studia
// w Opawie — już nie. Nie nazywamy wszystkiego wystawą, bo dane strukturalne
// mają opisywać rzeczywistość, a nie ją naciągać.
function newsEventType(a) {
  return /wystaw|pokaz/i.test(String(a.type && a.type.pl)) ? "ExhibitionEvent" : "Event";
}

/* Jeden opis wydarzenia dla obu miejsc, w których go podajemy: na stronie
   wpisu i na liście aktualności. Google prosi w danych o wydarzeniu o komplet
   pól — datę końca, adres miejsca, organizatora, wykonawcę i status — więc
   wszystkie podajemy tutaj, a nie w dwóch osobnych, rozjeżdżających się
   miejscach. Adres bierzemy z pola `venue` wpisu (content/news/*.json):
   nazwa instytucji, miasto i kraj — tyle, ile faktycznie wiemy.
   `full` = wersja na stronę wpisu (pełny opis); bez niej — skrót na listę. */
function newsEventLd(a, lang, full) {
  const L = lang;
  const self = a.id ? pathFor("newsItem", a.id, L) : null;
  const v = a.venue || {};
  const venueName = (v.name && v.name[L]) || a.place[L];
  const locality = v.locality && v.locality[L];
  const descText = String((a.description && a.description[L]) || "").replace(/\s+/g, " ").trim();

  return {
    "@type": newsEventType(a),
    "@id": self ? `${BASE}${self}#event` : undefined,
    name: a.title[L],
    url: self ? BASE + self : undefined,
    startDate: a.dateISO,
    endDate: a.dateEndISO || a.dateISO,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: venueName,
      address: {
        "@type": "PostalAddress",
        addressLocality: locality,
        addressCountry: v.country,
      },
    },
    organizer: { "@type": "Organization", name: venueName },
    performer: { "@type": "Person", "@id": `${BASE}/#person`, name: AUTHOR },
    description: full ? descText : shorten(descText, 300),
    inLanguage: INLANG[L],
  };
}

/* Lista aktualności w kodzie źródłowym — bliźniak renderAchievements() z app.js.
   Ten sam HTML musi powstać po obu stronach: bez tego robot nieuruchamiający
   JavaScriptu (Bing, GPTBot, ClaudeBot) zobaczyłby pustą sekcję, a przeglądarka
   po wczytaniu app.js przerysowałaby stronę na coś innego niż zaindeksowane.
   Uwaga przy zmianach: poprawkę wprowadza się TU i w app.js jednocześnie. */
function newsListHtml(items, lang, i18n, single) {
  const L = lang;
  const back = single
    ? `<a class="achievement-back" href="${pathFor("achievements", null, L)}" data-route="achievements">` +
      `${escapeHtml((i18n[L] && i18n[L]["news.back"]) || "←")}</a>`
    : "";

  return back + items.map((a, ai) => {
    const title = escapeHtml(a.title[L]);
    const photos = (a.images || []).map((src, i) =>
      `<div class="achievement-photo" data-achievement="${ai}" data-photo="${i}" role="button" tabindex="0" aria-label="${title} — ${i + 1}">` +
      `<img src="${escapeHtml(thumbPath(abs(src)))}" data-full="${escapeHtml(abs(src))}" alt="" loading="lazy" decoding="async"></div>`
    ).join("");

    let link = "";
    if (a.links && a.links.length) {
      const list = a.links.map((l) =>
        `<a class="achievement-link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label[L])} →</a>`
      ).join("");
      link = `<div class="achievement-links">${list}</div>`;
    } else if (a.url) {
      const fallback = L === "pl" ? "Zobacz więcej →" : "Learn more →";
      link = `<a class="achievement-link" href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer">${fallback}</a>`;
    }

    const displayDate = escapeHtml(a.date ? a.date[L] : (a.year || ""));
    const addressBlock = a.address ? `<div class="achievement-address">${escapeHtml(a.address[L])}</div>` : "";

    const href = a.id ? pathFor("newsItem", a.id, L) : null;
    const titleTag = single
      ? `<h1 class="achievement-title">${title}</h1>`
      : `<h2 class="achievement-title">${href ? `<a href="${href}">${title}</a>` : title}</h2>`;

    /* Bez znaczników microdata: to samo wydarzenie opisuje już komplet
       JSON-LD w <head> (patrz newsEventLd). Dwa opisy tego samego zdarzenia
       Google czyta jako dwa osobne wydarzenia i o brakujące pola w tym
       uboższym — dopisywał ostrzeżenia w Search Console. */
    return `
      <article class="achievement${single ? " single" : ""}">
        <div class="achievement-meta">
          <span class="date">${displayDate}</span>
          <span class="type">${escapeHtml(a.type[L])}</span>
        </div>
        <div class="achievement-content">
          ${titleTag}
          <div class="achievement-place">${escapeHtml(a.place[L])}</div>
          ${addressBlock}
          <p class="achievement-desc">${escapeHtml(a.description[L])}</p>
          ${photos ? `<div class="achievement-photos">${photos}</div>` : ""}
          ${link}
        </div>
      </article>
    `;
  }).join("");
}

function newsItemPage(a, lang, i18n) {
  const L = lang;
  const self = pathFor("newsItem", a.id, L);
  const descText = String((a.description && a.description[L]) || "").replace(/\s+/g, " ").trim();
  const images = (a.images || []).map(abs);

  return {
    route: "newsItem",
    slug: a.id,
    lang: L,
    path: self,
    viewId: "view-achievements",
    ogType: "article",
    // Nagłówkiem głównym jest tytuł wpisu, nie nazwa sekcji — dlatego
    // „Aktualności” zostaje przy h2 (patrz applyBody).
    h1InContent: true,
    listSingle: true,
    crumb: a.title[L],
    title: `${a.title[L]} — ${a.type[L]} · ${AUTHOR}`,
    description: shorten(descText),
    image: images.length
      ? { url: BASE + images[0], alt: `${a.title[L]} — ${a.place[L]}`, type: "image/webp", hasKnownSize: false }
      : COVER,
    fill: { achievementsList: newsListHtml([a], L, i18n, true) },
    jsonLd: {
      "@context": "https://schema.org",
      ...newsEventLd(a, L, true),
      image: images.map((src) => ({
        "@type": "ImageObject",
        contentUrl: BASE + src,
        caption: `${a.title[L]} — ${a.place[L]}`,
        creditText: AUTHOR,
      })),
    },
  };
}

function projectPage(p, lang, projects) {
  const L = lang;
  const title = p.title[L];
  const images = p.images.map(abs);
  const descText = (p.description && p.description[L]) || p.caption[L];
  const photoWord = L === "pl" ? "zdjęcie" : "photo";
  const ofWord = L === "pl" ? "z" : "of";

  const slides = images
    .map((src, i) =>
      `<div class="proj-slide"><img src="${escapeHtml(src)}" alt="${escapeHtml(
        `${title} — ${photoWord} ${i + 1} ${ofWord} ${images.length}, ${p.year}, ${p.category[L]}`
      )}" data-index="${i}" loading="${i === 0 ? "eager" : "lazy"}" fetchpriority="${
        i === 0 ? "high" : "auto"
      }" decoding="async"></div>`
    )
    .join("");

  const descHtml = (p.description && p.description[L] ? p.description[L] : "")
    .split("\n\n")
    .filter(Boolean)
    .map((par) => `<p${par.length < 100 ? ' class="kw"' : ""}>${escapeHtml(par).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return {
    route: "project",
    slug: p.slug,
    lang: L,
    path: pathFor("project", p.slug, L),
    viewId: "view-project",
    ogType: "article",
    crumb: title,
    title: `${title} — ${p.year} · ${AUTHOR}`,
    description: shorten(descText),
    image: {
      url: absUrl(p.thumb || p.images[0]),
      alt: `${title} — ${p.category[L]}, ${p.year}`,
      type: "image/webp",
      hasKnownSize: false,
    },
    project: { title, description: !!descHtml },
    fill: {
      homeListPoster: homeGrid(projects, L),
      pjSub: escapeHtml(`${p.no} / ${p.category[L]}`),
      pjMeta: `${escapeHtml(p.year)}<br>${escapeHtml(p.place[L])}<br>${p.works} ${L === "pl" ? "prac" : "works"}`,
      pjTrack: slides,
      pjCaption: escapeHtml(p.caption[L]),
      pjCounter: `01/${String(images.length).padStart(2, "0")}`,
      pjDescription: descHtml,
    },
    jsonLd: {
      "@context": "https://schema.org",
      "@type": p.book ? "Book" : "CreativeWork",
      "@id": `${BASE}${pathFor("project", p.slug, L)}#work`,
      name: title,
      alternateName: p.title[L === "pl" ? "en" : "pl"],
      url: `${BASE}${pathFor("project", p.slug, L)}`,
      dateCreated: p.year,
      genre: p.category[L],
      description: String(descText).replace(/\s+/g, " ").trim(),
      inLanguage: INLANG[L],
      numberOfItems: images.length,
      creator: { "@type": "Person", "@id": `${BASE}/#person`, name: AUTHOR },
      isPartOf: { "@id": `${BASE}/#gallery` },
      // Zdjęcia wymienione wprost — bez tego Grafika Google nie ma czego indeksować
      image: images.map((src, i) => ({
        "@type": "ImageObject",
        contentUrl: BASE + src,
        caption: `${title} — ${photoWord} ${i + 1} ${ofWord} ${images.length}, ${p.year}`,
        creditText: AUTHOR,
        creator: { "@id": `${BASE}/#person` },
        copyrightNotice: `© ${p.year} ${AUTHOR}`,
      })),
    },
  };
}

const TEXTS = {
  home: {
    pl: {
      title: `${AUTHOR} — Fotograf i Artysta Wizualny | Warszawa, ZPAF`,
      description:
        "Paweł Sypniewski — fotograf i artysta wizualny z Warszawy. Portfolio prac dokumentalnych, reportażowych i kreacyjnych. Członek ZPAF, Okręg Warszawski.",
    },
    en: {
      title: `${AUTHOR} — Photographer and Visual Artist | Warsaw, ZPAF`,
      description:
        "Paweł Sypniewski — photographer and visual artist from Warsaw. Documentary, reportage and constructed works. Member of ZPAF, Warsaw Branch.",
    },
  },
  about: {
    pl: {
      title: `O autorze — ${AUTHOR}, fotograf i artysta wizualny`,
      description:
        "Paweł Sypniewski (ur. 1987) — fotograf i artysta wizualny z Warszawy, członek ZPAF. Edukacja: ITF Opawa, Sputnik Photos.",
    },
    en: {
      title: `About — ${AUTHOR}, photographer and visual artist`,
      description:
        "Paweł Sypniewski (b. 1987) — photographer and visual artist from Warsaw, ZPAF member. Education: ITF Opava, Sputnik Photos.",
    },
  },
  contact: {
    pl: {
      title: `Kontakt — ${AUTHOR}`,
      description:
        "Limitowane odbitki autorskie. Skontaktuj się mailowo w sprawie nakładu, formatów i cen.",
    },
    en: {
      title: `Contact — ${AUTHOR}`,
      description:
        "Limited-edition artist prints available. Get in touch by email for sizes and pricing.",
    },
  },
  achievements: {
    pl: {
      title: `Aktualności — ${AUTHOR}`,
      description:
        "Aktualne wystawy, pokazy festiwalowe i wydarzenia z udziałem Pawła Sypniewskiego — fotografa i artysty wizualnego z Warszawy.",
    },
    en: {
      title: `News — ${AUTHOR}`,
      description:
        "Current exhibitions, festival screenings and events featuring Paweł Sypniewski — photographer and visual artist based in Warsaw.",
    },
  },
};

/* Okruszki nawigacyjne. Google pokazuje je w wyniku wyszukiwania ZAMIAST
   gołego adresu: „Paweł Sypniewski › Aktualności › Nocne ptaki…” zamiast
   „pawelsypniewski.pl/aktualnosci/offoto-opole-2026/”. Czytelniejsze dla
   człowieka i pokazuje, że wpis należy do większej całości.

   Ścieżkę bierzemy z tej samej hierarchii, którą widać na stronie: menu boczne
   podświetla sekcję, a podstrona wpisu ma nad treścią link „← Wszystkie
   aktualności”. Nazwy sekcji czerpiemy z data.js, żeby nie trzymać tłumaczeń
   w drugim miejscu. Strona główna okruszków nie dostaje — jest ich korzeniem. */
const CRUMB_KEY = { about: "nav.about", contact: "nav.contact", achievements: "nav.achievements" };

function breadcrumbJsonLd(page, i18n) {
  const L = page.lang;
  const dict = i18n[L] || {};
  // Liść to tytuł pracy albo wpisu; dla sekcji wystarczy nazwa z menu.
  const leaf = page.crumb || (CRUMB_KEY[page.route] && dict[CRUMB_KEY[page.route]]);
  if (!leaf || page.route === "home" || page.noindex) return null;
  const items = [{ name: AUTHOR, url: BASE + pathFor("home", null, L) }];
  if (page.route === "newsItem") {
    items.push({
      name: dict["nav.achievements"] || "Aktualności",
      url: BASE + pathFor("achievements", null, L),
    });
  }
  items.push({ name: leaf, url: BASE + page.path });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${BASE}${page.path}#breadcrumb`,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

function sectionPage(route, lang, viewId, extra) {
  return Object.assign(
    {
      route,
      slug: null,
      lang,
      path: pathFor(route, null, lang),
      viewId,
      title: TEXTS[route][lang].title,
      description: TEXTS[route][lang].description,
      image: COVER,
    },
    extra || {}
  );
}

function newsJsonLd(news, lang) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${BASE}${pathFor("achievements", null, lang)}#lista`,
    name: lang === "pl" ? "Wystawy i wydarzenia" : "Exhibitions and events",
    inLanguage: INLANG[lang],
    itemListElement: newsSorted(news)
      .map((n, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: newsEventLd(n, lang, false),
      })),
  };
}

/* ------------------------------------------------------------------ */

async function build() {
  const i18n = loadI18n();
  const { ABOUT, CONTACT } = await loadTexts();
  const projects = readJSON("content/projects.json").filter((p) => !p.hidden);
  const news = readJSON("content/news.json");

  // Polska strona główna: uzupełniamy ją o siatkę kafelków i dopiero TEN plik
  // służy za szablon dla pozostałych podstron. Dzięki temu każda podstrona ma
  // w kodzie komplet linków do projektów, a wynik nie zależy od tego, ile razy
  // skrypt uruchomiono (podmiana jest w kółko taka sama).
  const plHome = sectionPage("home", "pl", "view-home", {
    fill: { homeListPoster: homeGrid(projects, "pl") },
    gallery: projects,
  });
  const template = applyBody(
    applyHead(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), plHome),
    plHome,
    i18n
  );
  fs.writeFileSync(path.join(ROOT, "index.html"), template, "utf8");
  console.log("  ✓ / (index.html)");

  const pages = [];
  for (const lang of LANGS) {
    if (lang === "en") {
      pages.push(
        sectionPage("home", "en", "view-home", {
          fill: { homeListPoster: homeGrid(projects, "en") },
        })
      );
    }
    for (const p of projects) pages.push(projectPage(p, lang, projects));
    // Biogram, CV i dane kontaktowe w kodzie źródłowym. Wcześniej obie te
    // sekcje były w pliku puste — treść dorysowywał dopiero JavaScript, więc
    // spis wystaw i publikacji nie istniał dla robotów, które go nie
    // uruchamiają (Bing, GPTBot, ClaudeBot). A to najczęściej cytowana część
    // strony artysty.
    pages.push(
      sectionPage("about", lang, "view-about", {
        ogType: "profile",
        fill: {
          homeListPoster: homeGrid(projects, lang),
          aboutBody: ABOUT[lang].body,
          aboutSide: ABOUT[lang].side,
        },
      })
    );
    pages.push(
      sectionPage("contact", lang, "view-contact", {
        fill: {
          homeListPoster: homeGrid(projects, lang),
          contactBody: CONTACT[lang].body,
          contactSide: CONTACT[lang].side,
        },
      })
    );
    pages.push(
      sectionPage("achievements", lang, "view-achievements", {
        jsonLd: newsJsonLd(news, lang),
        fill: {
          homeListPoster: homeGrid(projects, lang),
          // Lista w kodzie źródłowym — wcześniej ta sekcja była pusta i całą
          // treść dorysowywał dopiero JavaScript. Teraz są tu też linki do
          // podstron wpisów, czyli droga, którą robot do nich dojdzie.
          achievementsList: newsListHtml(newsSorted(news), lang, i18n, false),
        },
      })
    );
    for (const a of newsSorted(news)) {
      if (!a.id) {
        console.warn(`  ! aktualność „${a.title && a.title.pl}" nie ma pola id — pomijam podstronę`);
        continue;
      }
      const page = newsItemPage(a, lang, i18n);
      page.fill.homeListPoster = homeGrid(projects, lang);
      pages.push(page);
    }
  }

  for (const page of pages) {
    page.gallery = projects;
    page.jsonLd = [].concat(page.jsonLd || [], breadcrumbJsonLd(page, i18n) || []);
    const html = applyBody(applyHead(template, page), page, i18n);
    const dir = path.join(ROOT, page.path);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
    console.log("  ✓", page.path);
  }

  // Podstrony po usuniętych wpisach. Bez tego skasowanie albo przemianowanie
  // pliku w content/news/ zostawiałoby w repo osieroconą stronę: zniknęłaby
  // z mapy i z listy, ale dalej odpowiadałaby pod starym adresem i siedziała
  // w indeksie Google. Usuwamy tylko katalogi, w których nie ma nic poza
  // wygenerowanym index.html — czegokolwiek innego nie ruszamy.
  const zyweId = new Set(news.map((a) => a.id).filter(Boolean));
  for (const lang of LANGS) {
    const listDir = path.join(ROOT, pathFor("achievements", null, lang));
    if (!fs.existsSync(listDir)) continue;
    for (const name of fs.readdirSync(listDir)) {
      const dir = path.join(listDir, name);
      if (!fs.statSync(dir).isDirectory() || zyweId.has(name)) continue;
      const zawartosc = fs.readdirSync(dir);
      if (zawartosc.length === 1 && zawartosc[0] === "index.html") {
        fs.rmSync(dir, { recursive: true });
        console.log("  – usunięto osieroconą podstronę", pathFor("newsItem", name, lang));
      } else {
        console.warn(`  ! ${pathFor("newsItem", name, lang)} nie odpowiada żadnemu wpisowi, ale zawiera własne pliki — zostawiam`);
      }
    }
  }

  // 404 — GitHub Pages podaje ten plik przy nieznanym adresie
  const nf = sectionPage("home", "pl", "view-home", {
    gallery: projects,
    path: "/404.html",
    title: `Nie znaleziono strony — ${AUTHOR}`,
    description: "Ten adres nie istnieje. Przejdź do portfolio.",
    noindex: true,
  });
  fs.writeFileSync(path.join(ROOT, "404.html"), applyBody(applyHead(template, nf), nf, i18n), "utf8");
  console.log("  ✓ /404.html");

  // Mapa strony — obie wersje językowe, każda z odsyłaczem do siostrzanej.
  //
  // lastmod = dzień, w którym ostatnio zmienił się PLIK Z TREŚCIĄ danej
  // podstrony (z historii git), a nie dzień uruchomienia generatora. Wcześniej
  // każda przebudowa stemplowała wszystkie adresy dzisiejszą datą, więc Google
  // co chwilę widział „wszystko zmienione" i przestawał tej dacie ufać.
  // Zmiany wyglądu (index.html) celowo nie liczą się jako zmiana treści.
  const today = new Date().toISOString().slice(0, 10);
  const projectSources = fs.readdirSync(path.join(ROOT, "content/projects"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: "content/projects/" + f, slug: readJSON("content/projects/" + f).slug }));
  const newsSources = fs.readdirSync(path.join(ROOT, "content/news"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: "content/news/" + f, id: readJSON("content/news/" + f).id }));
  const srcOfProject = (slug) => projectSources.filter((s) => s.slug === slug).map((s) => s.file);
  const srcOfNews = (id) => newsSources.filter((s) => s.id === id).map((s) => s.file);

  const entries = [];
  for (const lang of LANGS) {
    entries.push({ route: "home", slug: null, lang, priority: "1.0", changefreq: "monthly",
      lastmod: gitDate(["content/projects"]) });
    for (const p of projects) {
      entries.push({ route: "project", slug: p.slug, lang, priority: "0.9", changefreq: "monthly",
        lastmod: gitDate(srcOfProject(p.slug)) });
    }
    entries.push({ route: "achievements", slug: null, lang, priority: "0.8", changefreq: "weekly",
      lastmod: gitDate(["content/news"]) });
    // Wpisy: data ostatniej edycji pliku wpisu, a gdy git jej nie zna —
    // data wydarzenia. Treść wpisu sprzed dwóch lat zwykle się nie zmienia.
    for (const a of newsSorted(news)) {
      if (!a.id) continue;
      entries.push({
        route: "newsItem", slug: a.id, lang,
        priority: "0.7", changefreq: "yearly", lastmod: gitDate(srcOfNews(a.id)) || a.dateISO,
      });
    }
    entries.push({ route: "about", slug: null, lang, priority: "0.7", changefreq: "yearly",
      lastmod: gitDate(["content/settings/about.json"]) });
    entries.push({ route: "contact", slug: null, lang, priority: "0.6", changefreq: "yearly",
      lastmod: gitDate(["content/settings/contact.json"]) });
  }
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- Plik generowany przez tools/build-pages.js — nie edytować ręcznie. -->\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    entries
      .map((e) => {
        const loc = BASE + pathFor(e.route, e.slug, e.lang);
        const alts = LANGS.map(
          (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${BASE + pathFor(e.route, e.slug, l)}"/>`
        ).join("\n");
        return (
          `  <url>\n    <loc>${loc}</loc>\n${alts}\n    <lastmod>${e.lastmod || today}</lastmod>\n` +
          `    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
        );
      })
      .join("\n") +
    `\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap, "utf8");
  console.log("  ✓ /sitemap.xml —", entries.length, "adresów");
}

build().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
