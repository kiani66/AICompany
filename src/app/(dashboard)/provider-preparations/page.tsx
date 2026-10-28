'use client';
import { useEffect,useState } from 'react';

type Proposal={id:string;status:string;project_id:string;model:string;snapshot_sha256:string;};
type Prepared={id:string;proposal_id:string;state:string;version:number;review_digest:string;review_envelope:string;reserved_tokens:number;reserved_micro_usd:number;outcome_reason:string|null};
type Envelope={snapshotSha256:string;provider:{provider:string;model:string;pricingVersion:string};capabilities:string[];maxInputTokens:number;maxOutputTokens:number;maxChargeMicroUsd:number};

export default function ProviderPreparationPage(){
 const [proposals,setProposals]=useState<Proposal[]>([]);
 const [preps,setPreps]=useState<Prepared[]>([]);
 const [selected,setSelected]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [confirmed,setConfirmed]=useState(false);
 const [tokens,setTokens]=useState(10);
 async function load(){
   const [p,r]=await Promise.all([fetch('/api/project-plan/proposals'),fetch('/api/provider-preparations')]);
   if(!p.ok||!r.ok)throw new Error('Unable to load CEO review history');
   const options=(await p.json() as Proposal[]).filter(x=>x.status==='ACCEPTED');
   setProposals(options);setPreps(await r.json() as Prepared[]);
   setSelected(old=>options.some(x=>x.id===old)?old:options[0]?.id??'');
 }
 useEffect(()=>{void load().catch(e=>setError(String(e)));},[]);
 async function send(c:object){
   setBusy(true);setError('');setNotice('');
   try{
     const response=await fetch('/api/provider-preparations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});
     const data=await response.json() as {error?:string};
     if(!response.ok)throw new Error(data.error??'Preparation rejected');
     await load();setNotice('Local preparation state saved. No model called and no real charges incurred.');
   }catch(e){setError(e instanceof Error?e.message:'Request failed');}
   finally{setBusy(false);}
 }
 const selectedProposal=proposals.find(x=>x.id===selected);
 const envelope:Envelope|null=selectedProposal?{
   snapshotSha256:selectedProposal.snapshot_sha256,
   provider:{provider:'local-deterministic-mock',model:'deterministic-mock-v1',pricingVersion:'mock-zero-v1'},
   capabilities:[],maxInputTokens:tokens,maxOutputTokens:tokens,maxChargeMicroUsd:0,
 }:null;
 return <div className="space-y-5">
   <h1 className="text-2xl font-bold">Provider preparation — non-executing rehearsal</h1>
   <p className="rounded border border-amber-400 bg-amber-50 p-3">No real AI provider is connected. Preparation approval is NOT consent to spend. All actions are local database/accounting rehearsals only; the global kill switch must be off for this rehearsal. Unresolved mock outcomes retain their reservations.</p>
   <section className="space-y-2 rounded border p-3">
     <h2 className="font-semibold">Review an exact preparation envelope</h2>
     <label htmlFor="proposal">Accepted mock proposal</label>
     <select id="proposal" value={selected} className="block w-full rounded border p-2" onChange={e=>{setSelected(e.target.value);setConfirmed(false);}}>
       {proposals.map(p=><option key={p.id} value={p.id}>{p.id}</option>)}
     </select>
     {!proposals.length&&<p>Create and accept a synthetic mock plan first.</p>}
     <label className="block">Input/output token limit each
       <input type="number" className="ml-2 rounded border p-1" min={1} max={100000} value={tokens} onChange={e=>{setTokens(Number(e.target.value));setConfirmed(false);}}/>
     </label>
     {envelope&&<pre className="overflow-x-auto rounded bg-gray-50 p-3 text-xs">{JSON.stringify(envelope,null,2)}</pre>}
     <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed this exact mock envelope; no real inference or expenditure is authorized.</label>
     <button className="rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50" disabled={!confirmed||!envelope||busy||tokens<1||tokens>100000} onClick={()=>void send({type:'prepare',proposalId:selected,key:crypto.randomUUID(),envelope})}>Create mock preparation</button>
   </section>
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
   <section className="space-y-3"><h2 className="text-xl font-semibold">Recent preparations (latest 50)</h2>
   {preps.map(p=><div key={p.id} className="space-y-2 rounded border p-3">
     <p><strong>{p.state}</strong> — {p.id} · version {p.version}</p>
     <p className="break-all text-xs">Consent envelope SHA-256: {p.review_digest}</p>
     <pre className="overflow-x-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(JSON.parse(p.review_envelope) as unknown,null,2)}</pre>
     <p>Reserved: {p.reserved_tokens} tokens / {p.reserved_micro_usd} micro-USD · Outcome: {p.outcome_reason??'none'}</p>
     {p.state==='PREVIEWED'&&<button disabled={busy} className="rounded border p-2" onClick={()=>void send({type:'approve',id:p.id,version:p.version,digest:p.review_digest})}>Approve exact mock envelope</button>}
     {p.state==='APPROVED'&&<button disabled={busy} className="rounded border p-2" onClick={()=>void send({type:'reserve',id:p.id,version:p.version})}>Reserve simulated budget</button>}
     {p.state==='RESERVED'&&<div className="flex flex-wrap gap-2">
       <button className="rounded border p-2" disabled={busy} onClick={()=>void send({type:'resolveMock',id:p.id,version:p.version,outcome:'success'})}>Reconcile mock success</button>
       <button className="rounded border p-2" disabled={busy} onClick={()=>void send({type:'resolveMock',id:p.id,version:p.version,outcome:'no-charge'})}>Confirm no charge</button>
       <button className="rounded border p-2" disabled={busy} onClick={()=>void send({type:'resolveMock',id:p.id,version:p.version,outcome:'timeout'})}>Simulate unknown timeout</button>
     </div>}
     {['PREVIEWED','APPROVED','RESERVED'].includes(p.state)&&<button className="rounded border p-2" disabled={busy} onClick={()=>void send({type:'cancel',id:p.id,version:p.version})}>Cancel mock preparation</button>}
     {p.state==='UNRESOLVED'&&<p>Reservation held pending independently verified operator reconciliation. No automatic release or retry.</p>}
   </div>)}
   </section>
 </div>;
}
