'use client';
import { useEffect, useState } from 'react';

type Proposal = { summary:string; milestones:{title:string;acceptanceCriteria:string}[] };
type Saved = {id:string;project_id:string;status:string;version:number;provider:string;model:string;snapshot_sha256:string;proposal:string;created_at:string};
type Project = {id:string;name:string;status:string};
const model='deterministic-mock-v1';
export default function ProjectPlanPage() {
  const [description,setDescription]=useState('');
  const [projectId,setProjectId]=useState('');
  const [projects,setProjects]=useState<Project[]>([]);
  const [history,setHistory]=useState<Saved[]>([]);
  const [preview,setPreview]=useState<Proposal|null>(null);
  const [ack,setAck]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  async function load() {
    try {
      const [p,h]=await Promise.all([fetch('/api/projects?limit=100'),fetch('/api/project-plan/proposals')]);
      if(!p.ok||!h.ok) throw new Error('Unable to load projects or proposals');
      const ps=await p.json() as Project[];
      setProjects(ps.filter(x=>x.status==='active'));
      setHistory(await h.json() as Saved[]);
      setProjectId(old=>ps.some(x=>x.id===old)?old:(ps.find(x=>x.status==='active')?.id??''));
    } catch(e) {setError(e instanceof Error?e.message:'Unable to load history');}
  }
  useEffect(()=>{void load();},[]);
  async function submit(path:string,method:'POST'|'PATCH',body:object) {
    const response=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data:unknown=await response.json();
    if(!response.ok) throw new Error((data as {error?:string}).error??'Operation failed');
    return data;
  }
  async function act(f:()=>Promise<void>) {
    setBusy(true);setError('');setNotice('');
    try {await f();} catch(e){setError(e instanceof Error?e.message:'Request failed');}
    finally {setBusy(false);}
  }
  function changeDescription(value:string){setDescription(value);setPreview(null);setAck(false);}
  const button='rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50';
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Project Manager — mock project proposals</h1>
    <p className="rounded border border-amber-300 bg-amber-50 p-3">Mock-only, CEO review workflow. No model inference, real charges, tool execution or task creation. Do not enter credentials, personal data or customer secrets. Proposals store the submitted description for review; use only synthetic test data.</p>
    <section className="space-y-3 rounded border p-4">
      <label className="block font-semibold" htmlFor="plan-project">Active project</label>
      <select id="plan-project" className="w-full rounded border p-2" value={projectId} onChange={e=>{setProjectId(e.target.value);setPreview(null);setAck(false);}}>
        {!projectId && <option value="">Select a project</option>}
        {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <label className="block font-semibold" htmlFor="plan-description">Synthetic project description</label>
      <textarea id="plan-description" className="w-full rounded border p-3" required minLength={1} maxLength={2000} rows={5} value={description} onChange={e=>changeDescription(e.target.value)}/>
      <p>Provider: local deterministic mock · Model: {model} · Estimated real charge: $0 · Capabilities: none</p>
      <button className={button} disabled={busy||!description.trim()} onClick={()=>void act(async()=>{
        const d=await submit('/api/project-plan/preview','POST',{projectDescription:description,model}) as {proposal:Proposal};
        setPreview(d.proposal);
      })}>Preview mock plan</button>
      {preview && <div className="space-y-3 rounded border p-3" aria-label="Unsaved mock preview">
        <h2 className="font-semibold">Unsaved preview</h2><p>{preview.summary}</p>
        <ol className="list-decimal pl-6">{preview.milestones.map((m,i)=><li key={i}>{m.title}: {m.acceptanceCriteria}</li>)}</ol>
        <label className="flex items-start gap-2"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> I understand the submitted description will be persisted for CEO review, and no real AI execution occurs.</label>
        <button className={button} disabled={busy||!ack||!projectId} onClick={()=>void act(async()=>{
          await submit('/api/project-plan/proposals','POST',{projectId,description,acknowledgement:true,model});
          setNotice('Mock proposal saved for review. No tasks were created.');
          setPreview(null);setAck(false);await load();
        })}>Save mock proposal for review</button>
      </div>}
    </section>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {notice && <p role="status" className="text-green-800">{notice}</p>}
    {busy && <p role="status">Saving…</p>}
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Saved mock proposals (latest 50)</h2>
      {!history.length && <p>No saved mock proposals.</p>}
      {history.map(x=>{
        let plan:Proposal|null=null;
        try {plan=JSON.parse(x.proposal) as Proposal;}catch { /* Legacy corrupt content is not executable */ }
        return <div key={x.id} className="space-y-2 rounded border p-4">
          <p><strong>{projects.find(p=>p.id===x.project_id)?.name??x.project_id}</strong> — {x.status} · version {x.version}</p>
          <p className="text-xs">Mock provider: {x.provider}, {x.model} · Snapshot SHA-256: {x.snapshot_sha256}</p>
          {plan && <><p>{plan.summary}</p><ul className="list-disc pl-6">{plan.milestones.map((m,i)=><li key={i}>{m.title}: {m.acceptanceCriteria}</li>)}</ul></>}
          {x.status==='REVIEW_REQUIRED' && <div className="flex gap-3">
            <button className={button} disabled={busy} onClick={()=>void act(async()=>{
              await submit('/api/project-plan/proposals','PATCH',{id:x.id,version:x.version,decision:'ACCEPTED'});
              setNotice('Proposal accepted for reference only. No tasks created.');await load();
            })}>Accept for reference</button>
            <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={busy} onClick={()=>void act(async()=>{
              await submit('/api/project-plan/proposals','PATCH',{id:x.id,version:x.version,decision:'REJECTED'});
              setNotice('Proposal rejected.');await load();
            })}>Reject</button>
          </div>}
        </div>;
      })}
    </section>
  </div>;
}
