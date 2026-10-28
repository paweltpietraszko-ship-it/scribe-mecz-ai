# Kronika przygotowań meczu

Co, kiedy i dlaczego się zmieniało. Wpisy w kolejności dat. Poprawki po kolejnych audytach widać też w historii gita tego repozytorium. Pomysłodawcą i właścicielem gry jest Paweł. Sędziego napisał Claude Code, który jest też jedną ze stron meczu, i dlatego zasady audytują inne modele.

## 28.10.2026: pomysł i format

- Paweł: mecz ma być rozegrany **przez same modele**, a nie przez napisane przez nie boty („walka botów nikogo nie zainteresuje”). Jeśli modele nie dadzą rady rozegrać 3-minutowej rundy, pomysł odpada. Grają świeże instancje bez znajomości kodu, tylko z instrukcją gry. Bez mapki z góry, bo gracz-człowiek jej nie ma.
- Rozwiązanie Claude Code: czas gry stoi, kiedy model myśli. Model wydaje rozkazy, ciało postaci wykonuje je częściami bota gry (oczy, ręce na poziomie „Normalny”, nogi), jednakowo dla obu. Sędzia budzi model przy zdarzeniach. Wywołanie modeli bez narzędzi przeniesiono z sędziego meczu Statki (15.10.2026), gdzie było już sprawdzone.

## 28.10.2026: próby (folder `proby/`)

| Próba | Co pokazała |
|---|---|
| 1, Claude (A) kontra Codex (B), po 10 decyzji | Wszystkie rozkazy odrzucone przez **błąd sędziego**: odczyt odpowiedzi brał wewnętrzny obiekt JSON (`{"cover":"E57"}`) zamiast całego rozkazu. Odpowiedzi modeli były poprawne. Naprawione. |
| 2, jak wyżej | Gra działa: ruch od osłony do osłony, wymiana ognia, reakcja na zapadniętą osłonę. Pod ostrzałem sędzia budził model co klatkę trafienia (trzy pytania w 0,3 s). Naprawione: trafienie budzi raz na sekundę, kolejne trafienia trafiają do widoku jako zdarzenia. |
| 3, **pełna runda próbna** 180 s, ziarno 21, karabin | Wygrał Codex przez zabicie w 169,25 s. Claude zużył obie apteczki do 46. sekundy, Codex leczył się dopiero w 112. 148 i 154 decyzje, 0 odrzuconych, 35 minut zegarowych. Odtworzenie kroków z zapisu zgodne co do kroku (174 z 174 odcisków stanu). |

**Czym te próby nie są:** nie są meczem. Grały na zasadach sprzed audytu. Ziarno 21 wybrał Claude Code. Nie było zobowiązania przed grą. Nie zapisano surowego wyjścia CLI (jest tylko wyciągnięty z niego tekst odpowiedzi), więc można je odtworzyć fizycznie (`sedzia/odtworz.mjs`), ale nie da się udowodnić, że każdy krok wynika z odpowiedzi modelu. W rundzie próbnej były jeszcze dwie wady widoku, znalezione później w audycie i działające jednakowo na obie strony: słyszany strzał podawał **dokładne** położenie strzelca zamiast położenia z błędem około 3 m, a stan brył (zapowiedź ruchu, zapadnięcie) był widoczny także za ścianą. Kod, który grał rundę próbną, jest zachowany w `proby/3_2026-10-28_runda_probna/sedzia_wersja/` (gra: commit `df10f20` repozytorium gry). Kod prób 1 i 2 nie jest zachowany osobno, bo sędziego poprawiano między nimi.

## 28.10.2026: audyt r1 (`AUDYT_BRIEF.md`, `AUDYT_r1.md`)

- Paweł: zasady Claude Code przed prawdziwym meczem audytuje inny model, „żeby uniknąć zarzutu twojej stronniczości”, i ma szukać dziur, „do których może się przyczepić krytyk”.
- Brief był napisany dla Codexa, ale Codex nie miał limitu. Audyt zrobił **Gemini 3.8 Flash w Antigravity**, model, który w meczu nie gra (decyzja Claude Code, przyjęta przez Pawła). Każdą uwagę Claude Code sprawdził w kodzie przed poprawką.

