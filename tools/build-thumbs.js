/**
 * Pomniejszone wersje zdjęć — cztery rozmiary, każdy do innego miejsca:
 *
 *   thumbs/  600 px szerokości — kafle strony głównej, siatka Aktualności
 *            na komputerze i stykówka cyklu. Kafelek ma na ekranie ok.
 *            235 × 235 px (470 px na Retinie); pełne pliki po 2000 px ważyły
 *            do 620 KB, a samo wejście na /aktualnosci/ ciągnęło ~8,5 MB.
 *   xs/      320 px krótszego boku — siatka Aktualności NA TELEFONIE (tylko
 *            images/achievements/). Kwadrat ma tam ~120 px, więc 600 px było
 *            czterokrotnie za ciężkie: na liście ok. 1,1 MB do oszczędzenia.
 *   s/       800 px szerokości — slajdy cyklu na telefonie o podwójnej
 *            gęstości ekranu (tylko katalogi cykli). Przeglądarka dobiera
 *            z srcset 800 albo 1200 px wedle tego, ile pikseli wyświetli.
 *   m/       1200 px dłuższego boku — galeria cyklu (ekrany o potrójnej
 *            gęstości) i lightbox NA TELEFONIE. Oryginał 2000 px był tam
 *            trzykrotnie za duży. Komputer dalej dostaje oryginał.
 *
 * Do tego content/image-sizes.json: wymiary oryginałów, z których generator
 * i app.js wpisują width/height na slajdach (przeglądarka rezerwuje miejsce,
 * zanim zdjęcie się wczyta — nic nie przeskakuje).
 *
 *   node tools/build-thumbs.js        (albo: npm run thumbs)
 *
 * Wejście:  images/achievements/<wydarzenie>/NN.webp
 *           images/<cykl>/NN.webp — katalogi zdjęć z content/projects.json
 * Wyjście:  <ten sam katalog>/thumbs/NN.webp, xs/, s/, m/  oraz
 *           content/image-sizes.json
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
  // fit: "outside" pilnuje KRÓTSZEGO boku — kwadrat siatki kadruje obraz
  // (object-fit: cover), więc liczy się, ile pikseli ma krótszy bok
  { dir: "xs", quality: 76, only: "achievements",
    resize: { width: 320, height: 320, fit: "outside", withoutEnlargement: true } },
  { dir: "s", quality: 80, only: "projects", resize: { width: 800, withoutEnlargement: true } },
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

/* Wymiary oryginałów → content/image-sizes.json (klucz = ścieżka jak w treści,
   np. "images/labirynt/01.webp"). Posortowane, żeby plik nie zmieniał się bez
   powodu między uruchomieniami. */
async function writeSizes(sources) {
  const out = {};
  for (const src of sources.slice().sort()) {
    const meta = await sharp(src).metadata();
    if (!meta.width || !meta.height) continue;
    out[path.relative(ROOT, src).split(path.sep).join("/")] = { w: meta.width, h: meta.height };
  }
  const file = path.join(ROOT, "content", "image-sizes.json");
  const lines = Object.entries(out).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  fs.writeFileSync(file, "{\n" + lines.join(",\n") + "\n}\n", "utf8");
  console.log(`\ncontent/image-sizes.json: ${lines.length} zdjęć`);
}

async function main() {
  await buildPortrait();
  const achievementSources = findSources(ACHIEVEMENTS_DIR);
  const projectSources = [...new Set(projectDirs().flatMap((dir) => findSources(dir)))];
  const sources = [...new Set([...achievementSources, ...projectSources])];
  if (sources.length === 0) {
    console.log("Brak zdjęć do przetworzenia — nic do zrobienia.");
    return;
  }

  const mb = (b) => (b / 1024 / 1024).toFixed(1) + " MB";
  console.log(`Zdjęć źródłowych: ${sources.length} (${mb(sources.reduce((s, f) => s + fs.statSync(f).size, 0))})`);

  for (const v of VARIANTS) {
    // Niektóre rozmiary mają sens tylko w jednym miejscu (xs/ — siatka
    // Aktualności, s/ — slajdy cykli); reszta powstaje dla wszystkich zdjęć.
    const targets = v.only === "achievements" ? achievementSources
      : v.only === "projects" ? projectSources
      : sources;
    let made = 0, skipped = 0, bytesAfter = 0;
    for (const src of targets) {
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
      `${mb(targets.reduce((s, f) => s + fs.statSync(f).size, 0))} oryginałów → ${mb(bytesAfter)}`
    );
  }

  await writeSizes(sources);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
