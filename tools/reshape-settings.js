/**
 * Jednorazowe przekształcenie about.json / contact.json z surowego HTML
 * na format przyjazny panelowi:
 *   - teksty (body/side/intro) → markdown (edytowane w panelu jako tekst sformatowany),
 *   - portret → osobne pole `portrait` + `portraitAlt`,
 *   - galeria Instagrama → pole strukturalne `instagram` (kafelki: zdjęcie + link).
 *
 * Finalny HTML składa loader.js (markdown → HTML + portret + galeria).
 *
 *   node tools/reshape-settings.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SET = path.join(ROOT, "content", "settings");

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

// <a href="u">t</a>  →  [t](u)   (z zachowaniem mailto/http)
function linksToMd(html) {
  return html.replace(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gis, (_, href, text) => `[${text.trim()}](${href})`);
}

// Akapity <p>…</p> → tekst rozdzielony pustą linią
function paragraphsToMd(html) {
  const ps = [...html.matchAll(/<p>(.*?)<\/p>/gis)].map((m) => linksToMd(m[1]).replace(/\s+/g, " ").trim());
  return ps.join("\n\n");
}

// Sekwencja <h3>…</h3><ul><li>…</li></ul> → markdown (### + listy)
function sideToMd(html) {
  const out = [];
  const re = /<h3>(.*?)<\/h3>\s*<ul>(.*?)<\/ul>/gis;
  let m;
  while ((m = re.exec(html))) {
    out.push(`### ${linksToMd(m[1]).trim()}`);
    const items = [...m[2].matchAll(/<li>(.*?)<\/li>/gis)].map((x) => `- ${linksToMd(x[1]).replace(/\s+/g, " ").trim()}`);
    out.push(items.join("\n"));
    out.push("");
  }
  return out.join("\n").trim();
}

// === ABOUT ===============================================================
{
  const about = JSON.parse(fs.readFileSync(path.join(SET, "about.json"), "utf8"));
  const portraitM = about.pl.body.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
  const altPl = (about.pl.body.match(/<img[^>]*alt="([^"]+)"/i) || [])[1] || "";
  const altEn = (about.en.body.match(/<img[^>]*alt="([^"]+)"/i) || [])[1] || "";
  const out = {
    portrait: portraitM ? portraitM[1] : "",
    portraitAlt: { pl: altPl, en: altEn },
    pl: { body: paragraphsToMd(about.pl.body), side: sideToMd(about.pl.side) },
    en: { body: paragraphsToMd(about.en.body), side: sideToMd(about.en.side) },
  };
  fs.writeFileSync(path.join(SET, "about.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log("✓ about.json przekształcony (markdown + portret)");
}

// === CONTACT =============================================================
{
  const contact = JSON.parse(fs.readFileSync(path.join(SET, "contact.json"), "utf8"));
  const grabIntro = (html) => {
    const m = html.match(/<p>(.*?)<\/p>/is);
    return m ? linksToMd(m[1]).replace(/\s+/g, " ").trim() : "";
  };
  const igHtml = contact.pl.body; // siatka identyczna w obu językach (poza nagłówkiem)
  const heading = {
    pl: (contact.pl.body.match(/class="ig-heading">(.*?)<\/div>/is) || [])[1] || "",
    en: (contact.en.body.match(/class="ig-heading">(.*?)<\/div>/is) || [])[1] || "",
  };
  const ariaLabel = {
    pl: (contact.pl.body.match(/aria-label="([^"]+)"/i) || [])[1] || "",
    en: (contact.en.body.match(/aria-label="([^"]+)"/i) || [])[1] || "",
  };
  const tiles = [...igHtml.matchAll(/<a class="ig-tile"[^>]*href="([^"]+)"[^>]*style="background-image:url\('([^']+)'\)"/gi)].map(
    (m) => ({ image: m[2], url: m[1] })
  );
  const moreM = igHtml.match(/<a class="ig-more"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/is);
  const out = {
    instagram: {
      heading,
      ariaLabel,
      profileUrl: moreM ? moreM[1] : "",
      profileLabel: moreM ? moreM[2].trim() : "",
      tiles,
    },
    pl: { intro: grabIntro(contact.pl.body), side: sideToMd(contact.pl.side) },
    en: { intro: grabIntro(contact.en.body), side: sideToMd(contact.en.side) },
  };
  fs.writeFileSync(path.join(SET, "contact.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log("✓ contact.json przekształcony (markdown + galeria Instagrama)");
}
