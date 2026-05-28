/* ============================================================
   PROJECT DATA
   ============================================================ */

window.PROJECTS = [
  {
    slug: "ustawienia-domyslne",
    no: "01",
    title: { pl: "Ustawienia domyślne", en: "Default Settings" },
    year: "2024",
    category: { pl: "Dokument", en: "Documentary" },
    place: { pl: "O sztucznej inteligencji", en: "On artificial intelligence" },
    works: 18,
    caption: {
      pl: "Cykl o codzienności, fragmentach krajobrazu i obrazach przestrzeni publicznej. Co zostaje, gdy wszystko sprowadzić do ustawień fabrycznych.",
      en: "A series on the everyday — fragments of landscape and public space. What remains once everything is reduced to factory settings."
    },
    images: Array.from({length: 18}, (_, i) =>
      `images/ustawienia/${String(i+1).padStart(2,"0")}.jpg`)
  },
  {
    slug: "superpozycja",
    no: "02",
    title: { pl: "Superpozycja", en: "Superposition" },
    year: "2023",
    category: { pl: "Kreacja / Portret", en: "Constructed / Portrait" },
    place: { pl: "Kwantowa wizja", en: "Quantum vision" },
    works: 8,
    caption: {
      pl: "Obraz nakładający się na obraz — postać w stroju z porzuconych obwodów drukowanych krąży po przestrzeni miasta. Praca o równoczesności bytów.",
      en: "Image layered on image — a figure dressed in discarded circuit boards drifts through the city. A work on the simultaneity of being."
    },
    images: Array.from({length: 8}, (_, i) =>
      `images/superpozycja/${String(i+1).padStart(2,"0")}.jpg`)
  },
  {
    slug: "gra-o-tron",
    no: "03",
    title: { pl: "Gra o tron", en: "Game of Thrones" },
    year: "2022",
    category: { pl: "Dokument / Found", en: "Documentary / Found" },
    place: { pl: "Walka polityczna", en: "Political fight" },
    works: 12,
    flashEffect: true,
    caption: {
      pl: "Polityczna ikonografia polskiej prowincji. Plakaty, ołtarzyki, prowizoryczne pomniki — krajobraz przed wyborami.",
      en: "Political iconography of the Polish countryside. Posters, makeshift shrines, monuments — the landscape before an election."
    },
    images: Array.from({length: 12}, (_, i) =>
      `images/gra_o_tron/${String(i+1).padStart(2,"0")}.jpg`)
  },
  {
    slug: "nowa-topografia",
    no: "04",
    title: { pl: "Nowa topografia Polski", en: "New Topography of Poland" },
    year: "2022",
    category: { pl: "Dokument / Krajobraz", en: "Documentary / Landscape" },
    place: { pl: "Polska moim okiem", en: "Poland through my eye" },
    works: 9,
    caption: {
      pl: "Polska moim okiem — krajobraz peryferii, ogrodzeń, tablic, prowizorek. Ślady codziennego porządkowania przestrzeni.",
      en: "Poland through my eye — a landscape of edges, fences, notice boards, makeshift things. Traces of the everyday ordering of space."
    },
    images: Array.from({length: 9}, (_, i) =>
      `images/topografia/${String(i+1).padStart(2,"0")}.jpg`)
  },
  {
    slug: "labirynt",
    no: "05",
    title: { pl: "Labirynt", en: "Labyrinth" },
    year: "2024",
    category: { pl: "Dokument / Książka", en: "Documentary / Book" },
    place: { pl: "Zagubieni", en: "The Lost" },
    works: 15,
    flashEffect: true,
    caption: {
      pl: "Książka fotograficzna o stanach zawieszenia, błądzeniu i braku perspektyw. Zrealizowana w ramach Instytutu Fotografii Twórczej w Opawie.",
      en: "A photobook on states of suspension, drift, and dead ends. Made within the Institute of Creative Photography, Opava."
    },
    images: Array.from({length: 15}, (_, i) =>
      `images/labirynt/${String(i+1).padStart(2,"0")}.jpg`)
  },
  {
    slug: "nocne-ptaki",
    no: "06",
    title: { pl: "Nocne Ptaki Późno Wracają Do Domu", en: "Night Birds Come Home Late" },
    year: "2025",
    category: { pl: "Dokument / Reportaż / Street", en: "Documentary / Reportage / Street" },
    place: { pl: "Nocny styl życia", en: "Nocturnal life" },
    works: 8,
    flashEffect: true,
    caption: {
      pl: "Zapis dokumentalny nocnego stylu życia. Refleksja nad normami społecznymi.",
      en: "A documentary record of nocturnal life. A reflection on social norms."
    },
    images: [
      "images/nocne-ptaki/04.jpg",
      "images/nocne-ptaki/03.jpg",
      "images/nocne-ptaki/01.jpg",
      "images/nocne-ptaki/07.jpg",
      "images/nocne-ptaki/06.jpg",
      "images/nocne-ptaki/08.jpg",
      "images/nocne-ptaki/02.jpg",
      "images/nocne-ptaki/05.jpg"
    ]
  },
  {
    slug: "danie-dnia",
    no: "07",
    title: { pl: "Danie dnia", en: "Dish of the Day" },
    year: "2025",
    category: { pl: "Studium / Dokument / Ekologia", en: "Studio / Documentary / Ecology" },
    place: { pl: "Marnowanie żywności", en: "Food waste" },
    works: 4,
    caption: {
      pl: "Studium fotograficzne o codziennym wyborze i marnowaniu. Dokumentacja konsumpcji — jedzenia które nie trafia na stół.",
      en: "A photographic study of daily choice and waste. Documentation of consumption — food that never reaches the table."
    },
    images: Array.from({length: 4}, (_, i) =>
      `images/danie-dnia/${String(i+1).padStart(2,"0")}.jpg`)
  }
];

