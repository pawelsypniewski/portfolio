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

// Adresy widoków. Musi zgadzać się z PATH_BY_ROUTE / routeToPath w app.js.
const PATHS = {
  pl: { home: "/", about: "/o-autorze/", contact: "/kontakt/", achievements: "/aktualnosci/" },
  en: { home: "/en/", about: "/en/about/", contact: "/en/contact/", achievements: "/en/news/" },
};
function pathFor(route, slug, lang) {
  if (route === "project") return (lang === "en" ? "/en/" : "/") + slug + "/";
  return PATHS[lang][route];
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

  // Dane strukturalne właściwe dla tej podstrony — dokładane obok
  // istniejącego grafu (Person / WebSite), który opisuje całą witrynę.
  if (page.jsonLd) {
    const ld = JSON.stringify(page.jsonLd, null, 2);
    html = replaceOnce(html, /<\/head>/,
      () => `<script type="application/ld+json">\n${ld}\n</script>\n</head>`,
      "</head>");
  }

  return html;
}

/* ------------------------------------------------------------------ */
/* Podmiany w <body> — który widok jest widoczny i co w nim jest       */
/* ------------------------------------------------------------------ */

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

  // Dokładnie jeden <h1> z sensowną treścią: na podstronie projektu jest
  // nim tytuł cyklu, więc ukryty nagłówek strony głównej schodzi do <p>.
  if (page.viewId === "view-project") {
    html = replaceOnce(html, /<h1 class="sr-only">([\s\S]*?)<\/h1>/,
      (_m, inner) => `<p class="sr-only">${inner}</p>`, "ukryty h1 strony głównej");
    html = replaceOnce(html, /<(?:div|h1) class="pj-title" id="pjTitle">[\s\S]*?<\/(?:div|h1)>/,
      `<h1 class="pj-title" id="pjTitle">${escapeHtml(page.project.title)}</h1>`, "#pjTitle");
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
        <div class="thumb-frame" role="img" aria-label="${title} — ${lang === "pl" ? "podgląd" : "preview"}"></div>
      </div>
      <div class="meta"><span itemprop="dateCreated">${escapeHtml(p.year)}</span> · <span itemprop="contentLocation">${escapeHtml(p.place[lang])}</span> · ${p.works} ${worksLabel}</div>
    </article>
  `;
    })
    .join("");
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
    itemListElement: news
      .slice()
      .sort((a, b) => String(b.dateISO).localeCompare(String(a.dateISO)))
      .map((n, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "ExhibitionEvent",
          name: n.title[lang],
          startDate: n.dateISO,
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          location: { "@type": "Place", name: n.place[lang] },
          description: shorten(n.description && n.description[lang], 300),
          performer: { "@type": "Person", "@id": `${BASE}/#person`, name: AUTHOR },
        },
      })),
  };
}

/* ------------------------------------------------------------------ */

function build() {
  const i18n = loadI18n();
  const projects = readJSON("content/projects.json").filter((p) => !p.hidden);
  const news = readJSON("content/news.json");

  // Polska strona główna: uzupełniamy ją o siatkę kafelków i dopiero TEN plik
  // służy za szablon dla pozostałych podstron. Dzięki temu każda podstrona ma
  // w kodzie komplet linków do projektów, a wynik nie zależy od tego, ile razy
  // skrypt uruchomiono (podmiana jest w kółko taka sama).
  const plHome = sectionPage("home", "pl", "view-home", {
    fill: { homeListPoster: homeGrid(projects, "pl") },
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
    pages.push(
      sectionPage("about", lang, "view-about", {
        ogType: "profile",
        fill: { homeListPoster: homeGrid(projects, lang) },
      })
    );
    pages.push(
      sectionPage("contact", lang, "view-contact", {
        fill: { homeListPoster: homeGrid(projects, lang) },
      })
    );
    pages.push(
      sectionPage("achievements", lang, "view-achievements", {
        jsonLd: newsJsonLd(news, lang),
        fill: { homeListPoster: homeGrid(projects, lang) },
      })
    );
  }

  for (const page of pages) {
    const html = applyBody(applyHead(template, page), page, i18n);
    const dir = path.join(ROOT, page.path);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
    console.log("  ✓", page.path);
  }

  // 404 — GitHub Pages podaje ten plik przy nieznanym adresie
  const nf = sectionPage("home", "pl", "view-home", {
    path: "/404.html",
    title: `Nie znaleziono strony — ${AUTHOR}`,
    description: "Ten adres nie istnieje. Przejdź do portfolio.",
    noindex: true,
  });
  fs.writeFileSync(path.join(ROOT, "404.html"), applyBody(applyHead(template, nf), nf, i18n), "utf8");
  console.log("  ✓ /404.html");

  // Mapa strony — obie wersje językowe, każda z odsyłaczem do siostrzanej
  const today = new Date().toISOString().slice(0, 10);
  const entries = [];
  for (const lang of LANGS) {
    entries.push({ route: "home", slug: null, lang, priority: "1.0", changefreq: "monthly" });
    for (const p of projects) {
      entries.push({ route: "project", slug: p.slug, lang, priority: "0.9", changefreq: "monthly" });
    }
    entries.push({ route: "achievements", slug: null, lang, priority: "0.8", changefreq: "weekly" });
    entries.push({ route: "about", slug: null, lang, priority: "0.7", changefreq: "yearly" });
    entries.push({ route: "contact", slug: null, lang, priority: "0.6", changefreq: "yearly" });
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
          `  <url>\n    <loc>${loc}</loc>\n${alts}\n    <lastmod>${today}</lastmod>\n` +
          `    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
        );
      })
      .join("\n") +
    `\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap, "utf8");
  console.log("  ✓ /sitemap.xml —", entries.length, "adresów");
}

build();
