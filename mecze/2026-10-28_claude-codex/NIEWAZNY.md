# Próba 1 (28.10.2026): mecz unieważniony, błąd sędziego

**Wynik: brak.** Mecz przerwany w rundzie 1 przy 1,5 s czasu gry, stan 0:0, HP obu postaci 100. Nikt nie wygrał.

**Co się stało.** Sędzia ruszył o 09:49:25 UTC, po rundzie drand 33459191. Każda strona podjęła po dwie decyzje (`decyzje.jsonl`, `raw/`). O 09:49:49 UTC aktualizacja Claude Code przeinstalowała pakiet `@anthropic-ai/claude-code` (ta sama wersja 2.1.312) i podmieniła `claude.exe`, kiedy mecz trwał. Przy trzecim wywołaniu Claude'a system nie uruchomił programu (`Error: spawn UNKNOWN`, `dziennik.log`). Sędzia nie zamienił tego błędu w zapisaną awarię, tylko przerwał działanie. Dlatego w katalogu nie ma `koniec.json` ani `zapis.json`.

**Zasada.** Według zasady Pawła (README, `przygotowania/AUDYT_r3.md`) błąd wywołania programu modelu unieważnia mecz. Ta próba zostaje jawna. Jawne jest też jej tajne ziarno (`ziarno.txt`), więc każdy może sprawdzić, że zgadza się z zobowiązaniem.

**Co poprawiono przed próbą 2.** Mecz gra na kopiach programów obu graczy w katalogu meczu, których żadna aktualizacja nie dotknie. Zobowiązanie zawiera skróty SHA-256 tych programów. Błąd uruchomienia programu jest teraz błędem CLI (`cli_error`, unieważnienie zapisane w `koniec.json`). Każdy inny upadek sędziego po starcie gry też jest zapisywany jako unieważnienie.
