import './style.css';
import { createIcons, icons } from 'lucide';
import { EvolutionEngine, type NetworkFamily, type MazeEnvironment, type DecisionTrace } from './neural';

type GameId = 'snake' | 'tictactoe' | 'minesweeper' | 'flappy' | 'pong' | 'xor' | 'breakout' | 'dino' | 'merge2048' | 'lander' | 'maze' | 'custom';
type NetworkType = NetworkFamily;

interface GenerationRecord { generation:number; best:number; average:number; species:number; trace:DecisionTrace; decisions:number; decisionLimit:number; timeLimitSeconds:number; actionRuns:Array<{action:string;count:number}>; maze?:MazeEnvironment; }

interface AppState {
  game: GameId;
  running: boolean;
  speed: number;
  generation: number;
  targetGenerations: number;
  population: number;
  mutationRate: number;
  mutationStrength: number;
  elitism: number;
  networkType: NetworkType;
  hiddenLayers: number[];
  bestFitness: number;
  averageFitness: number;
  species: number;
  history: number[];
  selectedAgent: number;
  forgePoints: number;
  xp: number;
  level: number;
  streak: number;
  boosts: number;
  generationSpeed: number;
  acceleration: number;
  episodeTimeLimit: number;
  decisionsPerSecond: number;
  mazeMode: 'builder' | 'coevolve';
  maze: MazeEnvironment;
  architectFitness: number;
  architectGeneration: number;
  custom?: CustomTask;
}

interface CustomTask {
  sourceId: string;
  sourceName: string;
  thumbnail: string;
  region: { x: number; y: number; w: number; h: number };
  actions: string[];
  reward: string;
  rewardValue: string;
}

const games: Array<{ id: GameId; name: string; icon: string; color: string; description: string; inputs: number; outputs: number }> = [
  { id: 'snake', name: 'Snake', icon: 'move', color: '#b9ff66', description: 'Eat, grow, and avoid walls', inputs: 12, outputs: 4 },
  { id: 'tictactoe', name: 'Tic-Tac-Toe', icon: 'grid-3x3', color: '#7df9ff', description: 'Learn strategy through self-play', inputs: 18, outputs: 9 },
  { id: 'minesweeper', name: 'Minesweeper', icon: 'bomb', color: '#ffcb66', description: 'Infer safe tiles from local clues', inputs: 81, outputs: 81 },
  { id: 'flappy', name: 'Flappy', icon: 'bird', color: '#ff7ad9', description: 'Master timing with one action', inputs: 5, outputs: 1 },
  { id: 'pong', name: 'Pong', icon: 'circle-dot', color: '#a78bfa', description: 'Track and intercept a moving ball', inputs: 6, outputs: 3 },
  { id: 'xor', name: 'Logic Lab', icon: 'binary', color: '#72a7ff', description: 'Watch a network solve XOR', inputs: 2, outputs: 1 },
  { id: 'breakout', name: 'Breakout', icon: 'blocks', color: '#ff8a66', description: 'Aim the paddle and clear bricks', inputs: 6, outputs: 3 },
  { id: 'dino', name: 'Dino Run', icon: 'tree-pine', color: '#92ffb3', description: 'Jump obstacles at rising speed', inputs: 4, outputs: 1 },
  { id: 'merge2048', name: 'Merge 2048', icon: 'layout-grid', color: '#ffd166', description: 'Combine tiles and plan ahead', inputs: 16, outputs: 4 },
  { id: 'lander', name: 'Lunar Lander', icon: 'rocket', color: '#b8a1ff', description: 'Balance thrust, drift, and fuel', inputs: 6, outputs: 3 },
  { id: 'maze', name: 'Maze Forge', icon: 'route', color: '#55f6d2', description: 'Solver versus maze architect', inputs: 12, outputs: 4 },
];

function starterMaze(width=15,height=11):MazeEnvironment{const walls=Array(width*height).fill(false);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const edge=x===0||y===0||x===width-1||y===height-1;walls[y*width+x]=edge||((x%3===0&&y>1&&y<height-2&&y!==4)||(y===6&&x>4&&x<width-2&&x!==9));}const start=width+1,goal=(height-2)*width+width-2;walls[start]=false;walls[goal]=false;return{width,height,walls,start,goal};}

const networkDescriptions: Record<NetworkType, string> = {
  'NEAT-style': 'Species-aware neuroevolution using your editable topology and structural protection.',
  'Dense MLP': 'Classic fully connected layers with smooth tanh activations. A dependable baseline.',
  'ReLU Feed Forward': 'Fast non-recurrent layers using rectified activations for crisp decisions.',
  'Simple RNN': 'Carries a hidden state between game frames so recent events influence decisions.',
  'LSTM': 'Gated long-term memory for tasks where delayed events and sequences matter.',
  'GRU': 'A lighter gated recurrent network that remembers context with fewer moving parts.',
  'Convolutional': 'Blends neighboring observations before dense layers; useful for grids and pixels.',
  'Spiking': 'Leaky integrate-and-fire neurons emit discrete spikes after reaching a threshold.',
  'Liquid': 'Continuous, leaky neural dynamics adapt their state at every simulation step.',
  'Radial Basis': 'Gaussian response neurons specialize around regions of the observation space.',
  'Transformer Lite': 'Applies lightweight attention to emphasize important observations globally.',
  'Echo State': 'Reservoir-style recurrent dynamics preserve a rich trail of recent inputs.',
};

const state: AppState = {
  game: 'snake', running: false, speed: 1, generation: 0, targetGenerations: 500,
  population: 120, mutationRate: 12, mutationStrength: 35, elitism: 8,
  networkType: 'NEAT-style', hiddenLayers: [8, 6], bestFitness: 0, averageFitness: 0,
  species: 1, history: [0], selectedAgent: 1,
  forgePoints:0,xp:0,level:1,streak:0,boosts:3,generationSpeed:1,acceleration:25,episodeTimeLimit:10,decisionsPerSecond:10,mazeMode:'coevolve',maze:starterMaze(),architectFitness:0,architectGeneration:1,
};

