# Panel administracyjny — instrukcja

Twoja strona ma teraz panel, przez który edytujesz treść **bez dotykania kodu**.
Treść (projekty, aktualności, bio, kontakt) trzymana jest w plikach JSON w folderze
`content/`, a panel (Sveltia CMS) zapisuje w nich zmiany.

Adres panelu po wdrożeniu: **https://pawelsypniewski.pl/admin/**

---

## Najszybszy start — edycja LOKALNA (bez żadnej konfiguracji)

Sveltia umożliwia edycję wprost z dysku — idealne, żeby od razu wypróbować panel,
zanim ustawisz logowanie online.

1. Uruchom stronę lokalnie. W terminalu, w folderze projektu:
   ```
   npm run serve
   ```
2. Otwórz w przeglądarce **http://localhost:3000/admin/**
3. Kliknij **„Work with Local Repository"** i wskaż folder projektu (`Portfolio`).
4. Edytuj projekty / aktualności / teksty. Zmiany zapisują się prosto na dysk.
5. Po edycji przebuduj pliki zbiorcze i wyślij na stronę:
   ```
   npm run optimize   # konwertuje wgrane zdjęcia do WebP
   npm run build      # przebudowuje content/projects.json i news.json
   git add -A && git commit -m "Aktualizacja treści" && git push
   ```

> Wymaga przeglądarki Chrome lub Edge (obsługa zapisu na dysk).

---

## Edycja ONLINE (logowanie przez GitHub) — konfiguracja jednorazowa

Żeby logować się do panelu z dowolnego miejsca (`pawelsypniewski.pl/admin/`),
potrzebny jest darmowy „pośrednik logowania" (OAuth). Robisz to **raz**.

### Krok 1 — aplikacja OAuth na GitHubie
1. Wejdź na https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**.
2. Wypełnij:
   - **Application name:** `Panel pawelsypniewski.pl`
   - **Homepage URL:** `https://pawelsypniewski.pl`
   - **Authorization callback URL:** `https://<adres-pośrednika>/callback`
     (adres pośrednika dostaniesz w Kroku 2 — na razie wpisz cokolwiek, wrócisz tu).
3. Kliknij **Register application**. Zapisz **Client ID**, a potem **Generate a new
   client secret** i zapisz **Client Secret** (pokazany tylko raz!).

### Krok 2 — pośrednik logowania (darmowy Cloudflare Worker)
Najprościej użyć gotowego workera dla Sveltii:
1. Załóż darmowe konto na https://dash.cloudflare.com (jeśli nie masz).
2. Postaw worker `sveltia-cms-auth` wg instrukcji autora:
   https://github.com/sveltia/sveltia-cms-auth (przycisk „Deploy to Cloudflare").
3. W ustawieniach workera (Settings → Variables) dodaj sekrety:
   - `GITHUB_CLIENT_ID` = Client ID z Kroku 1
   - `GITHUB_CLIENT_SECRET` = Client Secret z Kroku 1
   - `ALLOWED_DOMAINS` = `pawelsypniewski.pl`
4. Skopiuj adres workera (np. `https://sveltia-cms-auth.twoja-nazwa.workers.dev`).
5. Wróć do aplikacji OAuth (Krok 1) i ustaw **Authorization callback URL** na:
   `https://sveltia-cms-auth.twoja-nazwa.workers.dev/callback`

### Krok 3 — wpięcie adresu w panelu
W pliku `admin/config.yml`, w sekcji `backend`, odkomentuj i ustaw linię:
```yaml
backend:
  name: github
  repo: pawelsypniewski/portfolio
  branch: main
  base_url: https://sveltia-cms-auth.twoja-nazwa.workers.dev
```
Zapisz, zcommituj i wypchnij (`git push`). Od teraz wchodzisz na
`pawelsypniewski.pl/admin/`, klikasz **„Sign In with GitHub"** i edytujesz online.

---

## Jak działa publikacja (online)

1. W panelu edytujesz wpis i klikasz **Publish / Save**.
2. Panel zapisuje zmianę jako commit w repozytorium GitHub.
3. Automat (GitHub Action `Build content`) sam:
   - przerabia wgrane zdjęcia na lekki WebP,
   - przebudowuje pliki zbiorcze (`content/projects.json`, `content/news.json`).
4. GitHub Pages publikuje stronę — zmiana widoczna zwykle w ~1–2 minuty.

> **Ważne:** plików `content/projects.json` i `content/news.json` **nie edytuj ręcznie** —
> są generowane automatycznie z pojedynczych plików w `content/projects/` i `content/news/`.

---

## Co możesz zmieniać w panelu

| Sekcja            | Co edytujesz                                                            |
|-------------------|-------------------------------------------------------------------------|
| **Aktualności**   | Wystawy, pokazy, publikacje — data, typ, tytuł/opis PL+EN, linki, zdjęcia |
| **Projekty**      | Tytuł, rok, kategoria, opis i podpis PL+EN, galeria zdjęć, miniatura     |
| **Kolejność**     | Pole **„Kolejność"** w projekcie (1 = pierwszy na stronie)               |
| **Widoczność**    | Przełącznik **„Ukryty"** — chowa projekt bez usuwania                     |
| **Teksty strony** | „O autorze" (bio) i „Kontakt" — tekst sformatowany PL+EN (bez HTML)      |

> **Teksty piszesz zwykłym tekstem, nie w HTML.** Edytor ma pasek narzędzi
> (nagłówki, listy, pogrubienie, linki) — formatowanie zamienia się na HTML
> automatycznie przy wczytywaniu strony. Portret i galeria Instagrama mają osobne
> pola (zdjęcie + linki), więc też nie dotykasz kodu.

### Dodawanie projektu / aktualności
Kliknij **„New …"**, wypełnij pola, dodaj zdjęcia (przeciągnij lub wybierz z dysku),
zapisz. Nowe zdjęcia trafiają do `images/uploads/` i są automatycznie konwertowane.

### Zmiana kolejności projektów
W projekcie ustaw pole **„Kolejność"** (mniejsza liczba = wyżej). Po publikacji
automat przebuduje stronę w odpowiedniej kolejności.

---

## Czego panel NIE obejmuje (zostaje w kodzie)
- Układ/wygląd strony, menu, animacje (`app.js`, `index.html`).
- Flipbook „Danie dnia" i teksty interfejsu (`data.js` → `DANIE_BOOK`, `I18N`).
- Dane SEO/meta w `index.html` (można dodać do panelu w przyszłości).

---

## Komendy pomocnicze (terminal)
```
npm run serve      # podgląd strony i panelu lokalnie (http://localhost:3000)
npm run build      # przebudowa plików zbiorczych (po edycji lokalnej)
npm run optimize   # konwersja zdjęć z images/uploads na WebP
```
