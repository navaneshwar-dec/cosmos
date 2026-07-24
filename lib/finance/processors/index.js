import * as sbi from './sbi';
import * as axis_ace from './axis_ace';

// Per-source statement processors. Add a bank's module here and set the source's
// `processor` field to its id to activate it.
const REGISTRY = { sbi, axis_ace };

export function getProcessor(id) {
  return id && REGISTRY[id] ? REGISTRY[id] : null;
}

export const PROCESSORS = Object.values(REGISTRY).map(p => p.meta);
