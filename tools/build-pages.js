/**
 * Generuje PRAWDZIWE podstrony z szablonu index.html.
 *
 *   node tools/build-pages.js        (albo: npm run pages)
 *
 * Po co: strona jest aplikacją jednostronicową (SPA) — wszystkie widoki
 * żyją w jednym pliku i przełącza je JavaScript. Wyszukiwarka odkrywa treść
 * wyłącznie idąc po linkach i traktuje każdy adres jako osobną stronę,
 * dlatego każdy widok musi istnieć jako osobny plik pod własnym adresem.
 *
 * Wejście:  index.html (szablon) + content/*.json (treść)
 * Wyjście:  ustawienia-domyslne/index.html, …, o-autorze/index.html,
 *           kontakt/index.html, aktualnosci/index.html,
 *           404.html oraz sitemap.xml
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

const ROOT = path.join(__dirname, "..");
const BASE = "https://pawelsypniewski.pl";
const AUTHOR = "Paweł Sypniewski";

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

/* ------------------------------------------------------------------ */
/* Podmiany w <head>                                                   */
/* ------------------------------------------------------------------ */

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

function applyHead(html, page) {
  const url = BASE + page.path;
  const title = escapeHtml(page.title);
  const desc = escapeHtml(page.description);
  const img = escapeHtml(page.image.url);
  const imgAlt = escapeHtml(page.image.alt);

  html = replaceOnce(html, /<title>[\s\S]*?<\/title>/,
    `<title>${title}</title>`, "<title>");

  html = replaceOnce(html, /<meta name="description" content="[\s\S]*?">/,
    `<meta name="description" content="${desc}">`, 'meta name="description"');

  html = replaceOnce(html, /<link rel="canonical" href="[^"]*">/,
    `<link rel="canonical" href="${url}">`, "link rel=canonical");

  // hreflang — każda podstrona wskazuje na SIEBIE, nie na stronę główną
  html = replaceOnce(html,
    /<link rel="alternate" href="[^"]*" hreflang="pl">[\s\S]*?<link rel="alternate" href="[^"]*" hreflang="x-default">/,
    `<link rel="alternate" href="${url}" hreflang="pl">\n` +
    `<link rel="alternate" href="${url}?lang=en" hreflang="en">\n` +
    `<link rel="alternate" href="${url}" hreflang="x-default">`,
    "link rel=alternate hreflang");

  html = replaceOnce(html, /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${title}">`, "og:title");
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${desc}">`, "og:description");
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${url}">`, "og:url");
  html = replaceOnce(html, /<meta property="og:type" content="[^"]*">/,
    `<meta property="og:type" content="${page.ogType || "website"}">`, "og:type");

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

function applyBody(html, page) {
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
      '<p class="sr-only">$1</p>', "ukryty h1 strony głównej");
    html = replaceOnce(html, /<div class="pj-title" id="pjTitle">[\s\S]*?<\/div>/,
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

function projectPage(p) {
  const L = "pl";
  const title = p.title[L];
  const images = p.images.map(abs);
  const descText = (p.description && p.description[L]) || p.caption[L];

  const slides = images
    .map((src, i) =>
      `<div class="proj-slide"><img src="${escapeHtml(src)}" alt="${escapeHtml(
        `${title} — zdjęcie ${i + 1} z ${images.length}, ${p.year}, ${p.category[L]}`
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
    path: `/${p.slug}/`,
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
      pjSub: escapeHtml(`${p.no} / ${p.category[L]}`),
      pjMeta: `${escapeHtml(p.year)}<br>${escapeHtml(p.place[L])}<br>${p.works} prac`,
      pjTrack: slides,
      pjCaption: escapeHtml(p.caption[L]),
      pjCounter: `01/${String(images.length).padStart(2, "0")}`,
      pjDescription: descHtml,
    },
    jsonLd: {
      "@context": "https://schema.org",
      "@type": p.book ? "Book" : "CreativeWork",
      "@id": `${BASE}/${p.slug}/#work`,
      name: title,
      alternateName: p.title.en,
      url: `${BASE}/${p.slug}/`,
      dateCreated: p.year,
      genre: p.category[L],
      description: String(descText).replace(/\s+/g, " ").trim(),
      inLanguage: "pl-PL",
      numberOfItems: images.length,
      creator: { "@type": "Person", "@id": `${BASE}/#person`, name: AUTHOR },
      isPartOf: { "@id": `${BASE}/#gallery` },
      // Zdjęcia wymienione wprost — bez tego Grafika Google nie ma czego indeksować
      image: images.map((src, i) => ({
        "@type": "ImageObject",
        contentUrl: BASE + src,
        caption: `${title} — zdjęcie ${i + 1} z ${images.length}, ${p.year}`,
        creditText: AUTHOR,
        creator: { "@id": `${BASE}/#person` },
        copyrightNotice: `© ${p.year} ${AUTHOR}`,
      })),
    },
  };
}

