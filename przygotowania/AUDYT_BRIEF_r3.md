# Brief audytu r3: organizacja meczu po audytach r1 i r2 (dla Codexa)

Repozytorium: `C:\Projects\scribe-mecz-ai` (publiczne: https://github.com/paweltpietraszko-ship-it/scribe-mecz-ai, gałąź `main`). Zlecił Paweł, autor gry, 28.10.2026.

## Kim jesteś w tym audycie

Jesteś Codexem, czyli **jedną ze stron meczu**. Sędziego napisał Claude Code, druga strona. Dwa poprzednie audyty zrobiły modele, które nie grają: Gemini 3.8 Flash (r1) i Qwen3.8 (r2). Ten audyt ma inną wartość: patrzysz jako strona, która mogłaby zostać skrzywdzona. Szukaj przede wszystkim wszystkiego, co mogłoby dać przewagę Claude'owi albo zaszkodzić Codexowi, także nieumyślnie. Ten konflikt interesów zapiszemy w kronice otwarcie.

Instancja Codexa, która zagra w meczu, jest świeża. Działa z osobnym `CODEX_HOME` (`%LOCALAPPDATA%\Statki\codex-home`), bez narzędzi i bez Twojej pamięci z tej sesji. Jeśli widzisz drogę, którą wiedza z tego audytu mogłaby do niej trafić, to też jest uwaga.

## Zasady

- **Nie zmieniaj kodu ani zasad.** Jedyny plik, który tworzysz, to raport `przygotowania/AUDYT_r3.md`. Nie commitujesz.
- Każda uwaga musi wskazywać plik i linię (sprawdź numer w pliku) albo cytować dosłowny fragment. Czego nie da się sprawdzić, oznacz jako NIESPRAWDZONE i podaj powód. Gdy coś jest w porządku, napisz krótko „OK” z dowodem.
- Wolno uruchomić najwyżej raz `node sedzia/sedzia.mjs --p0 stub --p1 stub --n 8` (gracze zastępczy, bez modeli). **Nie wywołuj modeli**, ani Claude, ani Codexa.
- Najpierw przeczytaj: `README.md`, `przygotowania/KRONIKA.md`, `przygotowania/AUDYT_r1.md`, `przygotowania/AUDYT_r2.md`.

## Pytania

Przy każdym podaj werdykt (OK / DZIURA / RYZYKO / NIESPRAWDZONE), dowód, zarzut krytyka i najprostszą naprawę.

### A. Symetria między graczami (najważniejsze)
1. `sedzia/gracze.mjs`: porównaj wywołanie Claude Code i Codexa. Chodzi o polecenie systemowe i plik instrukcji, moc myślenia (`--effort` u Claude, jej odpowiednik u Codexa), limit czasu, ponowienia, katalog roboczy oraz odczyt odpowiedzi (`readClaude`, `readCodex`, `parseAnswer`). Czy któryś gracz dostaje więcej albo mniej?
2. `sedzia/sedzia.mjs`: czy widok (`view`), sprawdzanie rozkazu (`check`), budzenie (`reasons`) i limit decyzji (`cap`) zależą w jakikolwiek sposób od tego, który model gra, a nie od strony? Czy czas myślenia modelu wpływa na grę (gra ma stać)?
3. Strony areny i zamiana stron (`playerOf`, `thirdSwap`): czy przy 1:1 runda 3 jest losowana uczciwie i czy to widać w zapisie?

### B. Codex CLI (znasz go najlepiej)
4. Czy flagi w `codexArgs` naprawdę wyłączają wszystkie narzędzia, sieć, pamięć i konfigurację użytkownika w aktualnej wersji Codex CLI? Czy czegoś brakuje albo coś jest zbędne lub nieaktualne?
5. `codexSessionModel`: czy nazwa modelu z pliku sesji będzie poprawna i czy na pewno pochodzi z bieżącego wywołania (np. przy równoległych sesjach)?
6. Czy odpowiedź Codexa w formacie `--json` może zostać źle odczytana, na przykład przez kilka wiadomości, wiadomość z rozumowaniem, ostrzeżenie albo błąd?

### C. Poprawki po r2
7. Ziarno z latarnią drand (`zobowiaz.mjs`: `drandAt`, `matchSeed`, numer rundy; `sedzia.mjs`: `committedSeed`). Czy organizator nadal może wybrać ziarno? Czy wzór ziarna jest jednoznaczny i czy da się go sprawdzić bez kodu tego repozytorium?
8. Zapis środowiska (`runtime`) i odmowa gry przy różnicy: czy jest poprawna? Czy coś ważnego dla przebiegu nadal nie jest objęte zobowiązaniem?

### D. Krytyk
9. Gdybyś przegrał ten mecz i chciał podważyć wynik, czego byś się uczepił? Wymień najmocniejsze argumenty i oceń, które są prawdziwe.

## Wynik

Zapisz raport w `przygotowania/AUDYT_r3.md`. Na górze wpisz nazwę i wersję modelu (tę, którą znasz ze swojej sesji), a pod nią listę dziur od najpoważniejszej, każdą z naprawą. Potem odpowiedzi 1–9. Na końcu napisz kilka zdań dla Pawła, prostym językiem po polsku: czy uważasz format za uczciwy wobec siebie i czego jeszcze brakuje do meczu. Nie proponuj zmian zasad gry SCRIBE ani jej wyglądu, tylko organizacji meczu.