/* ============================================================
   ACHIEVEMENTS — wystawy, publikacje, edukacja, członkostwa
   Sortowanie: chronologicznie odwrotnie (najnowsze u góry).
   Każdy wpis: zdjęcia w folderze images/achievements/<id>/
   ============================================================ */
window.ACHIEVEMENTS = [
  {
    id: "pamietnik-przetrwania-2025",
    year: "2025",
    type: { pl: "Wystawa indywidualna", en: "Solo exhibition" },
    title: { pl: "Pamiętnik przetrwania", en: "Diary of Survival" },
    place: {
      pl: "Galeria MAL — Terminal Kultury Gocław, Warszawa",
      en: "MAL Gallery — Terminal Kultury Gocław, Warsaw"
    },
    description: {
      pl: "Osobisty zapis fotograficzny walki z depresją. Projekt powstał z potrzeby przełamania społecznego tabu wokół chorób psychicznych i dotarcia do osób zmagających się z podobnymi doświadczeniami — z myślą, że prośba o pomoc nie jest oznaką słabości, lecz odwagą. Wernisaż 3 grudnia 2025, ekspozycja do 10 stycznia 2026.",
      en: "A personal photographic record of struggle with depression. The project was born from the need to break the social taboo around mental illness and to reach others fighting similar battles — with the conviction that asking for help is not a sign of weakness, but of courage. Opening December 3, 2025, on view through January 10, 2026."
    },
    url: "",
    images: [
      "images/achievements/pamietnik-przetrwania-2025/01.jpg",
      "images/achievements/pamietnik-przetrwania-2025/02.jpg",
      "images/achievements/pamietnik-przetrwania-2025/03.jpg",
      "images/achievements/pamietnik-przetrwania-2025/04.jpg",
      "images/achievements/pamietnik-przetrwania-2025/05.jpg",
      "images/achievements/pamietnik-przetrwania-2025/06.jpg"
    ]
  },
  {
    id: "w-glowie-sie-nie-miesci-2025",
    year: "2025",
    type: { pl: "Wystawa indywidualna", en: "Solo exhibition" },
    title: { pl: "W głowie się nie mieści", en: "W głowie się nie mieści" },
    place: {
      pl: "Lokal Bródno, ul. Kondratowicza 18b/406, Warszawa",
      en: "Lokal Bródno, Kondratowicza 18b/406, Warsaw"
    },
    description: {
      pl: "Indywidualna wystawa łącząca cztery cykle artysty — „Pamiętnik przetrwania”, „Flashback”, „Labirynt” i „Superpozycja”. Podróż w głąb ludzkiej świadomości i podświadomości: o pamięci, granicach wolności, lękach i pragnieniach. Fotografia jako narzędzie dialogu — z samym sobą, z odbiorcą, ze światem. Kuratorka: Agata Rząsowska-Grabicka. Wernisaż 5 września 2025, ekspozycja do 19 września.",
      en: "Solo exhibition bringing together four of the artist's series — \"Diary of Survival\", \"Flashback\", \"Labyrinth\" and \"Superposition\". A journey into human consciousness and subconsciousness — memory, limits of freedom, fears and desires. Photography as a tool for dialogue — with oneself, the viewer and the world. Curator: Agata Rząsowska-Grabicka. Opening 5 September 2025, on view through 19 September."
    },
    url: "",
    images: [
      "images/achievements/w-glowie-sie-nie-miesci-2025/01.jpg",
      "images/achievements/w-glowie-sie-nie-miesci-2025/02.jpg",
      "images/achievements/w-glowie-sie-nie-miesci-2025/03.jpg",
      "images/achievements/w-glowie-sie-nie-miesci-2025/04.jpg",
      "images/achievements/w-glowie-sie-nie-miesci-2025/05.jpg"
    ]
  }
];

