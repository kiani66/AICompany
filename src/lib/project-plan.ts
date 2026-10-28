import { z } from 'zod';

// Output is untrusted data. These contracts do not grant execution authority.
export const projectPlan = z.object({
  summary: z.string().trim().min(1).max(1000),
  milestones: z.array(z.object({ title: z.string().trim().min(1).max(150), acceptanceCriteria: z.string().trim().min(1).max(1000) }).strict()).min(1).max(12),
}).strict();
export type ProjectPlan = z.infer<typeof projectPlan>;
export interface PlanProvider {
  propose(input: { snapshot: string; model: string }): Promise<unknown>;
}
export const mockPlanProvider: PlanProvider = {
  async propose() { return { summary: 'Simulated project plan for CEO review.', milestones: [{ title: 'Review scope', acceptanceCriteria: 'CEO reviews the scope and decides next steps.' }] }; },
};
// No runtime selector for a real provider is provided until consent, accounting,
// egress controls and ambiguous-billing recovery are implemented and reviewed.
export function validatePlan(output: unknown): ProjectPlan { return projectPlan.parse(output); }