## 28.10.2026: poprawki po audycie r1

| Pkt audytu | Zarzut | Co zmieniono |
|---|---|---|
| 1 / 14 | sprawdzenie nie łączy kroków gry z odpowiedziami modeli | `sedzia.mjs --sprawdz`: mecz rozgrywany od nowa z zapisanego surowego wyjścia CLI (`raw/`), tym samym kodem odczytu. Wymaga zgodności każdego widoku (skrót), rozkazu i kroku gry. Próba fałszerstwa (jedna podmieniona odpowiedź) daje FAIL. |
| 2 / 7 | jedna runda na niesymetrycznej arenie | mecz do 2 wygranych, zamiana stron po rundzie 1, strona w rundzie 3 z ziarna. Wygrane liczy sędzia po graczach (gra liczy je po stronach). |
| 3 / 5 | słuch podawał dokładne położenie strzelca | położenie z tym samym błędem co bot gry (do 3 m), z osobnego strumienia losowości |
| 4 / 10 | brak nazwy modelu Codexa, różna moc myślenia | nazwa modelu odczytywana z pliku sesji Codexa (jak w Statkach), **niesprawdzone do pierwszego prawdziwego wywołania**. Tokeny myślenia są zapisywane przy każdej decyzji. |
| 5 | rozkaz nieudany od razu nie budził modelu | budzi, model dostaje powód |
| 6 / 4 | stan brył za ścianą | stan bryły tylko wtedy, gdy postać ją widzi; inaczej „not in sight now”. Lista brył w 15 m zostaje jako pamięć areny (gracz zna arenę). |
| 7 / 8 / 15 | ziarno wybrane przez stronę meczu | `zobowiaz.mjs`: ziarno losuje i trzyma w tajemnicy autor gry. Przed meczem publikowany jest skrót ziarna z solą, odciski plików sędziego i silnika (z modelami postaci i broni), commit gry, wersje CLI i ustawienia. Sędzia odmawia gry przy niezgodności. |
| 8 / 13 | brak zasad remisu, ucinanie notatki | dopisane w zasadach dla modeli; także format meczu i co się dzieje po złej odpowiedzi |
| 9 | zła wartość `fire` zamieniała się na strzelanie | rozkaz odrzucany, poprzedni trwa, model dostaje powód |
| 10 | trafienia wykrywane po spadku HP | trafienia z dziennika walki gry. Audytor miał rację w jednym przypadku: daleki śrut ze strzelby (ok. 0,2 HP) ginął podczas leczenia (ok. 0,8 HP na klatkę). |
| 6 (pyt.) | „enemy lost about X HP” po strzale | tylko liczba wskaźników trafienia |
| 18 | ostrzeżenie o biwaku tylko raz | budzi przy 5 i przy 2 s |

Uwagi uznane za słabsze: „izolacja w 100%” to za mocne słowo, choć sama ocena jest słuszna.

## 28.10.2026: repozytorium meczu i jawny silnik

- Paweł: w repozytorium meczu ma być wszystko, co dotyczy przygotowań i samego meczu, bo zajrzy tu zainteresowany nerd. Poprawki po kolejnych audytach mają być widoczne jako dojrzewanie projektu.
- Paweł o silniku: „grę napisały modele, więc modele mogą je odtworzyć, a to znaczy, że silnik może być jawny”. Mecz ma być jawny i sprawdzalny jako ciekawostka. Kod gry jest więc w `gra/` (pochodzenie: `gra/ZRODLO.md`).
- Animacje są z Adobe Mixamo. Ich FAQ pozwala używać animacji w grach, ale nie pozwala rozpowszechniać samych plików animacji. Dlatego modele i animacje nie leżą w repozytorium. `sedzia/zasoby.mjs` pobiera je z opublikowanej gry i sprawdza skróty SHA-256 z `sedzia/zasoby.json` (12 plików, wszystkie zgodne 28.10). Na kopii silnika w repozytorium runda próbna odtwarza się co do kroku (174 z 174). Jeśli gra zniknie z sieci, pliki o tych skrótach może udostępnić autor gry.
- Sędzia domyślnie używa silnika z `gra/`. Zobowiązanie przed meczem obejmuje skróty kodu z `gra/`, zasobów pobranych do `gra/public/` i plików sędziego.

