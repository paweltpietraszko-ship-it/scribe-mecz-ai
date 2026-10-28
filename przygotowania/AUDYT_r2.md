# Audyt r2 (Qwen3.8)

Brief: `AUDYT_BRIEF_r2.md` (pisany dla Kimi; Kimi nie odpowiedział, audyt zrobił Qwen3.8). Tekst poniżej to odpowiedź audytora wklejona przez Pawła bez zmian. Weryfikacja Claude Code i poprawki: `KRONIKA.md`, wpis „poprawki po audycie r2”.

---

**Audytor:** Qwen3.8
**Data:** 28 października 2026
**Repozytorium:** `paweltpietraszko-ship-it/scribe-mecz-ai` (gałąź `main`)

### Lista dziur i ryzyk (od najpoważniejszych)

1.  **DZIURA: Sędzia okłamuje model w `ZASADY_GRACZA.md` co do stanu brył (Pytania 11 i 12)**
    *   **Dowód:** `ZASADY_GRACZA.md` zawiera zdanie: *"You know the arena around you (the 20 nearest elements within 15 m **and whether they are up or sunk**...)"*. Jednak w kodzie sędziego (`sedzia.mjs:85`, funkcja `describe`) stan bryły (czy jest zapadnięta) jest ukrywany, jeśli nie znajduje się ona w linii wzroku (`!inSight`). Model dostaje wtedy tylko jej oryginalną wysokość (`el.H`) i dopisek `"not in sight now (its current state unknown)"`.
    *   **Zarzut krytyka:** Sędzia wprowadza model w błąd, obiecując mu wiedzę, której mu nie dostarcza. Model może budować taktykę opartą na fałszywym założeniu, że "wie", iż osłona za jego plecami jest nadal aktywna.
    *   **Naprawa:** Zmień zdanie w `ZASADY_GRACZA.md` na: *"You know the static arena around you (the 20 nearest elements within 15 m and their original shape; you only know their current state if you see them)."*
2.  **RYZYKO / NIESPRAWDZONE: Błędna zamiana stron przy powtórce rundy po remisie (Pytanie 6)**
    *   **Dowód:** Logika przypisywania stron opiera się na zmiennej `roundNo` pobieranej z silnika gry (`sedzia.mjs:293`: `roundNo = e.round.view().round`). Wzór w `sedzia.mjs:66` to: `const playerOf = (r, k) => ((r === 2 || (r >= 3 && thirdSwap)) ? 1-k : k);`.
    *   **NIESPRAWDZONE:** Nie mam dostępu do kodu silnika (`gra/src/sim/engine.js`), aby zweryfikować, czy silnik inkrementuje swój wewnętrzny licznik rund w przypadku remisu (powtórki). Jeśli silnik traktuje remis jako koniec rundy i zwiększa `roundNo`, to powtórka rundy 1 otrzyma `r=2`. Wzór sędziego uzna to za drugą rundę meczu i **dokona zamiany stron** (`1-k`), podczas gdy powtórka powinna odbyć się na tych samych stronach.
    *   **Naprawa:** Sędzia powinien śledzić własny licznik `matchRound` (1, 2, 3), inkrementowany wyłącznie gdy runda zakończy się zwycięstwem którejś ze stron (`w !== null`), i używać go do wyznaczania stron w `playerOf`.
3.  **RYZYKO: Brak mechanizmu zapobiegającego selekcji ziarna (Pytanie 2)**
    *   **Dowód:** `zobowiaz.mjs:31` losuje ziarno lokalnie za pomocą `crypto.randomInt`. Nic nie stoi na przeszkodzie, by organizator uruchomił skrypt 100 razy, rozegrał mecze testowe i opublikował tylko to zobowiązanie, w którym układ broni lub stron jest najkorzystniejszy.
    *   **Naprawa:** Hash pliku `ZOBOWIAZANIE.json` musi zostać opublikowany w sposób nieodwracalny z publicznym znacznikiem czasu (np. commit do publicznego repozytorium, wpis na X/Twitter, hash przyszłego bloku blockchain) **przed** rozpoczęciem meczu.
4.  **RYZYKO: Niepełny odcisk środowiska wykonawczego (Pytanie 4)**
    *   **Dowód:** `zobowiaz.mjs:14-23` hashuje pliki źródłowe i `package-lock.json`, ale pomija folder `node_modules`, wersję Node.js oraz system operacyjny. Złośliwy organizator mógłby użyć zmodyfikowanej biblioteki w `node_modules` (np. z inną fizyką), co zmieniłoby `stepsHash` w `--sprawdz`.
    *   **Naprawa:** Hashować całe `node_modules` (lub używać kontenera Docker z zahashowanym obrazem) oraz zapisać `process.versions` i `os.platform()` w `ZOBOWIAZANIE.json`.

