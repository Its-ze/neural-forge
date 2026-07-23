export type Arena = 'snake' | 'tictactoe' | 'minesweeper' | 'flappy' | 'pong' | 'xor' | 'breakout' | 'dino' | 'merge2048' | 'lander' | 'maze' | 'maze-maker' | 'custom';
export interface MazeEnvironment { width: number; height: number; walls: boolean[]; start: number; goal: number; }
export type NetworkFamily = 'NEAT-style' | 'Dense MLP' | 'ReLU Feed Forward' | 'Simple RNN' | 'LSTM' | 'GRU' | 'Convolutional' | 'Spiking' | 'Liquid' | 'Radial Basis' | 'Transformer Lite' | 'Echo State';

export interface EvolutionResult {
  best: number;
  average: number;
  species: number;
  weights: number[][][];
  championDecisions: number;
  decisionLimit: number;
  championActions: string[];
}

export interface EpisodeConfig { timeLimitSeconds: number; decisionsPerSecond: number; }

export interface DecisionTrace {
  observations: Array<{ label: string; value: number }>;
  outputs: Array<{ label: string; value: number }>;
  chosenAction: string;
  chosenIndex: number;
  confidence: number;
  explanation: string;
  fitnessRule: string;
  layers: number[][];
  weights: number[][][];
}

interface Genome {
  weights: number[][][];
  biases: number[][];
  fitness: number;
  memory: number[][];
  cell: number[][];
}

const rand = () => Math.random() * 2 - 1;
const sigmoid = (x: number) => 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));

export class EvolutionEngine {
  private genomes: Genome[] = [];
  private shape: number[] = [];
  private family: NetworkFamily;
  private evaluationDecisions = 0;
  private evaluationActions:string[] = [];

  constructor(shape: number[], population: number, family: NetworkFamily = 'NEAT-style') {
    this.family = family;
    this.reset(shape, population);
  }

  reset(shape: number[], population: number) {
    this.shape = [...shape];
    this.genomes = Array.from({ length: population }, () => this.createGenome());
  }

  evolve(arena: Arena, mutationRate: number, mutationStrength: number, elitePercent: number, maze?: MazeEnvironment, episode: EpisodeConfig = { timeLimitSeconds: 10, decisionsPerSecond: 10 }): EvolutionResult {
    const decisionLimit = Math.max(1, Math.min(2000, Math.round(episode.timeLimitSeconds * episode.decisionsPerSecond)));
    const decisionCounts = new Map<Genome,number>();
    const actionSequences = new Map<Genome,string[]>();
    for (const genome of this.genomes) { genome.fitness = this.evaluate(genome, arena, maze, decisionLimit); decisionCounts.set(genome, this.evaluationDecisions); actionSequences.set(genome,[...this.evaluationActions]); }
    this.genomes.sort((a, b) => b.fitness - a.fitness);
    const best = this.genomes[0].fitness;
    const championDecisions = decisionCounts.get(this.genomes[0]) || 0;
    const championActions = actionSequences.get(this.genomes[0]) || [];
    const average = this.genomes.reduce((sum, g) => sum + g.fitness, 0) / this.genomes.length;
    const eliteCount = Math.max(1, Math.floor(this.genomes.length * elitePercent / 100));
    const next = this.genomes.slice(0, eliteCount).map(g => this.clone(g));
    while (next.length < this.genomes.length) {
      const a = this.tournament();
      const b = this.tournament();
      next.push(this.mutate(this.crossover(a, b), mutationRate / 100, mutationStrength / 100));
    }
    this.genomes = next;
    const buckets = new Set(this.genomes.slice(0, Math.min(40, this.genomes.length)).map(g => Math.round(g.weights[0][0][0] * 3)));
    return { best, average, species: Math.max(1, buckets.size), weights: this.clone(this.genomes[0]).weights, championDecisions, decisionLimit, championActions };
  }