try{const progress=JSON.parse(localStorage.getItem('neural-forge-progress')||'null');if(progress)Object.assign(state,progress);}catch{/* keep fresh progression */}

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark"><i data-lucide="orbit"></i></span><div><strong>NEURAL FORGE</strong><small>EVOLUTION PLAYGROUND</small></div></div>
      <nav class="top-nav"><button class="nav-button active" data-view="lab"><i data-lucide="flask-conical"></i> Playground</button><button class="nav-button" data-action="open-library"><i data-lucide="library"></i> Experiments</button></nav>
      <div class="top-actions"><div class="player-chip"><i data-lucide="gem"></i><span><b id="forge-points">0</b> FP</span></div><div class="level-chip"><span>LV <b id="player-level">1</b></span><i><em id="level-progress"></em></i></div><span class="engine-status"><span></span> Engine ready</span><button class="update-button" data-action="updates" title="Check for Neural Forge updates"><i data-lucide="download-cloud"></i><span>Updates</span><b id="update-dot"></b></button><button class="icon-button" data-action="load" title="Open project"><i data-lucide="folder-open"></i></button><button class="icon-button" data-action="save" title="Save project"><i data-lucide="save"></i></button><button class="icon-button" data-action="settings" title="Settings"><i data-lucide="settings-2"></i></button></div>
    </header>

    <aside class="sidebar">
      <div class="sidebar-heading"><span>TRAINING ARENAS</span><button class="tiny-button" data-action="collapse-games"><i data-lucide="chevrons-up-down"></i></button></div>
      <div class="game-list" id="game-list"></div>
      <button class="custom-game-card" data-action="custom-trainer"><span class="custom-icon"><i data-lucide="scan-line"></i></span><span><strong>Custom screen task</strong><small>Capture any app or game</small></span><i data-lucide="plus"></i></button>
      <div class="sidebar-footer"><div class="tip-icon"><i data-lucide="lightbulb"></i></div><p><strong>Evolution tip</strong><br>Start with a broad population, then lower mutation once fitness plateaus.</p></div>
    </aside>

    <main class="workspace">
      <section class="arena-panel panel">
        <div class="panel-header arena-header"><div><div class="eyebrow">STORED GENERATION CHAMPION</div><h1 id="arena-title">Snake</h1><p class="panel-subtitle" id="arena-explainer">Run a generation to store its exact champion and decision.</p></div><div class="arena-badges"><button class="maze-button hidden" id="maze-tools" data-action="maze-builder"><i data-lucide="pencil-ruler"></i> Maze studio</button><span class="badge"><i data-lucide="trophy"></i> <span id="champion-label">No generation recorded</span></span><button class="ghost-button" data-action="archive-latest"><i data-lucide="radio"></i> Follow latest</button></div></div>
        <div class="generation-browser"><button data-action="archive-prev" aria-label="Previous generation"><i data-lucide="chevron-left"></i></button><div class="generation-location"><span id="archive-position">No generations stored yet</span><input id="archive-slider" type="range" min="0" max="0" value="0" disabled aria-label="Stored generation"></div><button data-action="archive-next" aria-label="Next generation"><i data-lucide="chevron-right"></i></button><label>JUMP TO <input id="jump-generation" type="number" min="1" placeholder="Gen #"></label><button class="archive-text-button" data-action="archive-best"><i data-lucide="crown"></i> Best ever</button><button class="archive-text-button" data-action="archive-latest"><i data-lucide="radio"></i> Latest</button></div>
        <div class="game-stage" id="game-stage"><canvas id="game-canvas"></canvas><div class="game-hud"><span>EXACT STORED OBSERVATION</span><span id="episode-hud">TIMED MULTI-MOVE EPISODE</span></div></div>
        <div class="replay-controls"><button data-action="replay-prev" aria-label="Previous move"><i data-lucide="step-back"></i></button><button class="replay-play" data-action="replay-toggle" aria-label="Play champion episode"><i data-lucide="play"></i><span>PLAY EPISODE</span></button><button data-action="replay-next" aria-label="Next move"><i data-lucide="step-forward"></i></button><label><span id="replay-position">NO EPISODE</span><input id="replay-slider" type="range" min="0" max="0" value="0" disabled></label><strong id="replay-action">Run a generation first</strong></div>
        <div class="episode-sequence"><span>CHAMPION MOVE SEQUENCE</span><div id="episode-moves"><em>Run a generation to record every move in order.</em></div></div>
        <div class="decision-flow"><div class="decision-step"><b>1</b><div><span>WHAT THE NETWORK SEES</span><div class="signal-list" id="observation-list"></div></div></div><i data-lucide="arrow-right"></i><div class="decision-step chosen"><b>2</b><div><span>WHAT IT CHOSE</span><strong id="chosen-action">RIGHT</strong><small id="choice-reason">Strongest output activation</small></div></div><i data-lucide="arrow-right"></i><div class="decision-step"><b>3</b><div><span>HOW IT EARNS FITNESS</span><p id="fitness-rule"></p></div></div></div>
      </section>

      <section class="training-panel panel">
        <div class="training-main">
          <div class="run-control"><button class="start-button" data-action="toggle-run"><i data-lucide="play"></i><span><strong>START EVOLUTION</strong><small>Space</small></span></button><button class="step-button" data-action="step" title="Run one generation"><i data-lucide="step-forward"></i></button></div><button class="boost-button" data-action="boost"><i data-lucide="zap"></i><span>BOOST <b id="boost-count">3</b></span></button>
          <div class="speed-control"><label>SIMULATION SPEED <output id="speed-label">1×</output></label><input id="speed" type="range" min="0" max="4" step="1" value="1"><div class="range-labels"><span>0.5×</span><span>1×</span><span>2×</span><span>5×</span><span>MAX</span></div></div>
        </div>
        <div class="generation-progress"><div class="generation-copy"><span>GENERATION <strong id="generation">001</strong> <em>/ <span id="generation-target">500</span></em></span><span id="generation-percent">0.2%</span></div><div class="progress-track"><div id="generation-bar"></div></div></div>
      </section>

      <section class="metrics-grid">
        <article class="metric-card"><div class="metric-icon lime"><i data-lucide="trophy"></i></div><div><span>BEST FITNESS</span><strong id="best-fitness">0.0</strong><small>Highest score found this generation</small></div></article>
        <article class="metric-card"><div class="metric-icon cyan"><i data-lucide="activity"></i></div><div><span>AVERAGE FITNESS</span><strong id="average-fitness">0.0</strong><small>Mean score across every evaluated agent</small></div></article>
        <article class="metric-card"><div class="metric-icon violet"><i data-lucide="dna"></i></div><div><span>ACTIVE SPECIES</span><strong id="species">1</strong><small>Distinct weight-diversity groups</small></div></article>
        <article class="metric-card"><div class="metric-icon amber"><i data-lucide="users"></i></div><div><span>POPULATION</span><strong id="population-metric">120</strong><small id="alive-count">120 alive</small></div></article>
      </section>

      <section class="network-panel panel">
        <div class="panel-header network-header"><div><div class="eyebrow">WHY THE CHAMPION CHOSE <span id="network-choice">RIGHT</span></div><h2>Signal path through the real network</h2><p class="panel-subtitle">Dots are neuron values. Lines are the champion's actual weights for this sampled decision.</p></div><div class="network-legend"><span><i class="positive"></i> Pushes up</span><span><i class="negative"></i> Pushes down</span><button class="icon-button" data-action="fullscreen-network" aria-label="Expand network"><i data-lucide="maximize-2"></i></button></div></div>
        <div class="network-wrap"><canvas id="network-canvas" aria-label="Champion neural network signal diagram"></canvas><div class="layer-labels"><span>OBSERVATIONS <b id="input-count">12</b></span><span>THINKING LAYERS <b id="hidden-count">14</b></span><span>ACTIONS <b id="output-count">4</b></span></div></div>
        <div class="network-readout"><div><span>STRONGEST OBSERVATIONS</span><div id="network-inputs" class="activation-list"></div></div><div><span>OUTPUT ACTIVATIONS</span><div id="network-outputs" class="activation-list"></div></div></div>
        <div class="network-note"><i data-lucide="info"></i><span>Thicker lines have more influence. Brighter dots are more active. The selected action is ringed. For large networks, the diagram shows the strongest neurons and connections while the totals remain exact.</span></div>
        <div class="network-stats"><span id="neuron-total">42 neurons</span><span id="connection-total">187 connections</span><span id="family-label">NEAT-style</span><span class="accent" id="network-status">UNTRAINED NETWORK</span></div>
      </section>

      <aside class="control-panel panel">
        <div class="control-title"><div><div class="eyebrow">EVOLUTION LAB</div><h2>Experiment setup</h2></div><button class="icon-button" data-action="reset"><i data-lucide="rotate-ccw"></i></button></div>
        <div class="control-section"><label class="field-label">NETWORK TYPE <span class="type-count">12 TYPES</span></label><div class="select-wrap"><select id="network-type"><optgroup label="Evolutionary & dense"><option>NEAT-style</option><option>Dense MLP</option><option>ReLU Feed Forward</option><option>Radial Basis</option></optgroup><optgroup label="Memory networks"><option>Simple RNN</option><option>LSTM</option><option>GRU</option><option>Liquid</option><option>Echo State</option></optgroup><optgroup label="Spatial & experimental"><option>Convolutional</option><option>Spiking</option><option>Transformer Lite</option></optgroup></select><i data-lucide="chevron-down"></i></div><p class="field-help" id="network-help">${networkDescriptions['NEAT-style']}</p></div>
        <div class="control-section"><div class="field-row"><label class="field-label">POPULATION SIZE</label><output id="population-value">120</output></div><input id="population" type="range" min="20" max="500" step="10" value="120"><div class="range-labels"><span>20</span><span>500 agents</span></div></div>
        <div class="control-section"><div class="field-row"><label class="field-label">GENERATIONS</label><output id="generations-value">500</output></div><input id="generations" type="range" min="10" max="2000" step="10" value="500"><div class="range-labels"><span>10</span><span>2,000</span></div></div>
        <div class="control-section engine-tuning"><div class="section-heading"><span>GENERATION ENGINE</span><span id="generation-rate">57 GEN/MIN</span></div><label><span>Generation speed <output id="generation-speed-value">1×</output></span><input id="generation-speed" type="range" min="1" max="10" value="1"></label><label><span>Acceleration <output id="acceleration-value">25%</output></span><input id="acceleration" type="range" min="0" max="100" value="25"></label><p class="field-help">Acceleration raises how quickly generations are processed. It does not remove moves from an agent's trial.</p></div><div class="control-section engine-tuning episode-tuning"><div class="section-heading"><span>AGENT EPISODE</span><span id="episode-budget">100 MOVES MAX</span></div><label><span>Time limit per agent <output id="episode-time-value">10 sec</output></span><input id="episode-time" type="range" min="1" max="60" value="10"></label><label><span>Decisions per second <output id="decision-rate-value">10/sec</output></span><input id="decision-rate" type="range" min="1" max="30" value="10"></label><p class="field-help">Each agent keeps making moves until it wins, loses, or reaches this time limit. The generation archive stores the champion's real move count.</p></div>
        <div class="control-section mutations"><div class="section-heading"><span>MUTATIONS</span><span class="mutation-live"><i></i> LIVE</span></div><label><span>Mutation chance <output id="mutation-rate-value">12%</output></span><input id="mutation-rate" type="range" min="1" max="50" value="12"></label><label><span>Mutation strength <output id="mutation-strength-value">0.35</output></span><input id="mutation-strength" type="range" min="1" max="100" value="35"></label><label><span>Elite survivors <output id="elitism-value">8%</output></span><input id="elitism" type="range" min="1" max="30" value="8"></label></div>
        <div class="control-section topology"><div class="section-heading"><span>STARTING TOPOLOGY</span><button class="text-button" data-action="add-layer"><i data-lucide="plus"></i> Layer</button></div><div id="layer-list"></div></div>
        <div class="control-section toggles"><label><span><strong>Speciation</strong><small>Protect new structures</small></span><input type="checkbox" checked><i></i></label><label><span><strong>Complexity penalty</strong><small>Favor simpler brains</small></span><input type="checkbox" checked><i></i></label><label><span><strong>Auto-save champion</strong><small>Keep every new record</small></span><input type="checkbox" checked><i></i></label></div>
      </aside>

      <section class="chart-panel panel"><div class="panel-header"><div><div class="eyebrow">LEARNING CURVE</div><h2>Fitness over generations</h2></div><div class="chart-key"><span><i class="best"></i> Best</span><span><i class="average"></i> Average</span></div></div><canvas id="fitness-chart"></canvas></section>
    </main>
  </div>
  <div class="toast-stack" id="toasts"></div>
  <div class="modal-root" id="modal-root"></div>
