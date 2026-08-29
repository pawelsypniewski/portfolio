/* ============================================================
   DANE NIEEDYTOWALNE PRZEZ PANEL
   Treść (projekty, aktualności, bio, kontakt) została przeniesiona do
   plików content/*.json i jest wczytywana przez loader.js.
   Tutaj zostają tylko: DANIE_BOOK (układ flipbooka) oraz I18N (teksty UI).
   ============================================================ */

/* ============================================================
   DANIE DNIA — dane książki (flipbook)
   Odwzorowanie układu stron z PDF-a: okładka, strona tytułowa,
   stopka redakcyjna, sekcje/przepisy + zdjęcia warzyw, zakończenie,
   tylna okładka. Treść przepisów w oryginale (PL) — to reprodukcja
   realnej książki kucharskiej.
   ============================================================ */
window.DANIE_BOOK = (function () {
  const P = n => `/images/danie-dnia/book/${String(n).padStart(2, "0")}.webp`;

  const recipes = [
    {
      section: { pl: "Napój", en: "Drink" },
      title: "Lemoniada",
      ing: [
        "4 cytryny",
        "1 szklanka ksylitolu",
        "6–8 szklanek wody mineralnej, źródlanej lub filtrowanej",
        "1 gruszka",
        "1 granat",
        "1 marakuja",
        "lód do podania"
      ],
      steps: "Wyciśnij sok z cytryn, używając wyciskarki do cytrusów lub ręcznie przez sitko tak, aby oddzielić nasiona. W rondelku zagotuj 1 szklankę wody i dodaj ksylitol. Gotuj na małym ogniu, mieszając, aż ksylitol się rozpuści. Następnie zdejmij z ognia i ostudź. W dużym dzbanku połącz sok z cytryn z przestudzonym syropem z ksylitolu. Dodaj resztę wody (około 5–7 szklanek) do dzbanka i dokładnie wymieszaj. Dodaj pestki granatu i marakui oraz plasterki gruszki, aby wzbogacić smak i kolor lemoniady. Odstaw lemoniadę na kilka minut, aby składniki się przegryzły i napój nabrał pełni smaku."
    },
    {
      section: { pl: "Przystawka", en: "Starter" },
      title: "Twarożek z Rzodkiewką",
      ing: [
        "300 g twarogu w kostce, np. półtłusty",
        "1 mały pęczek rzodkiewki",
        "1 czubata łyżka śmietany",
        "2 ząbki czosnku",
        "1/4 łyżeczki soli",
        "większa szczypta pieprzu czarnego",
        "1 łyżeczka szczypiorku"
      ],
      steps: "Rzodkiewki umyj i pokrój w drobną kostkę, czosnek przeciśnij przez praskę. Przełóż twaróg do miski i rozgnieć go widelcem, do uzyskania jednolitej konsystencji. Do twarogu dodaj śmietanę, drobno posiekane rzodkiewki i czosnek, dopraw solą i pieprzem. Całość dokładnie wymieszaj łyżką. Drobno posiekanym szczypiorkiem udekoruj wierzch twarożku lub dodaj go do środka i wymieszaj. Twarożek podawaj z pokrojoną bagietką lub domowym pieczywem."
    },
    {
      section: { pl: "Zupa", en: "Soup" },
      title: "Polewka Letnia",
      ing: [
        "2 duże kartofle",
        "1 sałata",
        "1 cebula",
        "1 pietruszka",
        "1 łyżka masła",
        "sól",
        "pieprz"
      ],
      steps: "Obrane ziemniaki umyj i pokrój w plasterki, następnie zalej je gorącą wodą i gotuj przez około 10 minut. Po tym czasie ziemniaki odcedź. Pokrojoną drobno i obraną pietruszkę, cebulę, sałatę i podgotowane ziemniaki włóż do rondelka, zalej ½ litra wody i gotuj do miękkości. Następnie przetrzyj ziemniaki przez sito, dodaj łyżkę masła oraz sól i pieprz do smaku."
    },
    {
      section: { pl: "Drugie Danie", en: "Main Course" },
      title: "Lasagne z kapusty",
      ing: [
        "1 kapusta",
        "2 cebule",
        "1 łyżka oleju",
        "3 ząbki czosnku",
        "2 marchewki",
        "3 pieczarki",
        "1 i 1/2 szklanki przecieru pomidorowego",
        "1 łyżka sosu sojowego",
        "1 łyżka płatków drożdżowych",
        "szczypta mielonej kozieradki",
        "pieprz",
        "sól",
        "suszona bazylia"
      ],
      steps: "Kapustę obgotuj i zdejmij z niej zewnętrzne liście, wycinając z nich zgrubiałe części. Naczynie żaroodporne (15 × 25 centymetrów) wyłóż warstwą ugotowanych liści kapusty. Cebule obierz i pokrój w drobną kostkę. Na patelni rozgrzej olej, dodaj cebulę oraz przeciśnięty przez praskę ząbek czosnku. Obierz marchewki, zetrzyj je na tarce o grubych oczkach i podsmaż razem z cebulą. Następnie dodaj pokrojone w kostkę pieczarki. Farsz dopraw kozieradką, bazylią, solą oraz pieprzem. Dodaj 1 szklankę przecieru pomidorowego i podsmaż do odparowania wody. Na koniec dopraw sosem sojowym, a w razie potrzeby pieprzem i solą. Farsz wyłóż na liście kapusty, a następnie przykryj go kolejną warstwą liści. Wierzch zalej ½ szklanki przecieru pomidorowego wymieszanego z płatkami drożdżowymi, solą i pieprzem. Piecz całość przez 20 minut w temperaturze 180 stopni."
    },
    {
      section: { pl: "Deser", en: "Dessert" },
      title: "Szarlotka z Mandarynkami",
      ing: [
        "Ciasto:",
        "5 żółtek",
        "250 g masła",
        "5 łyżek cukru",
        "1/2 kg mąki tortowej",
        "3 łyżeczki proszku do pieczenia",
        "sok z połowy cytryny",
        "3 łyżki tartej bułki",
        "Beza:",
        "5 białek",
        "szczypta soli",
        "1 szklanka cukru",
        "Dodatkowo:",
        "1,5 kg jabłek i mandarynek (proporcje 1:1)",
        "3 łyżki cukru trzcinowego",
        "cynamon"
      ],
      steps: "Utrzyj w misie żółtka z cukrem i masłem. Przesiej do misy mąkę z proszkiem do pieczenia, dodaj sok z cytryny i zmiksuj całość, aż powstanie konsystencja przypominająca „żwirek”. Odsyp 1/3 ciasta na kruszonkę, a resztę zagnieć. Większą część ciasta przełóż na blaszkę (30 × 40 cm) wyłożoną papierem do pieczenia i dociśnij, wyrównując powierzchnię. Jabłka obierz, pokrój w plasterki i ułóż na cieście posypanym tartą bułką. Na jabłkach ułóż odsączone mandarynki. Posyp owoce cukrem i cynamonem. Białka ubij ze szczyptą soli, a następnie stopniowo dodawaj cukier, kontynuując ubijanie. Wyłóż powstałą masę na jabłka, a na wierzchu rozsyp pozostałą część ciasta. Piecz przez 40 minut w temperaturze 180°C (góra–dół), następnie przełącz piekarnik tylko na dolne grzanie i piecz jeszcze przez 15 minut. Jeśli góra ciasta za bardzo się rumieni, przykryj ją papierem do pieczenia. Po ostygnięciu posyp ciasto cukrem pudrem."
    }
  ];

  // Liczba zdjęć przypadająca na każdą sekcję (kolejność = recipes)
  const photoGroups = [4, 3, 4, 6, 3]; // razem 20

  // Budowa płaskiej listy stron — odwzorowanie rozkładówek z PDF.
  // Para (left,right) tworzy rozkładówkę: indeksy (1,2)(3,4)... ; okładka sama.
  const pages = [];
  pages.push({ type: "cover" });
  pages.push({ type: "title" });
  pages.push({ type: "colophon" });

  let ph = 0;
  recipes.forEach((r, ri) => {
    // zdjęcia tej grupy (przed sekcją w sekwencji PDF — patrz mapowanie)
    for (let k = 0; k < photoGroups[ri]; k++) {
      pages.push({ type: "blank" });
      pages.push({ type: "photo", src: P(++ph) });
    }
    // strona przepisu (lewa) + pusta (prawa)
    pages.push({ type: "recipe", r });
    pages.push({ type: "blank" });
  });

  pages.push({ type: "blank" });
  pages.push({ type: "closing" });
  pages.push({ type: "backcover" });

  return { pages, recipes };
})();

