# Neural Forge

Neural Forge is a Windows desktop playground for evolving small neural networks and watching them learn visual game tasks.

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
- Custom screen task wizard

The evolution engine performs real forward passes, fitness evaluation, tournament selection, crossover, elitism, and weight/bias mutation. The custom task wizard uses Electron desktop capture to enumerate real windows and displays, lets you draw an observation region, restrict the action space, and configure a reward signal.

## Network families

Neural Forge includes 12 selectable families with distinct forward-pass behavior: NEAT-style, Dense MLP, ReLU Feed Forward, Simple RNN, LSTM, GRU, Convolutional, Spiking, Liquid, Radial Basis, Transformer Lite, and Echo State.

## Progression and overclocking

Every completed generation earns persistent Forge Points and XP. Improving-generation streaks and level-ups award 15-second 3x speed boosts. Generation speed and acceleration are controlled separately, with a live generations-per-minute readout.

## Maze Forge

Maze Forge includes a visual grid editor with wall, erase, start, and goal tools. A separate Liquid-network architect population can generate mazes, while co-evolution mode continuously changes the maze in response to the solver population. The editor reports route length, wall count, and estimated difficulty.

## Run from source

```powershell
npm install
npm run dev
```

## Build the Windows app

```powershell
npm run dist
```

Installers and the portable executable are written to `release`.

## Current safety boundary

Custom tasks store a real capture source, region, allowed actions, and reward configuration. OS-level key injection and OCR evaluation are intentionally not armed in this first release; those controls are represented in the project format and UI for the next native training-worker phase.
