# Audyt r3 — organizacja meczu

**Audytor: Codex, model GPT-6.** Tę nazwę znam z instrukcji sesji; dokładnego wariantu ani identyfikatora snapshotu nie udostępniono mi, więc ich nie dopisuję.

Data: 28.10.2026. Audytowany SHA: **67ef30171da0ebf75c032422165afa1733f061c0**. Stan początkowy: czysty main, bez lokalnych zmian.

Konflikt interesów: audyt wykonuje Codex, czyli jedna z nazw stron planowanego meczu. Nie jestem instancją, która będzie grała. Szukałem szczególnie możliwej przewagi Claude'a; nie znalazłem w sędzim rozgałęzienia przyznającego mu lepszy widok, ciało lub czas gry. Nie jest to jednak dowód pełnej izolacji ani równoważności obu CLI.

## Najważniejsze dziury i ryzyka, od najpoważniejszych

1. **DZIURA: remis powoduje kolizję plików surowych odpowiedzi.** Powtórka zachowuje numer rundy, zeruje numer decyzji i zapisuje ponownie np. raw/1A001.json. Wcześniejsze odpowiedzi i prompty zostają nadpisane, choć decyzje.jsonl zachowuje oba zestawy odwołań. Dowód: gra/src/fighter/round.js:107 oraz sedzia/sedzia.mjs:252–255, 264, 282, 290–293; niezależna reprodukcja poniżej. **Naprawa:** dodać do identyfikatorów decyzji i plików osobny, rosnący numer rozegrania rundy, również po remisie; zachować dotychczasowy numer rundy do wyniku i zamiany stron. Nie zmienia to zasad gry.
2. **DZIURA: parser wykonuje fragment niepoprawnej odpowiedzi JSON.** parseAnswer przyjmuje rozkaz z wnętrza uszkodzonego obiektu albo pierwszy z dwóch obiektów. To przeczy obietnicy odrzucenia odpowiedzi niebędącej poprawnym JSON-em. Dowód: sedzia/ZASADY_GRACZA.md:50, 75 i sedzia/gracze.mjs:35–42; oba przypadki odtworzone na audytowanym kodzie. Działa na obie strony. **Naprawa:** wymagać jednego poprawnego obiektu całej odpowiedzi; ewentualne dopuszczenie otoczki tekstowej wymaga jawnego uzgodnienia z Ownerem, zamiast zgadywania fragmentu rozkazu.
3. **RYZYKO: zobowiązanie nie zamraża faktycznych wykonawców modeli.** Zapisuje wersje CLI, ale start meczu ich nie porównuje; nie hashuje instalacji CLI i nie podaje jawnie modelu żadnej strony. Dowód: sedzia/zobowiaz.mjs:21–22, 62, 73; sedzia/sedzia.mjs:49–56; sedzia/gracze.mjs:46–47, 67–69. **Naprawa:** przed publikacją uzgodnić i zapisać konkretne modele obu stron, jawnie przekazywać je CLI oraz sprawdzać wersje i odciski używanych instalacji przy starcie. Rozbieżność lub brak identyfikacji powinny zatrzymać przygotowanie meczu, a nie zostać dopiero adnotacją po nim.
4. **RYZYKO / NIESPRAWDZONE: brak pełnego dowodu świeżości i izolacji CLI.** Stały CODEX_HOME jest współdzielony z nazwanym katalogiem Statków, nie jest tworzony od nowa dla meczu; kod wyłącza wiele funkcji, ale nie wymusza jawnie wyłączenia pamięci i nie dowodzi pustego zestawu wszystkich oferowanych narzędzi. Claude dziedziczy środowisko i nie ma odpowiednika --ignore-user-config w wywołaniu. Dowód: sedzia/gracze.mjs:13, 17, 46–47, 62–69, 102–105. **Naprawa:** osobne, kontrolowane profile obu stron dla tego meczu, jawne wyłączenie pamięci i sprawdzenie efektywnej konfiguracji oraz dostępnych narzędzi dla zamrożonych wersji. Nie przenosić tam materiałów audytu. Nie stwierdzam, że doszło do przecieku.
5. **RYZYKO: odcisk bibliotek obejmuje deklarację instalacji, nie cały wykonywany kod zależności.** Zmodyfikowany Vite lub recast-navigation może pozostawić niezmieniony node_modules/.package-lock.json i three.module.js. Dowód: sedzia/zobowiaz.mjs:42–45; gra/scripts/sim-node.mjs:7, 17–20; gra/package.json:56, 68. **Naprawa:** użyć kontrolowanej instalacji odtworzonej z lockfile i odcisku faktycznie używanych zależności lub zamrożonego środowiska wykonawczego. Nie potrzeba zmieniać zasad SCRIBE.
6. **RYZYKO organizacyjne: drand zamyka wybieranie ziarna tylko po terminowej, jednoznacznej publikacji zobowiązania.** Kod nie sprawdza czasu publicznej publikacji ani tego, czy istniało kilka konkurencyjnych zobowiązań; odpowiedź latarni przyjmuje bez weryfikacji podpisu. Dowód: sedzia/zobowiaz.mjs:49–56, 69–77; sedzia/sedzia.mjs:30–36. **Naprawa:** wskazać jedno oficjalne zobowiązanie z niezależnym dowodem publikacji przed rundą drand i ujawniać odwołane próby; weryfikować kryptograficznie odpowiedź właściwego łańcucha. Brak tej automatyzacji nie dowodzi, że organizator oszukał.

