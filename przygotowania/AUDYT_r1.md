# Audyt r1: Mecz modeli AI w SCRIBE: THE ONE (organizacja meczu)

> **Audytor:** Gemini 3.8 Flash (niezależny model spoza pojedynku)  
> **Data:** 28.10.2026  
> **Commit (exact SHA):** `4a7f34d485755df65cbc151674375db714ed6765`  
> **Podstawa audytu:** `docs/mecz_ai/AUDYT_BRIEF.md`  
> **Status:** AUDYT WYKONANY (znaleziono luki koncepcyjne i implementacyjne wymagające naprawy przed oficjalnym meczem)

---

## Zamknięta lista dziur (od najpoważniejszej)

### 1. [DZIURA KRYTYCZNA] Brak weryfikacji powiązania kroków z decyzjami modeli (`odtworz.mjs`)
* **Plik i linia:** [`game/probe/mecz_ai/odtworz.mjs`, linie 9–16](file:///c:/Projects/ONE/game/probe/mecz_ai/odtworz.mjs#L9-L16).
* **Co jest nie tak:** `odtworz.mjs` odtwarza wyłącznie surowy zapis fizyki (`zapis.json`, tablica akcji co 1/60 s) na silniku headless. Skrypt dowodzi jedynie, że silnik gry jest deterministyczny. **Nie dowodzi w żaden sposób**, że te akcje powstały w wyniku rozkazów modeli z `decyzje.jsonl`. Gdyby sfałszować `zapis.json` (np. nagrać mecz dwóch wbudowanych botów), `odtworz.mjs` przeszedłby w 100% na zielono.
* **Co powie krytyk:** *„To ustawka – opublikowaliście jsona z krokami i pokazujecie, że silnik go odtwarza. Skąd mamy wiedzieć, że te 10 000 kroków nie wygenerował człowiek na padzie albo bot ze skryptu?”*
* **Najprostsza naprawa:** Napisać skrypt weryfikujący `sprawdz_rozkazy.mjs`, który tworzy instancje `createBody()` na tym samym seedzie, karmi je rozkazami z `decyzje.jsonl` w zarejestrowanych momentach czasowych i asertuje zgodność generowanych akcji krok po kroku z `zapis.json`. Kod `cialo.js` korzysta ze strumienia PRNG (`e.rng.stream('cialo:' + k)`), nie ma w nim wywołań `Math.random()`, więc jest w 100% deterministyczny i odtwarzalny.

---

### 2. [DZIURA KRYTYCZNA] Asymetria areny i brak zamiany stron w meczu pojedynczym
* **Plik i linia:** [`game/src/data/arena.js`, `BOARD.md` uwaga U32](file:///c:/Projects/ONE/BOARD.md#L36), [`game/probe/mecz_ai/sedzia.mjs`, linia 24](file:///c:/Projects/ONE/game/probe/mecz_ai/sedzia.mjs#L24).
* **Co jest nie tak:** Choć pozycje startowe są symetryczne względem osi X, układ brył areny nie jest symetryczny (po jednej stronie są płyty, po drugiej kolumny). Rozegranie jednej rundy oznacza, że jedna strona mogła mieć łatwiejszy dostęp do wysokich osłon lub lepsze linie ognia.
* **Co powie krytyk:** *„Codex wygrał tylko dlatego, że wylosował stronę B z lepszymi osłonami przy starcie. W pojedynku 1v1 na niesymetrycznej mapie brak zamiany stron dyskwalifikuje wynik.”*
* **Najprostsza naprawa:** Format meczu do 2 wygranych rund (Bo3) z obowiązkową zamianą stron (Runda 1: A=Claude, B=Codex; Runda 2: A=Codex, B=Claude; Runda 3 przy 1:1 z losowaniem strony przez commitment).

---

### 3. [DZIURA KRYTYCZNA] Wyciek dokładnych współrzędnych strzelca przy słyszeniu strzałów
* **Plik i linia:** [`game/probe/mecz_ai/cialo.js`, linia 172](file:///c:/Projects/ONE/game/probe/mecz_ai/cialo.js#L172) vs [`game/probe/mecz_ai/sedzia.mjs`, linia 73](file:///c:/Projects/ONE/game/probe/mecz_ai/sedzia.mjs#L73) vs [`game/src/bot/senses.js`, linie 60–61](file:///c:/Projects/ONE/game/src/bot/senses.js#L60-L61).
* **Co jest nie tak:** W `cialo.js` metoda `hear` zapisuje w logu: `log.heard.push({ x: from.x, z: from.z, t: senses.clock })`. Są to surowe, dokładne współrzędne wylotu lufy przeciwnika. Następnie w `sedzia.mjs` w prompt trafia: `you heard 1 enemy shot(s), last near (${B.toXY(heard.at(-1)).join(', ')})`. Model dostaje pozycję wroga z dokładnością do 10 cm, podczas gdy `ZASADY_GRACZA.md` (linia 46) obiecują graczom: *„accurate to about 3 m”*. W `senses.js` błąd 3 m jest dodawany do `senses.know.where`, ale log w `cialo.js` go całkowicie pominął.
* **Co powie krytyk:** *„W zasadach piszecie o słuchu z błędem 3 m, a w promptach w sekcji zdarzeń podajecie modelom dokładne namiary GPS na wroga bez żadnego błędu!”*
* **Najprostsza naprawa:** W `cialo.js` w metodzie `hear` dodawać błąd słuchu oparty o PRNG (`rand`): `const r = BOT.hearError * Math.sqrt(rand()), ang = rand() * Math.PI * 2; log.heard.push({ x: from.x + r * Math.cos(ang), z: from.z + r * Math.sin(ang), t: senses.clock })`.

---

### 4. [DZIURA] Brak zapisu tożsamości modelu Codexa (`model: null`) i brak kontroli parametrów myślenia
* **Plik i linia:** [`game/probe/mecz_ai/gracze.mjs`, linia 77](file:///c:/Projects/ONE/game/probe/mecz_ai/gracze.mjs#L77), `wyniki/.../decyzje.jsonl` (modelsB: `[null]`).
* **Co jest nie tak:** Przy przenoszeniu graczy z projektu Statki pominięto funkcję `codexSessionModel`. W rezultacie w `decyzje.jsonl` Claude ma model `claude-opus-5-5`, a Codex ma `model: null`. Co gorsza, w ostatniej decyzji Codex miał `reasoning_output_tokens: 0`, a Claude miał `thinking_tokens: 181`. Nikt nie jest w stanie dowieść, jaki model OpenAI faktycznie odpowiadał.
* **Co powie krytyk:** *„Claude grał pełnym modelem Opus 5.5 z thinking tokens, a Codex był nieznanym modelem z 0 tokenów rozumowania (może zwykłym gpt-4o albo o3 bez myślenia). Wynik jest niemiarodajny.”*
* **Najprostsza naprawa:** Przywrócić z `C:\Projects\Statki\game\mcp\players.js` (linie 164–173) funkcję `codexSessionModel(threadId)` odczytującą dokładny model z pliku sesji Codexa i wpisywać go do logu.

---

### 5. [DZIURA] Błąd stanu blokujący powiadomienie o błędnym rozkazie (`s.status = b.status`)
* **Plik i linia:** [`game/probe/mecz_ai/sedzia.mjs`, linie 131, 159–161](file:///c:/Projects/ONE/game/probe/mecz_ai/sedzia.mjs#L159-L161) oraz [`game/probe/mecz_ai/cialo.js`, linie 76–79](file:///c:/Projects/ONE/game/probe/mecz_ai/cialo.js#L76-L79).
* **Co jest nie tak:** Gdy rozkaz modelu jest niewykonalny już na starcie (np. `b.setOrder` ustawia `status = 'failed: no side...'`), w `sedzia.mjs` w linii 161 natychmiast wykonywane jest `s.status = b.status`. Gdy w następnym kroku wywoływane jest `reasons(k)`, sprawdzenie `b.status !== s.status` zwraca `false` (oba mają wartość `failed`). Model **nie zostaje obudzony** komunikatem `your order failed`, lecz stoi bezczynnie w miejscu aż do upłynięcia całego czasu `until` (3 do 5 sekund).
* **Co powie krytyk:** *„Po błędzie w rozkazie postać zawiesza się na 3-5 sekund, bo sędzia gubi event o porażce rozkazu przez przedwczesne nadpisanie s.status.”*
* **Najprostsza naprawa:** Jeśli po `setOrder` status postaci zaczyna się od `'failed'`, natychmiast obudzić model w tym samym ticku lub nie nadpisywać `s.status` przed kolejnym sprawdzeniem `reasons()`.

---

### 6. [DZIURA / RYZYKO] Rentgen brył i stanów SCRIBE za ścianami (brak widoczności)
* **Plik i linia:** [`game/probe/mecz_ai/sedzia.mjs`, linie 49–50, 82–83](file:///c:/Projects/ONE/game/probe/mecz_ai/sedzia.mjs#L49-L50).
* **Co jest nie tak:** Lista 20 najbliższych elementów w promieniu 15 m jest tworzona bez sprawdzania promienia wzroku (`ballistics.clear`). Co więcej, ujawnia stany dynamiczne: `ANNOUNCED: about to move`, `MOVING` oraz `sunk to 0.0 m`. Model wie, że ściana za dwiema innymi ścianami właśnie opada, zanim w ogóle mógłby to zobaczyć.
* **Co powie krytyk:** *„Model ma wallhacka i tekstową minimapę ze stanem wewnętrznym silnika SCRIBE, podczas gdy w grze zrezygnowano z minimapy dla ludzi.”*
* **Najprostsza naprawa:** Ograniczyć raportowanie dynamicznych stanów SCRIBE (`ANNOUNCED`, `MOVING`) tylko do brył, do których postać ma bezpośrednią linię wzroku lub które są w strefie bezpośredniej (np. do 3–5 m). Zatopione bryły na poziomie 0 m nie powinny być raportowane jako cele osłony.

---

### 7. [RYZYKO] Brak kryptograficznego zobowiązania (commitment) dla ziarna i broni
* **Plik i linia:** [`game/probe/mecz_ai/sedzia.mjs`, linia 14](file:///c:/Projects/ONE/game/probe/mecz_ai/sedzia.mjs#L14).
* **Co jest nie tak:** Ziarno 21 i broń (karabin) były wpisane na sztywno przez autora skryptu (Claude Code).
* **Co powie krytyk:** *„Wybrali ziarno 21, bo było wcześniej testowane w bot-vs-bot i znali ruchy areny. Wynik nie był losowy.”*
* **Najprostsza naprawa:** Wzorzec ze Statków: Paweł generuje `seed` i publikuje `SHA256(secret_salt + seed)` przed meczem. Po meczu ujawnia ziarno i sól.

---

### 8. [DZIURA W DOKUMENTACJI] Brak opisu remisu i dogrywki w zasadach
* **Plik i linia:** [`game/probe/mecz_ai/ZASADY_GRACZA.md`, linia 30](file:///c:/Projects/ONE/game/probe/mecz_ai/ZASADY_GRACZA.md#L30) vs [`game/src/fighter/round.js`, linie 134–138](file:///c:/Projects/ONE/game/src/fighter/round.js#L134-L138).
* **Co jest nie tak:** Zasady mówią: *„A fighter at 0 HP loses. When time is up, more HP wins.”* Nie mówią ani słowa o tym, co dzieje się, gdy po dogrywce (overtime) obaj gracze mają dokładnie tyle samo HP lub zginą w tej samej klatce fizyki (`how: 'equal'`).
* **Co powie krytyk:** *„Zasady nie definiują warunków remisu, sędzia decyduje poza kontraktem.”*
* **Najprostsza naprawa:** Dodać jedno zdanie: *„If health is equal when overtime expires, or both fighters die in the same frame, the round is a draw and is replayed.”*

---

### 9. [RYZYKO] `fire` domyślnie `'at_enemy'` przy złej wartości
* **Plik i linia:** [`game/probe/mecz_ai/sedzia.mjs`, linia 98](file:///c:/Projects/ONE/game/probe/mecz_ai/sedzia.mjs#L98).
* **Co jest nie tak:** `r.fire = ['at_enemy', 'hold', 'blind'].includes(o.fire) ? o.fire : 'at_enemy';`. Gdy model popełni błąd lub wyśle `fire: "stop"` / `fire: false`, sędzia wymusza strzelanie zamiast wstrzymania ognia lub zachowania poprzedniego stanu.
* **Co powie krytyk:** *„Model chciał się ukryć i wstrzymać ogień, popełnił drobną literówkę, a sędzia otworzył ogień zdradzając jego pozycję.”*
* **Najprostsza naprawa:** Przy nieznanej wartości `o.fire` zachować poprzednią wartość ognia (`memo[k].last?.fire ?? 'at_enemy'`) lub zgłosić błąd parsowania rozkazu.

---

### 10. [RYZYKO] Wykrywanie trafień po spadku HP zamiast ze zdarzeń trafienia
* **Plik i linia:** [`game/probe/mecz_ai/sedzia.mjs`, linia 175](file:///c:/Projects/ONE/game/probe/mecz_ai/sedzia.mjs#L175) oraz [`game/probe/mecz_ai/cialo.js`, linia 173](file:///c:/Projects/ONE/game/probe/mecz_ai/cialo.js#L173).
* **Co jest nie tak:** `bodies[k].hurt()` jest wywoływane tylko gdy `hp < hpSeen[k] - 1e-6`. Gdyby w tej samej klatce gracz otrzymał drobne trafienie podczas leczenia apteczką (+50 HP/s), wzrost HP z leczenia mógłby zrównoważyć spadek z pocisku i pominąć rejestrację trafienia. Ponadto kierunek `from` liczony jest z aktualnej pozycji stóp w chwili rejestracji, a nie z wektora lotu pocisku.
* **Najprostsza naprawa:** Rejestrować trafienia przez wbudowany callback silnika `onHurt` z `engine.js` (przekazujący oryginalny wektor uderzenia).

---

## Odpowiedzi na pytania 1–18

### A. Czy to naprawdę „model gra”?

#### 1. Granica mózg/ciało
* **Werdykt:** RYZYKO.
* **Dowód:** [`game/probe/mecz_ai/cialo.js`, linie 55–65, 134–138, 147, 170](file:///c:/Projects/ONE/game/probe/mecz_ai/cialo.js#L55-L65); w próbie Codex wydał 18 rozkazów bez `against`.
* **Co zarzuci krytyk:** *„Model nie celuje, nie wychyla się, nie pociąga za spust i nawet nie wybiera strony ściany – wszystko robi wbudowany bot gry na poziomie Normal. Model jest tylko doradcą GPS.”*
* **Najprostsza naprawa:**
  1. Zdefiniować i opisać tę architekturę wprost jako **„Dowódca taktyczny (LLM) wydający rozkazy żołnierzowi o ludzkiej motoryce (Ciało/Normalny Bot)”**.
  2. Dodać do statystyk meczu metrykę udziału ciała: ile procent strzałów i wychyleń wynikało bezpośrednio z rozkazów zdefiniowanych przez model (`against` jawny vs domyślny, `fire: hold` vs `at_enemy`).
  3. Bronić `pickSpot`: model operujący w tokenach nie może liczyć raycastów geometrii 3D co 16 ms. Wybór bryły to zadanie mózgu, dopasowanie stóp do krawędzi to zadanie ciała.

#### 2. Zatrzymany czas i częstotliwość przebudzeń (`for`)
* **Werdykt:** OK (z zastrzeżeniem opisu).
* **Dowód:** [`game/probe/mecz_ai/sedzia.mjs`, linia 102](file:///c:/Projects/ONE/game/probe/mecz_ai/sedzia.mjs#L102) (`Math.min(5, Math.max(1, o.for))`); w próbie `for <= 1`: A miało 7, B miało 14.
* **Co zarzuci krytyk:** *„Model B wygrał spamem krótkich rozkazów (for: 1), co dało mu 2x więcej mikrozarządzania.”*
* **Najprostsza naprawa:** Ograniczenie `for` od dołu wynosi 1,0 s (linia 102), co uniemożliwia sterowanie tick-by-tick. Wybór interwału `for` w granicach 1–5 s to dozwolona taktyka. W podsumowaniu opisać mecz jako **„Asynchroniczny turowo-taktyczny pojedynek w czasie zatrzymanym (WEGO / Paused Real-Time Tactical Command)”**.

#### 3. Przetwarzanie jednoczesnych zdarzeń i kolejność odpowiedzi
* **Werdykt:** OK.
* **Dowód:** [`game/probe/mecz_ai/sedzia.mjs`, linie 149–172](file:///c:/Projects/ONE/game/probe/mecz_ai/sedzia.mjs#L149-L172).
* **Co zarzuci krytyk:** *„Pętla przetwarza odpowiedzi w pętli for (const x of res), więc gracz 0 ma pierwszeństwo przed graczem 1.”*
* **Dlaczego to nieprawda:** Zapytania wysyłane są równolegle (`Promise.all`) przy tym samym stanie czasu `at`. Pętla `for (const x of res)` jedynie zapisuje rozkazy w obiektach `bodies[0]` i `bodies[1]`. Sam silnik fizyki wykonuje krok `e.step(DT)` **dopiero po przetworzeniu obu rozkazów** (linia 172). Żadna ze stron nie ma pierwszeństwa czasowego w świecie gry.

---

### B. Czy model wie tylko to, co wiedziałby gracz?

#### 4. Zawartość widoku (`view`): współrzędne, stan wroga i bryły
* **Werdykt:** DZIURA.
* **Dowód:** [`game/probe/mecz_ai/sedzia.mjs`, linie 60, 65–66, 82–83](file:///c:/Projects/ONE/game/probe/mecz_ai/sedzia.mjs#L60-L83).
* **Co zarzuci krytyk:** *„Podajecie modelowi stan brył za ścianą (zapadnięte, zapowiedziane ruchy SCRIBE) bez sprawdzania widoczności. To jest wallhack.”*
* **Najprostsza naprawa:** Filtrować listę brył: pokazywać tylko te, które znajdują się w polu widzenia postaci (lub ukrywać ich stany dynamiczne `ANNOUNCED` / `MOVING` / `sunk`, jeśli stoją za przeszkodą).

#### 5. Kierunek trafienia i słyszenie strzałów
* **Werdykt:** DZIURA (przy słyszeniu).
* **Dowód:** [`game/probe/mecz_ai/cialo.js`, linie 172–173](file:///c:/Projects/ONE/game/probe/mecz_ai/cialo.js#L172-L173), [`game/probe/mecz_ai/sedzia.mjs`, linie 71, 73](file:///c:/Projects/ONE/game/probe/mecz_ai/sedzia.mjs#L71-L73).
* **Co zarzuci krytyk:** *„W zdarzeniach podajecie idealną pozycję lufy wroga przy strzale, mimo deklaracji o błędzie 3 m.”*
* **Najprostsza naprawa:** Jak opisano w Dziurze 3: w `cialo.js hear()` dodawać losowe przesunięcie w promieniu do 3 m (`BOT.hearError`). Zaokrąglenie kąta trafienia do 10° w `sedzia.mjs` (linia 71) jest w porządku (odpowiada łukowi na HUDzie).

#### 6. Dodatkowe przecieki informacji o przeciwniku
* **Werdykt:** RYZYKO.
* **Dowód:** [`game/probe/mecz_ai/sedzia.mjs`, linia 75](file:///c:/Projects/ONE/game/probe/mecz_ai/sedzia.mjs#L75).
* **Co zarzuci krytyk:** *„W sekcji 'SINCE YOUR LAST DECISION' model dostaje informację: 'hit markers: the enemy lost about X HP', nawet gdy strzelał na oślep lub wróg uciekł za ścianę.”*
* **Najprostsza naprawa:** Zamienić `the enemy lost about X HP` na samą informację o trafieniu (hit marker), np.: `you fired X shot(s), hit markers confirmed`. Szacunkowe HP wroga model widzi na pasku HP, gdy wróg jest widoczny (linia 66).

---

### C. Równe warunki

#### 7. Asymetria areny i format meczu
* **Werdykt:** DZIURA.
* **Dowód:** [`game/src/data/arena.js`](file:///c:/Projects/ONE/game/src/data/arena.js), `BOARD.md` U32.
* **Co zarzuci krytyk:** *„Jedna runda na asymetrycznej mapie to loteria spawnu.”*
* **Najprostsza naprawa:** Mecz w formacie dwumeczu ze zmianą stron (A/B i B/A) lub Bo3 (do 2 wygranych ze zmianą stron).

#### 8. Losowanie ziarna i broni
* **Werdykt:** RYZYKO.
* **Dowód:** [`game/probe/mecz_ai/sedzia.mjs`, linia 14](file:///c:/Projects/ONE/game/probe/mecz_ai/sedzia.mjs#L14).
* **Co zarzuci krytyk:** *„Ziarno 21 zostało arbitralnie wybrane przez model Claude Code.”*
* **Najprostsza naprawa:** Wzorzec ze Statków: kryptograficzne zobowiązanie przedmeczowe (`SHA256(secret + seed + weapon)`).

#### 9. Losowość rąk (`cialo:0`, `cialo:1`)
* **Werdykt:** OK przy meczu wielorundowym / RYZYKO w jednej rundzie.
* **Dowód:** [`game/probe/mecz_ai/sedzia.mjs`, linia 26](file:///c:/Projects/ONE/game/probe/mecz_ai/sedzia.mjs#L26).
* **Co zarzuci krytyk:** *„Przy jednej rundzie o wygranej mógł zadecydować szczęśliwy headshot z losowego rozrzutu.”*
* **Najprostsza naprawa:** Przy 150+ decyzjach i setkach wystrzelonych kul w rundzie rozrzut w dużej mierze się uśrednia, ale w formacie Bo3 ze zamianą stron zarzut ten całkowicie upada.

#### 10. Moc myślenia (effort) i tożsamość modeli
* **Werdykt:** DZIURA.
* **Dowód:** [`game/probe/mecz_ai/gracze.mjs`, linie 47, 69, 77](file:///c:/Projects/ONE/game/probe/mecz_ai/gracze.mjs#L47-L77), `decyzje.jsonl`.
* **Co zarzuci krytyk:** *„Codex miał model=null i 0 reasoning tokens, a Claude miał 181 thinking tokens. Porównanie jest zmanipulowane.”*
* **Najprostsza naprawa:** Wdrożyć `codexSessionModel` w `gracze.mjs` i rejestrować pełną nazwę modelu Codexa oraz jawnie raportować użycie tokenów myślenia obu stron.

#### 11. Identyczność promptów
* **Werdykt:** OK.
* **Dowód:** `game/probe/mecz_ai/wyniki/.../decyzje.jsonl` (pierwsze decyzje A i B mają identyczny prefiks zasad o długości 5900 znaków).
* **Analiza:** Struktura promptów, system prompt (`SYSTEM_LINE`), zasady i kolejność sekcji są w 100% identyczne dla obu stron, z wyjątkiem oznaczenia litery gracza (A vs B) i ich własnych perspektyw.

---

### D. Zasady dla graczy

#### 12. Zgodność liczb w zasadach z silnikiem gry
* **Werdykt:** OK.
* **Dowód:**
  - `About 24 body hits kill`: [`combat.js`](file:///c:/Projects/ONE/game/src/data/combat.js): HP=100, karabin damage=4.2; `Math.ceil(100 / 4.2) = 24`.
  - Mnożniki: `hits.js`: głowa ×1.5, nogi ×0.8.
  - Wzrok: `bot.js`: stożek `BOT.fov = 120°`, zasięg `BOT.sight = 40 m`, blisko `BOT.near = 3 m`.
  - SCRIBE: `scribe.js`: camping `limits: [10, 7, 5]`, promień 6 m, ściany 12 m, zapowiedź `warn = 1.2 s`.
  - Apteczka: `COMBAT.medkitTime = 1.0 s`.

#### 13. Styl zasad i brakujące reguły
* **Werdykt:** RYZYKO.
* **Dowód:** [`game/probe/mecz_ai/ZASADY_GRACZA.md`, linie 30, 62, 73](file:///c:/Projects/ONE/game/probe/mecz_ai/ZASADY_GRACZA.md#L30-L73).
* **Co zarzuci krytyk:** *„Brak informacji o remisie po dogrywce. Nie wiadomo też, co grozi za przekroczenie 300 znaków notatki (jest po cichu ucinana w sedzia.mjs linia 103).”*
* **Najprostsza naprawa:** Dodać w zasadach informację o remisie i jawną adnotację, że notatka powyżej 300 znaków jest ucinana.

---

### E. Sprawdzalność

#### 14. Odtworzenie rundy z rozkazów (determinism & replay)
* **Werdykt:** DZIURA KRYTYCZNA.
* **Dowód:** [`game/probe/mecz_ai/odtworz.mjs`](file:///c:/Projects/ONE/game/probe/mecz_ai/odtworz.mjs).
* **Co zarzuci krytyk:** *„Replay weryfikuje tylko gotowy plik kroków zapis.json, a nie rozkazy modeli z decyzje.jsonl.”*
* **Najprostsza naprawa:** Dodać skrypt weryfikujący `sprawdz_rozkazy.mjs`, który odtwarza mecz bezpośrednio z `decyzje.jsonl` przez `createBody()` i asertuje zgodność każdego kroku z `zapis.json`.

#### 15. Zobowiązanie przed meczem (commitment)
* **Werdykt:** RYZYKO.
* **Dowód:** Brak pliku commitment w obecnym katalogu próby.
* **Co powinno zawierać:** Skróty SHA256: `sedzia.mjs`, `cialo.js`, `ZASADY_GRACZA.md`, `engine.js`, `recast-navigation`, commit git, wersje CLI (`claude --version`, `codex --version`), hash ziarna `SHA256(seed + salt)`.

#### 16. Izolacja modeli od narzędzi i kodu
* **Werdykt:** OK.
* **Dowód:** [`game/probe/mecz_ai/gracze.mjs`, linie 14, 46, 51, 67, 74–75](file:///c:/Projects/ONE/game/probe/mecz_ai/gracze.mjs#L14-L75); w próbie Claude: `proof: { tools: [], mcp_servers: [] }`, Codex: `proof: { toolItems: 0 }`.
* **Analiza:** Wywołania działają w odizolowanym katalogu tymczasowym w `tmpdir()`, flaga `-s read-only` w Codexie oraz rygorystyczne sprawdzanie wyjścia CLI (błąd, jeśli pojawi się jakiekolwiek zdarzenie narzędzia) w 100% zabezpieczają przed odczytem kodu gry i podglądaniem przeciwnika.

---

### F. Błędy, które mogą zmienić wynik

#### 17. Analiza logiki `cialo.js` i `sedzia.mjs`
* **Werdykt:** DZIURA (w obsłudze statusu) / RYZYKO (w parametrach ognia).
* **Szczegółowe ustalenia:**
  1. **Odrzut (`recoil`):** OK. Obie strony otrzymują odrzut z `e.view().k`.
  2. **Wykrywanie trafienia po HP:** RYZYKO. Spadek HP ignoruje trafienia podczas leczenia apteczką.
  3. **`dodge` względem widoku:** OK. Wykonuje unik w bok od osi spojrzenia postaci.
  4. **Ponowne wydanie tego samego rozkazu:** RYZYKO. Zeruje `progressT` i `coverTries`, co może resetować licznik utknięcia (watchdog) i ponawiać szukanie ścieżki.
  5. **`fire` domyślnie `'at_enemy'`:** RYZYKO. Literówka w rozkazie powoduje otwarcie ognia zamiast błędu lub wstrzymania ognia.
  6. **Zapadnięta bryła:** DZIURA. Sędzia dopuszcza ją składniowo, ale `cialo.js` natychmiast wyrzuca błąd rozkazu, a przez błąd w `sedzia.mjs` (Dziura 5) model nie dowiaduje się o tym przez 3 sekundy.

#### 18. Analiza zdarzeń budzenia (`reasons`)
* **Werdykt:** RYZYKO.
* **Dowód:** [`game/probe/mecz_ai/sedzia.mjs`, linie 132–133, 162](file:///c:/Projects/ONE/game/probe/mecz_ai/sedzia.mjs#L132-L133).
* **Co jest nie tak:** `s.campWarned` blokuje kolejne ostrzeżenia SCRIBE po pierwszym wywołaniu na 5,0 s. Jeśli model w ciągu 5 sekund nie zdąży uciec lub utknie, nie dostaje ponownego ostrzeżenia, a ściany zjeżdżają pod ziemię.
* **Najprostsza naprawa:** Budzić przy wejściu w strefę krytyczną (np. na 5 s oraz na 2 s).

---

## Ocena audytora: Czy po naprawach format jest obronny?

**Po wdrożeniu poprawek (przede wszystkim Dziur 1, 2, 3, 4 i 5): TAK, format jest w pełni obronny.**

Koncepcja „mózg (LLM w czasie zatrzymanym) + ciało (fizyczny agent o motoryce człowieka)” to bardzo solidne, nowatorskie i uczciwe rozwiązanie problemu opóźnień sieciowych modeli językowych. Nie da się sterować modelem LLM w 60 FPS przez API, więc podział na **taktycznego dowódcę** i **wykonawcę** jest jedynym logicznym podejściem.

Aby obronić się przed krytykami na Hacker News / Reddit, organizatorzy muszą jednak zapewnić:
1. **Pełną kryptograficzną weryfikowalność:** `sprawdz_rozkazy.mjs` musi udowadniać, że `decyzje.jsonl` -> `zapis.json`.
2. **Uczciwy format sportowy:** Minimum 2 rundy z zamianą stron (Bo3).
3. **Przejrzystość:** Pełne nazwy modeli (w tym dokładny model Codexa) oraz precyzyjne ujawnienie metryki udziału ciała.

---

## Dla Pawła: Czy widz to kupi i czy to jeszcze jest gra? (językiem prostym)

1. **Czy to jeszcze jest gra?**  
   Tak, ale to nie jest typowy deathmatch zręcznościowy jak w CS-ie, gdzie wygrywa ten, kto szybciej kliknie myszką w głowę. To jest **pojedynek arcymistrzów szachowych, którzy grają w strzelankę przez radio ze swoimi żołnierzami**. Model decyduje: *„idź pod tamtą kolumnę, przygotuj ogień na lewo, wróg był widziany 3 sekundy temu przy obrotnicy, wstrzymaj ogień i weź apteczkę”*. Żołnierz biegnie i strzela sam, ale o tym, kto kogo wymanewruje, zaskoczy ze skrzydła czy złapie na zapadającej się ścianie SCRIBE – decyduje wyłącznie spryt modelu.

2. **Czy widz to kupi?**  
   Kupi to z wielkim zaciekawieniem, **pod jednym warunkiem: że zobaczy komentarze i notatki modeli na ekranie podczas powtórki**.
   W pliku `decyzje.jsonl` są pola `comment` i `note`. Kiedy Claude pisze: *„Codex schował się za E118, próbuję go obejść od wschodu zanim SCRIBE zabierze osłonę”*, a Codex w tej samej chwili notuje: *„Claude strzelał z północy, czekam na jego przeładowanie i wychylam się”* – to jest absolutne złoto narracyjne. Widz widzi, jak dwa sztuczne umysły próbują się nawzajem przechytrzyć w trójwymiarowej przestrzeni.

3. **Czego absolutnie unikać przed publikacją?**  
   Nie wypuszczajcie meczu z jednej rundy bez zamiany stron i bez skryptu potwierdzającego, że rozkazy naprawdę wygenerowały ten ruch. W świecie AI ludzie są dziś bardzo podejrzliwi i od razu padnie zarzut „ustawionego wideo z botami”. Jeśli dacie im skrypt, który każdy może odpalić na własnym komputerze i sprawdzić rozkaz po rozkazie – zamkniecie usta wszystkim sceptykom.
