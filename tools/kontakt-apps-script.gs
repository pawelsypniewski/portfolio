/**
 * FORMULARZ KONTAKTOWY pawelsypniewski.pl → skrzynka katedranalogowa@gmail.com
 *
 * Ten plik NIE jest częścią strony. To kod, który wkleja się do Google Apps
 * Script na własnym koncie Google. Leży w repozytorium, żeby nie zginął i żeby
 * było widać, co dokładnie robi z wiadomościami: czyta zgłoszenie, składa maila
 * i wysyła go na jeden, wpisany na sztywno adres. Nic nie zapisuje, nigdzie
 * nie przekazuje, niczego nie przechowuje poza Twoją skrzynką.
 *
 * ── JAK TO URUCHOMIĆ (raz, ok. 15 minut) ─────────────────────────────────
 *
 *  1. Wejdź na https://script.google.com i kliknij „Nowy projekt".
 *  2. Nazwij projekt, np. „Formularz kontaktowy portfolio".
 *  3. Usuń to, co jest w edytorze, i wklej CAŁĄ zawartość tego pliku.
 *  4. Kliknij ikonę dyskietki (Zapisz projekt).
 *  5. Prawy górny róg: „Wdróż" → „Nowe wdrożenie".
 *  6. Kliknij koło zębate przy „Wybierz typ" i wybierz „Aplikacja internetowa".
 *  7. Ustaw:
 *        Wykonaj jako:        Ja (twój@gmail.com)
 *        Kto ma dostęp:       Wszyscy
 *     Drugie ustawienie MUSI być „Wszyscy" — inaczej formularz na stronie
 *     dostanie odmowę. Nie oznacza to, że ktokolwiek zobaczy Twoją pocztę:
 *     skrypt umie wyłącznie wysłać wiadomość na adres wpisany niżej w ODBIORCA.
 *  8. Kliknij „Wdróż". Google poprosi o zgodę — „Autoryzuj dostęp", wybierz
 *     swoje konto. Zobaczysz ostrzeżenie „Google nie zweryfikował tej
 *     aplikacji" — to normalne dla własnych skryptów: kliknij „Zaawansowane",
 *     a potem „Przejdź do …(niebezpieczne)". To Twój własny kod.
 *  9. Skopiuj „Adres URL aplikacji internetowej" — długi, kończy się na /exec.
 * 10. Wklej mi ten adres (albo sam wstaw go w app.js w stałej
 *     KONTAKT_ENDPOINT — jest opisana komentarzem).
 *
 * ── PRZY ZMIANIE KODU ────────────────────────────────────────────────────
 * Po każdej edycji tego skryptu trzeba zrobić „Wdróż” → „Zarządzaj
 * wdrożeniami” → ołówek → Wersja: „Nowa wersja” → „Wdróż”. Samo zapisanie
 * pliku NIE aktualizuje działającego adresu.
 *
 * ── LIMITY ───────────────────────────────────────────────────────────────
 * Zwykłe konto Gmail wysyła przez Apps Script do 100 wiadomości dziennie.
 * Dla formularza w portfolio to bardzo dużo. Gdyby ktoś próbował ten limit
 * zapchać, najgorsze co się stanie, to spam w Twojej skrzynce — skrypt wysyła
 * wyłącznie do Ciebie, więc nie da się go użyć do rozsyłania czegokolwiek
 * innym ludziom.
 */

/** Jedyny adres, na który ten skrypt potrafi cokolwiek wysłać. */
const ODBIORCA = "katedranalogowa@gmail.com";

/** Skąd wolno przyjmować zgłoszenia (pusta tablica = zewsząd). */
const DOZWOLONE_ZRODLA = [
  "https://pawelsypniewski.pl",
  "http://localhost:3000"
];

function doPost(e) {
  try {
    const dane = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    // Pułapka na roboty: pole jest schowane poza ekranem, więc wypełnia je
    // wyłącznie automat. Odpowiadamy „sukces", żeby bot nie kombinował dalej,
    // ale nic nie wysyłamy.
    if (dane.botcheck) return odpowiedz({ success: true });

    // Zgłoszenie z obcej strony (ktoś podpiął nasz adres pod swój formularz)
    // odrzucamy — poza tym pole i tak może nie dojść, więc brak źródła jest ok.
    if (dane.origin && DOZWOLONE_ZRODLA.length && DOZWOLONE_ZRODLA.indexOf(dane.origin) === -1) {
      return odpowiedz({ success: false, message: "Nieznane źródło zgłoszenia." });
    }

    const imie      = przytnij(dane.name, 120);
    const email     = przytnij(dane.email, 160);
    const temat     = przytnij(dane.topic, 80);
    const wiadomosc = przytnij(dane.message, 4000);
    const jezyk     = dane.language === "en" ? "angielski" : "polski";

    if (!imie || !email || !wiadomosc) {
      return odpowiedz({ success: false, message: "Brak wymaganych pól." });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
      return odpowiedz({ success: false, message: "Nieprawidłowy adres e-mail." });
    }

    MailApp.sendEmail({
      to: ODBIORCA,
      // Odpowiadasz przyciskiem „Odpowiedz" — mail wraca wprost do piszącego.
      replyTo: email,
      name: "Formularz pawelsypniewski.pl",
      subject: "Portfolio — " + (temat || "wiadomość") + " — " + imie,
      body: [
        "Od:      " + imie + " <" + email + ">",
        "Temat:   " + (temat || "—"),
        "Język:   " + jezyk,
        "",
        "──────────────────────────────────────────",
        "",
        wiadomosc,
        "",
        "──────────────────────────────────────────",
        "Wysłane z formularza na pawelsypniewski.pl"
      ].join("\n")
    });

    return odpowiedz({ success: true });
  } catch (err) {
    return odpowiedz({ success: false, message: String(err) });
  }
}

/** Wejście przez GET — żeby otwarcie adresu w przeglądarce nie straszyło błędem. */
function doGet() {
  return odpowiedz({ success: false, message: "Ten adres przyjmuje tylko formularz." });
}

function przytnij(wartosc, ile) {
  return String(wartosc == null ? "" : wartosc).trim().slice(0, ile);
}

function odpowiedz(obiekt) {
  return ContentService
    .createTextOutput(JSON.stringify(obiekt))
    .setMimeType(ContentService.MimeType.JSON);
}