## 28.10.2026: audyt r2 (`AUDYT_BRIEF_r2.md`, `AUDYT_r2.md`)

- Paweł o wyborze audytora: „nie musi być najmądrzejszym modelem, ale najmniej skłonnym do halucynacji”. Brief r2 żądał przy każdej uwadze pliku i linii albo cytatu. Pisany był dla Kimi, ale Kimi nie odpowiedział, więc audyt zrobił **Qwen3.8**, model, który w meczu nie gra.
- Claude Code sprawdził każdą uwagę w kodzie. Cytaty audytora są trafne, ale numery linii często nie zgadzają się z plikami (np. `sedzia.mjs:85` zamiast 100, `sedzia.mjs:293` zamiast 234). Audytor napisał też, że nie ma dostępu do `gra/src/sim/engine.js`, choć silnik jest w repozytorium.

## 28.10.2026: poprawki po audycie r2

| Pkt audytu | Zarzut | Werdykt Claude Code i co zmieniono |
|---|---|---|
| 1 / 11 | zasady obiecują stan wszystkich brył w 15 m, a sędzia pokazuje go tylko widocznym | **trafne**. Zdanie w `ZASADY_GRACZA.md` poprawione: bryły w 15 m z pełną wysokością, a stan (zapadnięta, w ruchu, zapowiedziana) tylko wtedy, gdy postać ją widzi |
| 2 / 6 | powtórka po remisie może zamienić strony, jeśli silnik liczy remis jako rundę | **nietrafne**. Silnik zwiększa numer rundy tylko przy zwycięzcy: `gra/src/fighter/round.js:107` `if (who) { wins[who]++; score[who]++; round++; } else score.draws++;`. Bez zmian |
| 3 / 2 | organizator może losować zobowiązania do skutku | **trafne**, i to także bez rozgrywania meczów: wystarczy losować do korzystnej broni. Ziarno meczu zależy teraz od liczby z publicznej latarni losowości **drand** (League of Entropy, sieć quicknet, nowa liczba co 3 s). Zobowiązanie podaje numer rundy drand 30 minut naprzód. Ziarno meczu to skrót tajnego ziarna, soli i liczby drand z tej rundy. Zobowiązanie trzeba opublikować przed czasem tej rundy (czas wysłania na GitHub jest publiczny), a sędzia odmawia gry, zanim runda nadejdzie. Po meczu `--sprawdz` wylicza ziarno od nowa z zobowiązania, `ziarno.txt` i latarni |
| 4 / 4 | odcisk nie obejmuje Node, systemu i zainstalowanych bibliotek | **trafne**. Zobowiązanie zapisuje wersję Node i V8, system, architekturę, skrót `node_modules/.package-lock.json` (dokładne wersje zainstalowanego drzewa) i skrót `three.module.js` (matematyka silnika). Sędzia odmawia gry przy innym środowisku, a `--sprawdz` ostrzega przy innej wersji Node. Skrótu całego `node_modules` nie robimy: zmieniłby się po samym `npm ci` na innym komputerze |
| 3 | surowe wyjście CLI da się w teorii napisać ręcznie | **trafne i nienaprawialne** bez podpisu dostawcy modelu. Obiecujemy tylko tyle, ile da się sprawdzić: przebieg wynika z zapisanych odpowiedzi, a zapis jest kompletny (identyfikatory sesji, użycie tokenów, czasy) |
| 5 | gdy gra zniknie z sieci, zasobów nie da się pobrać | trafne, bez zmian w kodzie. Pliki o tych skrótach udostępni autor gry na prośbę, a skróty pozwalają sprawdzić, że to te same pliki |

