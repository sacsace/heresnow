export const PENDING_APPROVALS_CHANGED_EVENT = "pending-approvals-changed";

export function notifyPendingApprovalsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PENDING_APPROVALS_CHANGED_EVENT));
}