`;

createIcons({ icons });

const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const gameCanvas = $('#game-canvas') as HTMLCanvasElement;
const networkCanvas = $('#network-canvas') as HTMLCanvasElement;
const fitnessChart = $('#fitness-chart') as HTMLCanvasElement;
let animationFrame = 0;
let lastGenerationAt = performance.now();
let gameTime = 0;
let engine = new EvolutionEngine([12, ...state.hiddenLayers, 4], state.population, state.networkType);
let architectEngine = new EvolutionEngine([4, 10, 8, 1], Math.max(30,Math.floor(state.population/2)), 'Liquid');
let boostUntil=0;
let runStartedAt=performance.now();
let completionShownFor=-1;
let traceSample=0;
let liveTrace:DecisionTrace=engine.inspectChampion(state.game,state.game==='maze'?state.maze:undefined,traceSample);
let latestTrace:DecisionTrace=liveTrace;
let generationArchive:GenerationRecord[]=[];
let viewedArchiveIndex=-1;
let followLatest=true;
let lastEpisode={decisions:0,decisionLimit:100,actions:[] as string[]};
let replayStep=0,replayPlaying=false,replayLastAt=0;
let updateCheck:UpdateCheckResult|null=null;

function currentShape() {
  const game = games.find(g => g.id === state.game);
  return [game?.inputs || 8, ...state.hiddenLayers, game?.outputs || state.custom?.actions.length || 4];
}

function refreshDecisionTrace(){liveTrace=engine.inspectChampion(state.game,state.game==='maze'?state.maze:undefined,traceSample);if(followLatest)latestTrace=liveTrace;}
function resetEngine() { engine = new EvolutionEngine(currentShape(), state.population, state.networkType);if(state.game==='maze')architectEngine=new EvolutionEngine([4,10,8,1],Math.max(30,Math.floor(state.population/2)),'Liquid');refreshDecisionTrace(); }

function clearGenerationArchive(){generationArchive=[];viewedArchiveIndex=-1;followLatest=true;latestTrace=liveTrace;}
function viewedGeneration(){return viewedArchiveIndex>=0?generationArchive[viewedArchiveIndex]:undefined;}
function showArchiveGeneration(index:number){if(!generationArchive.length)return;viewedArchiveIndex=Math.max(0,Math.min(generationArchive.length-1,index));followLatest=viewedArchiveIndex===generationArchive.length-1;latestTrace=generationArchive[viewedArchiveIndex].trace;replayStep=0;replayPlaying=false;updateUI();}
function replayActions(record=viewedGeneration()){if(!record)return[];return record.actionRuns.flatMap(run=>Array(run.count).fill(run.action) as string[]);}
function setReplayStep(step:number){const actions=replayActions();replayStep=Math.max(0,Math.min(actions.length,step));if(replayStep>=actions.length)replayPlaying=false;updateReplayControls();drawGame(performance.now());}
function updateReplayControls(){const actions=replayActions(),has=actions.length>0,slider=$('#replay-slider') as HTMLInputElement;slider.disabled=!has;slider.max=String(actions.length);slider.value=String(replayStep);$('#replay-position').textContent=has?`MOVE ${replayStep} / ${actions.length}`:'NO EPISODE';$('#replay-action').textContent=!has?'Run a generation first':replayStep===0?'Ready at episode start':`LAST ACTION: ${actions[replayStep-1]}${replayStep>=actions.length?' · EPISODE FINISHED':''}`;const play=$('[data-action="replay-toggle"]') as HTMLButtonElement;play.disabled=!has;play.innerHTML=replayPlaying?'<i data-lucide="pause"></i><span>PAUSE REPLAY</span>':'<i data-lucide="play"></i><span>PLAY EPISODE</span>';createIcons({icons});}
function compressActions(actions:string[]){const runs:Array<{action:string;count:number}>=[];for(const action of actions){const last=runs.at(-1);if(last?.action===action)last.count++;else runs.push({action,count:1});}return runs;}
function storeGeneration(){const record:GenerationRecord={generation:state.generation,best:state.bestFitness,average:state.averageFitness,species:state.species,trace:liveTrace,decisions:lastEpisode.decisions,decisionLimit:lastEpisode.decisionLimit,timeLimitSeconds:state.episodeTimeLimit,actionRuns:compressActions(lastEpisode.actions),maze:state.game==='maze'?{...state.maze,walls:[...state.maze.walls]}:undefined};generationArchive.push(record);if(followLatest){viewedArchiveIndex=generationArchive.length-1;latestTrace=record.trace;}}

function renderGameList() {
  $('#game-list').innerHTML = games.map(game => `
    <button class="game-card ${state.game === game.id ? 'active' : ''}" data-game="${game.id}" style="--game-color:${game.color}">
      <span class="game-icon"><i data-lucide="${game.icon}"></i></span><span><strong>${game.name}</strong><small>${game.description}</small></span><span class="game-status-dot"></span>
    </button>`).join('');
  createIcons({ icons });
}

function renderLayers() {
  $('#layer-list').innerHTML = state.hiddenLayers.map((size, index) => `<div class="layer-row"><span>Hidden ${index + 1}</span><button data-layer-dec="${index}"><i data-lucide="minus"></i></button><b>${size}</b><button data-layer-inc="${index}"><i data-lucide="plus"></i></button><button class="remove-layer" data-layer-remove="${index}" ${state.hiddenLayers.length === 1 ? 'disabled' : ''}><i data-lucide="x"></i></button></div>`).join('');
  createIcons({ icons });
}

function setCanvasSize(canvas: HTMLCanvasElement) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * ratio));
  const h = Math.max(1, Math.floor(rect.height * ratio));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function drawGame(t: number) {
  const { ctx, width: w, height: h } = setCanvasSize(gameCanvas);
  ctx.clearRect(0, 0, w, h);
  const accent = games.find(g => g.id === state.game)?.color || '#b9ff66';
  const grid = 24;
  ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.shadowColor = accent; ctx.shadowBlur = 12;drawStoredDecision(ctx,w,h,accent);
  ctx.shadowBlur = 0;
}

function observationValue(label:string){return latestTrace.observations.find(item=>item.label===label)?.value||0;}
function pongReplayState(actions:string[],steps:number){let paddle=.5,opponent=.5,ballX=.5,ballY=.15,vx=-.035,vy=.037,rallies=0,finished=false;for(let step=0;step<Math.min(steps,actions.length);step++){ballX+=vx;ballY+=vy;if(ballY<.04||ballY>.96){vy*=-1;ballY=Math.max(.04,Math.min(.96,ballY));}opponent=Math.max(.12,Math.min(.88,opponent+Math.sign(ballY-opponent)*.045));const action=actions[step];paddle=Math.max(.12,Math.min(.88,paddle+(action==='UP'?-.06:action==='DOWN'?.06:0)));if(ballX<.06){if(Math.abs(ballY-paddle)<.17){vx=Math.abs(vx)*1.015;ballX=.06;rallies++;}else{finished=true;break;}}else if(ballX>.94){vx=-Math.abs(vx)*1.015;ballX=.94;rallies++;}}return{paddle,opponent,ballX,ballY,rallies,finished};}
function drawDecisionArrow(ctx:CanvasRenderingContext2D,x:number,y:number,action:string,accent:string){const moves:Record<string,[number,number]>={RIGHT:[1,0],LEFT:[-1,0],UP:[0,-1],DOWN:[0,1],'MOVE RIGHT':[1,0],'MOVE LEFT':[-1,0],'MOVE UP':[0,-1],'MOVE DOWN':[0,1],FLAP:[0,-1],JUMP:[0,-1]};const move=moves[action];if(!move)return;ctx.strokeStyle=accent;ctx.fillStyle=accent;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+move[0]*55,y+move[1]*55);ctx.stroke();ctx.beginPath();ctx.arc(x+move[0]*55,y+move[1]*55,6,0,Math.PI*2);ctx.fill();}
function drawStoredDecision(ctx:CanvasRenderingContext2D,w:number,h:number,accent:string){
  if(!generationArchive.length){ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='600 18px Inter';ctx.textAlign='center';ctx.fillText('No generation recorded yet',w/2,h/2-8);ctx.fillStyle='rgba(255,255,255,.4)';ctx.font='11px Inter';ctx.fillText('Press Start or run one generation to create the first real champion record.',w/2,h/2+16);return;}
  if(state.game==='snake'){
    const size=9,cell=Math.min(30,(h-55)/size),ox=(w-cell*size)/2,oy=(h-cell*size)/2;ctx.strokeStyle='rgba(255,255,255,.1)';for(let i=0;i<=size;i++){ctx.beginPath();ctx.moveTo(ox+i*cell,oy);ctx.lineTo(ox+i*cell,oy+size*cell);ctx.stroke();ctx.beginPath();ctx.moveTo(ox,oy+i*cell);ctx.lineTo(ox+size*cell,oy+i*cell);ctx.stroke();}const hx=ox+(observationValue('Head X')*size+.5)*cell,hy=oy+(observationValue('Head Y')*size+.5)*cell,fx=ox+(observationValue('Food X')*size+.5)*cell,fy=oy+(observationValue('Food Y')*size+.5)*cell;ctx.fillStyle=accent;roundRect(ctx,hx-cell*.38,hy-cell*.38,cell*.76,cell*.76,6);ctx.fill();ctx.fillStyle='#ff5277';ctx.beginPath();ctx.arc(fx,fy,cell*.26,0,Math.PI*2);ctx.fill();drawDecisionArrow(ctx,hx,hy,latestTrace.chosenAction,accent);
  }else if(state.game==='flappy'){
    const birdX=w*.25,birdY=observationValue('Bird height')*h,pipeX=birdX+observationValue('Pipe distance')*(w-birdX-60),gapTop=observationValue('Gap top')*h,gapBottom=observationValue('Gap bottom')*h;ctx.fillStyle='#253246';ctx.fillRect(pipeX,0,48,gapTop);ctx.fillRect(pipeX,gapBottom,48,h-gapBottom);ctx.fillStyle=accent;ctx.beginPath();ctx.arc(birdX,birdY,16,0,Math.PI*2);ctx.fill();drawDecisionArrow(ctx,birdX,birdY,latestTrace.chosenAction,accent);
  }else if(state.game==='pong'||state.game==='breakout'){
    const paddleX=observationValue(state.game==='pong'?'Paddle height':'Paddle X'),ball=observationValue(state.game==='pong'?'Ball height':'Ball X');if(state.game==='pong'){const frame=pongReplayState(replayActions(),replayStep);ctx.setLineDash([7,9]);ctx.strokeStyle='rgba(255,255,255,.12)';ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=accent;roundRect(ctx,38,frame.paddle*h-42,12,84,5);ctx.fill();ctx.fillStyle='#ff7ad9';roundRect(ctx,w-50,frame.opponent*h-42,12,84,5);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(frame.ballX*w,frame.ballY*h,9,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,.62)';ctx.font='700 10px DM Mono';ctx.textAlign='center';ctx.fillText(`RALLIES ${frame.rallies}${frame.finished?' · MISSED':''}`,w/2,30);}else{for(let r=0;r<4;r++)for(let c=0;c<9;c++){ctx.fillStyle=`hsl(${20+r*35} 80% 60%)`;ctx.fillRect(35+c*(w-70)/9,25+r*22,(w-82)/9,14);}const px=paddleX*w,bx=ball*w;ctx.fillStyle=accent;roundRect(ctx,px-42,h-34,84,9,5);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bx,h*.48,8,0,Math.PI*2);ctx.fill();drawDecisionArrow(ctx,px,h-45,latestTrace.chosenAction,accent);}
  }else if(state.game==='dino'){
    const ground=h*.78,jump=observationValue('Jump height')*h,obstacleX=w*.2+observationValue('Obstacle distance')*w*.65;ctx.strokeStyle='rgba(255,255,255,.25)';ctx.beginPath();ctx.moveTo(0,ground);ctx.lineTo(w,ground);ctx.stroke();ctx.fillStyle=accent;roundRect(ctx,w*.25-17,ground-38-jump,34,38,6);ctx.fill();ctx.fillStyle='#ff7a8f';ctx.fillRect(obstacleX,ground-30,15,30);drawDecisionArrow(ctx,w*.25,ground-45-jump,latestTrace.chosenAction,accent);
  }else if(state.game==='lander'){
    const x=observationValue('Lander X')*w,y=(1-observationValue('Lander height'))*h*.7+35;ctx.strokeStyle='rgba(255,255,255,.22)';ctx.beginPath();ctx.moveTo(0,h*.82);ctx.lineTo(w,h*.82);ctx.stroke();ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(x,y-22);ctx.lineTo(x-19,y+17);ctx.lineTo(x+19,y+17);ctx.closePath();ctx.fill();drawDecisionArrow(ctx,x,y,latestTrace.chosenAction,accent);
  }else if(state.game==='tictactoe'){
    const size=Math.min(w,h)*.65,ox=(w-size)/2,oy=(h-size)/2;ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=3;for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(ox+i*size/3,oy);ctx.lineTo(ox+i*size/3,oy+size);ctx.stroke();ctx.beginPath();ctx.moveTo(ox,oy+i*size/3);ctx.lineTo(ox+size,oy+i*size/3);ctx.stroke();}ctx.font=`700 ${size/6}px Inter`;ctx.textAlign='center';ctx.textBaseline='middle';for(let i=0;i<9;i++){const ours=observationValue(`Our mark cell ${i+1}`),theirs=observationValue(`Opponent cell ${i+1}`);if(ours||theirs){ctx.fillStyle=ours?accent:'#ff7ad9';ctx.fillText(ours?'X':'O',ox+(i%3+.5)*size/3,oy+(Math.floor(i/3)+.5)*size/3);}}const chosen=Number(latestTrace.chosenAction.replace(/\D/g,''))-1;if(chosen>=0){ctx.strokeStyle=accent;ctx.strokeRect(ox+(chosen%3)*size/3+5,oy+Math.floor(chosen/3)*size/3+5,size/3-10,size/3-10);}
  }else if(state.game==='minesweeper'||state.game==='merge2048'){
    const n=state.game==='minesweeper'?9:4,items=latestTrace.observations,s=Math.min(state.game==='minesweeper'?34:60,(h-35)/n),ox=(w-n*s)/2,oy=(h-n*s)/2;for(let i=0;i<n*n;i++){const value=items[i]?.value||0;ctx.fillStyle=value<0?'#4a1f2b':'#172332';roundRect(ctx,ox+(i%n)*s+2,oy+Math.floor(i/n)*s+2,s-4,s-4,5);ctx.fill();ctx.fillStyle=value<0?'#ff5277':'#c8d2df';ctx.font=`600 ${Math.max(9,s*.28)}px Inter`;ctx.textAlign='center';ctx.fillText(value<0?'×':value.toFixed(1),ox+(i%n+.5)*s,oy+(Math.floor(i/n)+.62)*s);}const chosen=Number(latestTrace.chosenAction.replace(/\D/g,''))-1;if(chosen>=0&&chosen<n*n){ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.strokeRect(ox+(chosen%n)*s+3,oy+Math.floor(chosen/n)*s+3,s-6,s-6);}
  }else if(state.game==='xor'){
    const a=observationValue('Input A'),b=observationValue('Input B');ctx.fillStyle='#dce4ef';ctx.font='700 44px Inter';ctx.textAlign='center';ctx.fillText(`${a.toFixed(0)}  XOR  ${b.toFixed(0)}`,w/2,h*.46);ctx.fillStyle=accent;ctx.font='700 28px Inter';ctx.fillText(`→ ${latestTrace.chosenAction.replace('OUTPUT ','')}`,w/2,h*.64);
  }else if(state.game==='maze'){
    const m=viewedGeneration()?.maze||state.maze,cell=Math.min((w-70)/m.width,(h-35)/m.height),ox=(w-cell*m.width)/2,oy=(h-cell*m.height)/2;for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){const i=y*m.width+x;ctx.fillStyle=m.walls[i]?'#263447':'#0d1520';ctx.fillRect(ox+x*cell,oy+y*cell,cell-1,cell-1);}const x=m.start%m.width,y=Math.floor(m.start/m.width),gx=m.goal%m.width,gy=Math.floor(m.goal/m.width);ctx.fillStyle=accent;ctx.beginPath();ctx.arc(ox+(x+.5)*cell,oy+(y+.5)*cell,cell*.3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff7ad9';ctx.fillRect(ox+gx*cell+3,oy+gy*cell+3,cell-6,cell-6);drawDecisionArrow(ctx,ox+(x+.5)*cell,oy+(y+.5)*cell,latestTrace.chosenAction,accent);
  }else{
    const rows=latestTrace.observations.slice(0,10);ctx.textAlign='left';rows.forEach((item,i)=>{const y=35+i*24;ctx.fillStyle='#8290a4';ctx.font='10px Inter';ctx.fillText(item.label,35,y);ctx.fillStyle=accent;ctx.fillRect(180,y-9,Math.abs(item.value)*Math.max(0,w-250),7);ctx.fillStyle='#dce4ef';ctx.fillText(traceValue(item.value),w-55,y);});
  }
  ctx.fillStyle='rgba(6,10,16,.82)';roundRect(ctx,14,h-45,Math.min(w-28,360),31,7);ctx.fill();ctx.fillStyle=accent;ctx.font='700 11px DM Mono';ctx.textAlign='left';const replayAction=replayStep>0?replayActions()[replayStep-1]:latestTrace.chosenAction;ctx.fillText(`GEN ${viewedGeneration()?.generation??state.generation} CHAMPION → ${replayAction}`,26,h-25);
}

function drawSnake(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, accent: string) {
  const size = 22, cx = Math.floor(w / size / 2), cy = Math.floor(h / size / 2);
  const pulse = state.running ? Math.floor(t / 230) % 6 : 0;
  const snake = [[cx + pulse,cy],[cx+1+Math.min(pulse,2),cy],[cx+2+Math.min(pulse,1),cy],[cx+3,cy],[cx+3,cy+1],[cx+3,cy+2],[cx+2,cy+2],[cx+1,cy+2]];
  snake.forEach(([x,y], i) => { ctx.fillStyle = i === 0 ? '#efffdc' : accent; roundRect(ctx, x*size, y*size, size-3, size-3, 5); ctx.fill(); });
  ctx.fillStyle = '#ff5277'; ctx.beginPath(); ctx.arc((cx-4)*size+10, (cy+2)*size+10, 7, 0, Math.PI*2); ctx.fill();
}

function drawTicTacToe(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, accent: string) {
  const size = Math.min(w, h) * .62, x = (w-size)/2, y=(h-size)/2;
  ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.lineWidth=3;
  for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(x+i*size/3,y);ctx.lineTo(x+i*size/3,y+size);ctx.stroke();ctx.beginPath();ctx.moveTo(x,y+i*size/3);ctx.lineTo(x+size,y+i*size/3);ctx.stroke();}
  const moves = ['X','O','X','O','X','O','X']; const shown = state.running ? 3 + Math.floor(t/700)%5 : 4;
  const cells=[0,4,8,2,6,3,1]; ctx.font=`700 ${size/5}px Inter, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  cells.slice(0,shown).forEach((cell,i)=>{ctx.fillStyle=i%2===0?accent:'#ff7ad9';ctx.fillText(moves[i],x+(cell%3+.5)*size/3,y+(Math.floor(cell/3)+.5)*size/3);});
}

