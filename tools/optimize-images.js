/**
 * Optymalizacja zdjęć wgranych przez panel.
 *
 *   node tools/optimize-images.js
 *
 * Panel (Sveltia) wgrywa oryginały (JPG/PNG) do images/uploads/. Ten skrypt:
 *  1. konwertuje każdy JPG/JPEG/PNG w images/uploads/ na lekki WebP (sharp),
 *  2. podmienia ścieżki w plikach content/**.json (.jpg/.png → .webp),
 *  3. usuwa oryginał po udanej konwersji (repo zostaje lekkie).
 *
 * Uruchamiane automatycznie przez GitHub Action po każdym zapisie z panelu.
 * Działa tylko na images/uploads/ — pozostałe zdjęcia są już w WebP.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const UPLOADS = path.join(ROOT, "images", "uploads");
const CONTENT = path.join(ROOT, "content");
const QUALITY = 82;

const RASTER = /\.(jpe?g|png)$/i;

async function convertUploads() {
  if (!fs.existsSync(UPLOADS)) return [];
  const renamed = []; // { from: "images/uploads/x.jpg", to: "images/uploads/x.webp" }
  const files = fs.readdirSync(UPLOADS).filter((f) => RASTER.test(f));
  for (const f of files) {
    const src = path.join(UPLOADS, f);
    const webpName = f.replace(RASTER, ".webp");
    const dst = path.join(UPLOADS, webpName);
    try {
      await sharp(src).webp({ quality: QUALITY }).toFile(dst);
      fs.unlinkSync(src);
      renamed.push({
        from: `images/uploads/${f}`,
        to: `images/uploads/${webpName}`,
      });
      console.log(`  ${f} → ${webpName}`);
    } catch (e) {
      console.error(`  ✗ ${f}: ${e.message}`);
    }
  }
  return renamed;
}

function rewriteReferences(renamed) {
  if (renamed.length === 0) return;
  const map = new Map(renamed.map((r) => [r.from, r.to]));
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".json")) {
        let txt = fs.readFileSync(full, "utf8");
        let changed = false;
        for (const [from, to] of map) {
          if (txt.includes(from)) {
            txt = txt.split(from).join(to);
            changed = true;
          }
        }
        if (changed) {
          fs.writeFileSync(full, txt, "utf8");
          console.log(`  zaktualizowano ścieżki w ${path.relative(ROOT, full)}`);
        }
      }
    }
  }
  walk(CONTENT);
}

(async () => {
  console.log("Optymalizacja zdjęć z images/uploads/ …");
  const renamed = await convertUploads();
  rewriteReferences(renamed);
  console.log(
    renamed.length
      ? `✓ Przekonwertowano ${renamed.length} zdjęć do WebP.`
      : "✓ Brak nowych zdjęć do konwersji."
  );
})();
