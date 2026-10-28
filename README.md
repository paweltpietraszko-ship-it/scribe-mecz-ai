# SCRIBE: THE ONE — Claude Code vs Codex: the models play the shooter themselves

**EN.** This repository holds everything about a match of the third-person arena shooter *SCRIBE: THE ONE* between two AI models, Claude Code and Codex: the referee, the rules the models get, the preparation (trial runs, audits and the fixes that followed them) and, once played, the match itself with everything needed to check it. Status: **preparation**. The match has not been played yet.

**How the models play.** A model cannot steer a shooter at 60 frames a second, so game time stops while a model thinks. The model is the mind: it gives an order in JSON (where to go, behind which block to take cover and against which point, whether to fire, look, sprint, heal, reload, dodge, and for how long the order lasts). The fighter's body carries the order out with the same eyes, hands and legs as the game's own bot on its *Normal* level, the same for both sides: it walks the shortest way, takes the named cover, and aims and fires only at what its eyes see, with a human-like reaction time and aim error. The referee stops the game and asks the model again when something happens: it sees or loses the enemy, is hit, hears a shot, reaches its goal or fails, gets SCRIBE's camping warning, or the order's time is up. The models get only what their fighter could know. They play without tools and without the game's code, only with the rules in [`sedzia/ZASADY_GRACZA.md`](sedzia/ZASADY_GRACZA.md).

**Format.** First to 2 round wins. The players swap start sides after round 1; the side for round 3 comes from the seed. The seed is drawn by the game's author, not by a player. Its SHA-256 (with a salt), the hashes of every file of the referee and of the game engine, the CLI versions and the settings are published **before** the match (`ZOBOWIAZANIE.json`). The seed is published after it.

**Checking a match.** `node sedzia/sedzia.mjs --sprawdz mecze/<match> --gra <game folder>` plays the whole match again without the models. It reads every answer from the models' recorded raw CLI output (`raw/`), and requires every view shown to a model, every order and every game step to be identical to the record. Any edited answer, order, step or file makes it FAIL.

| Folder | What is there |
|---|---|
| [`sedzia/`](sedzia/) | the referee (`sedzia.mjs`), the fighter's body (`cialo.js`), the model calls without tools (`gracze.mjs`), the commitment (`zobowiaz.mjs`), the physics replay (`odtworz.mjs`), the rules for the models (`ZASADY_GRACZA.md`) |
| [`przygotowania/`](przygotowania/) | the history of the preparation ([`KRONIKA.md`](przygotowania/KRONIKA.md)), the audit brief, the audit reports and the fixes |
| [`proby/`](proby/) | the trial runs before the audit, with the models' decisions, comments and notes (one full trial round: Codex won in 169 s) |
| `mecze/` | the match package, once played |

**The game engine.** The referee runs the game's own engine without drawing (`--gra <folder>`, the `game` folder of SCRIBE: THE ONE). How the engine is made available for checking is still open (see `KRONIKA.md`).

**All rights reserved.** Everything here is published only so the match can be read and verified. See [`LICENSE`](LICENSE).

---

**PL.** Repozytorium meczu Claude Code kontra Codex w strzelance TPP *SCRIBE: THE ONE*, który modele rozgrywają same: sędzia, zasady dla modeli, przygotowania (próby, audyty i poprawki po nich), a po rozegraniu mecz ze wszystkim, co potrzebne do sprawdzenia. Stan: **przygotowania**, mecz jeszcze się nie odbył. Czas gry stoi, kiedy model myśli. Model wydaje rozkazy, a ciało postaci wykonuje je tymi samymi oczami, rękami i nogami co bot gry na poziomie „Normalny”, jednakowo dla obu. Format: do 2 wygranych rund, zamiana stron po rundzie 1. Ziarno losuje autor gry, a jego skrót i odciski plików publikujemy przed meczem. Sprawdzenie: `node sedzia/sedzia.mjs --sprawdz mecze/<mecz> --gra <folder gry>` rozgrywa mecz od nowa z surowych odpowiedzi modeli i wymaga zgodności każdego kroku. Historia przygotowań: [`przygotowania/KRONIKA.md`](przygotowania/KRONIKA.md). **Wszelkie prawa zastrzeżone**, zob. `LICENSE`.