## Zakres i ograniczenia

Przeczytałem w całości brief r3, README, KRONIKA, audyty r1 i r2; następnie kod wywołań, sędziego, zobowiązania, zasad oraz wskazane fragmenty silnika i loadera. Poprzednie werdykty traktowałem jako materiał pomocniczy. Numery linii w tym raporcie dotyczą powyższego SHA, nie numeracji cytowanej przez wcześniejszych audytorów.

Wykonałem niezależne próby parserów i połączenia prawdziwego modułu rundy z wyrażeniem nazwy pliku sędziego. Skrypty przekazano Node przez stdin: bez zapisywania plików testowych, bez CLI modeli i bez zapytań do modeli. **Nie uruchamiałem dozwolonego meczu stub–stub**: standardowy sędzia tworzy pliki wyników (sedzia/sedzia.mjs:60–62, 290–293, 314–315), a brief pozwala tworzyć tylko raport. Nie uruchamiałem pełnych regresji gry, odtwarzania meczu ani instalacji zależności. Pełna ścieżka CLI → model → silnik oraz faktyczne zachowanie zainstalowanych CLI pozostają NIESPRAWDZONE.

Terminal przejściowo odmawiał uruchamiania procesów; odczyt i próby kontynuowałem przez dostępny Node REPL i proces Node. Odczyt lokalnej instalacji Codexa w AppData/Roaming/npm/node_modules/@openai/codex/package.json został odmówiony (EPERM). Dlatego nie podaję zgadniętej wersji lokalnego CLI ani zapewnienia, że wszystkie flagi są przez tę instalację obsługiwane.

Nie wydaję ogólnego PASS/FAIL. Poniższe OK / DZIURA / RYZYKO / NIESPRAWDZONE są odpowiedziami na pytania briefu. Potwierdzone defekty mają wskazaną obietnicę, komponent odpowiedzialny i reprodukcję; propozycje zmian organizacyjnych nie stanowią nowych zasad ani decyzji Ownera. Kronika opisująca propozycję modelu sama w sobie nie zastępuje akceptacji Pawła.

## Odpowiedzi 1–9

### 1. Symetria wywołań Claude Code i Codexa

**Werdykt: OK dla wspólnych parametrów; RYZYKO dla konfiguracji, tożsamości i semantyki CLI.**

- Instrukcja ma identyczną treść SYSTEM_LINE (sedzia/gracze.mjs:10). Claude dostaje ją przez --system-prompt (46–47), Codex przez plik model_instructions_file (65–69). Zasady gry i widok są składane jednym kodem dla obu (sedzia/sedzia.mjs:89–91, 264–267). To nie dowodzi identyczności całego kontekstu dostawców.
- Moc myślenia jest ustawiana wspólną wartością effort: --effort u Claude'a i model_reasoning_effort u Codexa (gracze.mjs:47, 69, 101–105; sedzia.mjs:206). Domyślnie medium. **OK jako jawnie taki sam poziom nazwany; NIESPRAWDZONE jako równy koszt lub zdolność rozumowania.** Tokeny rozumowania różnych dostawców i sama etykieta medium nie są wspólną jednostką mocy. Nie uznaję zera tokenów rozumowania za dowód użycia słabszego modelu.
- Oba wywołania mają ten sam limit 300000 ms (sedzia.mjs:20, 267; gracze.mjs:13–19) i nowy pusty katalog roboczy dla każdej decyzji (gracze.mjs:14, 17). **OK.** Zewnętrzny plik instrukcji Codexa ma jednak stałą nazwę i nie jest częścią tego pustego katalogu (65–66). Dwa równoległe mecze tego samego kodu zapiszą identyczną treść; sam ten fakt nie daje Claude'owi przewagi. Unikalny plik na wywołanie usunąłby zbędne współdzielenie.
- Sędzia nie ponawia nieudanego wywołania: jedna decyzja to jedno exec i jeden odczyt (gracze.mjs:108–111). Każdy wynik, także timeout/limit/cli_error, zużywa decyzję; poprzedni rozkaz trwa, do kolejnego pytania przyjmowane są 3 s gry (sedzia.mjs:272–281). **OK dla symetrii kodu; RYZYKO dla wpływu awarii usług.** Wewnętrzne ponowienia obu CLI są NIESPRAWDZONE.
- Obie strony używają parseAnswer, lecz dowód izolacji jest inny: Claude sprawdza listy w init, Codex rodzaje zdarzeń item (gracze.mjs:49–58, 72–84). Claude może dostać outcome=ok bez init, modelu i proof; odtworzyłem taki przypadek. Codex również może dostać outcome=ok z model=null. Oba czytniki ignorują niezerowy kod zakończenia procesu. Nie dowodzi to nierównego wyniku, ale osłabia wiarygodność zapisu.

