import { EvolutionEngine, type EngineSnapshot, type DecisionTrace, type EvaluatedStep, type MazeEnvironment } from './neural';
export interface GenerationRecord { generation:number; best:number; average:number; species:number; trace:DecisionTrace; steps?:EvaluatedStep[]; decisions:number; decisionLimit:number; timeLimitSeconds:number; actionRuns:Array<{action:string;count:number}>; maze?:MazeEnvironment; }
export interface ProjectDocument { format:'neural-forge'; version:2; state:Record<string,unknown>; engine:EngineSnapshot; architect:EngineSnapshot; archive:GenerationRecord[]; view:{index:number; followLatest:boolean; replayStep:number}; }
const families = ['NEAT-style','Dense MLP','ReLU Feed Forward','Simple RNN','LSTM','GRU','Convolutional','Spiking','Liquid','Radial Basis','Transformer Lite','Echo State'];
const games = ['snake','tictactoe','minesweeper','flappy','pong','xor','breakout','dino','merge2048','lander','maze','custom'];
function requireValue(ok:unknown, message:string): asserts ok { if (!ok) throw new Error(`Invalid project: ${message}`); }
function object(v:unknown): asserts v is Record<string,any> { requireValue(v && typeof v==='object'&&!Array.isArray(v),'expected an object'); }
function number(v:unknown,min=-1e9,max=1e9): asserts v is number { requireValue(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,'number outside supported range'); }
function integer(v:unknown,min:number,max:number) {number(v,min,max);requireValue(Number.isInteger(v),'expected integer');}
function safeTree(v:unknown,depth=0) { requireValue(depth<30,'excessive nesting'); if(typeof v==='number')number(v);else if(typeof v==='string')requireValue(v.length<=2000000&&!/[<>]/.test(v),'unsafe or oversized string');else if(Array.isArray(v)){requireValue(v.length<=20000,'oversized array');v.forEach(x=>safeTree(x,depth+1));}else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){requireValue(!['__proto__','constructor','prototype'].includes(k),'unsafe property');safeTree(x,depth+1);}else requireValue(v===null||typeof v==='boolean','unsupported value'); }
function maze(v:any){object(v);integer(v.width,3,64);integer(v.height,3,64);requireValue(Array.isArray(v.walls)&&v.walls.length===v.width*v.height&&v.walls.every((b:unknown)=>typeof b==='boolean'),'maze walls');integer(v.start,0,v.walls.length-1);integer(v.goal,0,v.walls.length-1);}
function snapshot(v:unknown): asserts v is EngineSnapshot {object(v);requireValue(families.includes(v.family),'network family');requireValue(Array.isArray(v.shape)&&v.shape.length>=2&&v.shape.length<=10,'network shape');v.shape.forEach((n:unknown)=>integer(n,1,128));requireValue(Array.isArray(v.genomes)&&v.genomes.length>=1&&v.genomes.length<=500,'population');for(const g of v.genomes){object(g);number(g.fitness);requireValue(Array.isArray(g.weights)&&g.weights.length===v.shape.length-1&&Array.isArray(g.biases)&&g.biases.length===g.weights.length,'genome dimensions');g.weights.forEach((m:any,l:number)=>{requireValue(Array.isArray(m)&&m.length===v.shape[l+1]&&Array.isArray(g.biases[l])&&g.biases[l].length===m.length,'layer dimensions');m.forEach((row:any)=>{requireValue(Array.isArray(row)&&row.length===v.shape[l],'weight dimensions');row.forEach((n:unknown)=>number(n));});g.biases[l].forEach((n:unknown)=>number(n));});requireValue(Array.isArray(g.memory)&&Array.isArray(g.cell),'recurrent state');} }
export function parseProject(raw:unknown, defaults:Record<string,unknown>): {document:ProjectDocument|null;state:Record<string,unknown>;legacy:boolean} {
  if(typeof raw==='string'){requireValue(raw.length<=128*1024*1024,'file exceeds 128 MiB');raw=JSON.parse(raw);}
  object(raw);safeTree(raw);
  const legacy=raw.format===undefined&&raw.version===undefined;
  if(!legacy)requireValue(raw.format==='neural-forge'&&raw.version===2,'unsupported format/version; original left unchanged');
  const source=legacy?raw:raw.state;object(source);
  const state:Record<string,unknown>={...defaults};
  for(const key of Object.keys(defaults))if(Object.hasOwn(source,key))state[key]=source[key];
  const aliases:Record<string,string>={NEAT:'NEAT-style','Feed Forward':'Dense MLP',Recurrent:'Simple RNN'};
  if(typeof state.networkType==='string')state.networkType=aliases[state.networkType]||state.networkType;
  requireValue(games.includes(state.game as string)&&families.includes(state.networkType as string),'arena/network');
  for(const [key,value] of Object.entries(defaults))if(typeof value==='number')number(state[key]);else if(typeof value==='boolean')requireValue(typeof state[key]==='boolean',key);
  for(const [key,min,max] of [['population',20,500],['generation',0,1000000],['targetGenerations',10,1000000],['episodeTimeLimit',1,60],['decisionsPerSecond',1,30],['mutationRate',0,100],['mutationStrength',0,100],['elitism',0,100]] as const)integer(state[key],min,max);
  requireValue(Array.isArray(state.hiddenLayers)&&state.hiddenLayers.length>=1&&state.hiddenLayers.length<=8,'hidden layers');state.hiddenLayers.forEach((x:unknown)=>integer(x,1,128));
  requireValue(Array.isArray(state.history)&&state.history.length<=20000,'fitness history');state.history.forEach((x:unknown)=>number(x));maze(state.maze);
  if(source.custom!==undefined){object(source.custom);requireValue(Array.isArray(source.custom.actions)&&source.custom.actions.length>=1&&source.custom.actions.length<=32,'custom actions');state.custom=source.custom;}
  requireValue(['builder','coevolve'].includes(state.mazeMode as string),'maze mode');
  state.running=false;
  if(legacy){state.generation=0;state.bestFitness=0;state.averageFitness=0;state.history=[0];return {document:null,state,legacy:true};}
  snapshot(raw.engine);snapshot(raw.architect);
  requireValue(JSON.stringify(raw.architect.shape)==='[4,10,8,1]'&&raw.architect.family==='Liquid','architect shape');
  const inputCount:Record<string,number>={snake:12,tictactoe:18,minesweeper:81,flappy:5,pong:6,xor:2,breakout:6,dino:4,merge2048:16,lander:6,maze:12,custom:8};
  const outputCount:Record<string,number>={snake:4,tictactoe:9,minesweeper:81,flappy:1,pong:3,xor:1,breakout:3,dino:1,merge2048:4,lander:3,maze:4,custom:(state.custom as any)?.actions?.length||4};
  const expected=[inputCount[state.game as string],...state.hiddenLayers as number[],outputCount[state.game as string]];
  requireValue(JSON.stringify(raw.engine.shape)===JSON.stringify(expected)&&raw.engine.family===state.networkType&&raw.engine.genomes.length===state.population,'engine/settings mismatch');
  requireValue(Array.isArray(raw.archive)&&raw.archive.length<=20000,'archive');
  let previous=0;
  for(const r of raw.archive){object(r);integer(r.generation,previous+1,state.generation as number);previous=r.generation;number(r.best);number(r.average);integer(r.species,1,500);integer(r.decisions,0,2000);integer(r.decisionLimit,1,2000);number(r.timeLimitSeconds,1,60);requireValue(Array.isArray(r.actionRuns),'action sequence');let total=0;for(const run of r.actionRuns){object(run);requireValue(typeof run.action==='string'&&run.action.length<=80,'action');integer(run.count,1,2000);total+=run.count;}requireValue(total===r.decisions&&total<=r.decisionLimit,'action/decision budget mismatch');object(r.trace);requireValue(Array.isArray(r.trace.observations)&&Array.isArray(r.trace.outputs)&&Array.isArray(r.trace.layers)&&Array.isArray(r.trace.weights),'trace');
    requireValue(r.trace.provenance==='evaluated'&&r.trace.observations.length===expected[0]&&r.trace.outputs.length===expected.at(-1)&&r.trace.layers.length===expected.length&&r.trace.weights.length===expected.length-1,'trace dimensions/provenance');
    for(const o of [...r.trace.observations,...r.trace.outputs]){object(o);requireValue(typeof o.label==='string'&&o.label.length<=100,'trace label');number(o.value);}
    r.trace.layers.forEach((layer:any,i:number)=>requireValue(Array.isArray(layer)&&layer.length===expected[i],'trace activation dimensions'));
    r.trace.weights.forEach((matrix:any,l:number)=>{requireValue(Array.isArray(matrix)&&matrix.length===expected[l+1],'trace weight dimensions');matrix.forEach((row:any)=>requireValue(Array.isArray(row)&&row.length===expected[l],'trace weight row'));});
    requireValue(typeof r.trace.chosenAction==='string'&&typeof r.trace.explanation==='string'&&typeof r.trace.fitnessRule==='string','trace text');integer(r.trace.chosenIndex,0,r.trace.outputs.length-1);
    if(r.maze)maze(r.maze);requireValue(Array.isArray(r.steps)&&r.steps.length===r.decisions,'evaluated steps');const expanded=r.actionRuns.flatMap((run:any)=>Array(run.count).fill(run.action));for(const [stepIndex,step] of r.steps.entries()){requireValue(Array.isArray(step.input)&&step.input.length===expected[0]&&Array.isArray(step.layers)&&step.layers.length===expected.length&&typeof step.action==='string','evaluated step');requireValue(step.action===expanded[stepIndex],'step/action mismatch');step.layers.forEach((layer:any,i:number)=>requireValue(Array.isArray(layer)&&layer.length===expected[i],'activation dimensions'));} }
  object(raw.view);integer(raw.view.index,raw.archive.length?0:-1,raw.archive.length-1);requireValue(typeof raw.view.followLatest==='boolean','archive following');integer(raw.view.replayStep,0,raw.archive[raw.view.index]?.decisions||0);
  // Validation is complete before callers replace any live state.
  return {document:structuredClone({...raw,state}) as unknown as ProjectDocument,state,legacy:false};
}
export function createProject(state:Record<string,unknown>,engine:EvolutionEngine,architect:EvolutionEngine,archive:GenerationRecord[],view:ProjectDocument['view']):ProjectDocument {
  return structuredClone({format:'neural-forge',version:2,state:{...state,running:false},engine:engine.snapshot(),architect:architect.snapshot(),archive,view});
}
