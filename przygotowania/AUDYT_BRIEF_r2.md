# Brief audytu r2: organizacja meczu po poprawkach (dla Kimi)

Repozytorium: https://github.com/paweltpietraszko-ship-it/scribe-mecz-ai (gałąź `main`). Zlecił Paweł, autor gry, 28.10.2026. Audytor r2: Kimi, model, który w meczu nie gra (grają Claude Code i Codex). Autor sędziego to Claude Code, czyli jedna ze stron meczu, i dlatego zasady sprawdzają inne modele.

## Najważniejsza zasada tego audytu: tylko to, co widać w plikach

Paweł wybrał audytora za to, że nie zmyśla. Dlatego:
- **Każda uwaga musi wskazywać plik i linię albo cytować dosłowny fragment kodu lub tekstu.** Uwaga bez takiego dowodu się nie liczy.
- Jeśli czegoś nie da się sprawdzić z samego czytania (np. jak zachowa się program po uruchomieniu), napisz „NIESPRAWDZONE” i dlaczego. Nie zgaduj.
- Nie zakładaj treści plików, których nie otworzyłeś. Jeśli plik jest za długi, napisz, które części przeczytałeś.
- Jeśli coś jest w porządku, napisz krótko „OK” z dowodem. Nie szukaj problemu na siłę.

## Co to jest (krótko)

Mecz Claude Code kontra Codex w strzelance TPP *SCRIBE: THE ONE*, który modele rozgrywają same. Czas gry stoi, kiedy model myśli. Model wydaje rozkazy JSON, a ciało postaci wykonuje je częściami bota gry (oczy, ręce na poziomie „Normalny”, nogi), jednakowo dla obu. Szczegóły: `README.md`. Historia przygotowań: `przygotowania/KRONIKA.md`. Pierwszy audyt zrobił Gemini 3.8 Flash (`przygotowania/AUDYT_BRIEF.md`, `przygotowania/AUDYT_r1.md`; ścieżki `game/probe/...` z tamtych plików to dzisiejszy folder `sedzia/`).

## Pliki

| Plik | Co to |
|---|---|
| `sedzia/sedzia.mjs` | sędzia: mecz do 2 wygranych z zamianą stron, widok dla modelu (`view`), sprawdzanie rozkazu (`check`), budzenie (`reasons`), zapis, tryb sprawdzania `--sprawdz` |
| `sedzia/cialo.js` | ciało postaci: wykonanie rozkazu |
| `sedzia/gracze.mjs` | wywołanie Claude Code i Codexa bez narzędzi, odczyt surowego wyjścia CLI |
| `sedzia/zobowiaz.mjs` | zobowiązanie przed meczem: losowanie ziarna, skróty plików |
| `sedzia/zasoby.mjs`, `sedzia/zasoby.json` | pobieranie modeli i animacji z opublikowanej gry ze sprawdzeniem SHA-256 |
| `sedzia/gra.mjs` | ładowanie silnika gry z `gra/` |
| `sedzia/ZASADY_GRACZA.md` | zasady dla modeli (sędzia wstawia liczby w `{{...}}`) |
| `gra/` | kod gry i silnika (`gra/src/sim/engine.js`, `gra/src/bot/`, `gra/src/data/`), pochodzenie: `gra/ZRODLO.md` |
| `proby/3_2026-10-28_runda_probna/` | runda próbna sprzed audytu r1: `decyzje.jsonl` (polecenia i odpowiedzi modeli), `dziennik.log` |

## Pytania

Przy każdym podaj: werdykt (OK / DZIURA / RYZYKO / NIESPRAWDZONE), dowód (plik:linia albo cytat), co zarzuci nieżyczliwy krytyk, najprostszą naprawę.

### A. Czy poprawki po r1 są naprawdę w kodzie
1. Tabela „Poprawki po audycie r1” w `przygotowania/KRONIKA.md`: przy każdym wierszu sprawdź w kodzie, czy opisana zmiana jest. Wskaż linie. Jeśli opis w kronice mówi więcej niż kod, to jest DZIURA (kronika jest publiczna).

