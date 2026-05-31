/**
 * Jednorazowa migracja treści z data.js → pliki JSON w content/.
 *
 * Uruchamia data.js w izolowanym kontekście Node (z atrapą `window`),
 * odczytuje window.PROJECTS / ACHIEVEMENTS / ABOUT / CONTACT i zapisuje je
 * jako pliki JSON, którymi będzie zarządzać panel CMS (Sveltia).
 *
 *   node tools/migrate-data.js
 *
 * DANIE_BOOK i I18N zostają w data.js (to kod / teksty UI, nie treść do CMS).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const DATA_FILE = path.join(ROOT, "data.js");
const CONTENT = path.join(ROOT, "content");

// --- 1. Uruchom data.js w piaskownicy z atrapą window -------------------
const code = fs.readFileSync(DATA_FILE, "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "data.js" });
const W = sandbox.window;

if (!W.PROJECTS || !W.ACHIEVEMENTS || !W.ABOUT || !W.CONTACT) {
  console.error("✗ Brakuje któregoś z obiektów (PROJECTS/ACHIEVEMENTS/ABOUT/CONTACT) w data.js");
  process.exit(1);
}

// --- 2. Pomocnicze -------------------------------------------------------
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
function writeJSON(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8");
  console.log("  +", path.relative(ROOT, file));
}

// --- 3. Projekty ---------------------------------------------------------
// Każdy projekt → osobny plik. `order` z pola `no` (kolejność na stronie),
// `hidden:false` (widoczność). images/title/etc. zapisujemy bez zmian.
ensureDir(path.join(CONTENT, "projects"));
W.PROJECTS.forEach((p, i) => {
  const order = parseInt(p.no, 10) || i + 1;
  const out = {
    order,
    hidden: false,
    slug: p.slug,
    no: p.no,
    title: p.title,
    year: p.year || "",
    category: p.category || { pl: "", en: "" },
    place: p.place || { pl: "", en: "" },
    works: p.works ?? null,
    flashEffect: !!p.flashEffect,
    book: !!p.book,
    thumb: p.thumb || "",
    caption: p.caption || { pl: "", en: "" },
    description: p.description || { pl: "", en: "" },
    images: p.images || [],
  };
  const name = `${String(order).padStart(2, "0")}-${p.slug}.json`;
  writeJSON(path.join(CONTENT, "projects", name), out);
});

// --- 4. Aktualności (ACHIEVEMENTS) --------------------------------------
ensureDir(path.join(CONTENT, "news"));
W.ACHIEVEMENTS.forEach((a) => {
  const out = {
    id: a.id,
    dateISO: a.dateISO,
    date: a.date || { pl: "", en: "" },
    type: a.type || { pl: "", en: "" },
    title: a.title || { pl: "", en: "" },
    place: a.place || { pl: "", en: "" },
    description: a.description || { pl: "", en: "" },
    links: a.links || [],
    images: a.images || [],
  };
  const name = `${a.dateISO}-${a.id}.json`;
  writeJSON(path.join(CONTENT, "news", name), out);
});

// --- 5. Ustawienia: bio / kontakt ---------------------------------------
ensureDir(path.join(CONTENT, "settings"));
writeJSON(path.join(CONTENT, "settings", "about.json"), W.ABOUT);
writeJSON(path.join(CONTENT, "settings", "contact.json"), W.CONTACT);

console.log(`\n✓ Migracja zakończona.`);
console.log(`  Projekty:     ${W.PROJECTS.length}`);
console.log(`  Aktualności:  ${W.ACHIEVEMENTS.length}`);
console.log(`  Ustawienia:   about.json, contact.json`);
