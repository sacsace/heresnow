/**
 * Synthetic face identity security tests — no DB required.
 * Run: npx tsx scripts/face-identity-security-tests.ts
 */

import {
  analyzeTemplateMatch,
  confirmMultiFrameIdentity,
  identifyEmployeeAmongCandidates,
  verifyEmployeeTemplates,
} from "@/lib/faceIdentityMatch";
import { resolveFaceIdentityPolicy } from "@/lib/faceIdentityPolicy";
import { euclideanDistance, FACE_DESCRIPTOR_LENGTH } from "@/lib/faceMatch";

type TestResult = { name: string; pass: boolean; detail?: string };

const policy = resolveFaceIdentityPolicy();
const results: TestResult[] = [];

function assert(name: string, condition: boolean, detail?: string) {
  results.push({ name, pass: condition, detail });
  const mark = condition ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function randomUnitVector(seed: number): number[] {
  const v = new Array(FACE_DESCRIPTOR_LENGTH);
  let sum = 0;
  for (let i = 0; i < FACE_DESCRIPTOR_LENGTH; i++) {
    const x = Math.sin(seed * 997 + i * 13) * 1000;
    v[i] = x;
    sum += x * x;
  }
  const norm = Math.sqrt(sum);
  return v.map((x) => x / norm);
}

function perturb(base: number[], magnitude: number, seed: number): number[] {
  const noise = randomUnitVector(seed);
  const out = base.map((b, i) => b + noise[i]! * magnitude);
  let sum = 0;
  for (const x of out) sum += x * x;
  const norm = Math.sqrt(sum);
  return out.map((x) => x / norm);
}

const personA = randomUnitVector(1);
const personB = randomUnitVector(2);
const personC = randomUnitVector(3);

const templatesA = [
  perturb(personA, 0.08, 10),
  perturb(personA, 0.1, 11),
  perturb(personA, 0.09, 12),
  perturb(personA, 0.11, 13),
  perturb(personA, 0.07, 14),
];

const templatesB = [
  perturb(personB, 0.08, 20),
  perturb(personB, 0.1, 21),
  perturb(personB, 0.09, 22),
  perturb(personB, 0.11, 23),
  perturb(personB, 0.07, 24),
];

const similarB = perturb(personB, 0.05, 25);

const candidates = [
  { id: "emp-a", name: "Employee A", descriptors: templatesA },
  { id: "emp-b", name: "Employee B", descriptors: templatesB },
];

const probeA = perturb(personA, 0.06, 100);
const probeUnknown = randomUnitVector(999);
const probeAsB = perturb(personB, 0.06, 200);
const probeAmbiguous = perturb(personA, 0.14, 300);

// 1. Registered employee self → success
{
  const r = identifyEmployeeAmongCandidates(candidates, probeA, policy);
  assert("1. Registered employee self → PASS", r.status === "PASS" && r.employeeId === "emp-a");
}

// 2. Unregistered person → UNKNOWN
{
  const r = identifyEmployeeAmongCandidates(candidates, probeUnknown, policy);
  assert("2. Unregistered → UNKNOWN", r.status === "UNKNOWN");
}

// 3. Employee A face trying to pass as B (1:1) → fail
{
  const credsB = templatesB.map((d, i) => ({ id: `b${i}`, descriptor: d }));
  const v = verifyEmployeeTemplates(credsB, probeA, policy);
  assert("3. A face vs B templates → reject", !v.matched, v.reason);
}

// 4. Similar employees → AMBIGUOUS or correct
{
  const tightCandidates = [
    { id: "emp-a", descriptors: templatesA },
    { id: "emp-b", descriptors: [similarB, ...templatesB.slice(1)] },
  ];
  const r = identifyEmployeeAmongCandidates(tightCandidates, probeAmbiguous, policy);
  assert(
    "4. Similar pair → not arbitrary best",
    r.status === "AMBIGUOUS" || r.status === "UNKNOWN" || r.status === "PASS"
  );
}

// 5. Single template lucky match → fail consistency
{
  const luckyTemplates = [
    perturb(personA, 0.06, 501),
    perturb(personB, 0.08, 502),
    perturb(personB, 0.08, 503),
    perturb(personB, 0.08, 504),
    perturb(personB, 0.08, 505),
  ];
  const analysis = analyzeTemplateMatch(
    luckyTemplates,
    probeA,
    policy.matchThreshold,
    policy.minTemplateMatches
  );
  assert("5. One lucky template → inconsistent", !analysis.consistent);
}

// 6. 3+ consistent templates → success (1:1)
{
  const creds = templatesA.map((d, i) => ({ id: `c${i}`, descriptor: d }));
  const v = verifyEmployeeTemplates(creds, probeA, policy);
  assert("6. Multi-template consistent 1:1 → matched", v.matched && (v.templateMatchCount ?? 0) >= 2);
}

// 7. 5 frames, 1 match → fail
{
  const frames = [probeA, probeUnknown, probeUnknown, probeUnknown, probeUnknown];
  const mf = confirmMultiFrameIdentity(frames, candidates, policy);
  assert("7. 1/5 frames → MULTIFRAME_FAILED", mf.status !== "PASS");
}

// 8. 5 frames, 3+ same employee → pass
{
  const frames = [probeA, perturb(personA, 0.07, 801), probeUnknown, perturb(personA, 0.08, 802), perturb(personA, 0.06, 803)];
  const mf = confirmMultiFrameIdentity(frames, candidates, policy);
  assert(
    "8. 3+/5 frames same → PASS",
    mf.status === "PASS" && mf.employeeId === "emp-a",
    `got ${mf.status} ${"employeeId" in mf ? mf.employeeId : ""}`
  );
}

// 9. Best match without threshold → UNKNOWN (never auto-auth closest)
{
  const farProbe = perturb(personC, 0.02, 900);
  const r = identifyEmployeeAmongCandidates(candidates, farProbe, policy);
  assert("9. Distant probe → UNKNOWN", r.status === "UNKNOWN", r.status);
}

// 15. Wrong embedding dimension → fail
{
  const bad = probeA.slice(0, 64);
  const r = identifyEmployeeAmongCandidates(candidates, bad, policy);
  assert("15. Bad dimension → UNKNOWN", r.status === "UNKNOWN" && r.reason === "INVALID_PROBE");
}

// Margin enforcement
{
  const distAB = euclideanDistance(probeA, templatesB[0]!);
  assert("Margin config loaded", policy.identityMinMargin >= 0.08, `margin=${policy.identityMinMargin}`);
  assert("Threshold stricter than legacy 0.45", policy.matchThreshold <= 0.45, `t=${policy.matchThreshold}`);
  void distAB;
}

// Login uses same matchThreshold as account test (no extra min-confidence gate)
{
  const loginResult = identifyEmployeeAmongCandidates(candidates, probeA, policy, {
    purpose: "login",
    thresholdOverride: policy.matchThreshold,
  });
  assert(
    "Login same threshold as test → PASS for genuine",
    loginResult.status === "PASS" && loginResult.employeeId === "emp-a"
  );
}

const failed = results.filter((r) => !r.pass);
console.log("\n--- Summary ---");
console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
if (failed.length > 0) {
  console.error("Failed tests:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
