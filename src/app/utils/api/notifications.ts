import { fetchAPI } from "./_internal";

// ============================================================================
// Notification APIs
// ============================================================================

export async function saveNotification(planId: string, time: string, enabled: boolean) {
  return fetchAPI("/notifications", {
    method: "POST",
    body: JSON.stringify({ planId, time, enabled }),
  });
}

export async function getNotifications() {
  return fetchAPI("/notifications");
}