  generateMaze(width: number, height: number, seed = 1): MazeEnvironment {
    const champion = this.genomes[0] || this.createGenome();
    const walls = Array(width * height).fill(false);
    this.resetState(champion);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const noise = Math.sin((x + seed) * 12.9898 + (y - seed) * 78.233) * 43758.5453 % 1;
      walls[y * width + x] = edge || this.forward(champion, [x / width, y / height, noise, seed % 17 / 17])[0] > .57;
    }
    let x = 1, y = 1; walls[y * width + x] = false;
    while (x < width - 2 || y < height - 2) {
      if (x < width - 2 && (y >= height - 2 || Math.sin(seed++ * 3.17) > 0)) x++; else y++;
      walls[y * width + x] = false;
      if (x + 1 < width - 1 && seed % 3 === 0) walls[y * width + x + 1] = false;
    }
    const start = width + 1, goal = (height - 2) * width + width - 2; walls[start] = false; walls[goal] = false;
    return { width, height, walls, start, goal };
  }

  inspectChampion(arena: Arena, maze?: MazeEnvironment, sample = 0): DecisionTrace {
    const champion = this.genomes[0] || this.createGenome();
    const phase = (sample % 10) / 10;
    let input: number[] = [];
    let inputLabels: string[] = [];
    let outputLabels: string[] = [];
    let fitnessRule = 'Fitness rewards outputs that match the arena objective.';

    if (arena === 'snake') {
      const direction = sample % 4, x = .45, y = .52, foodX = .78, foodY = .24;
      input = [x,y,foodX,foodY,foodX-x,foodY-y,direction===0?1:0,direction===1?1:0,direction===2?1:0,direction===3?1:0,1-x,1-y];
      inputLabels = ['Head X','Head Y','Food X','Food Y','Food right','Food above','Facing right','Facing down','Facing left','Facing up','Wall clearance X','Wall clearance Y'];
      outputLabels = ['RIGHT','DOWN','LEFT','UP'];
      fitnessRule = 'Fitness: +12 for food, +0.25 per safe move, a small bonus for moving closer; hitting a wall or body ends the run.';
    } else if (arena === 'tictactoe') {
      const board=[1,0,-1,0,1,0,0,-1,0]; input=[...board.map(v=>v===1?1:0),...board.map(v=>v===-1?1:0)];
      inputLabels=[...board.map((_,i)=>`Our mark cell ${i+1}`),...board.map((_,i)=>`Opponent cell ${i+1}`)]; outputLabels=board.map((_,i)=>`CELL ${i+1}`);
      fitnessRule='Fitness rewards wins (+12), surviving turns, and avoiding losses. Occupied cells are ignored when choosing a move.';
    } else if (arena === 'minesweeper') {
      input=Array.from({length:81},(_,i)=>((i*13+sample*7)%19===0?-1:(i*7+sample)%4)/3);inputLabels=input.map((_,i)=>`Tile ${i+1} clue`);outputLabels=input.map((_,i)=>`TILE ${i+1}`);
      fitnessRule='Fitness rewards selecting a safe tile and its visible clue value; selecting a mine earns nothing.';
    } else if (arena === 'flappy') {
      input=[.46+phase*.08,-.02,1-phase,.28,.56];inputLabels=['Bird height','Vertical speed','Pipe distance','Gap top','Gap bottom'];outputLabels=['FLAP SIGNAL'];
      fitnessRule='Fitness increases for every frame survived. A flap fires when its output activation exceeds 0.55.';
    } else if (arena === 'pong') {
      input=[.48,.18+phase*.65,.037,.5,Math.abs(.48-(.18+phase*.65)),1];inputLabels=['Paddle height','Ball height','Ball vertical speed','Ball X','Paddle-ball gap','Bias'];outputLabels=['MOVE UP','STAY','MOVE DOWN'];
      fitnessRule='Fitness rewards paddle-ball alignment, successful returns, and longer rallies. Missing the ball ends the episode.';
    } else if (arena === 'xor') {
      const pair=[[0,0],[0,1],[1,0],[1,1]][sample%4];input=pair;inputLabels=['Input A','Input B'];outputLabels=['OUTPUT 1'];
      fitnessRule='Fitness measures how closely the output matches XOR across all four input pairs.';
    } else if (arena === 'breakout') {
      input=[.46,.2+phase*.65,.047,Math.abs(.46-(.2+phase*.65)),phase,1];inputLabels=['Paddle X','Ball X','Ball direction','Paddle-ball gap','Replay time','Bias'];outputLabels=['MOVE LEFT','STAY','MOVE RIGHT'];
      fitnessRule='Fitness rises when the paddle remains under the ball and keeps the rally alive.';
    } else if (arena === 'dino') {
      input=[1-phase,phase>.5?.2:0,phase>.5?.05:0,phase];inputLabels=['Obstacle distance','Jump height','Vertical speed','Replay time'];outputLabels=['JUMP SIGNAL'];
      fitnessRule='Fitness increases for every frame survived. A jump fires when its output activation exceeds 0.58.';
    } else if (arena === 'merge2048') {
      input=Array.from({length:16},(_,i)=>i<sample%16?Math.min(1,(i%6+1)/11):0);inputLabels=input.map((_,i)=>`Cell ${i+1} value`);outputLabels=['UP','RIGHT','DOWN','LEFT'];
      fitnessRule='Fitness rewards confident legal moves and larger merged tiles.';
    } else if (arena === 'lander') {
      input=[.3+phase*.2,1-phase*.7,.015,-.025-phase*.01,1-phase*.3,.2-phase*.2];inputLabels=['Lander X','Lander height','Horizontal speed','Vertical speed','Fuel','Target offset'];outputLabels=['MAIN THRUST','LEFT THRUST','RIGHT THRUST'];
      fitnessRule='Fitness rewards a centered landing with low vertical speed and remaining fuel.';
    } else if (arena === 'maze' && maze) {
      const pos=maze.start,x=pos%maze.width,y=Math.floor(pos/maze.width),gx=maze.goal%maze.width,gy=Math.floor(maze.goal/maze.width),moves=[-maze.width,1,maze.width,-1];const blocked=moves.map(d=>maze.walls[pos+d]?1:0);const dist=Math.abs(gx-x)+Math.abs(gy-y);
      input=[...blocked,(gx-x)/maze.width,(gy-y)/maze.height,x/maze.width,y/maze.height,dist/(maze.width+maze.height),1/(maze.width*maze.height),phase,1];inputLabels=['Wall up','Wall right','Wall down','Wall left','Goal X direction','Goal Y direction','Position X','Position Y','Goal distance','Visited area','Replay time','Bias'];outputLabels=['UP','RIGHT','DOWN','LEFT'];
      fitnessRule='Fitness rewards moving closer to the goal, exploring new cells, and finishing quickly.';
    } else {
      input=Array.from({length:this.shape[0]},(_,i)=>Math.sin(i*1.7+phase));inputLabels=input.map((_,i)=>`Input ${i+1}`);outputLabels=Array.from({length:this.shape.at(-1)||1},(_,i)=>`ACTION ${i+1}`);
    }

    this.resetState(champion);
    const layers=this.forwardLayers(champion,input);
    const output=layers.at(-1) || [];
    let chosenIndex=output.indexOf(Math.max(...output));
    if(chosenIndex<0)chosenIndex=0;
    let chosenAction=outputLabels[chosenIndex] || `ACTION ${chosenIndex+1}`;
    if(arena==='flappy')chosenAction=(output[0]||0)>.55?'FLAP':'COAST';
    if(arena==='dino')chosenAction=(output[0]||0)>.58?'JUMP':'KEEP RUNNING';
    if(arena==='xor')chosenAction=(output[0]||0)>.5?'OUTPUT 1':'OUTPUT 0';
    const confidence=output[chosenIndex]||0;
    return {
      observations:input.map((value,i)=>({label:inputLabels[i]||`Input ${i+1}`,value})),
      outputs:output.map((value,i)=>({label:outputLabels[i]||`Action ${i+1}`,value})),
      chosenAction,chosenIndex,confidence,
      explanation:`${chosenAction} was selected because its output activation was ${confidence.toFixed(2)}${output.length>1?'—the strongest available action':''}.`,
      fitnessRule,layers,weights:champion.weights.map(matrix=>matrix.map(row=>[...row]))
    };
  }

  private createGenome(): Genome {
    const weights: number[][][] = [], biases: number[][] = [];
    for (let layer = 1; layer < this.shape.length; layer++) {
      const scale = Math.sqrt(2 / this.shape[layer - 1]);
      weights.push(Array.from({ length: this.shape[layer] }, () => Array.from({ length: this.shape[layer - 1] }, () => rand() * scale)));
      biases.push(Array.from({ length: this.shape[layer] }, () => rand() * .1));
    }
    return { weights, biases, fitness: 0, memory: [], cell: [] };
  }

  private forward(genome: Genome, input: number[]) { return this.forwardLayers(genome,input).at(-1) || []; }

  private forwardLayers(genome: Genome, input: number[]) {
    let values = this.preprocess(input.slice(0, this.shape[0]));
    while (values.length < this.shape[0]) values.push(0);
    const layers:number[][]=[values.slice()];
    genome.weights.forEach((matrix, layer) => {
      values = matrix.map((row, neuron) => {
        const sum = row.reduce((total, weight, i) => total + weight * (values[i] || 0), genome.biases[layer][neuron]);
        if (layer === genome.weights.length - 1) return sigmoid(sum);
        const previous = genome.memory[layer]?.[neuron] || 0;
        const previousCell = genome.cell[layer]?.[neuron] || 0;
        let value: number;
        switch (this.family) {
          case 'ReLU Feed Forward': case 'Convolutional': value = Math.max(0, Math.min(6, sum)); break;
          case 'Simple RNN': value = Math.tanh(sum + previous * .48); break;
          case 'LSTM': {
            const inputGate = sigmoid(sum);
            const forgetGate = sigmoid(sum * .55 + .45);
            const cell = forgetGate * previousCell + inputGate * Math.tanh(sum);
            genome.cell[layer][neuron] = cell;
            value = Math.tanh(cell) * sigmoid(sum + previous);
            break;
          }
          case 'GRU': {
            const update = sigmoid(sum);
            const reset = sigmoid(sum * .5 - previous * .35);
            value = (1 - update) * previous + update * Math.tanh(sum + reset * previous);
            break;
          }
          case 'Spiking': {
            const voltage = previous * .72 + sum;
            value = voltage > .72 ? 1 : 0;
            genome.cell[layer][neuron] = value ? 0 : voltage;
            break;
          }
          case 'Liquid': value = previous + (Math.tanh(sum + previous * .2) - previous) * (.14 + sigmoid(genome.biases[layer][neuron]) * .3); break;
          case 'Radial Basis': value = Math.exp(-Math.pow(sum - genome.biases[layer][neuron], 2)); break;
          case 'Echo State': value = Math.tanh(sum * .65 + previous * .82); break;
          default: value = Math.tanh(sum); break;
        }
        genome.memory[layer][neuron] = value;
        return value;
      });
      layers.push(values.slice());
    });
    return layers;
  }

  private preprocess(input: number[]) {
    if (this.family === 'Convolutional') {
      return input.map((value, i) => value * .55 + (input[i - 1] || 0) * .225 + (input[i + 1] || 0) * .225);
    }
    if (this.family === 'Transformer Lite') {
      const mean = input.reduce((sum, value) => sum + value, 0) / Math.max(1, input.length);
      const attention = input.map(value => Math.exp(Math.max(-8, Math.min(8, value * mean * 2))));
      const total = attention.reduce((sum, value) => sum + value, 0) || 1;
      const context = input.reduce((sum, value, i) => sum + value * attention[i] / total, 0);
      return input.map(value => value * .72 + context * .28);
    }
    return input;
  }

  private resetState(genome: Genome) {
    genome.memory = this.shape.slice(1).map(size => Array(size).fill(0));
    genome.cell = this.shape.slice(1).map(size => Array(size).fill(0));
  }

  private evaluate(genome: Genome, arena: Arena, maze: MazeEnvironment|undefined, decisionLimit: number) {
    this.resetState(genome);
    this.evaluationDecisions = 0;
    this.evaluationActions = [];
    if (arena === 'xor') return this.evaluateXor(genome);
    if (arena === 'tictactoe') return this.evaluateTicTacToe(genome, decisionLimit);
    if (arena === 'snake') return this.evaluateSnake(genome, decisionLimit);
    if (arena === 'flappy') return this.evaluateFlappy(genome, decisionLimit);
    if (arena === 'pong') return this.evaluatePong(genome, decisionLimit);
    if (arena === 'minesweeper') return this.evaluateMinesweeper(genome, decisionLimit);
    if (arena === 'breakout') return this.evaluateBreakout(genome, decisionLimit);
    if (arena === 'dino') return this.evaluateDino(genome, decisionLimit);
    if (arena === 'merge2048') return this.evaluateMerge(genome, decisionLimit);
    if (arena === 'lander') return this.evaluateLander(genome, decisionLimit);
    if (arena === 'maze' && maze) return this.evaluateMaze(genome, maze, decisionLimit);
    if (arena === 'maze-maker') return this.evaluateMazeMaker(genome);
    return this.evaluatePattern(genome, decisionLimit);
  }

  private evaluateXor(g: Genome) {
    const tests = [[[0, 0], 0], [[0, 1], 1], [[1, 0], 1], [[1, 1], 0]] as Array<[number[], number]>;
    const error = tests.reduce((sum, [input, target]) => { this.evaluationDecisions++;const value=this.forward(g,input)[0];this.evaluationActions.push(value>.5?'OUTPUT 1':'OUTPUT 0');return sum + Math.pow(target-value, 2); }, 0);
    return Math.pow(4 - error, 2) * 6.25;
  }

  private evaluateTicTacToe(g: Genome, limit:number) {
    let total = 0;
    for (let match = 0; match < Math.ceil(limit/5) && this.evaluationDecisions<limit; match++) {
      const board = Array(9).fill(0); let player = 1;
      for (let turn = 0; turn < 9; turn++) {
        if (player === 1) {
          if(this.evaluationDecisions>=limit)break;this.evaluationDecisions++;
          const input = [...board.map(v => v === 1 ? 1 : 0), ...board.map(v => v === -1 ? 1 : 0)];
          const scores = this.forward(g, input); const legal = board.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0);
          legal.sort((a, b) => (scores[b] || 0) - (scores[a] || 0));this.evaluationActions.push(`CELL ${legal[0]+1}`); board[legal[0]] = 1;
        } else { const legal = board.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0); board[legal[Math.floor(Math.random() * legal.length)]] = -1; }
        const winner = this.winner(board); if (winner) { total += winner === 1 ? 12 : -4; break; }
        total += .5; player *= -1;
      }
    }
    return Math.max(.1, total + 8);
  }

  private winner(b: number[]) { const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; for(const [a,c,d] of lines) if(b[a]&&b[a]===b[c]&&b[a]===b[d]) return b[a]; return 0; }

  private evaluateSnake(g: Genome, limit:number) {
    const size=9, body:[[number,number]]=[[4,4]], food:[number,number]=[7,2]; let dir=0, score=0;
    for(let step=0;step<limit;step++){this.evaluationDecisions++;
      const [x,y]=body[0];const input=[x/size,y/size,food[0]/size,food[1]/size,(food[0]-x)/size,(food[1]-y)/size,dir===0?1:0,dir===1?1:0,dir===2?1:0,dir===3?1:0,1-x/(size-1),1-y/(size-1)];
      const out=this.forward(g,input);dir=out.indexOf(Math.max(...out));this.evaluationActions.push(['RIGHT','DOWN','LEFT','UP'][dir]);const moves=[[1,0],[0,1],[-1,0],[0,-1]], nx=x+moves[dir][0],ny=y+moves[dir][1];if(nx<0||ny<0||nx>=size||ny>=size||body.some(p=>p[0]===nx&&p[1]===ny))break;body.unshift([nx,ny]);score+=.25;if(nx===food[0]&&ny===food[1]){score+=12;food[0]=(food[0]*3+2)%size;food[1]=(food[1]*5+1)%size;}else body.pop();score+=Math.max(0,1-Math.abs(food[0]-nx)/size-Math.abs(food[1]-ny)/size)*.08;
    } return score;
  }

  private evaluateFlappy(g:Genome,limit:number){let y=.5,v=0,score=0;for(let step=0;step<limit;step++){this.evaluationDecisions++;const pipeX=1-(step%35)/35,gap=.25+((Math.floor(step/35)*.23)% .5);const flap=this.forward(g,[y,v,pipeX,gap,gap+.28])[0]>.55;this.evaluationActions.push(flap?'FLAP':'COAST');if(flap)v=-.035;v+=.006;y+=v;if(y<0||y>1||(pipeX<.08&&(y<gap||y>gap+.28)))break;score+=.3;}return score;}
  private evaluatePong(g:Genome,limit:number){let paddle=.5,opponent=.5,ballX=.5,ballY=.15,vx=-.035,vy=.037,score=0;for(let step=0;step<limit;step++){this.evaluationDecisions++;ballX+=vx;ballY+=vy;if(ballY<.04||ballY>.96){vy*=-1;ballY=Math.max(.04,Math.min(.96,ballY));}opponent=Math.max(.12,Math.min(.88,opponent+Math.sign(ballY-opponent)*.045));const out=this.forward(g,[paddle,ballY,vy,ballX,Math.abs(paddle-ballY),1]);const action=out.indexOf(Math.max(...out));this.evaluationActions.push(['UP','STAY','DOWN'][action]);paddle=Math.max(.12,Math.min(.88,paddle+(action===0?-.06:action===2?.06:0)));score+=Math.max(0,1-Math.abs(paddle-ballY))*.08;if(ballX<.06){if(Math.abs(ballY-paddle)<.17){vx=Math.abs(vx)*1.015;ballX=.06;score+=8;}else break;}else if(ballX>.94){vx=-Math.abs(vx)*1.015;ballX=.94;score+=1;}}return score;}
  private evaluateMinesweeper(g:Genome,limit:number){let score=0;for(let sample=0;sample<limit;sample++){this.evaluationDecisions++;const board=Array.from({length:81},(_,i)=>((i*13+sample*7)%19===0?-1:(i*7+sample)%4)/3);const out=this.forward(g,board);const pick=out.indexOf(Math.max(...out));this.evaluationActions.push(`TILE ${pick+1}`);score+=board[pick]===-1?0:3+board[pick];}return score;}
  private evaluateBreakout(g:Genome,limit:number){let paddle=.5,ball=.2,v=.047,score=0;for(let i=0;i<limit;i++){this.evaluationDecisions++;ball+=v;if(ball<0||ball>1){v*=-1;ball=Math.max(0,Math.min(1,ball));}const o=this.forward(g,[paddle,ball,v,Math.abs(ball-paddle),i/limit,1]);const a=o.indexOf(Math.max(...o));this.evaluationActions.push(['LEFT','STAY','RIGHT'][a]);paddle=Math.max(0,Math.min(1,paddle+(a===0?-.06:a===2?.06:0)));score+=Math.abs(paddle-ball)<.15?.45:.03;}return score;}
  private evaluateDino(g:Genome,limit:number){let score=0,jump=0,velocity=0;for(let i=0;i<limit;i++){this.evaluationDecisions++;const obstacle=1-(i%31)/31;const o=this.forward(g,[obstacle,jump,velocity,i/limit]);const jumping=o[0]>.58&&jump===0;this.evaluationActions.push(jumping?'JUMP':'RUN');if(jumping)velocity=.16;velocity-=.018;jump=Math.max(0,jump+velocity);if(jump===0)velocity=0;if(obstacle<.08&&jump<.18)break;score+=.24;}return score;}
  private evaluateMerge(g:Genome,limit:number){let score=0,largest=2;for(let i=0;i<limit;i++){this.evaluationDecisions++;const board=Array.from({length:16},(_,n)=>n<i%16?Math.log2(largest)/11:0);const o=this.forward(g,board);const action=o.indexOf(Math.max(...o));this.evaluationActions.push(['UP','RIGHT','DOWN','LEFT'][action]);const confidence=Math.max(...o);if(confidence>.45){score+=confidence*1.4;if(i%6===0)largest*=2;}else score+=.1;}return score+Math.log2(largest)*2;}
  private evaluateLander(g:Genome,limit:number){let x=.3,y=1,vx=.015,vy=-.025,fuel=1,score=0;for(let i=0;i<limit&&y>0;i++){this.evaluationDecisions++;const o=this.forward(g,[x,y,vx,vy,fuel,.5-x]);const action=o.indexOf(Math.max(...o));this.evaluationActions.push(['MAIN','LEFT','RIGHT'][action]);if(o[0]>.58&&fuel>0){vy+=.012;fuel-=.012;}if(o[1]>.58&&fuel>0){vx-=.006;fuel-=.005;}if(o[2]>.58&&fuel>0){vx+=.006;fuel-=.005;}vy-=.003;x+=vx;y+=vy;score+=.08;}return Math.max(0,score+20-Math.abs(x-.5)*18-Math.abs(vy)*90);}
  private evaluateMaze(g:Genome,m:MazeEnvironment,limit:number){let pos=m.start,score=0;const visited=new Set<number>([pos]);const gx=m.goal%m.width,gy=Math.floor(m.goal/m.width);let previous=99;for(let step=0;step<limit;step++){this.evaluationDecisions++;const x=pos%m.width,y=Math.floor(pos/m.width),moves=[-m.width,1,m.width,-1];const blocked=moves.map(d=>m.walls[pos+d]?1:0);const dist=Math.abs(gx-x)+Math.abs(gy-y);const input=[...blocked,(gx-x)/m.width,(gy-y)/m.height,x/m.width,y/m.height,dist/(m.width+m.height),visited.size/(m.width*m.height),step/limit,1];const out=this.forward(g,input);const choices=out.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v);const move=choices.find(c=>!blocked[c.i]);if(!move)break;this.evaluationActions.push(['UP','RIGHT','DOWN','LEFT'][move.i]);pos+=moves[move.i];score+=dist<previous?.35:-.08;previous=dist;if(!visited.has(pos)){score+=.18;visited.add(pos);}if(pos===m.goal){score+=65-step*.2;break;}}return Math.max(.1,score+8);}
  private evaluateMazeMaker(g:Genome){const values:number[]=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)values.push(this.forward(g,[x/7,y/7,Math.sin(x*y),1])[0]);const density=values.filter(v=>v>.55).length/values.length;const variance=values.reduce((s,v)=>s+Math.abs(v-.5),0)/values.length;return 25-Math.abs(density-.38)*35+variance*12;}
  private evaluatePattern(g:Genome,limit:number){let score=0;for(let step=0;step<limit;step++){this.evaluationDecisions++;const input=Array.from({length:this.shape[0]},(_,i)=>Math.sin(i*1.7+step/Math.max(1,limit)*Math.PI*2));const output=this.forward(g,input);this.evaluationActions.push(`ACTION ${output.indexOf(Math.max(...output))+1}`);score+=output.reduce((s,v,i)=>s+(i%2?v:1-v),0);}return score*4/Math.max(1,limit);}

  private tournament(){let best=this.genomes[Math.floor(Math.random()*this.genomes.length)];for(let i=0;i<3;i++){const candidate=this.genomes[Math.floor(Math.random()*this.genomes.length)];if(candidate.fitness>best.fitness)best=candidate;}return best;}
  private crossover(a:Genome,b:Genome){const child=this.clone(a);child.weights=child.weights.map((m,l)=>m.map((row,n)=>row.map((v,w)=>Math.random()<.5?v:b.weights[l][n][w])));child.biases=child.biases.map((row,l)=>row.map((v,n)=>Math.random()<.5?v:b.biases[l][n]));return child;}
  private mutate(g:Genome,rate:number,strength:number){g.weights.forEach(m=>m.forEach(row=>row.forEach((_,i)=>{if(Math.random()<rate)row[i]+=rand()*strength;})));g.biases.forEach(row=>row.forEach((_,i)=>{if(Math.random()<rate)row[i]+=rand()*strength;}));return g;}
  private clone(g:Genome):Genome{return{weights:g.weights.map(m=>m.map(r=>[...r])),biases:g.biases.map(r=>[...r]),fitness:g.fitness,memory:[],cell:[]};}
}