function drawMinesweeper(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, accent: string) {
  const n=8, s=Math.min(42,(h-40)/n), ox=(w-n*s)/2, oy=(h-n*s)/2; const reveal=state.running?12+Math.floor(t/300)%40:17;
  for(let i=0;i<n*n;i++){const x=ox+(i%n)*s,y=oy+Math.floor(i/n)*s;ctx.fillStyle=i<reveal?'#17202d':'#222c3a';ctx.strokeStyle='#334153';roundRect(ctx,x+2,y+2,s-4,s-4,4);ctx.fill();ctx.stroke();if(i<reveal&&i%5){ctx.fillStyle=i%3===0?'#ff7ad9':accent;ctx.font='600 14px Inter';ctx.textAlign='center';ctx.fillText(String((i*7)%4),x+s/2,y+s*.64);}}
}

function drawFlappy(ctx: CanvasRenderingContext2D,w:number,h:number,t:number,accent:string){const shift=state.running?(t*.12)%220:40;ctx.fillStyle='#18202d';for(let i=0;i<4;i++){const x=w-i*220+shift-80,gap=90+Math.sin(i*2)*40;ctx.fillRect(x,0,48,gap);ctx.fillRect(x,gap+120,48,h-gap-120);}const by=h*.48+Math.sin(t/280)*42;ctx.fillStyle=accent;ctx.beginPath();ctx.arc(w*.28,by,17,0,Math.PI*2);ctx.fill();ctx.fillStyle='#080b13';ctx.beginPath();ctx.arc(w*.285,by-5,3,0,Math.PI*2);ctx.fill();}
function drawPong(ctx:CanvasRenderingContext2D,w:number,h:number,t:number,accent:string){const y1=h/2+Math.sin(t/500)*80,y2=h/2+Math.cos(t/650)*70,bx=w/2+Math.sin(t/650)*w*.35,by=h/2+Math.sin(t/380)*h*.32;ctx.fillStyle=accent;roundRect(ctx,40,y1-42,10,84,5);ctx.fill();roundRect(ctx,w-50,y2-42,10,84,5);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bx,by,8,0,Math.PI*2);ctx.fill();ctx.setLineDash([7,9]);ctx.strokeStyle='rgba(255,255,255,.12)';ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();ctx.setLineDash([]);}
function drawXor(ctx:CanvasRenderingContext2D,w:number,h:number,t:number,accent:string){const rows=[['0','0','0'],['0','1','1'],['1','0','1'],['1','1','0']];ctx.font='600 26px Inter';ctx.textAlign='center';rows.forEach((r,i)=>{const y=h*.23+i*55;ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillText(r[0],w*.35,y);ctx.fillText('⊕',w*.45,y);ctx.fillText(r[1],w*.55,y);ctx.fillStyle=accent;ctx.fillText('→  '+r[2],w*.7,y);});const accuracy=Math.min(99.8,50+(state.generation/35));ctx.fillStyle=accent;ctx.font='700 16px Inter';ctx.fillText(`${accuracy.toFixed(1)}% accuracy`,w/2,h*.83);}
function drawBreakout(ctx:CanvasRenderingContext2D,w:number,h:number,t:number,accent:string){for(let r=0;r<4;r++)for(let c=0;c<9;c++){ctx.fillStyle=`hsl(${20+r*35} 90% 65%)`;roundRect(ctx,35+c*(w-70)/9,30+r*24,(w-78)/9,16,4);ctx.fill();}const px=w/2+Math.sin(t/540)*w*.35,bx=w/2+Math.sin(t/430)*w*.38,by=h*.54+Math.cos(t/510)*h*.32;ctx.fillStyle=accent;roundRect(ctx,px-42,h-35,84,9,5);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bx,by,7,0,Math.PI*2);ctx.fill();}
function drawDino(ctx:CanvasRenderingContext2D,w:number,h:number,t:number,accent:string){const ground=h*.78;ctx.strokeStyle='rgba(255,255,255,.25)';ctx.beginPath();ctx.moveTo(0,ground);ctx.lineTo(w,ground);ctx.stroke();const jump=Math.max(0,Math.sin(t/380))*65;ctx.fillStyle=accent;roundRect(ctx,w*.25-17,ground-38-jump,34,38,6);ctx.fill();for(let i=0;i<3;i++){const x=w-((t*.18+i*230)%w);ctx.fillStyle='#ff7a8f';ctx.fillRect(x,ground-29,13,29);ctx.fillRect(x-6,ground-19,7,7);}}
function drawMerge(ctx:CanvasRenderingContext2D,w:number,h:number,t:number,accent:string){const s=Math.min(58,(h-45)/4),ox=(w-s*4)/2,oy=(h-s*4)/2;for(let i=0;i<16;i++){const value=[2,4,0,8,16,0,4,2,0,32,8,0,2,0,64,4][(i+Math.floor(t/1200))%16];ctx.fillStyle=value?`hsl(${40+Math.log2(value)*18} 70% 55%)`:'#1b2533';roundRect(ctx,ox+(i%4)*s+3,oy+Math.floor(i/4)*s+3,s-6,s-6,7);ctx.fill();if(value){ctx.fillStyle='#08101a';ctx.font=`700 ${value>32?13:16}px Inter`;ctx.textAlign='center';ctx.fillText(String(value),ox+(i%4+.5)*s,oy+(Math.floor(i/4)+.6)*s);}}}
function drawLander(ctx:CanvasRenderingContext2D,w:number,h:number,t:number,accent:string){const x=w*.5+Math.sin(t/850)*w*.18,y=h*.3+Math.abs(Math.sin(t/1100))*h*.28;ctx.strokeStyle='rgba(255,255,255,.22)';ctx.beginPath();ctx.moveTo(0,h*.82);for(let i=0;i<9;i++)ctx.lineTo(i*w/8,h*.82-(i%3)*12);ctx.stroke();ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(x,y-22);ctx.lineTo(x-19,y+17);ctx.lineTo(x+19,y+17);ctx.closePath();ctx.fill();ctx.fillStyle='#ffcb66';ctx.beginPath();ctx.moveTo(x-7,y+18);ctx.lineTo(x,y+39+Math.random()*12);ctx.lineTo(x+7,y+18);ctx.fill();}
function solveMazePath(m:MazeEnvironment){const queue=[m.start],came=new Map<number,number>();came.set(m.start,-1);while(queue.length){const p=queue.shift()!;if(p===m.goal)break;for(const d of [-m.width,1,m.width,-1]){const n=p+d;if(!m.walls[n]&&!came.has(n)){came.set(n,p);queue.push(n);}}}const path:number[]=[];if(!came.has(m.goal))return path;for(let p=m.goal;p!==-1;p=came.get(p)??-1)path.push(p);return path.reverse();}
function drawMaze(ctx:CanvasRenderingContext2D,w:number,h:number,t:number,accent:string){const m=state.maze,cell=Math.min((w-70)/m.width,(h-35)/m.height),ox=(w-cell*m.width)/2,oy=(h-cell*m.height)/2;for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){const i=y*m.width+x;ctx.fillStyle=m.walls[i]?'#263447':'#0d1520';ctx.fillRect(ox+x*cell,oy+y*cell,cell-1,cell-1);}const path=solveMazePath(m),shown=Math.min(path.length,Math.floor((t/160)%Math.max(1,path.length+8)));ctx.fillStyle='rgba(185,255,102,.28)';path.slice(0,shown).forEach(i=>ctx.fillRect(ox+(i%m.width)*cell+cell*.25,oy+Math.floor(i/m.width)*cell+cell*.25,cell*.5,cell*.5));const agent=path[Math.max(0,shown-1)]??m.start;ctx.fillStyle=accent;ctx.beginPath();ctx.arc(ox+(agent%m.width+.5)*cell,oy+(Math.floor(agent/m.width)+.5)*cell,cell*.32,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff7ad9';const g=m.goal;ctx.fillRect(ox+(g%m.width)*cell+3,oy+Math.floor(g/m.width)*cell+3,cell-6,cell-6);ctx.fillStyle='#8190a5';ctx.font='600 9px Inter';ctx.textAlign='left';ctx.fillText(`SOLVER ${state.generation}  vs  ARCHITECT ${state.architectGeneration} · difficulty ${mazeDifficulty()}%`,ox,oy-9);}
function mazeDifficulty(){const density=state.maze.walls.filter(Boolean).length/state.maze.walls.length;const path=solveMazePath(state.maze);return Math.round(Math.min(99,density*85+(path.length/(state.maze.width*state.maze.height))*70));}
function drawCustom(ctx:CanvasRenderingContext2D,w:number,h:number,accent:string){if(state.custom?.thumbnail){const img=new Image();img.src=state.custom.thumbnail;ctx.globalAlpha=.7;ctx.drawImage(img,0,0,w,h);ctx.globalAlpha=1;const r=state.custom.region;ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.setLineDash([8,6]);ctx.strokeRect(r.x*w,r.y*h,r.w*w,r.h*h);ctx.setLineDash([]);}else{ctx.fillStyle='rgba(255,255,255,.45)';ctx.font='600 18px Inter';ctx.textAlign='center';ctx.fillText('Configure a screen task to begin',w/2,h/2);}}

function roundRect(ctx: CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}

function drawNetwork(canvas = networkCanvas, compact = false) {
  const { ctx, width: w, height: h } = setCanvasSize(canvas); ctx.clearRect(0,0,w,h);
  if(!generationArchive.length){ctx.fillStyle='rgba(255,255,255,.62)';ctx.font='600 15px Inter';ctx.textAlign='center';ctx.fillText('No champion network stored yet',w/2,h/2-6);ctx.fillStyle='rgba(255,255,255,.36)';ctx.font='10px Inter';ctx.fillText('Run one generation to record real weights and activations.',w/2,h/2+17);return;}
  const cap=compact?5:10;
  const selected=latestTrace.layers.map((values,layerIndex)=>{
    const limit=Math.min(cap,values.length);const ranked=values.map((value,index)=>({value,index})).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).slice(0,limit).map(item=>item.index);
    if(layerIndex===latestTrace.layers.length-1&&!ranked.includes(latestTrace.chosenIndex)){ranked[ranked.length-1]=latestTrace.chosenIndex;}
    return ranked.sort((a,b)=>a-b);
  });
  const points=selected.map((indices,li)=>indices.map((index,i)=>({index,x:30+(w-60)*(li/Math.max(1,selected.length-1)),y:18+(h-36)*((i+1)/(indices.length+1))})));
  for(let li=0;li<points.length-1;li++)for(const source of points[li])for(const target of points[li+1]){
    const weight=latestTrace.weights[li]?.[target.index]?.[source.index]||0;if(Math.abs(weight)<.12)continue;const activity=Math.min(1,Math.abs(latestTrace.layers[li]?.[source.index]||0));const alpha=.08+Math.min(.68,Math.abs(weight)*.35)*(.45+activity*.55);
    ctx.strokeStyle=weight>=0?`rgba(185,255,102,${alpha})`:`rgba(255,82,119,${alpha})`;ctx.lineWidth=compact?Math.max(.4,Math.abs(weight)):.55+Math.min(3,Math.abs(weight)*1.7);ctx.beginPath();ctx.moveTo(source.x,source.y);const mid=(source.x+target.x)/2;ctx.bezierCurveTo(mid,source.y,mid,target.y,target.x,target.y);ctx.stroke();
  }
  points.forEach((layer,li)=>layer.forEach(point=>{const activation=latestTrace.layers[li]?.[point.index]||0;const amount=Math.min(1,Math.abs(activation));ctx.fillStyle=li===0?'#72a7ff':li===points.length-1?'#ff7ad9':'#b9ff66';ctx.globalAlpha=.22+amount*.78;ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=compact?3:amount*12;ctx.beginPath();ctx.arc(point.x,point.y,compact?3.5:5.5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.shadowBlur=0;if(li===points.length-1&&point.index===latestTrace.chosenIndex){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(point.x,point.y,compact?6:9,0,Math.PI*2);ctx.stroke();}}));
}

function drawChart() {
  const {ctx,width:w,height:h}=setCanvasSize(fitnessChart);ctx.clearRect(0,0,w,h);const pad={l:44,r:18,t:16,b:28};
  ctx.strokeStyle='rgba(255,255,255,.07)';ctx.fillStyle='rgba(255,255,255,.32)';ctx.font='10px Inter';ctx.textAlign='right';for(let i=0;i<5;i++){const y=pad.t+(h-pad.t-pad.b)*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(String(Math.round((4-i)*state.bestFitness/4)),pad.l-9,y+3);}
  const data=state.history,max=Math.max(...data,10)*1.12;const pts=data.map((v,i)=>({x:pad.l+(w-pad.l-pad.r)*i/Math.max(1,data.length-1),y:h-pad.b-(h-pad.t-pad.b)*v/max}));
  const grad=ctx.createLinearGradient(0,pad.t,0,h-pad.b);grad.addColorStop(0,'rgba(185,255,102,.25)');grad.addColorStop(1,'rgba(185,255,102,0)');ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.lineTo(pts.at(-1)!.x,h-pad.b);ctx.lineTo(pts[0].x,h-pad.b);ctx.closePath();ctx.fillStyle=grad;ctx.fill();ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#b9ff66';ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();pts.forEach((p,i)=>{const y=h-pad.b-(h-pad.t-pad.b)*(data[i]*.48)/max;i?ctx.lineTo(p.x,y):ctx.moveTo(p.x,y)});ctx.strokeStyle='#72a7ff';ctx.lineWidth=1.5;ctx.stroke();
}

function traceValue(value:number){return `${value<0?'−':''}${Math.abs(value).toFixed(2)}`;}
function activationRows(items:Array<{label:string;value:number}>,chosenLabel?:string){return items.map(item=>`<div class="activation-row ${item.label===chosenLabel?'selected':''}"><span>${item.label}</span><i><em style="width:${Math.min(100,Math.abs(item.value)*100)}%"></em></i><b>${traceValue(item.value)}</b></div>`).join('');}
function renderDecisionTrace(){
  if(!generationArchive.length){$('#observation-list').innerHTML='<span>No stored observation</span>';$('#chosen-action').textContent='NOT RECORDED';$('#network-choice').textContent='NOT RECORDED';$('#choice-reason').textContent='Run one generation to record a real champion decision.';$('#fitness-rule').textContent='The scoring rule will appear with the first stored champion.';$('#network-inputs').innerHTML='<div class="empty-readout">No stored observations</div>';$('#network-outputs').innerHTML='<div class="empty-readout">No stored output activations</div>';$('#neuron-total').textContent='— neurons';$('#connection-total').textContent='— weighted connections';$('#family-label').textContent=state.networkType;return;}
  const useful=latestTrace.observations.filter(item=>item.label!=='Bias'&&item.label!=='Replay time').sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).slice(0,4);
  $('#observation-list').innerHTML=useful.map(item=>`<span>${item.label} <b>${traceValue(item.value)}</b></span>`).join('');
  $('#chosen-action').textContent=latestTrace.chosenAction;$('#network-choice').textContent=latestTrace.chosenAction;$('#choice-reason').textContent=latestTrace.explanation;$('#fitness-rule').textContent=latestTrace.fitnessRule;
  $('#network-inputs').innerHTML=activationRows(useful);
  const shownOutputs=[...latestTrace.outputs].sort((a,b)=>b.value-a.value).slice(0,6);const chosenLabel=latestTrace.outputs[latestTrace.chosenIndex]?.label;
  if(chosenLabel&&!shownOutputs.some(item=>item.label===chosenLabel))shownOutputs[shownOutputs.length-1]=latestTrace.outputs[latestTrace.chosenIndex];
  $('#network-outputs').innerHTML=activationRows(shownOutputs,chosenLabel);
  const neurons=latestTrace.layers.reduce((sum,layer)=>sum+layer.length,0);const connections=latestTrace.weights.reduce((sum,matrix)=>sum+matrix.reduce((rowSum,row)=>rowSum+row.length,0),0);
  $('#neuron-total').textContent=`${neurons} neurons`;$('#connection-total').textContent=`${connections} weighted connections`;$('#family-label').textContent=state.networkType;
}

