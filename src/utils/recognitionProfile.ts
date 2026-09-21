const dev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
export type RecognitionTimings = Record<string, number>;
export function createRecognitionProfile() {
  const start = performance.now();
  const stages: RecognitionTimings = {};
  return {
    stages,
    time<T>(name: string, run: () => T): T {
      if (!dev) return run();
      const t = performance.now();
      try { return run(); } finally { stages[name] = (stages[name] ?? 0) + performance.now() - t; }
    },
    add(name: string, milliseconds: number) { if (dev) stages[name] = (stages[name] ?? 0) + milliseconds; },
    finish() { if (dev) stages.total = performance.now() - start; return stages; }
  };
}

let pending: { start: number; stages: RecognitionTimings; commitStart?: number } | undefined;
let legendProcessing = 0;
export function beginRecognitionProfile() {
  if (dev) pending = { start: performance.now(), stages: { legendProcessing } };
}
export function recordRecognitionStages(stages: RecognitionTimings) {
  if (dev && stages.legendProcessing !== undefined) legendProcessing = stages.legendProcessing;
  if (pending) Object.assign(pending.stages, stages);
}
export function markRecognitionCommit() { if (pending) pending.commitStart = performance.now(); }
export function finishRecognitionRender(milliseconds: number) {
  if (!pending) return;
  pending.stages.canvasRender = milliseconds;
  if (pending.commitStart) pending.stages.reactCommit = performance.now() - pending.commitStart - milliseconds;
  pending.stages.complete = performance.now() - pending.start;
  console.table(pending.stages);
  (globalThis as typeof globalThis & { __beadflowProfile?: RecognitionTimings }).__beadflowProfile = pending.stages;
  pending = undefined;
}