---

### Odpowiedzi na pytania z briefu

#### A. Czy poprawki po r1 są naprawdę w kodzie
1.  **OK.** Wszystkie wiersze z tabeli w `KRONIKA.md` znajdują odzwierciedlenie w kodzie:
    *   *1/14 (sprawdzenie):* `sedzia.mjs:179-181` weryfikuje `sha(prompt)`, a `sedzia.mjs:233` (`replayer`) czyta surowe wyjście z folderu `raw/`.
    *   *2/7 (format):* `sedzia.mjs:64-66` implementuje `thirdSwap` i `playerOf`, `sedzia.mjs:272` pętlę do `WINS`.
    *   *3/5 (słuch):* `cialo.js:211` dodaje błąd `BOT.hearError * Math.sqrt(hearRand())`.
    *   *4/10 (Codex):* `gracze.mjs:111` (`codexSessionModel`) wyciąga nazwę modelu z pliku sesji.
    *   *5 (nieudany rozkaz):* `sedzia.mjs:242` i `sedzia.mjs:255` budzą model przy zmianie statusu na 'failed'.
    *   *6/4 (stan brył):* `sedzia.mjs:85` ukrywa stan, jeśli `!inSight`.
    *   *7/8/15 (ziarno):* `zobowiaz.mjs:31` losuje i hashuje z solą.
    *   *8/13 (remis/notatka):* `ZASADY_GRACZA.md` opisuje remis; `sedzia.mjs:168` ucina notatkę `.slice(0, 300)`.
    *   *9 (zły fire):* `sedzia.mjs:164` odrzuca zły `fire` (`['at_enemy', 'hold', 'blind']`).
    *   *10 (trafienia):* `sedzia.mjs:266` nasłuchuje `combatLog`.
    *   *6 pyt. (wskaźniki):* `sedzia.mjs:138` pokazuje tylko `hit marker(s)`.
    *   *18 (biwak):* `sedzia.mjs:22` (`CAMP_WAKE = [5, 2]`) i `sedzia.mjs:248` budzą przy 5 i 2 s.

#### B. Czy organizator może oszukać mimo zobowiązania
2.  **RYZYKO.** Tak, może wygenerować wiele ziaren lokalnie i wybrać najlepsze. Zapobiegłoby temu: (a) publiczna publikacja hashu zobowiązania z niezależnym timestampem (np. GitHub commit, post w social media) przed meczem, (b) użycie publicznej losowości (np. VRF, hash przyszłego bloku krypto) jako części ziarna.
3.  **RYZYKO.** Surowe wyjście (`raw/`) to pliki tekstowe (JSONL stdout). Teoretycznie da się je spreparować ręcznie, pod warunkiem idealnego odtworzenia struktury `stream-json` (w tym zdarzeń `init` z pustą listą narzędzi dla Claude). Utrudnia to fakt, że `gracze.mjs` zapisuje pełny stdout (w tym `session_id` i czasy `ms`), co wymagałoby od oszusta wygenerowania spójnego ciągu zdarzeń.
    *   *Co da się uczciwie obiecać:* Że pliki w `raw/` to wierny, nieedytowany zrzut stdout/stderr z wywołania CLI.
    *   *Czego nie da się udowodnić:* Że ten zrzut powstał w czasie rzeczywistym podczas meczu, a nie został wygenerowany ręcznie po fakcie (chyba że użyto by zewnętrznego proxy podpisującego ruch lub TEE).
4.  **RYZYKO.** Odcisk nie obejmuje: folderu `node_modules` (tylko `package-lock.json`), wersji Node.js, systemu operacyjnego i architektury CPU (różnice w `floating-point` mogą zmienić `stepsHash` i fizykę). Wersje CLI są poprawnie zapisywane (`gracze.mjs:150`). Naprawa: hashowanie `node_modules` lub użycie Dockera oraz zapisanie `process.versions` w zobowiązaniu.
5.  **OK.** Sprawdzenie SHA-256 plików zasobów (`zasoby.mjs`) jest wystarczające przeciwko podmiance. Jeśli gra zniknie z sieci, `zasoby.mjs` zawiedzie. Obrona: autor gry udostępnia pliki, ale wymaga to zaufania. Najlepiej, aby pliki o tych hashach były zarchiwizowane publicznie (np. w osobnym repozytorium "assets" lub na IPFS).

