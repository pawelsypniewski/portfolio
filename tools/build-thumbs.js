/**
 * Pomniejszone wersje zdjęć — dwa rozmiary, każdy do innego miejsca:
 *
 *   thumbs/  600 px szerokości — kafelki w Aktualnościach i stykówka cyklu.
 *            Kafelek ma na ekranie ok. 235 × 235 px (470 px na Retinie);
 *            pełne pliki po 2000 px ważyły do 620 KB, a samo wejście na
 *            /aktualnosci/ ciągnęło ~8,5 MB.
 *   m/       1200 px dłuższego boku — galeria cyklu i lightbox NA TELEFONIE.
 *            Ekran telefonu ma 375–430 px szerokości (do ~1300 px fizycznych),
 *            więc oryginał 2000 px był tam trzykrotnie za duży: ~260 KB
 *            zamiast ~100 KB na każde przesunięcie zdjęcia. Komputer dalej
 *            dostaje oryginał.
 *
 *   node tools/build-thumbs.js        (albo: npm run thumbs)
 *
 * Wejście:  images/achievements/<wydarzenie>/NN.webp
 *           images/<cykl>/NN.webp — katalogi zdjęć z content/projects.json
 * Wyjście:  <ten sam katalog>/thumbs/NN.webp  oraz  <ten sam katalog>/m/NN.webp
 *
 * Skrypt pomija pliki, których wersje są już aktualne, więc można go
 * uruchamiać wielokrotnie. Jeśli którejś wersji zabraknie, strona i tak
 * pokaże zdjęcie — app.js wraca do oryginału (obsługa błędu wczytania).
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const ACHIEVEMENTS_DIR = path.join(ROOT, "images", "achievements");
const VARIANTS = [
  // width: 235 px kafelka × 2 (Retina) + zapas
  { dir: "thumbs", quality: 78, resize: { width: 600, withoutEnlargement: true } },
  // fit: "inside" ogranicza DŁUŻSZY bok — pion i poziom dostają tyle samo pikseli
  { dir: "m", quality: 80, resize: { width: 1200, height: 1200, fit: "inside", withoutEnlargement: true } },
];
const VARIANT_DIRS = new Set(VARIANTS.map((v) => v.dir));

/* Portret na stronie „O autorze" stoi w słupku szerokim na ~380 px, a leżał
   w pełnych 1440 px i 147 KB. 900 px starcza na ekrany o podwójnej gęstości.
   Pełny plik zostaje na dysku — bierze go opis osoby w danych strukturalnych,
   gdzie duże zdjęcie jest zaletą. */
const PORTRAIT = {
  src: path.join(ROOT, "images", "about", "portrait.webp"),
  out: path.join(ROOT, "images", "about", "portrait-web.webp"),
  width: 900,
  quality: 80,
};

async function buildPortrait() {
  if (!fs.existsSync(PORTRAIT.src)) return;
  if (isFresh(PORTRAIT.src, PORTRAIT.out)) {
    console.log("  = images/about/portrait-web.webp (aktualny)");
    return;
  }
  const info = await sharp(PORTRAIT.src)
    .resize({ width: PORTRAIT.width, withoutEnlargement: true })
    .webp({ quality: PORTRAIT.quality })
    .toFile(PORTRAIT.out);
  console.log(
    `  ✓ images/about/portrait-web.webp ${info.width}×${info.height}, ` +
    `${Math.round(fs.statSync(PORTRAIT.out).size / 1024)} KB`
  );
  console.log("    (jeśli wymiary się zmieniły, popraw portraitWidth/portraitHeight w content/settings/about.json)");
}

function findSources(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!VARIANT_DIRS.has(entry.name)) findSources(full, out);
    } else if (/\.webp$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/* Katalogi ze zdjęciami cykli bierzemy z pliku zbiorczego, a nie z listy
   katalogów na dysku — dzięki temu miniatury powstają dokładnie dla tych
   zdjęć, które strona pokazuje w stykówce, i nigdy nie rozjadą się z treścią.
   images/uploads/ (poczekalnia przed konwersją) i images/about/ (portret,
   nigdzie nie trafia do siatki) zostają bez miniatur. */
function projectDirs() {
  const file = path.join(ROOT, "content", "projects.json");
  if (!fs.existsSync(file)) return [];
  const dirs = new Set();
  for (const project of JSON.parse(fs.readFileSync(file, "utf8"))) {
    for (const img of project.images || []) {
      dirs.add(path.join(ROOT, path.dirname(String(img))));
    }
  }
  return [...dirs];
}

function isFresh(src, thumb) {
  if (!fs.existsSync(thumb)) return false;
  return fs.statSync(thumb).mtimeMs >= fs.statSync(src).mtimeMs;
}

async function main() {
  await buildPortrait();
  const dirs = [ACHIEVEMENTS_DIR, ...projectDirs()];
  const sources = [...new Set(dirs.flatMap((dir) => findSources(dir)))];
  if (sources.length === 0) {
    console.log("Brak zdjęć do przetworzenia — nic do zrobienia.");
    return;
  }

  const mb = (b) => (b / 1024 / 1024).toFixed(1) + " MB";
  const bytesBefore = sources.reduce((s, f) => s + fs.statSync(f).size, 0);

  for (const v of VARIANTS) {
    let made = 0, skipped = 0, bytesAfter = 0;
    for (const src of sources) {
      const outDir = path.join(path.dirname(src), v.dir);
      const out = path.join(outDir, path.basename(src));

      if (isFresh(src, out)) {
        skipped++;
        bytesAfter += fs.statSync(out).size;
        continue;
      }

      fs.mkdirSync(outDir, { recursive: true });
      try {
        await sharp(src).resize(v.resize).webp({ quality: v.quality }).toFile(out);
        made++;
        bytesAfter += fs.statSync(out).size;
        console.log(`  ✓ ${path.relative(ROOT, out)}`);
      } catch (e) {
        console.error(`  ✗ ${path.relative(ROOT, src)} (${v.dir}): ${e.message}`);
      }
    }
    console.log(
      `\n${v.dir}/: ${made} nowych, ${skipped} aktualnych — ` +
      `${mb(bytesBefore)} oryginałów → ${mb(bytesAfter)}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
