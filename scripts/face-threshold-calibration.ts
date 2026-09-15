/**
 * Genuine / Impostor threshold calibration from stored face templates.
 * Run: npx tsx scripts/face-threshold-calibration.ts [companyId]
 */

import { euclideanDistance, parseFaceDescriptor } from "@/lib/faceMatch";
import { prisma } from "@/lib/prisma";

type Pair = { distance: number; label: "genuine" | "impostor" };

async function loadPairs(companyId?: string): Promise<Pair[]> {
  const employees = await prisma.employee.findMany({
    where: {
      faceEnrolledAt: { not: null },
      ...(companyId ? { companyId } : {}),
    },
    select: {
      id: true,
      companyId: true,
      faceCredentials: { select: { descriptor: true } },
    },
  });

  const byCompany = new Map<string, Map<string, number[][]>>();
  for (const emp of employees) {
    const vecs = emp.faceCredentials
      .map((c) => parseFaceDescriptor(c.descriptor))
      .filter((d): d is number[] => d != null);
    if (vecs.length === 0) continue;
    if (!byCompany.has(emp.companyId)) byCompany.set(emp.companyId, new Map());
    byCompany.get(emp.companyId)!.set(emp.id, vecs);
  }

  const pairs: Pair[] = [];

  for (const gallery of byCompany.values()) {
    const ids = [...gallery.keys()];
    for (const id of ids) {
      const vecs = gallery.get(id)!;
      for (let i = 0; i < vecs.length; i++) {
        for (let j = i + 1; j < vecs.length; j++) {
          pairs.push({ distance: euclideanDistance(vecs[i]!, vecs[j]!), label: "genuine" });
        }
      }
    }
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        for (const va of gallery.get(ids[a]!)!) {
          for (const vb of gallery.get(ids[b]!)!) {
            pairs.push({ distance: euclideanDistance(va, vb), label: "impostor" });
          }
        }
      }
    }
  }

  return pairs;
}

function evaluateThreshold(pairs: Pair[], threshold: number) {
  const genuine = pairs.filter((p) => p.label === "genuine");
  const impostor = pairs.filter((p) => p.label === "impostor");
  const genuinePass = genuine.filter((p) => p.distance < threshold).length;
  const impostorPass = impostor.filter((p) => p.distance < threshold).length;
  const frr = genuine.length ? (1 - genuinePass / genuine.length) * 100 : 0;
  const far = impostor.length ? (impostorPass / impostor.length) * 100 : 0;
  return {
    threshold,
    genuinePassPct: genuine.length ? (genuinePass / genuine.length) * 100 : 0,
    falseAcceptPct: far,
    frr,
    far,
    genuineN: genuine.length,
    impostorN: impostor.length,
  };
}

async function main() {
  const companyId = process.argv[2];
  const pairs = await loadPairs(companyId);

  if (pairs.length === 0) {
    console.log("No enrolled face templates found. Skipping DB calibration.");
    console.log("Run scripts/face-identity-security-tests.ts for synthetic tests.");
    await prisma.$disconnect();
    return;
  }

  const thresholds = [0.6, 0.55, 0.5, 0.48, 0.45, 0.42, 0.4, 0.38, 0.36];
  console.log("Threshold   Genuine Pass   False Accept   FRR%    FAR%");
  console.log("---------   ------------   ------------   ----    ----");
  for (const t of thresholds) {
    const r = evaluateThreshold(pairs, t);
    console.log(
      `${t.toFixed(2).padStart(8)}   ${r.genuinePassPct.toFixed(1).padStart(11)}%   ${r.falseAcceptPct.toFixed(2).padStart(11)}%   ${r.frr.toFixed(1).padStart(5)}   ${r.far.toFixed(2).padStart(5)}`
    );
  }

  const recommended = thresholds
    .map((t) => evaluateThreshold(pairs, t))
    .find((r) => r.far <= 0.1 && r.genuinePassPct >= 90);
  console.log("\nRecommended production threshold (FAR≤0.1%, Genuine≥90%):");
  console.log(recommended ? recommended.threshold : "Manual review required — tighten threshold or re-enroll");
  console.log(`Pairs: genuine=${pairs.filter((p) => p.label === "genuine").length}, impostor=${pairs.filter((p) => p.label === "impostor").length}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
