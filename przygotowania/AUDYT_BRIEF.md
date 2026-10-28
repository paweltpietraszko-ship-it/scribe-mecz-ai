# Brief audytu: mecz modeli AI w SCRIBE: THE ONE (organizacja meczu)

Dla Codexa w roli **audytora** (nie zawodnika). Autor organizacji: Claude Code, 28.10.2026. Zlecił Paweł 28.10: „twoje zasady przed prawdziwym meczem audytuje Codex, żeby uniknąć zarzutu twojej stronniczości”; „niech szuka dziur, do których może się przyczepić krytyk. Kilka osób może się tym zainteresować, więc nie róbmy prostych błędów koncepcyjnych”.

## Co to jest

Pojedynek Claude Code kontra Codex w strzelance TPP SCRIBE: THE ONE, który modele rozgrywają **same**. Nie piszą botów i nie walczą boty. Czas gry stoi, kiedy model myśli. Model jest mózgiem i wydaje rozkazy JSON (dokąd iść, za którą bryłą się schować, czy strzelać, apteczka itd.). „Ciało” postaci wykonuje rozkaz tymi samymi częściami co bot gry: oczami, rękami na poziomie „Normalny” u obu i nogami (siatka nawigacji). Sędzia budzi model przy zdarzeniach: widzi lub zgubił wroga, trafienie, słyszy strzał, rozkaz wykonany lub nieudany, ostrzeżenie SCRIBE, upływ czasu rozkazu. Grają świeże instancje bez znajomości kodu, tylko z instrukcją gry.

Zrobiono już rundę próbną (pełne 180 s, ziarno 21, karabin): wygrał Codex przez zabicie w 169,25 s, 148 i 154 decyzje, 0 odrzuconych, odtworzenie z zapisu zgodne co do kroku. Ta runda trafi na GitHub jako **trening sprzed audytu** (decyzja Pawła), a nie jako mecz.

**Twój cel:** znaleźć wszystko, do czego może się przyczepić rozsądny, nieżyczliwy krytyk (Reddit, Hacker News), zanim rozegramy prawdziwy mecz. Najważniejsze są błędy koncepcyjne: czy to w ogóle jest „model gra”, czy warunki są równe, czy wynik da się sprawdzić. Drobne błędy kodu są ważne tylko wtedy, gdy zmieniają wynik albo wiarygodność.

**Konflikt interesów:** jesteś modelem z tej samej rodziny co zawodnik B. Oceniaj tak, jakbyś nie wiedział, która strona jest Twoja. Każda uwaga powinna działać tak samo dla obu stron. Jeśli jakaś uwaga pomaga tylko jednej stronie, napisz to wprost.

## Pliki (lokalne, `game/probe` jest poza gitem)

| Plik | Co to |
|---|---|
| `game/probe/mecz_ai/ZASADY_GRACZA.md` | instrukcja dla grających (EN); sędzia wstawia liczby z danych gry (`{{WEAPON}}` itd.) |
| `game/probe/mecz_ai/sedzia.mjs` | sędzia: pętla gry, widok dla modelu (`view`), sprawdzanie rozkazu (`check`), budzenie (`reasons`), zapisy |
| `game/probe/mecz_ai/cialo.js` | ciało postaci: wykonanie rozkazu (ruch, osłona, wychylanie, ogień, apteczka) |
| `game/probe/mecz_ai/gracze.mjs` | wywołanie Claude Code i Codexa bez narzędzi (przeniesione z sędziego Statków) |
| `game/probe/mecz_ai/odtworz.mjs` | odtworzenie rundy z zapisu kroków i porównanie odcisków stanu |
| `game/probe/mecz_ai/wyniki/2026-10-28T04-38-58_claude-codex/` | runda próbna: `decyzje.jsonl` (polecenie, surowa odpowiedź, rozkaz, komentarz, notatka, czas, użycie tokenów), `zapis.json` (kroki), `zasady.md` (zasady z liczbami, jak dostali gracze), `koniec.json`, `sedzia_wersja/` (kopia kodu, który grał) |
| `game/src/bot/senses.js`, `aim.js`, `nav.js`; `game/src/data/bot.js` (`LEVELS.normal`, `BOT`) | oczy, ręce i nogi wzięte z gry |
| `game/src/sim/engine.js`, `replay.js` | silnik bez rysowania i odtwarzanie zapisu |
| `C:\Projects\statki-mecz-ai\README.md`, `C:\Projects\Statki\game\mcp\dowod.mjs`, `sprawdz.mjs` | wzorzec weryfikowalnego meczu ze Statków (zobowiązanie przed meczem, sprawdzenie po) |