#### C. Nowy kod meczu
6.  **NIESPRAWDZONE / RYZYKO.** Logika `playerOf(roundNo, w)` opiera się na `e.round.view().round`. Jeśli silnik gry inkrementuje licznik rund przy remisie, to powtórka rundy 1 dostanie `roundNo = 2`, co w kodzie sędziego (`sedzia.mjs:66`) spowoduje błędną zamianę stron. Wymaga to weryfikacji w `gra/src/sim/engine.js` lub wprowadzenia osobnego licznika `matchRound` w sędziem.
7.  **OK.** Logika `inSight` (`sedzia.mjs:82`) rzuca promień do środka bryły z tolerancją `half`. Nic nie przecieka: stan `el.pose.h` jest ukrywany, gdy `!seen` (`sedzia.mjs:85`). Jedynym minusem jest to, że szeroka bryła zasłonięta przez słup na środku może zostać uznana za "niewidoczną", ale to błąd na niekorzyść gracza, więc nie daje przewagi.
8.  **OK.** `combatLog.listen` (`sedzia.mjs:266`) traktuje strony symetrycznie (`whom === 'A'` -> `k=0`, `whom === 'B'` -> `k=1`).
9.  **OK.** Reguły `reasons` (`sedzia.mjs:245`) mają wbudowane ograniczenia czasowe (np. `HIT_QUIET = 1.0` s dla trafień, 3 s dla strzałów). Nieudany rozkaz budzi raz (zmiana statusu). Ostrzeżenie o biwaku (`CAMP_WAKE = [5, 2]`) inkrementuje `s.camp`, więc odpala się dokładnie dwukrotnie (przy 5s i 2s). Nie ma ryzyka zalania pytaniami.
10. **OK.** Tryb `--sprawdz` (`sedzia.mjs:306`) porównuje `stepsHash` (skrót wszystkich kroków silnika), `finalState`, liczbę kroków, zwycięzcę oraz skrót każdego promptu i surowe odpowiedzi. Jeśli środowisko jest identyczne, fałszerstwo jest niemożliwe (chaos w fizyce gry uniemożliwia ręczne ułożenie plików `raw/` dających ten sam `stepsHash`).

#### D. Uczciwość widoku i zasad
11. **DZIURA.** `ZASADY_GRACZA.md` twierdzi: *"You know the arena around you (the 20 nearest elements within 15 m **and whether they are up or sunk**)"*. Kod (`sedzia.mjs:85`) pokazuje stan (czy są zapadnięte) **tylko** dla brył w zasięgu wzroku (`inSight`). Sędzia wprowadza model w błąd. (Patrz Lista Dziur #1).
12. **RYZYKO.** Kronika tłumaczy to "pamięcią areny". Jest to obrona do przyjęcia w kontekście meczu AI-vs-AI (obie strony mają ten sam, nieco ograniczony widok). Względem człowieka model jest na gorszej pozycji (nie słyszy/zauważa zmian stanu za plecami), ale nie daje to nieuczciwej przewagi żadnej ze stron meczu. Pod warunkiem poprawki w `ZASADY_GRACZA.md` (usunięcie obietnicy "whether they are up or sunk" dla niewidocznych brył).
13. **OK.** `README.md` i `KRONIKA.md` są spójne z kodem. `README` poprawnie opisuje format, tryb `--sprawdz` i strukturę folderów. `KRONIKA.md` poprawnie dokumentuje historię i poprawki.

---

### Krótko dla Pawła

Paweł, po audycie r2 format jest **bardzo bliski ideałowi**, ale masz jedną poważną dziurę w komunikacji z modelem: Twoje zasady (`ZASADY_GRACZA.md`) obiecują modelowi, że będzie znał stan (zapadnięcie) wszystkich brył w promieniu 15 metrów, podczas gdy Twój sędzia słusznie ukrywa ten stan, jeśli bryła jest za ścianą. Model może poczuć się "oszukany" przez własnego sędziego i stracić zaufanie do promptu. Zmień jedno zdanie w zasadach, żeby to sprostować (napisałem dokładnie jakie w raporcie).

Drugą rzeczą, której brakuje do pełnego zaufania publicznego, jest **niezależny dowód na to, że nie wybrałeś ziarna "na chybił trafił"**. Wrzuć hash `ZOBOWIAZANIE.json` na publicznego Twittera/X albo do commita w innym repozytorium na kilka godzin przed meczem. To zamyka usta krytykom, którzy mogliby twierdzi, że wygenerowałeś 100 ziaren i wybrałeś to, w którym Codex ma lepszą stronę.

Trzecia uwaga (techniczna): upewnij się, że silnik gry nie inkrementuje licznika rund przy remisie, bo sędzia może przez pomyłkę zamienić strony przy powtórce. Najlepiej dodaj w sędziem własny licznik rund meczowych.

Poza tym kod sędziego jest bardzo solidny, a zabezpieczenia przed fałszerstwem kroków (`--sprawdz`) działają bez zarzutu. Powodzenia w meczu!
