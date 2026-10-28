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

## 28.10.2026: decyzje przed meczem

- **OWNER_ACCEPTED 28.10.2026:** modele graczy `claude-opus-5-5` (Claude Code) i `gpt-6.1-sol` (Codex), moc myślenia `medium` dla obu.
- **OWNER_ACCEPTED 28.10.2026:** Paweł: „Jeśli któremuś z graczy skończy się limit danych, to potraktujemy to jako awarię i partia zostanie uznana za awarię”. Tak działa sędzia: `limit` jest na liście awarii unieważniających mecz.
- Paweł: ostatni audyt Codexa jest opcjonalny („jak nie, to możesz puszczać mecze”). Claude Code zdecydował **bez audytu r4**. Codex jest graczem, a każde jego wywołanie zużywa ten sam limit, którego wyczerpanie w meczu unieważnia partię. Poprawki po r3 sprawdzono testem na sucho i jednym prawdziwym wywołaniem każdego CLI.
- Zobowiązanie i mecz uruchamia Claude Code na słowo Pawła. Organizator nie może wybrać ziarna, bo zobowiązanie trafia do publicznego repozytorium przed rundą drand, z której pochodzi część ziarna.
- Teksty publiczne (README) do zatwierdzenia przez Pawła.

## 28.10.2026: próba 1 meczu unieważniona (`mecze/2026-10-28_claude-codex/`)

- Zobowiązanie opublikowane o 09:19 UTC (commit `b3f969e`), runda drand 33459191 o 09:48:57 UTC, start sędziego o 09:49:25 UTC. Po dwóch decyzjach każdej strony (1,5 s gry, 0:0) aktualizacja Claude Code o 09:49:49 UTC podmieniła `claude.exe` i trzecie wywołanie Claude'a się nie uruchomiło (`spawn UNKNOWN`). Sędzia upadł, zamiast zapisać awarię.
- Według zasady Pawła mecz jest unieważniony. Cały zapis i tajne ziarno są opublikowane (`NIEWAZNY.md`); ziarno zgadza się ze skrótem w zobowiązaniu i z latarnią drand.
- Poprawki: mecz gra na kopiach obu programów w katalogu meczu (`%LOCALAPPDATA%\scribe-mecz-ai\cli\<mecz>`), zobowiązanie zawiera skróty SHA-256 plików obu programów, błąd uruchomienia programu to `cli_error`, a upadek sędziego po starcie gry jest zapisywany jako unieważnienie. Sprawdzone jednym wywołaniem każdego modelu z kopii: oba `ok`, modele `claude-opus-5-5` i `gpt-6.1-sol`.

## 28.10.2026: próba 2 meczu unieważniona (`mecze/2026-10-28_claude-codex_2/`)

- Start o 10:22:53 UTC, po rundzie drand. Rundę 1 wygrał Codex przez zabicie w 94,3 s. W rundzie 2, w 178,65 s, przy stanie meczu 0:1 i HP 40:33 dla Codexa, Claude'owi skończył się 5-godzinny limit. Mecz jest unieważniony (zasada Pawła), a sędzia zatrzymał grę i zapisał stan, tak jak powinien. Szczegóły i zużycie tokenów: `NIEWAZNY.md`.
- Wniosek: pełna runda to około 100–200 wywołań każdego modelu, a mecz do 2 wygranych nie zmieścił się w jednym 5-godzinnym oknie limitu Claude'a, który w tym samym czasie zużywała też rozmowa z Claude Code prowadzącym mecz.
- Poprawki: wzorzec limitu rozpoznaje „hit your 5-hour limit” (zapisano `cli_error` zamiast `limit`; skutek ten sam). Oczekiwanie na rundę drand skrócono z 30 do 5 minut, bo zobowiązanie wysyła na GitHub skrypt w kilka sekund.
- **OWNER_ACCEPTED 28.10.2026 (przerwy):** Paweł wybrał przerwy między rundami. Mecz z zobowiązaniem staje po każdej rundzie, także po remisie (`przerwy.jsonl`: krok, wynik, skrót stanu). `--mecz <katalog> --dalej` rozgrywa mecz od nowa z zapisanych surowych odpowiedzi, z tymi samymi kontrolami co `--sprawdz`, wymaga tego samego stanu w kroku przerwy i gra dalej na żywo, na tych samych kopiach programów. Przerwa nie zmienia przebiegu, więc `--sprawdz` całego meczu działa jak bez przerw. Sprawdzone na sucho: remis, dwie przerwy, dwa wznowienia, koniec 0:2, `SPRAWDZENIE: PASS (240 decyzji, 19358 kroków, ten sam wynik: stub)`.
- Paweł zaproponował, żeby rundę 1 z próby 2 uznać za ważną. Claude Code odradził: według opublikowanej procedury unieważniony mecz zaczyna się od nowa z nowym zobowiązaniem, a próba 2 grała na kodzie sędziego bez przerw. Próba 3 zaczyna się od zera.