### B. Czy organizator może oszukać mimo zobowiązania
2. **Wybieranie ziarna.** `zobowiaz.mjs` losuje ziarno i publikuje jego skrót przed meczem. Czy organizator może uruchomić zobowiązanie wiele razy, prywatnie rozegrać mecze i opublikować tylko korzystne? Co by temu zapobiegło (np. publiczny znacznik czasu zobowiązania, zapowiedź terminu meczu, domieszanie publicznej losowości z przyszłości, obietnica publikacji każdego wyniku)?
3. **Sfałszowane odpowiedzi modeli.** `--sprawdz` sprawdza, że przebieg wynika z zapisanego surowego wyjścia CLI (`raw/`). Ale czy samo surowe wyjście da się podrobić od zera (np. napisać odpowiedzi ręcznie i zapisać jako wyjście CLI)? Co w zapisie mogłoby to utrudnić (identyfikatory sesji, użycie tokenów, nazwa modelu, czasy)? Co da się uczciwie obiecać, a czego nie?
4. **Kompletność odcisku plików** (`fingerprint` w `zobowiaz.mjs`). Co decyduje o przebiegu meczu, a nie jest objęte skrótem? Np. zainstalowane `node_modules` (skrót obejmuje tylko `package-lock.json`), wersja Node, system operacyjny, wersje CLI modeli.
5. **Zasoby z sieci** (`zasoby.mjs`): czy sprawdzenie skrótów wystarcza? Co się stanie, gdy gra zniknie z sieci?

### C. Nowy kod meczu
6. Zamiana stron i liczenie wygranych: `playerOf`, licznik `wins`, nadpisanie `MATCH.winsToWin` w `sedzia.mjs`. Czy wynik meczu zawsze trafia do właściwego gracza, także przy remisie (powtórka rundy) i w rundzie 3?
7. `inSight` w `sedzia.mjs` (stan bryły tylko w zasięgu wzroku): czy logika jest poprawna? Czy coś przecieka (np. wysokość bryły podawana, gdy jej nie widać)?
8. Trafienia z dziennika walki (`combatLog.listen` w `sedzia.mjs`): czy obie strony są traktowane jednakowo?
9. Budzenie (`reasons`): czy któraś reguła może zalać jedną stronę pytaniami albo ją uśpić? Szczególnie nowe: nieudany rozkaz budzi od razu, ostrzeżenie o biwaku przy 5 i 2 s.
10. Tryb `--sprawdz`: czy porównuje wszystko, co powinien (widok przez skrót, rozkaz, wynik, skrót kroków, stan końcowy)? Czy coś może przejść niezauważone?

### D. Uczciwość widoku i zasad
11. Czy `sedzia/ZASADY_GRACZA.md` zgadza się z silnikiem po poprawkach (format meczu, remis, notatka, odrzucona odpowiedź)? Każde nieprawdziwe zdanie to zarzut „sędzia wprowadził model w błąd”.
12. Lista brył w widoku obejmuje bryły w 15 m także za przeszkodą (tylko bez ich stanu). Kronika tłumaczy to pamięcią areny. Czy to obrona do przyjęcia, czy przewaga, której gracz nie ma?
13. Czy `README.md` i `KRONIKA.md` mówią coś, czego kod nie potwierdza?

## Wynik

Odpowiedź w jednym tekście (Paweł przeklei ją do repozytorium jako `przygotowania/AUDYT_r2.md`). Na górze: nazwa i wersja modelu audytora, lista dziur od najpoważniejszej z naprawą. Potem odpowiedzi 1–13. Na końcu krótko dla Pawła, prostym językiem: czy po r2 format jest gotowy do meczu i czego mu jeszcze brakuje. Nie proponuj zmian zasad gry SCRIBE ani wyglądu, tylko organizacji meczu.