function renderArchiveControls(){
  const slider=$('#archive-slider') as HTMLInputElement,record=viewedGeneration(),has=generationArchive.length>0;
  slider.disabled=!has;slider.max=String(Math.max(0,generationArchive.length-1));slider.value=String(Math.max(0,viewedArchiveIndex));
  $('#archive-position').textContent=record?`Viewing generation ${record.generation} of ${generationArchive.at(-1)!.generation} · champion fitness ${record.best.toFixed(1)}${followLatest?' · FOLLOWING LATEST':''}`:'No generations stored yet — run one to create the first real record';
  const prev=$('[data-action="archive-prev"]') as HTMLButtonElement,next=$('[data-action="archive-next"]') as HTMLButtonElement,best=$('[data-action="archive-best"]') as HTMLButtonElement;
  prev.disabled=!has||viewedArchiveIndex<=0;next.disabled=!has||viewedArchiveIndex>=generationArchive.length-1;best.disabled=!has;document.querySelectorAll<HTMLButtonElement>('[data-action="archive-latest"]').forEach(button=>button.disabled=!has);
}

function updateUI() {
  const game=games.find(g=>g.id===state.game);$('#arena-title').textContent=state.game==='custom'?(state.custom?.sourceName||'Custom task'):(game?.name||'Custom');
  const record=viewedGeneration(),trained=Boolean(record);$('#champion-label').textContent=record?`Generation ${record.generation} champion`:'No generation recorded';$('#network-status').textContent=record?`GEN ${record.generation} CHAMPION`:'NO STORED CHAMPION';$('#arena-explainer').textContent=record?`Generation ${record.generation}'s champion made ${record.decisions} move${record.decisions===1?'':'s'} out of a ${record.decisionLimit}-move (${record.timeLimitSeconds}s) limit before its episode ended. This panel shows one exact decision from that real trial. Training is at generation ${state.generation}.`:'Run a generation to evaluate full multi-move episodes and store the champion’s real move count, decision, weights, and fitness.';
  $('#episode-hud').textContent=record?`${record.decisions} / ${record.decisionLimit} MOVES USED`:`${state.episodeTimeLimit}s × ${state.decisionsPerSecond}/s = ${state.episodeTimeLimit*state.decisionsPerSecond} MOVES MAX`;
  $('#episode-moves').innerHTML=record?record.actionRuns.map((run,index)=>`<span><b>${index+1}</b>${run.action}${run.count>1?` <i>×${run.count}</i>`:''}</span>`).join(''):'<em>Run a generation to record every move in order.</em>';
  $('#episode-budget').textContent=`${state.episodeTimeLimit*state.decisionsPerSecond} MOVES MAX`;
  $('#generation').textContent=String(state.generation).padStart(3,'0');$('#generation-target').textContent=String(state.targetGenerations);const generationInput=$('#generations') as HTMLInputElement;generationInput.max=String(Math.max(2000,state.targetGenerations));generationInput.value=String(state.targetGenerations);$('#generations-value').textContent=state.targetGenerations.toLocaleString();const progress=Math.min(100,state.generation/state.targetGenerations*100);($('#generation-bar') as HTMLElement).style.width=`${progress}%`;$('#generation-percent').textContent=`${progress.toFixed(1)}%`;
  $('#best-fitness').textContent=(record?.best??0).toFixed(1);$('#average-fitness').textContent=(record?.average??0).toFixed(1);$('#species').textContent=String(record?.species??1);$('#population-metric').textContent=String(state.population);$('#alive-count').textContent=record?`Showing generation ${record.generation} champion`:state.running?'Evaluating full population':'Waiting to train';
  $('#input-count').textContent=String(game?.inputs||8);$('#hidden-count').textContent=String(state.hiddenLayers.reduce((a,b)=>a+b,0));$('#output-count').textContent=String(game?.outputs||state.custom?.actions.length||4);
  const networkSelect=$('#network-type') as HTMLSelectElement;networkSelect.value=state.networkType;$('#network-help').textContent=networkDescriptions[state.networkType];
  $('#forge-points').textContent=state.forgePoints.toLocaleString();$('#player-level').textContent=String(state.level);($('#level-progress') as HTMLElement).style.width=`${Math.min(100,state.xp/(state.level*120)*100)}%`;$('#boost-count').textContent=String(state.boosts);$('#maze-tools').classList.toggle('hidden',state.game!=='maze');
  const boosted=performance.now()<boostUntil;document.body.classList.toggle('boosted',boosted);const boostButton=$('[data-action="boost"]') as HTMLButtonElement;boostButton.classList.toggle('active',boosted);boostButton.disabled=state.boosts<1&&!boosted;
  const start=$('[data-action="toggle-run"]') as HTMLButtonElement;start.classList.toggle('running',state.running);start.innerHTML=state.running?'<i data-lucide="pause"></i><span><strong>PAUSE EVOLUTION</strong><small>Space</small></span>':'<i data-lucide="play"></i><span><strong>START EVOLUTION</strong><small>Space</small></span>';createIcons({icons});
  renderArchiveControls();renderDecisionTrace();updateReplayControls();drawChart();
}

