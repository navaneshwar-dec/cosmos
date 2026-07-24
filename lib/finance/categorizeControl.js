// Shared registry of in-flight categorization runs, keyed by userId → AbortController.
// Lives on globalThis so it survives dev HMR and is shared across route modules in
// the same Node process (the cancel route aborts the run the categorize route started).
const g = globalThis;
if (!g.__categorizeRuns) g.__categorizeRuns = new Map();

export const activeRuns = g.__categorizeRuns;