/* ============================================================
   I18N STRINGS
   ============================================================ */
window.I18N = {
  pl: {
    "role": "Artysta wizualny / Fotograf",
    "nav.works": "Prace",
    "nav.achievements": "Osiągnięcia",
    "nav.about": "O autorze",
    "nav.contact": "Kontakt",
    "achievements.h": "Osiągnięcia",
    "home.label": "Prace / Wybrane realizacje",
    "idx.no": "Nr",
    "idx.title": "Tytuł",
    "idx.cat": "Kategoria",
    "idx.year": "Rok",
    "idx.works": "Prace",
    "proj.prev": "poprzednie",
    "proj.next": "następne",
    "about.h": "O autorze",
    "contact.h": "Kontakt",
    "lb.close": "Zamknij ✕",
    "tw.home": "Układ strony głównej",
    "tw.lang": "Język",
    "tweaks.open": "Układ strony →"
  },
  en: {
    "role": "Visual artist / Photographer",
    "nav.works": "Works",
    "nav.achievements": "Achievements",
    "nav.about": "About",
    "nav.contact": "Contact",
    "achievements.h": "Achievements",
    "home.label": "Works / Selected projects",
    "idx.no": "No.",
    "idx.title": "Title",
    "idx.cat": "Category",
    "idx.year": "Year",
    "idx.works": "Works",
    "proj.prev": "previous",
    "proj.next": "next",
    "about.h": "About",
    "contact.h": "Contact",
    "lb.close": "Close ✕",
    "tw.home": "Homepage layout",
    "tw.lang": "Language",
    "tweaks.open": "Page layout →"
  }
};

/* ============================================================
   ABOUT / CONTACT CONTENT
   ============================================================ */
window.ABOUT = {
  pl: {
    body: `<p>Paweł Sypniewski (ur. 1987 w Warszawie) — artysta wizualny, fotograf i performer. Członek ZPAF, Okręg Warszawski. W swojej twórczości konsekwentnie wychodzi poza tradycyjnie pojmowane ramy fotografii.</p>
<p>Interesuje go relacja obrazu i tekstu, eksperyment oraz prowokacja, a także łączenie fotografii z innymi środkami wyrazu artystycznego. Jego wszechstronny warsztat sprawia, że trudno sklasyfikować go w obrębie jednego stylu.</p>
<p>W portfolio znajdują się prace dokumentalne, reporterskie, kreacyjne i studyjne, a także realizacje wykorzystujące techniki szlachetne, mixed media i kolaż. Inspiruje się sztuką konceptualną oraz awangardą, tworząc dzieła wymykające się prostym kategoryzacjom.</p>`,
    side: `
<h3>Członkostwo</h3>
<ul>
  <li>ZPAF — Okręg Warszawski</li>
</ul>
<h3>Edukacja</h3>
<ul>
  <li>Instytut Fotografii Twórczej, Opawa</li>
  <li>Program Mentorski Sputnik Photos</li>
  <li>Studium Fotografii ZPAF</li>
</ul>
<h3>Praktyki</h3>
<ul>
  <li>Dokument</li>
  <li>Portret kreacyjny</li>
  <li>Techniki szlachetne</li>
  <li>Mixed media / kolaż</li>
  <li>Performance</li>
</ul>
<h3>Bazy</h3>
<ul>
  <li>Warszawa, PL</li>
  <li>Opawa, CZ</li>
</ul>`
  },
  en: {
    body: `<p>Paweł Sypniewski (born 1987, Warsaw) — visual artist, photographer and performer. Member of ZPAF (Union of Polish Art Photographers), Warsaw Branch. His practice consistently moves beyond the traditional frames of photography.</p>
<p>He is interested in the relation between image and text, experimentation and provocation, and in combining photography with other artistic media. The breadth of his craft makes it difficult to place him within any single style.</p>
<p>His portfolio spans documentary, reportage, constructed and studio work, alongside projects employing historical photographic processes, mixed media and collage. Drawing from conceptual art and the avant-garde, he produces works that resist simple categorisation.</p>`,
    side: `
<h3>Membership</h3>
<ul>
  <li>ZPAF — Warsaw Branch</li>
</ul>
<h3>Education</h3>
<ul>
  <li>Institute of Creative Photography, Opava</li>
  <li>Sputnik Photos Mentor Programme</li>
  <li>ZPAF School of Photography</li>
</ul>
<h3>Practices</h3>
<ul>
  <li>Documentary</li>
  <li>Constructed portrait</li>
  <li>Alternative processes</li>
  <li>Mixed media / collage</li>
  <li>Performance</li>
</ul>
<h3>Based in</h3>
<ul>
  <li>Warsaw, PL</li>
  <li>Opava, CZ</li>
</ul>`
  }
};