function openTrainingComplete(){
  completionShownFor=state.targetGenerations;
  state.running=false;
  updateUI();
  const root=$('#modal-root');
  const arena=state.game==='custom'?(state.custom?.sourceName||'Custom task'):(games.find(game=>game.id===state.game)?.name||'Custom task');
  root.className='modal-root open';
  root.innerHTML=`<div class="modal-backdrop"></div><section class="completion-modal" role="dialog" aria-modal="true" aria-labelledby="completion-title">
    <button class="completion-close" data-complete-close aria-label="Stay paused and close"><i data-lucide="x"></i></button>
    <div class="completion-hero"><span class="completion-trophy"><i data-lucide="trophy"></i></span><div><span class="eyebrow">TRAINING RUN COMPLETE</span><h2 id="completion-title">The run stopped normally</h2><p>Neural Forge finished all <strong>${state.targetGenerations.toLocaleString()} generations</strong> you asked it to run. Nothing is broken—it is paused and waiting for you to choose what happens next.</p></div></div>
    <div class="completion-summary">
      <div><span>Arena</span><strong>${arena}</strong></div><div><span>Best fitness</span><strong>${state.bestFitness.toFixed(1)}</strong></div><div><span>Average fitness</span><strong>${state.averageFitness.toFixed(1)}</strong></div><div><span>Network</span><strong>${state.networkType}</strong></div>
    </div>
    <div class="champion-explainer"><i data-lucide="brain-circuit"></i><div><strong>What is the champion?</strong><span>It is the highest-scoring neural network found during this run. Inspect it to see its neurons and weighted connections, or continue training to try to improve it.</span></div></div>
    <div class="completion-actions">
      <button class="completion-action primary" data-complete-continue><i data-lucide="fast-forward"></i><span><strong>Continue training</strong><small>Add 500 more generations</small></span></button>
      <button class="completion-action" data-complete-inspect><i data-lucide="scan-eye"></i><span><strong>Inspect champion network</strong><small>Show its neurons, lines, and weights</small></span></button>
      <button class="completion-action" data-complete-save><i data-lucide="save"></i><span><strong>Save this project</strong><small>Keep the champion and settings</small></span></button>
      <button class="completion-action" data-complete-reset><i data-lucide="rotate-ccw"></i><span><strong>Start a fresh run</strong><small>Reset scores; keep your settings</small></span></button>
    </div>
    <button class="completion-pause" data-complete-close>Stay paused for now</button>
  </section>`;
  createIcons({icons});
  const close=()=>{root.className='modal-root';};
  root.querySelectorAll('[data-complete-close]').forEach(node=>node.addEventListener('click',close));
  root.querySelector('[data-complete-continue]')?.addEventListener('click',()=>{state.targetGenerations+=500;completionShownFor=-1;state.running=true;runStartedAt=performance.now();close();updateUI();toast('Training extended',`Running to generation ${state.targetGenerations.toLocaleString()}.`,'fast-forward');});
  root.querySelector('[data-complete-inspect]')?.addEventListener('click',()=>{close();const panel=$('.network-panel');panel.scrollIntoView({behavior:'smooth',block:'center'});panel.classList.add('completion-focus');setTimeout(()=>panel.classList.remove('completion-focus'),2200);toast('Champion network','Green lines help the output; pink lines suppress it. Thicker lines have more influence.','brain-circuit');});
  root.querySelector('[data-complete-save]')?.addEventListener('click',async()=>{await saveProject();});
  root.querySelector('[data-complete-reset]')?.addEventListener('click',()=>{Object.assign(state,{running:false,generation:0,bestFitness:0,averageFitness:0,species:1,history:[0]});completionShownFor=-1;resetEngine();clearGenerationArchive();close();updateUI();toast('Fresh run ready','Scores and generation archive reset. Press Start when you are ready.','rotate-ccw');});
}

function evolveOne() {
  if(state.generation>=state.targetGenerations){state.running=false;if(completionShownFor!==state.targetGenerations)openTrainingComplete();else updateUI();return;}
  state.generation++;
  const previousBest=state.bestFitness;
  const result = engine.evolve(state.game, state.mutationRate, state.mutationStrength, state.elitism,state.game==='maze'?state.maze:undefined,{timeLimitSeconds:state.episodeTimeLimit,decisionsPerSecond:state.decisionsPerSecond});
  state.bestFitness = result.best;
  state.averageFitness = result.average;
  state.species = result.species;
  lastEpisode={decisions:result.championDecisions,decisionLimit:result.decisionLimit,actions:result.championActions};
  refreshDecisionTrace();
  replayStep=0;replayPlaying=false;
  storeGeneration();
  if(state.game==='maze'&&state.mazeMode==='coevolve'){
    const architect=architectEngine.evolve('maze-maker',state.mutationRate,state.mutationStrength,state.elitism);state.architectFitness=architect.best;state.architectGeneration++;
    if(state.generation%3===0)state.maze=architectEngine.generateMaze(state.maze.width,state.maze.height,state.architectGeneration);
  }
  const multiplier=performance.now()<boostUntil?3:1;const improvement=Math.max(0,result.best-previousBest);const earned=Math.max(1,Math.round((2+improvement*2+state.generationSpeed)*multiplier));state.forgePoints+=earned;state.xp+=earned;state.streak=improvement>.05?state.streak+1:0;
  const needed=state.level*120;if(state.xp>=needed){state.xp-=needed;state.level++;state.boosts++;toast(`Level ${state.level}!`,'Speed boost earned and generation cap increased.','sparkles');}
  if(state.streak>0&&state.streak%20===0){state.boosts++;toast('Hot streak!',`${state.streak} improving generations earned a boost.`,'flame');}
  localStorage.setItem('neural-forge-progress',JSON.stringify({forgePoints:state.forgePoints,xp:state.xp,level:state.level,streak:state.streak,boosts:state.boosts}));
  state.history.push(state.bestFitness);
  if(state.history.length>60) state.history.shift();
  updateUI();
}

function loop(t:number){gameTime=t;if(replayPlaying&&t-replayLastAt>=Math.max(40,1000/state.decisionsPerSecond)){const actions=replayActions();replayStep=Math.min(actions.length,replayStep+1);replayLastAt=t;if(replayStep>=actions.length)replayPlaying=false;updateReplayControls();}drawGame(t);drawNetwork(networkCanvas);const elapsed=state.running?(t-runStartedAt)/1000:0;const ramp=Math.min(6,1+elapsed*(state.acceleration/100)*.12);const boost=t<boostUntil?3:1;const base=[.5,1,2,5,12][state.speed]*state.generationSpeed*ramp*boost;const interval=Math.max(22,1050/base);$('#generation-rate').textContent=`${Math.round(60000/interval)} GEN/MIN`;if(state.running&&t-lastGenerationAt>interval){evolveOne();lastGenerationAt=t;}if(boostUntil&&t>=boostUntil){boostUntil=0;updateUI();toast('Boost complete','Acceleration returned to normal.','gauge');}animationFrame=requestAnimationFrame(loop);}

function selectGame(id:GameId){state.game=id;state.running=false;state.generation=0;state.history=[0];state.bestFitness=0;state.averageFitness=0;state.species=1;completionShownFor=-1;traceSample=0;runStartedAt=performance.now();resetEngine();clearGenerationArchive();renderGameList();updateUI();toast(games.find(g=>g.id===id)?.name||'Custom task','Arena loaded. Run a generation to create its first champion record.','gamepad-2');}

function toast(title:string,message:string,icon='sparkles'){const node=document.createElement('div');node.className='toast';node.innerHTML=`<i data-lucide="${icon}"></i><div><strong>${title}</strong><span>${message}</span></div>`;$('#toasts').append(node);createIcons({icons});setTimeout(()=>node.classList.add('show'),20);setTimeout(()=>{node.classList.remove('show');setTimeout(()=>node.remove(),250)},3400);}

function formatBytes(value:number){if(!value)return 'Size reported when download starts';const units=['B','KB','MB','GB'];let amount=value,index=0;while(amount>=1024&&index<units.length-1){amount/=1024;index++;}return `${amount.toFixed(index>1?1:0)} ${units[index]}`;}
function updateBadge(){document.querySelector<HTMLElement>('#update-dot')?.classList.toggle('available',Boolean(updateCheck?.updateAvailable));}
async function checkUpdates(showModal=false){if(!window.neuralForge){if(showModal)openUpdateModal('browser');return;}if(showModal)openUpdateModal('checking');try{updateCheck=await window.neuralForge.checkForUpdates();updateBadge();if(showModal)openUpdateModal(updateCheck.updateAvailable?'available':'current');else if(updateCheck.updateAvailable)toast(`Neural Forge ${updateCheck.update?.version} is ready`,'Open Updates to review and install it.','download-cloud');}catch(error){if(showModal)openUpdateModal('error',error instanceof Error?error.message:String(error));}}
function openUpdateModal(mode:'checking'|'available'|'current'|'browser'|'error',errorMessage=''){
  const root=$('#modal-root');root.className='modal-root open';const current=updateCheck?.currentVersion||'checking…',next=updateCheck?.update;
  const content=mode==='checking'?`<div class="update-state"><i data-lucide="loader-circle" class="spin"></i><h3>Checking the release server…</h3><p>Comparing this installed version with the Neural Forge update manifest.</p></div>`:mode==='available'&&next?`<div class="update-state update-ready"><i data-lucide="package-check"></i><span class="update-kicker">UPDATE AVAILABLE</span><h3>${current} → ${next.version}</h3><p>${next.notes}</p><div class="update-facts"><span><b>${formatBytes(next.size)}</b> download</span><span><b>SHA-256</b> verified before install</span></div><div class="update-progress hidden" id="update-progress"><div><span id="update-progress-copy">Starting download…</span><b id="update-percent">0%</b></div><i><em id="update-progress-bar"></em></i></div><button class="primary-button update-install" data-install-update><i data-lucide="download"></i> Download and install</button><small>Neural Forge closes only after the installer passes its safety check. Your saved progress stays in place.</small></div>`:mode==='current'?`<div class="update-state"><i data-lucide="badge-check"></i><span class="update-kicker">UP TO DATE</span><h3>Neural Forge ${current}</h3><p>You already have the newest published version.</p><button class="secondary-button" data-recheck-update><i data-lucide="refresh-cw"></i> Check again</button></div>`:mode==='browser'?`<div class="update-state"><i data-lucide="monitor-down"></i><span class="update-kicker">WEB PLAYGROUND</span><h3>Updates apply in the Windows app</h3><p>This browser page is always the current web build. Open the installed Neural Forge app and choose Updates to update the desktop copy.</p></div>`:`<div class="update-state update-error"><i data-lucide="triangle-alert"></i><span class="update-kicker">CHECK FAILED</span><h3>Could not check for updates</h3><p>${errorMessage||'The release server could not be reached.'}</p><button class="secondary-button" data-recheck-update><i data-lucide="refresh-cw"></i> Try again</button></div>`;
  root.innerHTML=`<div class="modal-backdrop" data-update-close></div><section class="update-modal" role="dialog" aria-modal="true" aria-labelledby="update-title"><div class="modal-heading"><div><span class="eyebrow">NEURAL FORGE DESKTOP</span><h2 id="update-title">Software update</h2></div><button data-update-close aria-label="Close"><i data-lucide="x"></i></button></div>${content}</section>`;createIcons({icons});root.querySelectorAll('[data-update-close]').forEach(button=>button.addEventListener('click',()=>root.className='modal-root'));root.querySelector('[data-recheck-update]')?.addEventListener('click',()=>checkUpdates(true));root.querySelector('[data-install-update]')?.addEventListener('click',async event=>{const button=event.currentTarget as HTMLButtonElement;button.disabled=true;button.innerHTML='<i data-lucide="loader-circle" class="spin"></i> Downloading…';root.querySelector('#update-progress')?.classList.remove('hidden');createIcons({icons});const unsubscribe=window.neuralForge?.onUpdateProgress(progress=>{const bar=root.querySelector<HTMLElement>('#update-progress-bar'),percent=root.querySelector('#update-percent'),copy=root.querySelector('#update-progress-copy');if(bar)bar.style.width=`${progress.percent}%`;if(percent)percent.textContent=`${progress.percent}%`;if(copy)copy.textContent=`Downloaded ${formatBytes(progress.received)} of ${formatBytes(progress.total)}`;});try{await window.neuralForge?.installUpdate();if(root.querySelector('#update-progress-copy'))root.querySelector('#update-progress-copy')!.textContent='Verified. Restarting into the installer…';}catch(error){unsubscribe?.();openUpdateModal('error',error instanceof Error?error.message:String(error));}});
}

