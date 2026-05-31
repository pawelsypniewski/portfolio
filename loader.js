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

  window.__DATA_READY = (async function loadContent() {
    try {
      const [projects, news, about, contact] = await Promise.all([
        getJSON("content/projects.json"),
        getJSON("content/news.json"),
        getJSON("content/settings/about.json"),
        getJSON("content/settings/contact.json"),
      ]);

      // Projekty: pomiń ukryte; zachowaj kolejność z pliku (już po `order`).
      window.PROJECTS = (projects || []).filter((p) => !p.hidden);

      // Aktualności: app.js sam sortuje po dateISO.
      window.ACHIEVEMENTS = news || [];

      window.ABOUT = about;
      window.CONTACT = contact;
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