/* ============================================================
   INSTAGRAM TILES — 6 zdjęć z folderu /images/instagram/
   Aby zmienić: zastąp pliki 01-06.jpg w /images/instagram/.
   Jeśli chcesz linkować konkretne posty, edytuj url poniżej.
   ============================================================ */
const IG_TILES = [
  { img: "images/instagram/01.jpg", url: "https://www.instagram.com/p/C5L33N1IeEz/" },
  { img: "images/instagram/02.jpg", url: "https://www.instagram.com/p/DDElbqPI8tL/" },
  { img: "images/instagram/03.jpg", url: "https://www.instagram.com/p/DCMoYLComsI/" },
  { img: "images/instagram/04.jpg", url: "https://www.instagram.com/p/C__MGoGodx7/" },
  { img: "images/instagram/05.jpg", url: "https://www.instagram.com/p/DCPeeERoB0_/" },
  { img: "images/instagram/06.jpg", url: "https://www.instagram.com/p/DGbNquTI_p8/" }
];

function buildIgSection(L) {
  const heading = L === "pl" ? "Codziennie na Instagramie" : "Daily on Instagram";
  const aria    = L === "pl" ? "Zobacz post na Instagramie" : "View on Instagram";
  const tiles = IG_TILES.map(t =>
    `<a class="ig-tile" href="${t.url}" target="_blank" rel="noopener noreferrer" aria-label="${aria}" style="background-image:url('${t.img}')"></a>`
  ).join("");
  return `
<div class="ig-section">
  <div class="ig-heading">${heading}</div>
  <div class="ig-grid">${tiles}</div>
  <a class="ig-more" href="https://www.instagram.com/sypniewskistudio/" target="_blank" rel="noopener noreferrer">@sypniewskistudio →</a>
</div>`;
}

window.CONTACT = {
  pl: {
    body: `<p>Odbitki autorskie w limitowanych edycjach są dostępne w sprzedaży. Możesz zapytać o dowolne zdjęcie, które Cię zainteresowało. W sprawie nakładu, formatów i cen — napisz do mnie mailem.</p>` + buildIgSection("pl"),
    side: `
<h3>E-mail</h3>
<ul><li><a href="mailto:katedranalogowa@gmail.com">katedranalogowa@gmail.com</a></li></ul>
<h3>Instagram</h3>
<ul><li><a href="https://www.instagram.com/sypniewskistudio/" target="_blank" rel="noopener">@sypniewskistudio</a></li></ul>`
  },
  en: {
    body: `<p>Limited edition prints are available for sale. Please ask for any picture you like. For details — amounts, sizes, pricing — send me an email.</p>` + buildIgSection("en"),
    side: `
<h3>E-mail</h3>
<ul><li><a href="mailto:katedranalogowa@gmail.com">katedranalogowa@gmail.com</a></li></ul>
<h3>Instagram</h3>
<ul><li><a href="https://www.instagram.com/sypniewskistudio/" target="_blank" rel="noopener">@sypniewskistudio</a></li></ul>`
  }
};
