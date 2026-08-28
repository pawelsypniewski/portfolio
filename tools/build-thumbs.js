/**
 * Miniatury do siatki zdjęć w Aktualnościach.
 *
 *   node tools/build-thumbs.js        (albo: npm run thumbs)
 *
 * Po co: kafelki w Aktualnościach mają na ekranie 235 × 235 px (470 px na
 * Retinie), a wstawiane były pełne pliki po 2000 px i do 620 KB. Samo
 * wejście na /aktualnosci/ ważyło przez to ~8,5 MB. Lightbox nadal
 * otwiera oryginał — miniatura służy wyłącznie siatce.
 *
 * Wejście:  images/achievements/<wydarzenie>/NN.webp
 * Wyjście:  images/achievements/<wydarzenie>/thumbs/NN.webp  (600 px)
 *
 * Skrypt pomija pliki, których miniatura jest już aktualna, więc można go
 * uruchamiać wielokrotnie. Jeśli miniatury zabraknie, strona i tak pokaże
 * zdjęcie — app.js podmienia źródło na oryginał (obsługa błędu wczytania).
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT, "images", "achievements");
const THUMB_DIR_NAME = "thumbs";
const WIDTH = 600;   // 235 px kafelka × 2 (Retina) + zapas
const QUALITY = 78;

function findSources(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== THUMB_DIR_NAME) findSources(full, out);
    } else if (/\.webp$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function isFresh(src, thumb) {
  if (!fs.existsSync(thumb)) return false;
  return fs.statSync(thumb).mtimeMs >= fs.statSync(src).mtimeMs;
}

async function main() {
  const sources = findSources(SRC_DIR);
  if (sources.length === 0) {
    console.log("Brak zdjęć w images/achievements — nic do zrobienia.");
    return;
  }

  let made = 0, skipped = 0, bytesBefore = 0, bytesAfter = 0;

  for (const src of sources) {
    const thumbDir = path.join(path.dirname(src), THUMB_DIR_NAME);
    const thumb = path.join(thumbDir, path.basename(src));

    bytesBefore += fs.statSync(src).size;

    if (isFresh(src, thumb)) {
      skipped++;
      bytesAfter += fs.statSync(thumb).size;
      continue;
    }

    fs.mkdirSync(thumbDir, { recursive: true });
    try {
      await sharp(src)
        .resize({ width: WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(thumb);
      made++;
      bytesAfter += fs.statSync(thumb).size;
      console.log(`  ✓ ${path.relative(ROOT, thumb)}`);
    } catch (e) {
      console.error(`  ✗ ${path.relative(ROOT, src)}: ${e.message}`);
    }
  }

  const mb = (b) => (b / 1024 / 1024).toFixed(1) + " MB";
  console.log(
    `\nMiniatury: ${made} nowych, ${skipped} aktualnych.\n` +
    `Siatka Aktualności: ${mb(bytesBefore)} → ${mb(bytesAfter)}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
