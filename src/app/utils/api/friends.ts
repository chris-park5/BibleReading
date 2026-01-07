import { fetchAPI } from "./_internal";

// ============================================================================
// Friend APIs
// ============================================================================

export async function addFriend(friendIdentifier: string) {
  return fetchAPI("/friends", {
    method: "POST",
    body: JSON.stringify({ friendIdentifier }),
  });
}

export async function getFriends() {
  return fetchAPI("/friends");
}

export async function getFriendProgress(friendUserId: string, planId: string) {
  return fetchAPI(`/friend-progress?friendUserId=${friendUserId}&planId=${planId}`);
}

export async function deleteFriend(friendUserId: string) {
  return fetchAPI(`/friends/${friendUserId}`, { method: "DELETE" });
}

// ============================================================================
// Share Plan APIs
// ============================================================================

export async function getSharePlan(): Promise<{ success: boolean; sharedPlanId: string | null }> {
  return fetchAPI("/share-plan");
}

export async function setSharePlan(planId: string | null): Promise<{ success: boolean }> {
  return fetchAPI("/share-plan", {
    method: "POST",
    body: JSON.stringify({ planId }),
  });
}

export async function respondFriendRequest(requestId: string, action: "accept" | "decline") {
  return fetchAPI("/friend-requests/respond", {
    method: "POST",
    body: JSON.stringify({ requestId, action }),
  });
}

export async function cancelFriendRequest(requestId: string) {
  return fetchAPI("/friend-requests/cancel", {
    method: "POST",
    body: JSON.stringify({ requestId }),
  });
}

export async function getFriendStatus(friendUserId: string) {
  return fetchAPI(`/friend-status?friendUserId=${friendUserId}`);
}