## 28.10.2026: próba 3 unieważniona i ponawianie wywołań

- Próba 3 (`mecze/2026-10-28_claude-codex_3/`, z przerwami między rundami): w 6,38 s rundy 1 szóste wywołanie Codexa zawiesiło się po `turn.started` i przez 300 s nic nie przyszło. Unieważniona (`NIEWAZNY.md`).
- **OWNER_ACCEPTED 28.10.2026:** na propozycję Claude Code Paweł odpowiedział „Tak, zgoda”. Wywołanie bez żadnej odpowiedzi (brak odpowiedzi w 120 s albo błąd CLI) sędzia ponawia z tym samym poleceniem najwyżej 2 razy. Czas gry stoi, więc ponowienie nie daje przewagi żadnej stronie. Każda próba jest zapisana (`raw/...p1.json`, pole `retries` w `decyzje.jsonl`) i odtwarzana przy sprawdzeniu. Mecz unieważniają dalej: limit, trzecie z rzędu wywołanie bez odpowiedzi, brak dowodu modelu i izolacji, inny model. Sprawdzone na sucho: udawana awaria, ponowienie, `SPRAWDZENIE: PASS (240 decyzji, 6100 kroków, ten sam wynik: stub)`.

## 28.10.2026: próby 4 i 5 unieważnione, zawieszki usługi Codexa

- Próba 4: przy szóstej decyzji Codexa trzy wywołania z rzędu nie dostały odpowiedzi. Usługa Codexa nie odpowiadała wtedy nawet na pytanie testowe poza meczem; równolegle działała aplikacja Codex Pawła na tym samym koncie. Paweł zamknął aplikację, trzy pytania testowe przeszły w 4–6 s.
- Próba 5: Codex zawiesił się przy trzeciej decyzji (ponowienie się udało) i przy ósmej (trzy razy z rzędu bez odpowiedzi). Unieważniona. Limit Codexa według zapisu sesji: 2% okna 5-godzinnego, 13% tygodniowego, więc to nie był limit.
- Test Claude Code: sześć razy to samo polecenie, na którym Codex się zawiesił, jedno po drugim, bez Claude'a w tle: `timeout 60s | timeout 60s | ok 14s | ok 5s | ok 9s | ok 7s`. Zawieszki są losowe i przychodzą seriami. To nie wina polecenia ani sędziego. Rano w próbie 2 przeszło 273 wywołań Codexa bez zawieszki.
- **OWNER_ACCEPTED 28.10.2026:** Paweł: „Tak, zgoda na oba, gramy jutro rano”. Wywołanie bez odpowiedzi czeka 45 s (poprawne odpowiedzi przychodzą w najwyżej 15 s) i jest ponawiane najwyżej 10 razy. Mecz gramy rano, a przed zobowiązaniem seria pytań testowych sprawdza, czy Codex odpowiada bez zawieszek.
