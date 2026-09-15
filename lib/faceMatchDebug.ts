/**
 * Development-only face match diagnostics — no raw embeddings or face images.
 */

type DebugPayload = Record<string, unknown>;

export function logFaceMatchDebug(purpose: string, payload: DebugPayload): void {
  if (process.env.NODE_ENV === "production" && process.env.FACE_MATCH_DEBUG !== "1") {
    return;
  }
  const lines: string[] = ["FACE MATCH DEBUG", `Purpose: ${purpose}`];

  if ("status" in payload) lines.push(`Result: ${String(payload.status)}`);
  if ("reason" in payload && payload.reason) lines.push(`Reason: ${String(payload.reason)}`);
  if ("distance" in payload && typeof payload.distance === "number") {
    lines.push(`Best Distance: ${payload.distance.toFixed(4)}`);
  }
  if ("debug" in payload && payload.debug && typeof payload.debug === "object") {
    const d = payload.debug as Record<string, unknown>;
    if (d.threshold != null) lines.push(`Threshold: ${d.threshold}`);
    if (d.requiredMargin != null) lines.push(`Required Margin: ${d.requiredMargin}`);
    if (d.identityMargin != null) lines.push(`Identity Margin: ${Number(d.identityMargin).toFixed(4)}`);
    if (d.minTemplateMatches != null) lines.push(`Min Template Matches: ${d.minTemplateMatches}`);
    if (d.best && typeof d.best === "object") {
      const b = d.best as Record<string, unknown>;
      lines.push(`Best Candidate: ${b.employeeId ?? "?"} distance=${b.distance}`);
      if (Array.isArray(b.templateDistances)) {
        lines.push(
          `Template Matches: ${(b.templateDistances as number[]).map((x) => x.toFixed(3)).join(", ")}`
        );
      }
      if (b.matchCount != null) lines.push(`Template Match Count: ${b.matchCount}`);
    }
    if (d.second && typeof d.second === "object") {
      const s = d.second as Record<string, unknown>;
      lines.push(`Second Candidate: ${s.employeeId ?? "?"} distance=${s.distance}`);
    }
    if (d.frameConfirmation && typeof d.frameConfirmation === "object") {
      const f = d.frameConfirmation as Record<string, unknown>;
      lines.push(`Frame Confirmation: ${f.passed}/${f.total}`);
    }
  }
  if ("templateMatchCount" in payload) {
    lines.push(`Template Match Count: ${payload.templateMatchCount}`);
  }
  if ("matched" in payload) lines.push(`Matched: ${payload.matched}`);

  console.info(lines.join("\n"));
}
