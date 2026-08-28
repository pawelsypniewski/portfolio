/* ============================================================
   LOADER — wczytuje treść z plików JSON (zarządzanych przez panel CMS)
   i odtwarza globalne obiekty, których oczekuje app.js:
     window.PROJECTS, window.ACHIEVEMENTS, window.ABOUT, window.CONTACT

   Źródła (generowane przez tools/build-content.js + panel CMS):
     content/projects.json   — tablica projektów (posortowana po `order`)
     content/news.json        — tablica aktualności
     content/settings/about.json
     content/settings/contact.json

   Kolejność: data.js (DANIE_BOOK, I18N) → loader.js → app.js.
   app.js czeka na window.__DATA_READY przed pierwszym renderem.
   ============================================================ */
(function () {
  async function getJSON(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return res.json();
  }

  // --- Minimalny konwerter Markdown → HTML --------------------------------
  // Obsługuje to, co produkuje edytor w panelu: nagłówki (#…), listy (- …),
  // akapity, pogrubienie (**…**), kursywę (*…*/_…_), linki [t](url) i obrazy.
  // Linki http(s) dostają target="_blank" rel="noopener" (jak w oryginale).
  // Neutralizacja surowego HTML w treści z panelu (ochrona XSS) — treść ma
  // być markdownem; znaczniki HTML wyświetlą się jako tekst, nie wykonają.
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  // Dozwolone adresy w linkach/obrazkach: http(s), mailto, tel, kotwice
  // i ścieżki względne. Blokuje m.in. javascript: (XSS).
  function safeUrl(u) {
    u = String(u).trim();
    if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return true;  // znane schematy
    return !u.includes(":");  // reszta tylko bez schematu (ścieżki względne, kotwice)
  }
  function inlineMd(s) {
    return escapeHtml(s)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, a, src) =>
        safeUrl(src) ? `<img src="${src}" alt="${a}" loading="lazy" decoding="async">` : a)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
        if (!safeUrl(u)) return t;
        return /^https?:\/\//i.test(u)
          ? `<a href="${u}" target="_blank" rel="noopener">${t}</a>`
          : `<a href="${u}">${t}</a>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/_([^_\n]+)_/g, "<em>$1</em>");
  }
  function mdToHtml(md) {
    if (!md) return "";
    const lines = String(md).replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let para = [];
    let list = null;
    const flushPara = () => {
      if (para.length) { blocks.push(`<p>${inlineMd(para.join(" ").trim())}</p>`); para = []; }
    };
    const flushList = () => {
      if (list) { blocks.push(`<ul>${list.map((li) => `<li>${inlineMd(li)}</li>`).join("")}</ul>`); list = null; }
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (line === "") { flushPara(); flushList(); continue; }
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { flushPara(); flushList(); blocks.push(`<h${h[1].length}>${inlineMd(h[2].trim())}</h${h[1].length}>`); continue; }
      const li = line.match(/^[-*]\s+(.*)$/);
      if (li) { flushPara(); (list = list || []).push(li[1].trim()); continue; }
      flushList(); para.push(line);
    }
    flushPara(); flushList();
    return blocks.join("\n");
  }

  // --- Składanie sekcji ABOUT / CONTACT z pól strukturalnych --------------
  function buildAbout(about) {
    const out = {};
    for (const L of ["pl", "en"]) {
      const lang = about[L] || {};
      const alt = escapeHtml((about.portraitAlt && about.portraitAlt[L]) || "");
      const img = about.portrait
        ? `<img class="author-portrait" src="${escapeHtml(about.portrait)}" alt="${alt}" loading="lazy" decoding="async">\n`
        : "";
      out[L] = { body: img + mdToHtml(lang.body), side: mdToHtml(lang.side) };
    }
    return out;
  }
  function buildInstagram(ig, L) {
    if (!ig || !ig.tiles || !ig.tiles.length) return "";
    const aria = escapeHtml((ig.ariaLabel && ig.ariaLabel[L]) || "");
    const heading = escapeHtml((ig.heading && ig.heading[L]) || "");
    const tiles = ig.tiles
      .map((t) => `<a class="ig-tile" href="${escapeHtml(t.url)}" target="_blank" rel="noopener noreferrer" aria-label="${aria}" style="background-image:url('${escapeHtml(t.image)}')"></a>`)
      .join("");
    return `<div class="ig-section">\n  <div class="ig-heading">${heading}</div>\n  <div class="ig-grid">${tiles}</div>\n  <a class="ig-more" href="${ig.profileUrl}" target="_blank" rel="noopener noreferrer">${ig.profileLabel}</a>\n</div>`;
  }
  function buildContact(contact) {
    const out = {};
    for (const L of ["pl", "en"]) {
      const lang = contact[L] || {};
      const ig = buildInstagram(contact.instagram, L);
      out[L] = {
        body: [mdToHtml(lang.intro), ig].filter(Boolean).join("\n"),
        side: mdToHtml(lang.side),
      };
    }
    return out;
  }

  // --- Ścieżki bezwzględne ------------------------------------------------
  // Strona działa również pod adresami typu /labirynt/, gdzie ścieżka względna
  // "images/…" wskazywałaby na /labirynt/images/… (błąd 404). Normalizujemy raz,
  // zaraz po wczytaniu JSON-a, żeby reszta kodu nie musiała o tym pamiętać.
  function absolutize(node) {
    if (typeof node === "string") return /^images\//.test(node) ? "/" + node : node;
    if (Array.isArray(node)) return node.map(absolutize);
    if (node && typeof node === "object") {
      for (const k of Object.keys(node)) node[k] = absolutize(node[k]);
      return node;
    }
    return node;
  }

  window.__DATA_READY = (async function loadContent() {
    try {
      const [projects, news, about, contact] = await Promise.all([
        getJSON("/content/projects.json"),
        getJSON("/content/news.json"),
        getJSON("/content/settings/about.json"),
        getJSON("/content/settings/contact.json"),
      ]);

      // Projekty: pomiń ukryte; zachowaj kolejność z pliku (już po `order`).
      window.PROJECTS = absolutize((projects || []).filter((p) => !p.hidden));

      // Aktualności: app.js sam sortuje po dateISO.
      window.ACHIEVEMENTS = absolutize(news || []);

      // Teksty: markdown + pola strukturalne → gotowy HTML (jak oczekuje app.js).
      window.ABOUT = buildAbout(absolutize(about));
      window.CONTACT = buildContact(absolutize(contact));
    } catch (err) {
      console.error("[loader] Nie udało się wczytać treści:", err);
      // Zabezpieczenie: pozwól app.js wystartować bez wywrotki.
      window.PROJECTS = window.PROJECTS || [];
      window.ACHIEVEMENTS = window.ACHIEVEMENTS || [];
      window.ABOUT = window.ABOUT || { pl: { body: "", side: "" }, en: { body: "", side: "" } };
      window.CONTACT = window.CONTACT || { pl: { body: "", side: "" }, en: { body: "", side: "" } };
    }
  })();
})();