## Pytania, na które proszę o odpowiedź

Przy każdym: werdykt (OK / DZIURA / RYZYKO), dowód (plik:linia albo liczba z rundy próbnej), co zarzuci krytyk i najprostsza naprawa.

### A. Czy to naprawdę „model gra”?
1. Granica mózg/ciało. Ciało samo wybiera stronę bryły (`pickSpot`), wychyla się seriami, celuje i strzela z błędem ręki, samo przeładowuje, samo przestaje biec na widok wroga, samo przyjmuje za zagrożenie ostatnie znane miejsce wroga, gdy rozkaz nie ma `against` (Codex w próbie 18 razy bez `against`). Czy to nie jest już bot z podpowiedziami modelu? Gdzie postawić granicę, żeby obronić tezę „modele grały”? Czy przyda się miara udziału ciała (np. ile strzałów, ruchów i wychyleń wynikało z decyzji modelu, a ile z automatu)?
2. Zatrzymany czas. Model nie ma czasu reakcji w czasie gry, ma za to częste przebudzenia. Czy to uczciwe porównanie do gracza i czy da się to jasno opisać? Strona, która dostaje więcej przebudzeń (krótkie `for`, więcej zdarzeń), ma więcej kontroli. W próbie rozkazy z `for` ≤ 1: A 7, B 14. Czy to dozwolona taktyka, czy luka?
3. Strona obudzona sama i strona nieobudzona (ta jedzie na starym rozkazie). Czy przy jednoczesnych zdarzeniach obie są pytane w tym samym stanie (`Promise.all` w `sedzia.mjs`)? Czy kolejność przetwarzania odpowiedzi daje komuś przewagę?

### B. Czy model wie tylko to, co wiedziałby gracz?
4. Widok (`view` w `sedzia.mjs`): dokładne współrzędne własne i wroga (człowiek szacuje), „HP bar about X” wroga, stan wroga („in cover/moving”), lista 20 brył w 15 m **bez sprawdzania, czy są widoczne** (także za ścianą), stan brył (zapadnięta, zapowiedziana). Co z tego to przewaga, której gracz nie ma? Paweł odrzucił mapkę z góry jako ułatwienie, więc czy lista brył nie jest mapką tylnymi drzwiami?
5. Kierunek trafienia liczony z położenia strzelca (`cialo.js hurt`), a nie z toru kuli. Słyszenie: ±3 m z `senses.js`. Czy coś przecieka (np. dokładne położenie przy ślepym ogniu)?
6. Czy model dostaje cokolwiek o przeciwniku, czego nie dałyby jego oczy, słuch i trafienia (np. przez opis zdarzeń, ostrzeżenia SCRIBE, liczbę przebudzeń)?

### C. Równe warunki
7. Miejsca startu są lustrzane względem osi X = 0,6 (`data/arena.js MATCH_SPAWN`), ale **układ brył areny nie jest symetryczny** (uwaga U32 na tablicy: po jednej stronie płyty, po drugiej kolumny). Jedna runda bez zamiany stron to zarzut „wygrał stroną”. Mecz w grze to do 2 wygranych rund. Jaki format jest obronny: rewanż ze zamianą stron, 2 rundy na stronę, mecz do 2 wygranych ze zmianą stron?
8. Ziarno 21 wybrał Claude Code (znane z filmów, sprawdzone w trybie bot na bota). Losowanie ziarna i broni: kto, kiedy, jak zobowiązać się przed meczem (skrót publikowany przed, ziarno po, jak w Statkach)?
9. Losowość rąk: każda strona ma własny strumień z ziarna (`cialo:0`, `cialo:1`). Czy przy jednym ziarnie i jednej rundzie szczęście w rozrzucie nie rozstrzyga? Czy powtórzenie z innym ziarnem albo z zamianą strumieni jest potrzebne?
10. Moc myślenia. Claude: `--effort medium`; Codex: `model_reasoning_effort="medium"`. W próbie ostatnie wywołanie Codexa pokazało `reasoning_output_tokens: 0`, a Claude miał `thinking_tokens: 181`. Czy „medium” u obu to porównywalne warunki i jak to opisać uczciwie? Sędzia nie zapisał nazwy modelu Codexa (sędzia Statków odczytuje ją z pliku sesji, `players.js codexSessionModel`). Do naprawy.
11. Identyczność poleceń: poza literą strony i danymi widoku polecenie ma być identyczne. Sprawdź na `decyzje.jsonl`, czy tak było (system prompt, zasady, kolejność sekcji).