document.addEventListener('click', async (event)=>{const target=event.target as HTMLElement;const gameButton=target.closest<HTMLElement>('[data-game]');if(gameButton){selectGame(gameButton.dataset.game as GameId);return;}const action=target.closest<HTMLElement>('[data-action]')?.dataset.action;if(action==='toggle-run'){if(!state.running&&state.generation>=state.targetGenerations){completionShownFor=-1;openTrainingComplete();}else{state.running=!state.running;if(state.running)runStartedAt=performance.now();updateUI();}}else if(action==='step'){evolveOne();}else if(action==='boost'){activateBoost();}else if(action==='maze-builder'){openMazeStudio();}else if(action==='archive-prev'){showArchiveGeneration(viewedArchiveIndex-1);}else if(action==='archive-next'){showArchiveGeneration(viewedArchiveIndex+1);}else if(action==='archive-latest'){showArchiveGeneration(generationArchive.length-1);}else if(action==='archive-best'&&generationArchive.length){const best=generationArchive.reduce((bestIndex,record,index)=>record.best>generationArchive[bestIndex].best?index:bestIndex,0);showArchiveGeneration(best);}else if(action==='custom-trainer'){openCustomWizard();}else if(action==='add-layer'){state.hiddenLayers.push(6);Object.assign(state,{running:false,generation:0,bestFitness:0,averageFitness:0,species:1,history:[0]});resetEngine();clearGenerationArchive();renderLayers();updateUI();}else if(action==='reset'){Object.assign(state,{running:false,generation:0,bestFitness:0,averageFitness:0,species:1,history:[0]});completionShownFor=-1;traceSample=0;resetEngine();clearGenerationArchive();updateUI();toast('Experiment reset','Controls kept; population and generation archive restarted.','rotate-ccw');}else if(action==='save'){await saveProject();}else if(action==='load'){await loadProject();}else if(action==='fullscreen-network'){$('.network-panel').classList.toggle('expanded');}else if(action==='settings'){openSettings();}
  const dec=target.closest<HTMLElement>('[data-layer-dec]');const inc=target.closest<HTMLElement>('[data-layer-inc]');const remove=target.closest<HTMLElement>('[data-layer-remove]');if(dec){const i=Number(dec.dataset.layerDec);state.hiddenLayers[i]=Math.max(1,state.hiddenLayers[i]-1);Object.assign(state,{running:false,generation:0,bestFitness:0,averageFitness:0,species:1,history:[0]});resetEngine();clearGenerationArchive();renderLayers();updateUI();}if(inc){const i=Number(inc.dataset.layerInc);state.hiddenLayers[i]=Math.min(64,state.hiddenLayers[i]+1);Object.assign(state,{running:false,generation:0,bestFitness:0,averageFitness:0,species:1,history:[0]});resetEngine();clearGenerationArchive();renderLayers();updateUI();}if(remove){state.hiddenLayers.splice(Number(remove.dataset.layerRemove),1);Object.assign(state,{running:false,generation:0,bestFitness:0,averageFitness:0,species:1,history:[0]});resetEngine();clearGenerationArchive();renderLayers();updateUI();}
});

function bindRange(id:string,handler:(value:number)=>void,output:string,format:(v:number)=>string=(v)=>String(v)){const input=$(`#${id}`) as HTMLInputElement;input.addEventListener('input',()=>{const v=Number(input.value);handler(v);$(output).textContent=format(v);if(id==='generations')updateUI();});}
bindRange('speed',v=>state.speed=v,'#speed-label',v=>['0.5×','1×','2×','5×','MAX'][v]);bindRange('population',v=>state.population=v,'#population-value');bindRange('generations',v=>{state.targetGenerations=v;completionShownFor=-1;},'#generations-value');bindRange('mutation-rate',v=>state.mutationRate=v,'#mutation-rate-value',v=>`${v}%`);bindRange('mutation-strength',v=>state.mutationStrength=v,'#mutation-strength-value',v=>(v/100).toFixed(2));bindRange('elitism',v=>state.elitism=v,'#elitism-value',v=>`${v}%`);
bindRange('generation-speed',v=>state.generationSpeed=v,'#generation-speed-value',v=>`${v}×`);bindRange('acceleration',v=>state.acceleration=v,'#acceleration-value',v=>`${v}%`);
bindRange('episode-time',v=>{state.episodeTimeLimit=v;updateUI();},'#episode-time-value',v=>`${v} sec`);bindRange('decision-rate',v=>{state.decisionsPerSecond=v;updateUI();},'#decision-rate-value',v=>`${v}/sec`);
($('#archive-slider') as HTMLInputElement).addEventListener('input',event=>showArchiveGeneration(Number((event.target as HTMLInputElement).value)));
($('#jump-generation') as HTMLInputElement).addEventListener('input',event=>{if(!generationArchive.length)return;const wanted=Number((event.target as HTMLInputElement).value);if(!Number.isFinite(wanted)||wanted<1)return;let closest=0;generationArchive.forEach((record,index)=>{if(Math.abs(record.generation-wanted)<Math.abs(generationArchive[closest].generation-wanted))closest=index;});showArchiveGeneration(closest);});
($('#network-type') as HTMLSelectElement).addEventListener('change',e=>{state.networkType=(e.target as HTMLSelectElement).value as NetworkType;state.running=false;state.generation=0;state.bestFitness=0;state.averageFitness=0;state.species=1;state.history=[0];completionShownFor=-1;resetEngine();clearGenerationArchive();updateUI();toast('Network changed',`${state.networkType} population initialized. The old generation archive was cleared because the network changed.`,'network');});
($('#population') as HTMLInputElement).addEventListener('change',()=>{state.running=false;state.generation=0;state.bestFitness=0;state.averageFitness=0;state.species=1;state.history=[0];resetEngine();clearGenerationArchive();updateUI();});
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!$('.modal-root').classList.contains('open')){e.preventDefault();if(!state.running&&state.generation>=state.targetGenerations){completionShownFor=-1;openTrainingComplete();}else{state.running=!state.running;if(state.running)runStartedAt=performance.now();updateUI();}}});
window.addEventListener('resize',()=>{drawChart();drawNetwork();});

async function saveProject(){if(!window.neuralForge){localStorage.setItem('neural-forge-project',JSON.stringify(state));toast('Project saved','Stored in this browser for the preview.','save');return;}const result=await window.neuralForge.saveProject(state);if(!result.canceled)toast('Project saved',result.path||'Experiment saved.','save');}
async function loadProject(){if(!window.neuralForge){const raw=localStorage.getItem('neural-forge-project');if(raw)Object.assign(state,JSON.parse(raw));else return toast('No saved project','Save an experiment first.','folder-open');}else{const result=await window.neuralForge.loadProject();if(result.canceled||!result.data)return;Object.assign(state,result.data);}if((state.networkType as string)==='NEAT')state.networkType='NEAT-style';if((state.networkType as string)==='Feed Forward')state.networkType='Dense MLP';if((state.networkType as string)==='Recurrent')state.networkType='Simple RNN';resetEngine();clearGenerationArchive();renderGameList();renderLayers();updateUI();toast('Project loaded','Experiment settings restored. Start training to create a new session generation archive.','folder-open');}

function activateBoost(){if(performance.now()<boostUntil)return;if(state.boosts<1)return toast('No boosts ready','Earn one by leveling up or reaching a 20-generation streak.','lock');state.boosts--;boostUntil=performance.now()+15000;runStartedAt=performance.now();updateUI();toast('3× OVERCLOCK','Generation throughput tripled for 15 seconds.','zap');}

let mazeTool:'wall'|'erase'|'start'|'goal'='wall';
function openMazeStudio(){state.running=false;const root=$('#modal-root');root.className='modal-root open';root.innerHTML=`<div class="modal-backdrop"></div><div class="maze-modal"><div class="wizard-header"><div><span class="eyebrow">ADVERSARIAL MAZE LAB</span><h2>Build it—or let the architect evolve it</h2></div><button data-maze-close><i data-lucide="x"></i></button></div><div class="maze-studio-body"><aside class="maze-toolbar"><span class="field-label">DRAW TOOL</span><button class="active" data-maze-tool="wall"><i data-lucide="brick-wall"></i> Wall</button><button data-maze-tool="erase"><i data-lucide="eraser"></i> Erase</button><button data-maze-tool="start"><i data-lucide="play"></i> Start</button><button data-maze-tool="goal"><i data-lucide="flag"></i> Goal</button><hr><button data-maze-generate class="architect-action"><i data-lucide="brain-circuit"></i><span><strong>Neural architect</strong><small>Evolve a hostile maze</small></span></button><button data-maze-random><i data-lucide="shuffle"></i> Randomize</button><button data-maze-clear><i data-lucide="trash-2"></i> Clear interior</button><div class="duel-card"><span><i data-lucide="swords"></i> CO-EVOLUTION</span><strong>Solver <b>${state.generation}</b> vs Architect <b>${state.architectGeneration}</b></strong><label><input type="checkbox" id="coevolve-mode" ${state.mazeMode==='coevolve'?'checked':''}><i></i><em>Architect fights back</em></label></div></aside><div class="maze-editor-wrap"><div class="maze-editor" id="maze-editor" style="--maze-cols:${state.maze.width}"></div><div class="maze-editor-stats"><span><i data-lucide="route"></i> Path <b id="maze-path-length">${solveMazePath(state.maze).length||'BLOCKED'}</b></span><span><i data-lucide="shield-alert"></i> Difficulty <b id="maze-difficulty">${mazeDifficulty()}%</b></span><span><i data-lucide="blocks"></i> Walls <b id="maze-wall-count">${state.maze.walls.filter(Boolean).length}</b></span></div></div></div><div class="wizard-footer"><span><i data-lucide="info"></i> Keep a valid route—or challenge the solver with an impossible draft.</span><div><button class="secondary-button" data-maze-close>Cancel</button><button class="primary-button" data-maze-apply>Use this maze <i data-lucide="check"></i></button></div></div></div>`;createIcons({icons});renderMazeEditor();root.querySelectorAll('[data-maze-close]').forEach(x=>x.addEventListener('click',()=>root.className='modal-root'));root.querySelectorAll<HTMLElement>('[data-maze-tool]').forEach(button=>button.addEventListener('click',()=>{mazeTool=button.dataset.mazeTool as typeof mazeTool;root.querySelectorAll('[data-maze-tool]').forEach(x=>x.classList.remove('active'));button.classList.add('active');}));root.querySelector('[data-maze-clear]')?.addEventListener('click',()=>{for(let y=1;y<state.maze.height-1;y++)for(let x=1;x<state.maze.width-1;x++)state.maze.walls[y*state.maze.width+x]=false;renderMazeEditor();});root.querySelector('[data-maze-random]')?.addEventListener('click',()=>{state.maze=starterMaze(state.maze.width,state.maze.height);state.maze.walls=state.maze.walls.map((wall,i)=>wall||((i*17+Date.now())%13<3));state.maze.walls[state.maze.start]=state.maze.walls[state.maze.goal]=false;renderMazeEditor();});root.querySelector('[data-maze-generate]')?.addEventListener('click',()=>{for(let i=0;i<5;i++)architectEngine.evolve('maze-maker',state.mutationRate,state.mutationStrength,state.elitism);state.architectGeneration+=5;state.maze=architectEngine.generateMaze(state.maze.width,state.maze.height,state.architectGeneration);renderMazeEditor();toast('Architect finished',`Generated a ${mazeDifficulty()}% difficulty maze.`,'brain-circuit');});root.querySelector('[data-maze-apply]')?.addEventListener('click',()=>{state.mazeMode=(root.querySelector<HTMLInputElement>('#coevolve-mode')?.checked?'coevolve':'builder');Object.assign(state,{generation:0,bestFitness:0,averageFitness:0,species:1,history:[0]});resetEngine();clearGenerationArchive();root.className='modal-root';updateUI();toast('Maze deployed','The old archive was cleared because the environment changed.','swords');});}
function renderMazeEditor(){const editor=document.querySelector<HTMLElement>('#maze-editor');if(!editor)return;editor.innerHTML=state.maze.walls.map((wall,i)=>`<button class="maze-cell ${wall?'wall':''} ${i===state.maze.start?'start':''} ${i===state.maze.goal?'goal':''}" data-maze-cell="${i}" title="${i===state.maze.start?'Start':i===state.maze.goal?'Goal':wall?'Wall':'Open'}"></button>`).join('');editor.querySelectorAll<HTMLElement>('[data-maze-cell]').forEach(cell=>cell.addEventListener('click',()=>{const i=Number(cell.dataset.mazeCell),x=i%state.maze.width,y=Math.floor(i/state.maze.width);if(x===0||y===0||x===state.maze.width-1||y===state.maze.height-1)return;if(mazeTool==='start'){state.maze.walls[state.maze.start]=false;state.maze.start=i;}else if(mazeTool==='goal'){state.maze.walls[state.maze.goal]=false;state.maze.goal=i;}else state.maze.walls[i]=mazeTool==='wall';state.maze.walls[state.maze.start]=state.maze.walls[state.maze.goal]=false;renderMazeEditor();}));const path=document.querySelector('#maze-path-length'),difficulty=document.querySelector('#maze-difficulty'),walls=document.querySelector('#maze-wall-count');if(path)path.textContent=String(solveMazePath(state.maze).length||'BLOCKED');if(difficulty)difficulty.textContent=`${mazeDifficulty()}%`;if(walls)walls.textContent=String(state.maze.walls.filter(Boolean).length);}