Przy okazji: sędzia odmawia gry w katalogu, w którym mecz już był rozgrywany, bo w próbie na sucho podwójne uruchomienie dopisało decyzje do tego samego zapisu. Sprawdzone na sucho (gracze zastępczy, `--czekaj 3`): przed rundą drand sędzia odmówił, mecz rozegrał się po niej, `--sprawdz` dał `ziarno zgodne z zobowiązaniem i latarnią drand (runda 33457700)` i `SPRAWDZENIE: PASS (36 decyzji, 7879 kroków, ten sam wynik: stub)`, ponowny mecz w tym katalogu został odrzucony.

## 28.10.2026: audyt r3 (`AUDYT_BRIEF_r3.md`, `AUDYT_r3.md`)

- Audyt zrobił **Codex (GPT-6)**, czyli jedna ze stron meczu. To był świadomy wybór: strona, która mogłaby zostać skrzywdzona, najlepiej szuka przewagi drugiej strony i zna własne CLI. Konflikt interesów był nazwany w briefie. Instancja audytora nie gra: Codex w meczu startuje z nowego katalogu `CODEX_HOME`, bez pamięci i bez materiałów audytu.
- Wniosek Codexa: w sędzim nie ma ułatwienia dla Claude'a. Wskazał dwie odtworzone dziury i kilka ryzyk dowodowych, z reprodukcjami. Numery linii i cytaty się zgadzają.
- **OWNER_ACCEPTED 28.10.2026 (zasada awarii):** Paweł: „Powinien być unieważniony, ale procedura musi być czytelna i jasna, bo ktoś powie, że model A wygrywał i został okradziony ze zwycięstwa lub na odwrót”. Procedura jest w `AUDYT_r3.md` (sekcja „Uściślenie Ownera”) i w `README.md`.

## 28.10.2026: poprawki po audycie r3

| Pkt audytu | Zarzut | Werdykt Claude Code i co zmieniono |
|---|---|---|
| 1 / 3 | po remisie pliki surowych odpowiedzi powtórki nadpisują pliki rundy z remisem | **trafne**. Każde rozegranie rundy ma swój numer (rośnie także po remisie) w zapisie decyzji i w nazwie pliku (`1-1A001.json`). Sędzia przerywa, zamiast nadpisać istniejący plik |
| 2 / 6 | sędzia wykonywał rozkaz z wnętrza uszkodzonej odpowiedzi albo pierwszy z dwóch obiektów | **trafne**. Odpowiedź musi być jednym obiektem JSON i niczym więcej. Dozwolony jest tylko blok kodu markdown wokół niego, bo w rundzie próbnej Claude 18 razy na 302 decyzje tak odpowiedział. Zasady dla modeli mówią to wprost |
| awaria (1, 9) | błąd dostawcy zużywał decyzję i gra trwała dalej | **decyzja Pawła: unieważnienie**. Limit, przekroczony czas, błąd CLI, brak dowodu modelu i izolacji albo inny model niż w zobowiązaniu zatrzymują grę od razu, przed następnym krokiem. Zapis meczu zostaje, `koniec.json` podaje stan i przyczynę, nikt nie wygrywa. Nowy mecz wymaga nowego zobowiązania. Sprawdzone na sucho (`--awaria`, udawana awaria gracza zastępczego): gra stanęła w chwili awarii, a `--sprawdz` odtworzył to samo (`SPRAWDZENIE: PASS (31 decyzji, 791 kroków, ten sam wynik: mecz unieważniony, cli_error)`) |
| 3 / 5 / 8 | zobowiązanie nie zamraża modeli ani CLI | **trafne**. Zobowiązanie zapisuje modele graczy (domyślnie `claude-opus-5-5` i `gpt-6.1-sol`), a sędzia podaje je obu CLI. Inny model w odpowiedzi unieważnia mecz. Sędzia odmawia gry przy innych wersjach CLI. Model Codexa jest odczytywany z pliku sesji tego wątku (sprawdzone `session_meta.id`) i razem z mocą myślenia, trybem piaskownicy i listą dodanego kontekstu zapisywany w surowym wyjściu, więc sprawdzenie po meczu czyta go z zapisu |
| 4 | stały, współdzielony `CODEX_HOME`; Claude dziedziczy ustawienia użytkownika | **trafne**. Każdy mecz Codexa ma nowy katalog, do którego kopiujemy tylko `auth.json`. Wyłączonych jest więcej funkcji (lista z `codex features list` 0.162.1), w tym pamięć. Claude działa bez ustawień użytkownika (`--setting-sources project,local`) |
| 5 | skrót `.package-lock.json` nie wykrywa zmienionego kodu biblioteki | **trafne**. Zobowiązanie zawiera skrót treści wszystkich plików bibliotek, których kod wykonuje się w meczu: 35 pakietów, 3054 pliki (zależności three, recast-navigation, vite i wtyczki licencji) |
| 6 / 7 | odpowiedź drand przyjmowana bez weryfikacji; czas publikacji zobowiązania niesprawdzany | **częściowo naprawione**. Liczbę drand pobieramy z trzech serwerów i wszystkie, które odpowiedzą (co najmniej dwa), muszą podać to samo. Sprawdzamy też, że jest skrótem SHA-256 podpisu. Pełnej weryfikacji podpisu BLS nie robimy. Czasu publikacji kod nie sprawdzi: to procedura (jedno zobowiązanie w historii repozytorium przed rundą drand, każda próba jawna). Wzór ziarna jest w zobowiązaniu opisany co do kodowania |
| 6 | Codex: zdarzenie `error` (np. ponowienie połączenia) unieważniało poprawną turę; kod wyjścia ignorowany | **trafne**. O awarii decyduje `turn.failed` albo brak zakończonej tury. Niezerowy kod wyjścia to błąd CLI u obu graczy. Czytana jest tylko zakończona wiadomość |
| 8 | `--sprawdz` miesza zgodność przebiegu ze zgodnością z zobowiązaniem | **trafne**. Osobne wiersze: ZOBOWIĄZANIE (ustawienia, modele, środowisko i CLI meczu), ZIARNO, PLIKI WERYFIKATORA, ŚRODOWISKO WERYFIKATORA, SPRAWDZENIE (przebieg) |
| 1 | stała nazwa pliku instrukcji Codexa | trafne, każde wywołanie ma swój plik |

