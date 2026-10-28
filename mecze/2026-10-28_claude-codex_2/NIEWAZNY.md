# Próba 2 (28.10.2026): mecz unieważniony, koniec limitu Claude Code

**Wynik: brak.** Rundę 1 wygrał Codex przez zabicie w 94,3 s (strona B). W rundzie 2, w 178,65 s, przy stanie meczu 0:1 i HP 40 (Codex, strona A) do 33 (Claude, strona B), wywołanie Claude'a zwróciło `You've hit your 5-hour limit · resets 3pm (Europe/Warsaw)`. Według zasady Pawła koniec limitu unieważnia mecz. Sędzia zatrzymał grę przed następnym krokiem i zapisał stan w `koniec.json`. Nikt nie wygrał.

**Nazwa przyczyny w zapisie.** Sędzia zapisał to jako `cli_error`, a nie `limit`, bo jego wzorzec nie rozpoznał słów „hit your 5-hour limit”. Skutek jest ten sam, bo obie przyczyny unieważniają mecz. Wzorzec poprawiono po tej próbie.

**Zużycie.** Claude: 314 wywołań (104 w rundzie 1, 210 w rundzie 2), około 1,5 mln tokenów wejścia i 166 tys. tokenów wyjścia. Codex: 273 wywołania, około 2,2 mln tokenów wejścia i 35 tys. tokenów wyjścia. Ten sam limit Claude'a zużywała równolegle rozmowa Pawła z Claude Code, który prowadził mecz.

**Sprawdzenie.** Zapis jest kompletny, z surowym wyjściem CLI i tajnym ziarnem, więc `node sedzia/sedzia.mjs --sprawdz mecze/2026-10-28_claude-codex_2` odtwarza przebieg aż do unieważnienia.
