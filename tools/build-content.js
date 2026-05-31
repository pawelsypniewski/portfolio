/**
 * Agreguje pojedyncze pliki treści (edytowane przez panel CMS) w pliki
 * zbiorcze, które wczytuje strona. Strona statyczna nie potrafi wylistować
 * katalogu przez fetch — dlatego potrzebny jest jeden plik na kolekcję.
 *
 *   node tools/build-content.js
 *
 * Uruchamiane:
 *  - ręcznie po migracji (żeby strona działała od razu),
 *  - automatycznie przez GitHub Action po każdej edycji w panelu.
 *
 * Wejście:  content/projects/*.json, content/news/*.json
 * Wyjście:  content/projects.json (posortowane po `order`),
 *           content/news.json     (wszystkie wpisy; sortowanie po dacie robi app.js)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONTENT = path.join(ROOT, "content");

function readDirJSON(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error(`✗ Niepoprawny JSON: ${path.join(dir, f)} — ${e.message}`);
        process.exit(1);
      }
    });
}

// --- Projekty: posortuj po `order` ---------------------------------------
const projects = readDirJSON(path.join(CONTENT, "projects"))
  .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

// --- Aktualności: bez sortowania (app.js sortuje po dateISO) --------------
const news = readDirJSON(path.join(CONTENT, "news"));

fs.writeFileSync(
  path.join(CONTENT, "projects.json"),
  JSON.stringify(projects, null, 2) + "\n",
  "utf8"
);
fs.writeFileSync(
  path.join(CONTENT, "news.json"),
  JSON.stringify(news, null, 2) + "\n",
  "utf8"
);

console.log(`✓ Zbudowano pliki zbiorcze:`);
console.log(`  content/projects.json  (${projects.length} projektów)`);
console.log(`  content/news.json      (${news.length} aktualności)`);