/* ============================================================
   I18N STRINGS
   ============================================================ */
window.I18N = {
  pl: {
    "role": "Artysta wizualny / Fotograf",
    "nav.works": "Prace",
    "nav.achievements": "Aktualności",
    "nav.about": "O autorze",
    "nav.contact": "Kontakt",
    "achievements.h": "Aktualności",
    "news.back": "← Wszystkie aktualności",
    "home.h1": "Paweł Sypniewski — Fotograf i Artysta Wizualny, Warszawa",
    "home.label": "Prace / Wybrane realizacje",
    "proj.prev": "poprzednie",
    "proj.next": "następne",
    "proj.sheet": "stykówka",
    "proj.single": "pojedynczo",
    "form.h": "Napisz do mnie",
    "form.name": "Imię i nazwisko",
    "form.email": "Twój e-mail",
    "form.topic": "Temat",
    "form.topic.print": "Zakup odbitki",
    "form.topic.exhibition": "Wystawa / współpraca",
    "form.topic.press": "Media / publikacja",
    "form.topic.other": "Inne",
    "form.message": "Wiadomość",
    "form.note": "Odpowiadam z adresu katedranalogowa@gmail.com. Dane z formularza służą wyłącznie odpowiedzi na Twoją wiadomość — nie trafiają na żadną listę wysyłkową. Wiadomość idzie prosto na moją skrzynkę — bez pośredników.",
    "form.send": "Wyślij wiadomość",
    "form.sending": "Wysyłanie…",
    "form.ok": "Dziękuję — wiadomość poszła. Odpowiem najszybciej, jak się da.",
    "form.err": "Nie udało się wysłać. Napisz proszę wprost na katedranalogowa@gmail.com.",
    "about.h": "O autorze",
    "contact.h": "Kontakt",
    "lb.close": "Zamknij ✕",
    "cookie.text": "Ta strona używa plików cookies do analizy ruchu (Google Analytics). Pomaga to zrozumieć, jak korzystasz z portfolio. Twoje dane są anonimizowane.",
    "cookie.accept": "Akceptuj",
    "cookie.reject": "Odrzuć",
    "cookie.manage": "Cookies"
  },
  en: {
    "role": "Visual artist / Photographer",
    "nav.works": "Works",
    "nav.achievements": "News",
    "nav.about": "About",
    "nav.contact": "Contact",
    "achievements.h": "News",
    "news.back": "← All news",
    "home.h1": "Paweł Sypniewski — Photographer and Visual Artist, Warsaw",
    "home.label": "Works / Selected projects",
    "proj.prev": "previous",
    "proj.next": "next",
    "proj.sheet": "contact sheet",
    "proj.single": "single",
    "form.h": "Write to me",
    "form.name": "Name",
    "form.email": "Your email",
    "form.topic": "Subject",
    "form.topic.print": "Buying a print",
    "form.topic.exhibition": "Exhibition / collaboration",
    "form.topic.press": "Press / publication",
    "form.topic.other": "Other",
    "form.message": "Message",
    "form.note": "I reply from katedranalogowa@gmail.com. The details you enter are used only to answer your message — they go on no mailing list. Your message goes straight to my inbox — no third party in between.",
    "form.send": "Send message",
    "form.sending": "Sending…",
    "form.ok": "Thank you — your message is on its way. I will reply as soon as I can.",
    "form.err": "Sending failed. Please write directly to katedranalogowa@gmail.com.",
    "about.h": "About",
    "contact.h": "Contact",
    "lb.close": "Close ✕",
    "cookie.text": "This site uses cookies for traffic analysis (Google Analytics) — to help understand how you interact with the portfolio. Your data is anonymized.",
    "cookie.accept": "Accept",
    "cookie.reject": "Reject",
    "cookie.manage": "Cookies"
  }
};