**Test prawdziwych CLI (28.10, po jednym krótkim pytaniu, nie mecz):** Claude odpowiedział `ok`, model `claude-opus-5-5`, `tools: []`, `mcp_servers: []`, `skills: []`, wtyczki tylko wbudowane w CLI (`cc-plugin-agents-md`, `cc-plugin-telemetry`, `cc-plugin-plugin-authoring`). Codex odpowiedział `ok`, model `gpt-6.1-sol` z pliku sesji, `effort: low`, `sandbox: read-only`. W pierwszej próbie wyłączenie `code_mode_host` dodało ostrzeżenie zapisane jako element `error`, które czytnik uznał za narzędzie. Ta flaga wróciła, a ostrzeżenia trafiają do dowodu. **Czego nie da się wyłączyć:** Codex CLI dokłada do kontekstu listę wbudowanych umiejętności (`<skills_instructions>`, około 3,4 tys. znaków), także w nowym katalogu. Zapis sesji pokazuje to przy każdej decyzji. Narzędzia do ich użycia są wyłączone.

**Łańcuch na sucho po poprawkach** (zobowiązanie, mecz graczy zastępczych, sprawdzenie): `ZOBOWIĄZANIE: ustawienia, modele, środowisko i wersje CLI meczu zgodne z zobowiązaniem`, `ZIARNO: zgodne z zobowiązaniem i latarnią drand`, `SPRAWDZENIE: PASS (36 decyzji, 9226 kroków, ten sam wynik: stub)`.

## Otwarte przed meczem

- Paweł zatwierdza modele graczy (domyślnie `claude-opus-5-5` i `gpt-6.1-sol`, moc myślenia `medium` dla obu).
- Codex może przejrzeć poprawki po r3 (opcjonalnie).
- Teksty publiczne (README) do zatwierdzenia przez Pawła.
