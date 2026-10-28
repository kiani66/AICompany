export type TaskState = 'draft'|'ready'|'in_progress'|'blocked'|'done'|'cancelled';
const transitions: Record<TaskState, TaskState[]> = {draft:['ready','cancelled'],ready:['in_progress','cancelled'],in_progress:['blocked','done','cancelled'],blocked:['ready','cancelled'],done:[],cancelled:[]};
export function canTransition(from: TaskState, to: TaskState) { return transitions[from].includes(to); }
export function hasCycle(edges: Array<[string,string]>) { const graph = new Map<string,string[]>(); for (const [a,b] of edges) graph.set(a,[...(graph.get(a) ?? []),b]); const active = new Set<string>(), done = new Set<string>(); function visit(n:string):boolean { if(active.has(n)) return true; if(done.has(n)) return false; active.add(n); for(const next of graph.get(n) ?? []) if(visit(next)) return true; active.delete(n); done.add(n); return false; } return [...graph.keys()].some(visit); }
export function executionAllowed() { return false as const; }
export function requiresCeoApproval(action: 'deploy'|'spend'|'activate'|'merge'|'read') { return action !== 'read'; }
export interface ModelProvider { generate(input: { prompt: string }): Promise<{ text: string; costUsd: number }> }
export interface Checkpoint { executionId: string; sequence: number; payload: string }
export interface ResumeContract { checkpoint: Checkpoint; approved: boolean }