function openSettings(){const root=$('#modal-root');root.className='modal-root open';root.innerHTML=`<div class="modal-backdrop" data-close-modal></div><div class="simple-modal"><div class="modal-heading"><div><span class="eyebrow">PREFERENCES</span><h2>Playground settings</h2></div><button data-close-modal><i data-lucide="x"></i></button></div><label class="setting-row"><span><strong>Keep trainer above other windows</strong><small>Helpful while watching a captured game</small></span><input type="checkbox" id="always-on-top"><i></i></label><label class="setting-row"><span><strong>Reduced motion</strong><small>Limit interface transitions</small></span><input type="checkbox" id="reduced-motion"><i></i></label><div class="modal-actions"><button class="primary-button" data-close-modal>Done</button></div></div>`;createIcons({icons});root.querySelectorAll('[data-close-modal]').forEach(x=>x.addEventListener('click',()=>root.className='modal-root'));root.querySelector('#always-on-top')?.addEventListener('change',e=>window.neuralForge?.setAlwaysOnTop((e.target as HTMLInputElement).checked));root.querySelector('#reduced-motion')?.addEventListener('change',e=>document.body.classList.toggle('reduced-motion',(e.target as HTMLInputElement).checked));}

let wizardStep=1;let wizardSources:CaptureSource[]=[];let wizardTask:CustomTask={sourceId:'demo',sourceName:'Demo game window',thumbnail:'',region:{x:.18,y:.18,w:.64,h:.58},actions:['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'],reward:'Color target',rewardValue:'#b9ff66'};

async function openCustomWizard(){wizardStep=1;wizardSources=[];if(window.neuralForge){try{wizardSources=await window.neuralForge.getCaptureSources();}catch{toast('Capture unavailable','Could not read windows. Demo source loaded instead.','triangle-alert');}}if(!wizardSources.length)wizardSources=[{id:'demo',name:'Demo game window',displayId:'1',thumbnail:'',icon:null},{id:'screen',name:'Entire display',displayId:'1',thumbnail:'',icon:null}];renderWizard();}

function renderWizard(){const root=$('#modal-root');root.className='modal-root open';const labels=['Choose source','Select region','Allowed actions','Define reward'];root.innerHTML=`<div class="modal-backdrop"></div><div class="wizard-modal"><div class="wizard-header"><div><span class="eyebrow">CUSTOM SCREEN TASK</span><h2>Teach an agent to use any game</h2></div><button data-wizard-close><i data-lucide="x"></i></button></div><div class="wizard-steps">${labels.map((l,i)=>`<div class="wizard-step ${wizardStep===i+1?'active':''} ${wizardStep>i+1?'done':''}"><span>${wizardStep>i+1?'✓':i+1}</span><b>${l}</b></div>`).join('')}</div><div class="wizard-body">${wizardContent()}</div><div class="wizard-footer"><span><i data-lucide="shield-check"></i> Inputs only run while a task is armed</span><div><button class="secondary-button" data-wizard-back ${wizardStep===1?'disabled':''}>Back</button><button class="primary-button" data-wizard-next>${wizardStep===4?'Create task':'Continue'} <i data-lucide="arrow-right"></i></button></div></div></div>`;createIcons({icons});
  root.querySelector('[data-wizard-close]')?.addEventListener('click',()=>root.className='modal-root');root.querySelector('[data-wizard-back]')?.addEventListener('click',()=>{wizardStep--;renderWizard();});root.querySelector('[data-wizard-next]')?.addEventListener('click',()=>{if(wizardStep<4){wizardStep++;renderWizard();}else{state.custom={...wizardTask};state.game='custom';state.generation=0;state.running=false;resetEngine();clearGenerationArchive();root.className='modal-root';renderGameList();updateUI();toast('Custom task created','Capture, actions, and reward signal are configured. Run a generation to create its first champion record.','scan-line');}});wireWizardStep(root);
}

function wizardContent(){if(wizardStep===1)return `<div class="wizard-copy"><h3>What should the agent watch?</h3><p>Select a window or an entire display. Neural Forge only captures the source while this experiment is open.</p></div><div class="source-grid">${wizardSources.map((s,i)=>`<button class="source-card ${wizardTask.sourceId===s.id||(!wizardTask.thumbnail&&i===0)?'selected':''}" data-source="${i}"><div class="source-preview">${s.thumbnail?`<img src="${s.thumbnail}">`:`<i data-lucide="${s.id==='screen'?'monitor':'app-window'}"></i>`}<span class="live-chip">LIVE</span></div><strong>${escapeHtml(s.name)}</strong><small>${s.id.startsWith('screen')?'Full display':'Application window'}</small></button>`).join('')}</div>`;
  if(wizardStep===2)return `<div class="wizard-copy"><h3>Drag around the useful game area</h3><p>Keep scores or status text inside the box if you want them available to the reward detector.</p></div><div class="region-editor" id="region-editor">${wizardTask.thumbnail?`<img src="${wizardTask.thumbnail}">`:'<div class="fake-capture"><span>SCORE 024</span><i data-lucide="gamepad-2"></i><small>Captured game preview</small></div>'}<div class="selection-box" id="selection-box"><i class="handle nw"></i><i class="handle se"></i><span>OBSERVATION REGION</span></div></div><div class="region-meta"><span><i data-lucide="scan"></i> ${Math.round(wizardTask.region.w*100)}% × ${Math.round(wizardTask.region.h*100)}% of source</span><button class="text-button" data-reset-region>Reset region</button></div>`;
  if(wizardStep===3){const keys=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','W','A','S','D','Enter','Z','X','Mouse click'];return `<div class="wizard-copy"><h3>Which controls may the agent use?</h3><p>Only checked inputs are part of the output layer. Keep the action space small for faster learning.</p></div><div class="key-grid">${keys.map(k=>`<label class="key-chip"><input type="checkbox" value="${k}" ${wizardTask.actions.includes(k)?'checked':''}><span>${prettyKey(k)}</span></label>`).join('')}</div><div class="safety-card"><i data-lucide="shield-check"></i><div><strong>Hold-to-arm safety</strong><span>Live input requires holding Ctrl + Shift. Releasing either key stops the agent immediately.</span></div></div>`;}
  return `<div class="wizard-copy"><h3>How should fitness be measured?</h3><p>Choose a signal that reliably means the agent did well. You can combine this with survival time.</p></div><div class="reward-layout"><div class="reward-types">${['Color target','Brightness change','Motion in region','OCR number','OCR text match','Survival time'].map((r,i)=>`<label class="reward-card"><input type="radio" name="reward" value="${r}" ${wizardTask.reward===r?'checked':''}><span class="reward-icon"><i data-lucide="${['palette','sun-medium','scan-eye','hash','text-search','timer'][i]}"></i></span><span><strong>${r}</strong><small>${['Reward when a chosen color appears','Track lighter or darker pixels','Reward visible progress or movement','Read a score or counter','Look for WIN, GAME OVER, etc.','Reward every second still active'][i]}</small></span></label>`).join('')}</div><div class="reward-config"><span class="field-label">REWARD TARGET</span><div class="reward-preview"><i data-lucide="crosshair"></i><strong id="reward-value-label">${escapeHtml(wizardTask.rewardValue)}</strong><small>Sample from captured region</small></div><input id="reward-value" value="${escapeHtml(wizardTask.rewardValue)}" placeholder="Target value or text"><label><span>Reward weight</span><input type="range" min="1" max="100" value="70"></label><label><span>Survival bonus</span><input type="range" min="0" max="100" value="25"></label></div></div>`;
}

function wireWizardStep(root:Element){if(wizardStep===1)root.querySelectorAll<HTMLElement>('[data-source]').forEach(card=>card.addEventListener('click',()=>{const s=wizardSources[Number(card.dataset.source)];wizardTask={...wizardTask,sourceId:s.id,sourceName:s.name,thumbnail:s.thumbnail};renderWizard();}));if(wizardStep===2){positionSelection();const editor=root.querySelector<HTMLElement>('#region-editor')!;const box=root.querySelector<HTMLElement>('#selection-box')!;let start:{x:number;y:number}|null=null;editor.addEventListener('pointerdown',e=>{const r=editor.getBoundingClientRect();start={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};wizardTask.region={x:start.x,y:start.y,w:.01,h:.01};box.setPointerCapture(e.pointerId);positionSelection();});editor.addEventListener('pointermove',e=>{if(!start)return;const r=editor.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));wizardTask.region={x:Math.min(start.x,x),y:Math.min(start.y,y),w:Math.abs(x-start.x),h:Math.abs(y-start.y)};positionSelection();});editor.addEventListener('pointerup',()=>start=null);root.querySelector('[data-reset-region]')?.addEventListener('click',()=>{wizardTask.region={x:.18,y:.18,w:.64,h:.58};positionSelection();});}if(wizardStep===3)root.querySelectorAll<HTMLInputElement>('.key-chip input').forEach(input=>input.addEventListener('change',()=>{wizardTask.actions=[...root.querySelectorAll<HTMLInputElement>('.key-chip input:checked')].map(x=>x.value);}));if(wizardStep===4){root.querySelectorAll<HTMLInputElement>('input[name="reward"]').forEach(input=>input.addEventListener('change',()=>{wizardTask.reward=input.value;}));const reward=root.querySelector<HTMLInputElement>('#reward-value');reward?.addEventListener('input',()=>{wizardTask.rewardValue=reward.value;const label=root.querySelector('#reward-value-label');if(label)label.textContent=reward.value;});}}
function positionSelection(){const box=document.querySelector<HTMLElement>('#selection-box');if(!box)return;Object.assign(box.style,{left:`${wizardTask.region.x*100}%`,top:`${wizardTask.region.y*100}%`,width:`${wizardTask.region.w*100}%`,height:`${wizardTask.region.h*100}%`});}
function prettyKey(k:string){return k.replace('Arrow','↑ ↓ ← →'.split(' ')[['Up','Down','Left','Right'].indexOf(k.replace('Arrow',''))]||k);}
function escapeHtml(s:string){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]!));}

document.addEventListener('click',event=>{const action=(event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;if(action==='updates')void checkUpdates(true);});
document.addEventListener('click',event=>{const action=(event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;if(action==='replay-prev')setReplayStep(replayStep-1);else if(action==='replay-next')setReplayStep(replayStep+1);else if(action==='replay-toggle'){const actions=replayActions();if(!actions.length)return;if(replayStep>=actions.length)replayStep=0;replayPlaying=!replayPlaying;replayLastAt=performance.now();updateReplayControls();}});
($('#replay-slider') as HTMLInputElement).addEventListener('input',event=>setReplayStep(Number((event.target as HTMLInputElement).value)));
renderGameList();renderLayers();updateUI();animationFrame=requestAnimationFrame(loop);setTimeout(()=>checkUpdates(false),1800);
