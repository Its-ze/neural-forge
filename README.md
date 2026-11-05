# Neural Forge

Neural Forge is a browser and Electron desktop playground for evolving small neural networks and watching them learn visual game tasks.

## Included arenas

- Snake
- Tic-Tac-Toe
- Minesweeper
- Flappy
- Pong
- XOR Logic Lab
- Breakout
- Dino Run
- Merge 2048
- Lunar Lander
- Maze Forge with hand-built and neural-architect mazes
- Custom screen tasks are unavailable: native input and reward execution are not implemented.

The evolution engine performs real forward passes, fitness evaluation, tournament selection, crossover, elitism, and weight/bias mutation. Custom screen task training is unavailable; built-in arenas run locally without a server.

## Network families

Neural Forge includes 12 selectable families with distinct forward-pass behavior: NEAT-style, Dense MLP, ReLU Feed Forward, Simple RNN, LSTM, GRU, Convolutional, Spiking, Liquid, Radial Basis, Transformer Lite, and Echo State.

## Progression and overclocking

Every completed generation earns persistent Forge Points and XP. Improving-generation streaks and level-ups award 15-second 3x speed boosts. Generation speed and acceleration are controlled separately, with a live generations-per-minute readout.

## Maze Forge

Maze Forge includes a visual grid editor with wall, erase, start, and goal tools. A separate Liquid-network architect population can generate mazes, while co-evolution mode continuously changes the maze in response to the solver population. The editor reports route length, wall count, and estimated difficulty.

## Run from source

```powershell
npm ci
npm run dev
```

## Build the Windows app

```powershell
npm run dist
```

Installers and the portable executable are written to `release`.

## Current safety boundary

Existing custom task configuration can be opened and preserved, but training is disabled because live capture, OS input and OCR rewards are not implemented.

## 0.5.4 project fidelity release

Version 2 project saves retain the full population (weights, biases and recurrent state), evaluated champion archive, action replay, selected generation, replay position and settings. Opens are validated before live state is replaced and always pause training. Legacy settings-only files import as fresh runs because they never contained trained weights; originals are not modified. Invalid/future files fail without replacing the active run. Desktop saves keep timestamped backups before atomic replacement. Browser saves retain a previous-save backup and report quota failures without erasing the old save. The supported JSON input limit is 128 MiB.

The inspection now uses observations, activations and applied actions captured during evaluation. Pong reconstructs its stored action sequence through deterministic physics. Other arena scenes show the selected captured observation rather than claiming a complete physics replay. Custom-screen training is disabled: continuous capture, OCR reward execution and OS input are not implemented.

Use Node from `.nvmrc` and the `packageManager` npm version, then `npm ci`, `npm test`, `npm run build`, and `npm run test:release`. Install Playwright Chromium with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed official Chromium executable. Release tests exercise the built bundle, train/save/reopen/resume, retained archive and trace provenance, malformed project preservation, and build metadata.

Every web build includes `build-info.json` with source SHA, dirty flag, Node/npm/Vite versions, lockfile SHA-256 and artifact checksums. Ship only a clean committed build; retain known-good previous assets and versioned installers. The source SHA maps the release to canonical Forgejo main. GitHub source sync and the separate Pages publication repository remain distinct. Windows install/update execution and Linux desktop launch require native acceptance on the target OS; generating a package is not native acceptance.

Version 0.5.5 completes the 0.5.4 audit fixes with explicit icon-map aliases and an icon-rendering regression assertion. Previously published 0.5.4 artifacts remain immutable.

## Standalone 0.5.6

Built-in arenas, evaluation, project files, archives and Pong replay work offline. Fonts use system fallbacks. Update checks are optional and bounded; the app does not automatically contact the update host at startup. The Windows installer and Linux archive remain standalone; this release does not require a hosted Neural Forge backend.