// Siatka kafelków strony głównej — dokładnie ten sam kod, który generuje
// renderHome() w app.js. Wstawiamy ją do pliku, bo w wersji tylko-JS linki
// do projektów nie istniały w kodzie źródłowym: Google je wyrenderuje, ale
// roboty Bing i boty AI (GPTBot, ClaudeBot) zwykle JavaScriptu nie uruchamiają.
function homeGrid(projects) {
  const L = "pl";
  return projects
    .map((p, i) => {
      const title = escapeHtml(p.title[L]);
      return `
    <article class="cell c${i + 1}" data-slug="${escapeHtml(p.slug)}" itemscope itemtype="https://schema.org/CreativeWork">
      <div class="num">${escapeHtml(p.no)} / PRACE</div>
      <div class="title">
        <h2 class="title-text"><a href="/${escapeHtml(p.slug)}/" itemprop="url"><span itemprop="name">${title}</span></a></h2>
        <div class="thumb-frame" role="img" aria-label="${title} — podgląd"></div>
      </div>
      <div class="meta"><span itemprop="dateCreated">${escapeHtml(p.year)}</span> · <span itemprop="contentLocation">${escapeHtml(p.place[L])}</span> · ${p.works} prac</div>
    </article>
  `;
    })
    .join("");
}

function build() {
  const projects = readJSON("content/projects.json").filter((p) => !p.hidden);
  const news = readJSON("content/news.json");

  // Strona główna: uzupełniamy ją o siatkę kafelków i dopiero TEN plik
  // służy za szablon dla pozostałych podstron. Dzięki temu każda podstrona
  // ma w kodzie komplet linków do projektów, a wynik nie zależy od tego,
  // ile razy skrypt uruchomiono (podmiana jest w kółko taka sama).
  const home = {
    path: "/",
    viewId: "view-home",
    title: `${AUTHOR} — Fotograf i Artysta Wizualny | Warszawa, ZPAF`,
    description:
      "Paweł Sypniewski — fotograf i artysta wizualny z Warszawy. Portfolio prac dokumentalnych, reportażowych i kreacyjnych. Członek ZPAF, Okręg Warszawski.",
    image: COVER,
    fill: { homeListPoster: homeGrid(projects) },
  };
  const template = applyBody(
    applyHead(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), home),
    home
  );
  fs.writeFileSync(path.join(ROOT, "index.html"), template, "utf8");
  console.log("  ✓ / (index.html)");

  const pages = projects.map(projectPage);

  pages.push({
    path: "/o-autorze/",
    viewId: "view-about",
    ogType: "profile",
    title: `O autorze — ${AUTHOR}, fotograf i artysta wizualny`,
    description:
      "Paweł Sypniewski (ur. 1987) — fotograf i artysta wizualny z Warszawy, członek ZPAF. Edukacja: ITF Opawa, Sputnik Photos.",
    image: COVER,
  });

  pages.push({
    path: "/kontakt/",
    viewId: "view-contact",
    title: `Kontakt — ${AUTHOR}`,
    description:
      "Limitowane odbitki autorskie. Skontaktuj się mailowo w sprawie nakładu, formatów i cen.",
    image: COVER,
  });

  pages.push({
    path: "/aktualnosci/",
    viewId: "view-achievements",
    title: `Aktualności — ${AUTHOR}`,
    description:
      "Aktualne wystawy, pokazy festiwalowe i wydarzenia z udziałem Pawła Sypniewskiego — fotografa i artysty wizualnego z Warszawy.",
    image: COVER,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": `${BASE}/aktualnosci/#lista`,
      name: "Wystawy i wydarzenia",
      itemListElement: news
        .slice()
        .sort((a, b) => String(b.dateISO).localeCompare(String(a.dateISO)))
        .map((n, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "ExhibitionEvent",
            name: n.title.pl,
            startDate: n.dateISO,
            eventStatus: "https://schema.org/EventScheduled",
            eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
            location: { "@type": "Place", name: n.place.pl },
            description: shorten(n.description && n.description.pl, 300),
            performer: { "@type": "Person", "@id": `${BASE}/#person`, name: AUTHOR },
          },
        })),
    },
  });

  // Zapis podstron
  for (const page of pages) {
    const html = applyBody(applyHead(template, page), page);
    const dir = path.join(ROOT, page.path);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
    console.log("  ✓", page.path);
  }

  // 404 — GitHub Pages podaje ten plik przy nieznanym adresie
  const notFound = applyBody(
    applyHead(template, {
      path: "/404.html",
      viewId: "view-home",
      title: `Nie znaleziono strony — ${AUTHOR}`,
      description: "Ten adres nie istnieje. Przejdź do portfolio.",
      image: COVER,
      noindex: true,
    }),
    { viewId: "view-home" }
  );
  fs.writeFileSync(path.join(ROOT, "404.html"), notFound, "utf8");
  console.log("  ✓ /404.html");

  // Mapa strony
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${BASE}/`, priority: "1.0", changefreq: "monthly" },
    ...projects.map((p) => ({ loc: `${BASE}/${p.slug}/`, priority: "0.9", changefreq: "monthly" })),
    { loc: `${BASE}/aktualnosci/`, priority: "0.8", changefreq: "weekly" },
    { loc: `${BASE}/o-autorze/`, priority: "0.7", changefreq: "yearly" },
    { loc: `${BASE}/kontakt/`, priority: "0.6", changefreq: "yearly" },
  ];
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- Plik generowany przez tools/build-pages.js — nie edytować ręcznie. -->\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n` +
          `    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
      )
      .join("\n") +
    `\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap, "utf8");
  console.log("  ✓ /sitemap.xml —", urls.length, "adresów");
}

build();
