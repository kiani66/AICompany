import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({ resolve:{alias:{'@':resolve(__dirname,'src')}}, test:{include:['tests/integration.test.ts','tests/workflow.integration.test.ts','tests/runtime.integration.test.ts','tests/handoff.integration.test.ts'], fileParallelism:false} });