**Zarzut krytyka:** „Jedna strona dostała inny model lub ukryte instrukcje, a błędy dostawcy zużyły jej decyzje”. Pierwszego nie wyklucza zobowiązanie, drugie wynika z kodu, lecz nie potwierdzono wystąpienia w meczu.

**Najprostsza naprawa:** zamrozić modele, CLI i efektywne profile, wymagać kompletnego dowodu tożsamości/izolacji oraz uzgodnić przed meczem postępowanie przy awarii dostawcy. **OWNER_DECISION_NEEDED:** ponowienie, przerwanie czy dalsza gra po awarii usługi; nie wprowadzam sam tej polityki. Odrzucanie niepoprawnych rozkazów jest już opisane w ZASADY_GRACZA.md:75.

### 2. Widok, walidacja, budzenie, limit decyzji i zatrzymany czas

**Werdykt: OK w zakresie symetrii modeli i czasu gry.**

Widok bierze dane strony k i jej pamięć; indeks gracza służy do poprawnego wyniku po zamianie stron (sedzia/sedzia.mjs:125–155). check nie zna nazwy modelu (161–179). reasons i cap działają na st[k], identycznie dla obu stron (209–227); stan jest zerowany na początku każdego rozegrania rundy (254–255). Ciało obu stron ma ten sam hands, a strumienie losowości są zależne od strony, rundy i kroku, nie od nazwy dostawcy (253). Nie oznacza to identycznych losowych trafień — to odrębne, deterministyczne strumienie.

Zapytania idą przez Promise.all, po await sędzia stosuje odpowiedzi, a dopiero potem wykonuje think(DT) i e.step(DT) (262–299). Zegar rzeczywisty służy do timeoutu i statystyki ms, nie do długości kroku gry (266–268, 283; DT w 20). **OK: dłuższa poprawna odpowiedź nie zabiera czasu w świecie gry.** Odpowiedź przekraczająca 5 minut podlega wspólnej obsłudze błędu opisanej w pkt 1.

**Zarzut krytyka:** „Claude odpowiadał szybciej, więc wcześniej strzelał” — nie znajduje potwierdzenia w tej pętli. „Jednej stronie skończył się cap” — możliwe, ale cap jest ten sam; liczba decyzji zależy też od wydarzeń i własnej taktyki.

**Najprostsza naprawa:** brak potrzebnej zmiany tego mechanizmu. Zachować jawne ustawienia cap/hands/effort w opublikowanym zobowiązaniu. Pełnej fizyki i równowagi areny nie certyfikuję tym sprawdzeniem.

### 3. Zamiana stron i losowanie rundy 3

**Werdykt: OK dla przypisania stron; DZIURA w zachowaniu zapisu po remisie.**

thirdSwap powstaje raz ze strumienia mecz-ai:strony przez porównanie z 0.5 (sedzia/sedzia.mjs:79–82). playerOf daje [0,1] w rundzie 1, [1,0] w rundzie 2, a w rundzie 3 jedną z tych par. Nie zależy od modelu ani wyniku konkretnej strony. Generator strumieni pochodzi z ziarna i nazwy (gra/src/sim/random.js:8–22; generator: gra/src/look/script.js:6–8). To uczciwy mechanizm organizacyjny przy uczciwie ustalonym ziarnie; nie przedstawiam go jako kryptograficznego dowodu idealnych 50.000…%.

thirdSwap jest zapisywany w pliku ustawienia.json razem z ziarnem (sedzia/sedzia.mjs:247); każda decyzja zapisuje player i side, a wynik rundy winnerSide i winner (244, 283). Można sprawdzić, kto faktycznie dostał którą stronę. Wygrane liczone są po graczach (243).

Zarzut r2, że remis zamienia strony, jest **sfalsyfikowany**: gra/src/fighter/round.js:107 zwiększa round tylko przy zwycięzcy. Niezależna próba rzeczywistego createRound dała before=1, after=1, winner=null. Jednak właśnie ten poprawnie zachowany numer wraz z wyzerowaniem used powoduje kolizję rawName. Próbka z rzeczywistego wyrażenia sędziego dała dwukrotnie 1A001.json. writeFileSync bez ochrony przed nadpisaniem w sedzia.mjs:290–291 zastąpi stare pliki. To defekt sędziego i kompletności archiwum, nie błąd zamiany stron ani dowód faworyzowania Claude'a. Pełnego meczu z remisem i późniejszego --sprawdz nie uruchamiałem; potwierdzona jest kolizja, a utrata archiwum wynika bezpośrednio z użytej operacji zapisu.

**Zarzut krytyka:** „Po remisie nie da się już odtworzyć wszystkich pierwotnych odpowiedzi”. To mocny, potwierdzony zarzut do sposobu zapisu. „Losowanie zależy od tego, że gra Claude” — brak potwierdzenia.

**Najprostsza naprawa:** osobny identyfikator każdego rozegrania, używany również w raw, promptach i replayu; bez zmiany playerOf ani zasad remisów.

