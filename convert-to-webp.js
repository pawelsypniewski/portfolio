/**
 * Konwertuje wszystkie pliki JPG/JPEG w folderze images/ na WebP.
 * Tworzy plik .webp obok każdego oryginalnego (nie usuwa JPG).
 * Quality 82 — dobry kompromis jakość/rozmiar dla fotografii.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "images");
const QUALITY = 82;

let totalOrigSize = 0;
let totalWebpSize = 0;
let converted = 0;
let skipped = 0;
let failed = 0;

async function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else if (/\.(jpg|jpeg)$/i.test(entry.name)) {
      const webpPath = fullPath.replace(/\.(jpg|jpeg)$/i, ".webp");
      const origStat = fs.statSync(fullPath);

      // Skip jeśli webp już istnieje i jest nowszy
      if (fs.existsSync(webpPath)) {
        const webpStat = fs.statSync(webpPath);
        if (webpStat.mtimeMs >= origStat.mtimeMs) {
          totalOrigSize += origStat.size;
          totalWebpSize += webpStat.size;
          skipped++;
          continue;
        }
      }

      try {
        await sharp(fullPath)
          .webp({ quality: QUALITY })
          .toFile(webpPath);
        const newStat = fs.statSync(webpPath);
        totalOrigSize += origStat.size;
        totalWebpSize += newStat.size;
        converted++;
        const saving = (1 - newStat.size / origStat.size) * 100;
        const rel = path.relative(__dirname, fullPath);
        console.log(`  ${rel}: ${(origStat.size/1024).toFixed(0)}KB → ${(newStat.size/1024).toFixed(0)}KB (-${saving.toFixed(0)}%)`);
      } catch (e) {
        failed++;
        console.error(`  ✗ ${entry.name}: ${e.message}`);
      }
    }
  }
}

(async () => {
  console.log(`Konwertuję JPG → WebP w ${ROOT}\nJakość: ${QUALITY}\n`);
  await walk(ROOT);
  console.log(`\n─────────────────────────────────────`);
  console.log(`Przekonwertowano: ${converted}`);
  console.log(`Pominięto (już istniejące): ${skipped}`);
  console.log(`Błędy: ${failed}`);
  console.log(`\nRozmiar JPG razem:  ${(totalOrigSize/1024/1024).toFixed(2)} MB`);
  console.log(`Rozmiar WebP razem: ${(totalWebpSize/1024/1024).toFixed(2)} MB`);
  const totalSavings = (1 - totalWebpSize / totalOrigSize) * 100;
  console.log(`Oszczędność: ${totalSavings.toFixed(1)}%  (${((totalOrigSize - totalWebpSize)/1024/1024).toFixed(2)} MB mniej)`);
})();
