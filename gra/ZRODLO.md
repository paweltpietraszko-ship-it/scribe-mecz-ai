# Where this copy of the game comes from

`gra/` is the engine and code of *SCRIBE: THE ONE* as the referee runs it: `src/` (the whole game code, including the fight engine without drawing in `src/sim/`), `scripts/sim-node.mjs` and `scripts/node-shims.mjs` (the engine in Node), `vite.config.js`, `package.json`, `package-lock.json`. Copied from the game's own repository (private), `game/` folder, commit `5388320cd016c4e96bbcbf37e7da1af4c3f2c5fc` (28.10.2026). The game code in `src/` is the same as in commit `df10f20` that played the trial round. The trial round replays on this copy step for step: 174 of 174 state fingerprints match.

The game's models and animations (`public/hero`, `public/weapon`) are **not** here. The animations come from Adobe Mixamo, whose licence does not allow distributing the animation files on their own. `node sedzia/zasoby.mjs` downloads them from the published game, the way every player's browser does, and checks each file's SHA-256 against `sedzia/zasoby.json`.

Setup: `cd gra && npm ci`, then from the repository root `node sedzia/zasoby.mjs`.

**PL.** Kopia kodu gry (silnik i cały `src`) z prywatnego repozytorium gry, commit `5388320` (kod `src` jak w `df10f20`, na którym grała runda próbna; runda odtwarza się na tej kopii co do kroku). Modeli i animacji tu nie ma (animacje Mixamo). Pobiera je `sedzia/zasoby.mjs` z opublikowanej gry i sprawdza skróty.