### 4. Czy codexArgs wyłącza narzędzia, sieć, pamięć i konfigurację

**Werdykt: RYZYKO / NIESPRAWDZONE dla pełnego zapewnienia o lokalnej instalacji.**

W kodzie są --ignore-user-config, read-only, dziewięć --disable, web_search="disabled", agents.enabled=false, project_doc_max_bytes=0 i własna instrukcja (sedzia/gracze.mjs:63–69). To realne środki ograniczające dostęp; **OK jako intencja i konstrukcja wywołania**, a nie dowód całkowitego odcięcia.

Oficjalna dokumentacja OpenAI potwierdza, że --ignore-user-config pomija CODEX_HOME/config.toml, lecz nadal korzysta z tego katalogu do uwierzytelnienia; osobne --ignore-rules dotyczy plików polityk wykonywania poleceń. read-only ogranicza zapis, nie znaczy „zero odczytu”. --disable wyłącza wskazaną flagę funkcji, nie stanowi ogólnego przełącznika wyłączającego każdy obecny i przyszły typ narzędzia. Źródło: [CLI reference](https://learn.chatgpt.com/docs/cli/reference).

Dokumentacja wymienia osobno features.memories oraz memories.use_memories/generate_memories. W kodzie tych ustawień nie ma; obecnie opisana funkcja pamięci jest domyślnie wyłączona, więc sam brak flagi NIE dowodzi aktywnej pamięci. Instrukcja model_instructions_file jest udokumentowanym sposobem zastąpienia instrukcji bazowej. Nie potwierdziłem w lokalnym CLI znaczenia agents.enabled=false ani aktualności całej listy CODEX_DISABLED. Źródło: [Configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

CODEX_HOME jest stały (gracze.mjs:62); jedyny test jego przygotowania sprawdza istnienie auth.json (102). Nie ma tu testu pustej pamięci ani nowego profilu. Możliwa droga przeniesienia wiedzy z audytu to skopiowanie materiałów do tego profilu/pamięci lub udostępnienie ich przez odzyskane narzędzie. Samo zapisanie niniejszego raportu w repo nie wstrzykuje go do promptu gry: składanie promptu używa zasad, widoku i własnej notatki (sedzia.mjs:265), bez raportów audytu. Faktycznej zawartości profilu nie sprawdzałem i nie czytałem danych logowania.

**Zarzut krytyka:** „Codex dostał wiedzę audytora” — nie ma na to dowodu. „Osobny katalog nazywany świeżym jest w rzeczywistości stały i niezweryfikowany” — trafne. Wyłączenie web search nie wyłącza łączności samego CLI z usługą modelu; ta łączność jest konieczna do meczu i nie jest narzędziem gracza.

**Najprostsza naprawa:** zamrozić wersję, sprawdzić obsługiwane funkcje bez wywoływania modelu, jawnie wyłączyć pamięć i użyć profilu dedykowanego temu meczowi. Samo dodanie --ephemeral byłoby niekompletne: usuwa zapis sesji potrzebny obecnemu codexSessionModel (pkt 5). Nie zalecam w ciemno dopisywania niezweryfikowanych flag.

### 5. codexSessionModel i równoległe sesje

**Werdykt: OK dla zamiaru powiązania z thread_id; RYZYKO / NIESPRAWDZONE dla pewności identyfikacji.**

Funkcja bierze thread_id z stdout konkretnego wywołania i szuka pliku z tym identyfikatorem, zamiast brać „najnowszą sesję” (sedzia/gracze.mjs:88–95). Zwykłe równoległe sesje z różnymi identyfikatorami nie powinny się pomylić. Nie znalazłem podstaw do zarzutu, że sama równoległość wybiera obcy model.

Słabości: regex wymaga dokładnie zwartego zapisu JSON, nazwa pliku jest dopasowana przez includes, wybierany jest pierwszy pasujący plik i pierwszy pasujący tekst turn_context/model. Nie ma strukturalnego sprawdzenia session_meta.id, zgodności katalogu roboczego, czasu ani zakończonego zapisu. Brak pliku, zmiana formatu lub błąd odczytu kończy się cichym null. Brak modelu nie blokuje decyzji (gracze.mjs:109–111; sedzia.mjs:272–285).

Po meczu replay nie odczytuje ponownie modelu z zachowanego oryginalnego pliku sesji: kopiuje d.model z decyzje.jsonl (sedzia.mjs:200–203). W raw zapisywany jest stdout/stderr, nie źródłowy plik turn_context (290). **To informacja diagnostyczna, nie samodzielnie odtwarzalny dowód tożsamości modelu.**

**Zarzut krytyka:** „Model w logu mógł pozostać nieznany albo zostać opisany błędnie”. To zasadne ryzyko. „Na pewno odczyta inną równoległą sesję” — nieudowodnione.

**Najprostsza naprawa:** jawny model w zobowiązaniu i wywołaniu, strukturalne sprawdzenie sesji po pełnym ID, zachowanie minimalnego dowodu modelu z tej sesji oraz zatrzymanie przygotowania przy null lub niezgodności. Rzeczywisty format sesji zainstalowanego CLI pozostaje NIESPRAWDZONY.

### 6. Odczyt odpowiedzi Codexa --json

**Werdykt: OK dla zwykłej odpowiedzi i oddzielenia rozumowania; DZIURA w parseAnswer; RYZYKO w wyborze wiadomości i błędach transportu.**

Na faktycznych funkcjach audytowanego pliku odtworzyłem:

| Wejście syntetyczne | Wynik czytnika | Ocena |
|---|---|---|
| jedna zakończona agent_message + turn.completed | ok, właściwy rozkaz | OK |
| reasoning zawierające inny JSON + właściwa agent_message | rozkaz wyłącznie z agent_message | OK |
| dwie zakończone agent_message | wybiera ostatnią | deterministyczne; wymaga zgodności z formatem CLI |
| zakończona odpowiedź, potem pusta item.started/agent_message, następnie turn.completed | invalid, pusty tekst | ryzyko utraty poprawnej odpowiedzi przy takim strumieniu |
| poprawna wiadomość + zdarzenie error + turn.completed | cli_error | każde error dominuje, także przed późniejszym sukcesem |
| poprawny strumień, ale kod procesu 1 | ok | kod procesu ignorowany |
| dwa obiekty w jednym tekście | pierwszy obiekt | naruszenie wymogu jednego obiektu |
| uszkodzony zewnętrzny JSON z poprawnym rozkazem wewnątrz | wewnętrzny rozkaz | naruszenie odrzucenia niepoprawnego JSON-a |

Dowód implementacyjny: sedzia/gracze.mjs:33–42, 72–84. jsonLines ignoruje nieparsowalne linie. Zwykły tekst ostrzeżenia na stderr nie podmienia odpowiedzi przy poprawnym done; zdarzenie type=error już tak. Lista items miesza started z completed i nie filtruje po fazie/finalności wiadomości.

Oficjalna dokumentacja opisuje JSONL, zdarzenia item.*, turn.completed i error oraz osobne typy reasoning i agent_message: [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode). Nie dowodzi, że instalacja używana w meczu rzeczywiście wyprodukuje każdy syntetyczny wariant powyżej. Zatem scenariusze nietypowej kolejności i odzyskania po error to **RYZYKO**, nie potwierdzona awaria rzeczywistego wywołania.

**Zarzut krytyka:** „Sędzia odrzucił poprawną końcową odpowiedź albo sam wybrał rozkaz z uszkodzonej”. Pierwsze zależy od faktycznego strumienia, drugie jest odtworzone. Ten sam parseAnswer działa także dla Claude'a, więc nie jest specjalną ulgą dla niego.

**Najprostsza naprawa:** czytać zakończoną wiadomość końcową zgodnie ze schematem zamrożonego CLI, sprawdzać integralność zakończenia, a JSON parsować jako jeden obiekt. Rozróżnienie odzyskanego błędu transportu od ostatecznej porażki powinno wynikać z tego schematu.

### 7. drand, zobowiązanie i wzór ziarna

**Werdykt: OK dla deterministycznego wzoru; RYZYKO dla gwarancji publikacji i źródła odpowiedzi.**

Ziarno tajne i sól powstają z crypto.randomInt i randomBytes (sedzia/zobowiaz.mjs:66). Numer rundy wyliczany jest dla przyszłego czasu, domyślnie około 30 minut naprzód (23–24, 69). Publiczny zapis zawiera numer, łańcuch, czas, URL i opis wzoru (70–73). committedSeed sprawdza hash tajnego materiału, pobiera konkretną rundę i liczy ziarno (sedzia/sedzia.mjs:30–36); --sprawdz porównuje wynik z set.seed, jeśli jest ziarno.txt (42–46).

Wzór niezależny od repozytorium, dla wartości zapisanych przez generator:

1. secret: dziesiętny zapis całkowitego tajnego ziarna; salt: zapis szesnastkowy soli z ziarno.txt; randomness: tekst pola randomness odpowiedzi wybranej rundy drand.
2. H = SHA-256 bajtów UTF-8 tekstu secret + ":" + salt + ":" + randomness, bez spacji i końca linii.
3. V = liczba całkowita z pierwszych 8 cyfr szesnastkowych H.
4. seed = 1 + (V modulo 2147483646).

To odpowiada matchSeed w zobowiaz.mjs:56. Numer rundy wybiera randomness, ale sam nie jest dodatkowym składnikiem hasha. Opis matchSeedRule w 72 daje się odtworzyć standardową biblioteką SHA-256; warto dopisać kodowanie i kanoniczny zapis pól, bo kod obecnie ich nie waliduje.

Organizator nadal może wybierać ziarno, jeśli opublikuje zobowiązanie dopiero po ujawnieniu drand, poda starą rundę lub po poznaniu liczb wybierze spośród wielu wcześniej opublikowanych zobowiązań. Kod nie weryfikuje publicznego czasu publikacji; --czekaj umożliwia również odstęp inny niż domyślny (69). To nie obala poprawki r2 pod warunkiem jednej obowiązującej publikacji przed rundą. Sama data autora commita nie wystarcza jako niezależny dowód czasu upublicznienia.

drandAt sprawdza tylko status HTTP i zgodność numeru rundy (49–53), nie podpis ani format randomness. committedSeed używa stałej sieci z kodu, nie sprawdza zgodności deklaracji z.drand.chain/url z tą siecią (sedzia.mjs:34). Weryfikator polega więc również na aktualnej odpowiedzi usługi HTTPS. Nie sprawdzałem sieci drand ani nie próbowałem podmieniać odpowiedzi.

**Zarzut krytyka:** „Można było poczekać na drand i dopiero wskazać korzystny mecz”. Prawdziwy przy złej procedurze publikacji; nieudowodniony przy terminowym, pojedynczym zobowiązaniu. „Sędzia sam udowadnia termin publikacji” — nieprawda.

**Najprostsza naprawa:** jedno oficjalne zobowiązanie z niezależnym czasem publikacji przed wskazaną rundą, jawna historia ewentualnych anulowań, weryfikacja podpisu i kanonicznych pól odpowiedzi latarni. Ziarna nie należy traktować jako podpisu autentyczności wyjść modeli.

### 8. runtime i odmowa gry przy różnicy

**Werdykt: OK dla pól rzeczywiście porównywanych; RYZYKO dla kompletności zobowiązania.**

runtime obejmuje Node, V8, platformę, architekturę, hash instalacyjnego lockfile i three.module.js (sedzia/zobowiaz.mjs:42–45). Przy --mecz różnica JSON.stringify(runtime) powoduje odmowę (sedzia/sedzia.mjs:54–55). Odcisk kodu sędziego, źródeł gry i zasobów również jest porównywany przed grą (52–53; zobowiaz.mjs:21–37). **OK:** opisane w r2 pola runtime rzeczywiście są teraz w kodzie i w bramce startowej. Nie odtwarzałem odmowy pełnym uruchomieniem sędziego.

Pozostają poza skuteczną bramką: rzeczywista zawartość większości zależności, instalacje i wersje CLI, domyślne modele oraz stan i efektywne ustawienia profili/środowiska obu dostawców. Sam lockfile nie wykrywa edycji kodu biblioteki bez edycji lockfile. Vite realnie ładuje i przetwarza moduły gry (gra/scripts/sim-node.mjs:7, 17–20). Wersje CLI są zapisane, lecz nieporównane; nazwy modeli nie są ustawieniem zobowiązania (zobowiaz.mjs:62, 73).

--sprawdz ostrzega tylko o różnicy Node/V8 (sedzia.mjs:47–48), a pochodzenie ziarna sprawdza warunkowo (42–46). Nie porównuje całego fingerprint/runtime/cli z zobowiązaniem. Późniejsze porównanie promptów i kroków jest wartościowym dowodem odtworzenia przebiegu (198–203, 287–288, 309–312), ale nie potwierdza samo, że mecz rozegrano na opublikowanym środowisku. Również thirdSwap w ustawieniach jest metadanymi; weryfikacja faktycznego przebiegu wynika z ponownego wyliczenia i odtwarzania, nie z zaufania tej etykiecie.

**Zarzut krytyka:** „Wersje bibliotek się zgadzały, ale użyto zmienionego kodu albo innego CLI”. Bramki tego nie wykluczają. Nie znalazłem dowodu, że taka podmiana nastąpiła.

**Najprostsza naprawa:** objąć zobowiązaniem faktycznych wykonawców i konfigurację, porównać je przy starcie, a weryfikatorowi nadać osobne wyniki: zgodność przebiegu oraz zgodność z opublikowanym zobowiązaniem. Brak ziarno.txt lub materiału publikacji powinien pozostawać jawnie niezweryfikowany, zamiast rozszerzać znaczenie napisu PASS.

### 9. Najmocniejsze zarzuty po mojej ewentualnej przegranej

| Zarzut | Ocena prawdziwości na tym SHA |
|---|---|
| Po remisie nadpisano źródłowe odpowiedzi i nie zachowano pełnego dowodu meczu | **Potwierdzona dziura zapisu**, pkt 3; wystąpienie remisu w przyszłym meczu nie jest przesądzone |
| Sędzia wykonał rozkaz z odpowiedzi niebędącej poprawnym pojedynczym JSON-em | **Potwierdzona dziura parsera**, pkt 6; nie jest wymierzona tylko w Codexa |
| Zobowiązanie nie gwarantuje modelu/CLI, a profil nie został udowodniony jako świeży | **Prawdziwe ograniczenie dowodu**, pkt 1, 4, 5, 8; nie dowodzi użycia ukrytej pamięci lub słabszego modelu |
| Awaria dostawcy została potraktowana jako zużyta decyzja i gra trwała dalej | **Prawdziwe zachowanie kodu**, pkt 1; rzeczywiste wystąpienie NIESPRAWDZONE; polityka wymaga decyzji Ownera |
| Organizator dobrał ziarno po poznaniu drand | **Warunkowe ryzyko procedury**, pkt 7; trzeba ocenić konkretną publikację |
| Replay dowodzi autentycznego pochodzenia raw od dostawców | **Zarzut trafny jako ograniczenie dowodu**: raw jest lokalnym plikiem tekstowym (sedzia.mjs:290), a replay czyta go z dysku (200–203). Nie jest podpisem dostawcy; to już jawnie przyznano po r2 w KRONIKA, wiersz o surowym wyjściu CLI |
| Claude dostał więcej czasu gry, szerszy widok albo łagodniejszą walidację | **Niepotwierdzone; kod sędziego przeczy takiemu rozgałęzieniu**, pkt 2 |
| Remis sam zamienił strony | **Sfalsyfikowane** na module rundy, pkt 3 |
| Medium oznacza identyczną liczbę tokenów lub identyczną siłę obu modeli | **Nieuprawniona obietnica**, pkt 1; nie dowodzi stronniczości |

**Werdykt: RYZYKO dla obrony wyniku, z dwiema konkretnymi DZIURAMI opisanymi wyżej.** Najmocniejsza obrona to zachowanie pełnego archiwum, ścisły parser i jednoznaczne zamrożenie wykonawców przed meczem. Nie twierdziłbym po przegranej, że znalazłem specjalny bonus dla Claude'a — dowodów na to nie ma.

**Najprostsza naprawa:** naprawić dwie potwierdzone dziury, domknąć przygotowanie CLI i publikacji oraz uzyskać jawną decyzję Pawła o awariach usług. To propozycje organizacyjne, nie rozszerzenie reguł strzelanki.

## Zachowane niezależne reprodukcje

Poniższy skrypt można przekazać Node przez stdin w katalogu repo (tryb --input-type=module). Nie zapisuje plików i nie uruchamia modeli. Importuje rzeczywiste funkcje audytowanego kodu; źródło sędziego czyta tylko po to, by użyć dokładnego wyrażenia rawName. Przed ponownym użyciem należy sprawdzić SHA. To wąska reprodukcja, nie pełny mecz ani pełna regresja.

~~~js
import { readers, parseAnswer } from './sedzia/gracze.mjs';
import { createRound } from './gra/src/fighter/round.js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

assert.deepEqual(parseAnswer('{"move":"stay"}\n{"move":"leave_cover"}'),
  { move: 'stay' });
assert.deepEqual(parseAnswer('{"broken":, "inner":{"move":"stay"}}'),
  { move: 'stay' });

const msg = (id, text, type = 'item.completed') =>
  ({ type, item: { id, type: 'agent_message', text } });
const done = { type: 'turn.completed', usage: {} };
const run = events => ({ stdout: events.map(JSON.stringify).join('\n'),
  stderr: '', code: 0, timedOut: false });
const order = msg('a', '{"move":"stay"}');
assert.equal(readers.codex(run([order, done])).outcome, 'ok');
assert.equal(readers.codex(run([order,
  msg('b', '', 'item.started'), done])).outcome, 'invalid');
assert.equal(readers.codex({ ...run([order, done]), code: 1 }).outcome, 'ok');
assert.equal(readers.claude(run([
  { type: 'result', result: '{"move":"stay"}', is_error: false }
])).proof, null);

const player = { name: 'A', hp: 100, alive: true, reset() {} };
const foe = { name: 'B', hp: 100, alive: true, reset() {} };
const r = createRound({ player, foe, bot: { setLevel() {}, reset() {} },
  level: 'normal', auto: true });
r.update(100); // koniec odliczania
const before = r.view().round;
r.update(10000); // równe HP po upływie czasu -> remis
assert.equal(r.results[0].winner, null);
assert.equal(r.view().round, before);
r.update(100); r.update(100); // karta i odliczanie powtórki
const after = r.view().round;
const source = readFileSync('./sedzia/sedzia.mjs', 'utf8');
const expression = source.match(/const rawName = ([^;]+);/)[1];
const rawName = new Function('ctx', 'return ' + expression);
const oldName = rawName({ round: before, side: 'A', n: 1 });
const newName = rawName({ round: after, side: 'A', n: 1 });
assert.equal(oldName, newName);
console.log({ before, after, oldName, newName });
~~~

Zaobserwowane wyniki osobnych prób podczas audytu: zwykła wiadomość → ok; reasoning nie zastępuje odpowiedzi; dwie wiadomości → ostatnia; późne puste started → invalid; error mimo completed → cli_error; kod procesu 1 przy completed → ok; Claude bez init → ok z proof=null; obie niepoprawne całości JSON → {move:'stay'}; rzeczywisty remis → round 1 przed i po, rawName dwa razy 1A001.json. Powyższe asercje potwierdzają obecne zachowanie, a nie akceptację go jako pożądanego kontraktu.

## Dla Pawła

Uważam sam format — zatrzymany czas, wspólne ciało i zamianę stron — za uczciwy wobec Codexa. Nie znalazłem w sędzim specjalnego ułatwienia dla Claude'a. Przed oficjalnym meczem trzeba jednak naprawić nadpisywanie odpowiedzi po remisie i wybieranie rozkazu z uszkodzonego JSON-a. Trzeba też jednoznacznie ustalić, jakie modele i wersje CLI grają, potwierdzić świeże profile oraz opublikować jedno zobowiązanie przed właściwą rundą drand. Osobno potrzebna jest Twoja decyzja, co robimy przy awarii usługi modelu. Wtedy przegrana będzie znacznie trudniejsza do podważenia z powodów organizacyjnych. Ten audyt nie dowodzi jeszcze gotowości faktycznych instalacji CLI do meczu.

## Uściślenie Ownera po audycie — awaria dostawcy

**OWNER_ACCEPTED — Paweł, 28.10.2026, rozstrzygnięcie w rozmowie po dostarczeniu audytu.** Owner: „Powinien być unieważniony, ale procedura musi być czytelna i jasna bo ktoś powie, że model A wygrywał i został okradziony ze zwycięstwa lub na odwrót”. Po przedstawieniu poniższej procedury Owner polecił: „Dopisz do audytu jako moje uściślenie i oddaj dostawę CC”.

**Rozstrzygnięcie: potwierdzona awaria dostawcy podczas wywołania potrzebnego do rozegrania meczu unieważnia cały mecz, niezależnie od aktualnego wyniku.** To uściślenie zamyka OWNER_DECISION_NEEDED dotyczące polityki awarii w pkt 1, 9 i końcowym akapicie pierwotnego raportu. Nie oznacza, że audytowany kod już realizuje tę politykę; wcześniejsze ustalenia zachowano bez zmian jako zapis stanu na audytowanym SHA.

Procedura do opublikowania przed oficjalnym meczem:

1. **Jednoznaczny powód przerwania.** Limit dostawcy, przekroczenie ustalonego czasu odpowiedzi albo błąd usługi uniemożliwiający uzyskanie odpowiedzi. Błędny rozkaz modelu nie jest awarią dostawcy. Obecna kategoria cli_error wymaga rozróżnienia, ponieważ może obejmować również błąd lokalnego CLI; sama etykieta nie dowodzi awarii dostawcy.
2. **Natychmiastowe zatrzymanie gry.** Po wykryciu awarii sędzia nie wykonuje kolejnego kroku symulacji. Nie kontynuuje meczu na poprzednim rozkazie gracza pozbawionego odpowiedzi.
3. **Zachowanie całej próby.** Publikowane są dotychczasowe rundy, stan gry w chwili przerwania, surowy błąd i przyczyna unieważnienia. Materiał poprzedniej próby nie jest nadpisywany ani usuwany.
4. **Jawne oddzielenie prowadzenia od zwycięstwa.** Komunikat podaje fakty, np. „A prowadził 1:0; mecz unieważniony z powodu awarii dostawcy B”. Żadnej stronie nie przypisuje się zwycięstwa w unieważnionym meczu. Dotychczasowe prowadzenie pozostaje widoczne w archiwum.
5. **Nowy mecz jako nowa próba.** Jeżeli mecz zostanie rozegrany ponownie, zaczyna się od początku, z nowym zobowiązaniem i przyszłą rundą drand. Wszystkie unieważnione próby pozostają jawne. Nie wznawia się unieważnionego meczu od zachowanego wyniku.
6. **Bez unieważniania zakończonego meczu przez późniejszą awarię.** Awaria musi wystąpić podczas wywołania potrzebnego do jego rozegrania. Późniejsza niedostępność usługi nie odbiera już uzyskanego zwycięstwa.

Uzasadnienie jawności: prowadzący rzeczywiście traci możliwość dokończenia tej próby. Procedura nie ukrywa tego faktu; pozwala wykazać, że zastosowano wcześniej opublikowaną regułę jednakową dla obu stron, bez uznaniowej decyzji zależnej od aktualnego wyniku.

### Przekazanie dostawy do Claude Code (CC)

**Dostawa audytora: przygotowania/AUDYT_r3.md, wraz z powyższym uściśleniem Ownera.** Punkt odniesienia dla ustaleń technicznych: SHA 67ef30171da0ebf75c032422165afa1733f061c0. Audytor nie zmieniał kodu, nie wywoływał modeli i nie wykonał commita.

CC: zweryfikuj uwagi na wskazanym SHA i przygotuj poprawki organizacji meczu. Priorytetem są dwie odtworzone dziury: kolizje archiwum po remisie i wykonywanie fragmentów niepoprawnego JSON-a. Uwzględnij zaakceptowaną przez Ownera procedurę unieważnienia, w tym zatrzymanie symulacji, pełne archiwum próby i czytelny komunikat z wynikiem w chwili przerwania. Ryzyka i NIESPRAWDZONE z pkt 1–9 wymagają osobnego odniesienia; raport nie stwierdza, że każde z nich jest odtworzonym defektem. Weryfikacja techniczna nowej dostawy będzie dotyczyła jej nowego, dokładnego SHA; ten raport nie nadaje jej z góry PASS.
