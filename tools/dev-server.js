/**
 * Lokalny podgląd strony — zero zależności, działa bez internetu.
 *
 *   node tools/dev-server.js        (albo: npm run serve)
 *   → http://localhost:3000
 *
 * Zachowuje się jak GitHub Pages: dla adresu katalogu (np. /labirynt/)
 * serwuje /labirynt/index.html, a dla nieznanego adresu zwraca 404.html
 * (jeśli istnieje) z kodem 404 — dzięki temu lokalny test odpowiada temu,
 * co zobaczy przeglądarka i robot Google na produkcji.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function send(res, status, body, type) {
  res.writeHead(status, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  res.end(body);
}

http
  .createServer((req, res) => {
    let rel;
    try {
      rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      return send(res, 400, "Bad request");
    }

    // Blokada wyjścia poza katalog projektu (np. /../../etc/passwd)
    let file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) return send(res, 403, "Forbidden");

    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }

    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      const notFound = path.join(ROOT, "404.html");
      if (fs.existsSync(notFound)) {
        return send(res, 404, fs.readFileSync(notFound), TYPES[".html"]);
      }
      return send(res, 404, `404 — nie znaleziono: ${rel}`);
    }

    send(res, 200, fs.readFileSync(file), TYPES[path.extname(file).toLowerCase()]);
  })
  .listen(PORT, () => console.log(`Podgląd strony: http://localhost:${PORT}`));
