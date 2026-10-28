'use client';
import { useState } from 'react';

type Proposal = { summary: string; milestones: { title: string; acceptanceCriteria: string }[] };
export default function ProjectPlanPreview() {
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<Proposal | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function preview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const response = await fetch('/api/project-plan/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDescription: description, model: 'deterministic-mock-v1' }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error('Preview request was rejected');
      const parsed = body as { proposal?: Proposal; mode?: string; persisted?: boolean };
      if (parsed.mode !== 'MOCK_PREVIEW_ONLY' || parsed.persisted !== false || !parsed.proposal)
        throw new Error('Unexpected preview response');
      setResult(parsed.proposal);
    } catch (e) { setError(e instanceof Error ? e.message : 'Preview unavailable'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">Project Manager — mock preview</h1>
    <p className="rounded border border-amber-300 bg-amber-50 p-3">
      Deterministic local simulation only. No real AI, API keys, provider calls, charges,
      persisted proposals or task creation. Do not enter secrets or customer data.
    </p>
    <form onSubmit={preview} className="space-y-3">
      <label className="block font-semibold" htmlFor="project-description">Project description (max 2,000 characters)</label>
      <textarea id="project-description" className="w-full rounded border p-3" required
        minLength={1} maxLength={2000} rows={6} value={description}
        onChange={e => setDescription(e.target.value)} />
      <p>Provider: local-deterministic-mock · Model: deterministic-mock-v1 · Tools: none · Real charge: none</p>
      <button type="submit" disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
        {busy ? 'Generating mock preview…' : 'Preview mock plan'}
      </button>
    </form>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {result && <section aria-label="Mock plan" className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-semibold">Unsaved mock proposal</h2>
      <p>{result.summary}</p>
      <ol className="list-decimal space-y-2 pl-6">{result.milestones.map((m, i) =>
        <li key={i}><strong>{m.title}</strong>: {m.acceptanceCriteria}</li>)}</ol>
      <p className="text-sm">Review only. Acceptance and persistence are not implemented.</p>
    </section>}
  </div>;
}