### D. Zasady dla graczy
12. Czy każde zdanie w `ZASADY_GRACZA.md` (i w `zasady.md` z rundy) zgadza się z silnikiem? Np. „about 24 body hits kill” (liczone bez głowy i nóg), stożek 120° i 40 m, „a few metres all around”, SCRIBE (1,2 s zapowiedzi, biwak 10/7/5 s w kole 6 m, ściany w 12 m), „after a long quiet the machine opens lines of sight”, apteczka 1 s, przewrót, ślepy ogień, sprint. Zdanie nieprawdziwe to gotowy zarzut „sędzia oszukał model”.
13. Czy zasady nie są napisane pod styl jednego z modeli (autor: Claude Code)? Czy coś, co powinno być w zasadach, jest pominięte (np. dogrywka i remis przy równym HP, co się dzieje po złej odpowiedzi, limit długości notatki)?

### E. Sprawdzalność
14. **Najważniejsze.** `odtworz.mjs` odtwarza surowe kroki (akcje co 1/60 s) i potwierdza zgodność stanu. Nie dowodzi jednak, że te kroki wynikają z rozkazów modeli. Kroki tworzy ciało z rozkazów, więc sfałszowany zapis kroków też by przeszedł. W Statkach `sprawdz.mjs` sprawdzał, że każda akcja pochodzi z nagranej odpowiedzi modelu. Co trzeba dodać? Np. ponowną symulację z ciałami i rozkazami podanymi w tych samych chwilach rundy, z porównaniem kroków. Czy ciało jest do tego dostatecznie deterministyczne?
15. Zobowiązanie przed meczem: co ma zawierać (skróty sędziego, ciała, zasad, silnika i danych gry, commit gry, ustawienia, skrót ziarna, wersje CLI i modeli), gdzie i kiedy je publikujemy.
16. Odcięcie modeli od narzędzi i od kodu gry: Claude `--tools ''` z dowodem w zdarzeniu init, Codex z wyłączonymi narzędziami, `-s read-only`, osobny `CODEX_HOME`, pusty katalog tymczasowy jako cwd. Czy model mógł przeczytać kod gry albo zapis przeciwnika? Czy `read-only` dla Codexa wystarcza, skoro odczyt dysku byłby wyciekiem (w próbie `toolItems: 0` przy każdym wywołaniu)?

### F. Błędy, które mogą zmienić wynik
17. Przejrzyj `cialo.js` i `sedzia.mjs` pod kątem błędów, które działają na niekorzyść jednej strony albo wypaczają rozkaz. Np.: odrzut broni podawany przez `e.view().k` (silnik daje go tylko botom wbudowanym), wykrywanie trafienia po spadku HP, `dodge` względem widoku, ponowne wydanie tego samego rozkazu kasuje postęp, `status` po dojściu do osłony, `fire` domyślnie `at_enemy` przy złej wartości, `against` domyślne, zapadnięta bryła jako cel osłony, apteczka razem ze sprintem.
18. Budzenie (`reasons`): czy któreś zdarzenie może zalać jedną stronę pytaniami albo ją uśpić (np. „heard a shot” przy widocznym wrogu, ostrzeżenie SCRIBE pokazane raz)?

## Ograniczenia

- Nie zmieniaj kodu ani zasad (zasada repozytorium: Codex audytuje, nie pisze kodu). Propozycje zmian w raporcie.
- **Nie uruchamiaj meczu z modelami.** Kosztuje limity Pawła (pamiętaj o budżecie testów). Wolno: suchą pętlę bez modeli (`node probe/mecz_ai/sedzia.mjs --p0 stub --p1 stub --n 8`, z katalogu `game/`), odtworzenie rundy próbnej (`node probe/mecz_ai/odtworz.mjs probe/mecz_ai/wyniki/2026-10-28T04-38-58_claude-codex`), czytanie `decyzje.jsonl`.
- Wynik: `docs/mecz_ai/AUDYT_r1.md` (sprawdź, że nie istnieje). Na górze lista dziur od najpoważniejszej, każda z naprawą. Potem odpowiedzi na pytania 1–18. Na końcu Twoja ocena: czy po naprawach format jest obronny przed nieżyczliwym krytykiem, a jeśli nie, to czego mu brakuje.
- Pytania o odczucie gracza („czy to jeszcze gra”, „czy widz to kupi”) zapisz osobno, dla Pawła, prostym językiem.
