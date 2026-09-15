/** Drop near-duplicate consecutive frame descriptors (multi-frame auth) */
export function dedupeFaceProbes(probes: number[][]): number[][] {
  const out: number[][] = [];
  for (const p of probes) {
    const dup = out.some((prev) => faceProbesTooSimilar(prev, p));
    if (!dup) out.push(p);
  }
  return out;
}

export function faceProbesTooSimilar(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    sum += d * d;
  }
  return Math.sqrt(sum) < 0.06;
}
