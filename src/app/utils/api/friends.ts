import type { Friend, IncomingFriendRequest, OutgoingFriendRequest } from "../../../services/friendService";
import { fetchAPI, supabase } from "./_internal";

// ============================================================================
// Friend APIs
// ============================================================================

export async function addFriend(friendIdentifier: string) {
  return fetchAPI("/friends", {
    method: "POST",
    body: JSON.stringify({ friendIdentifier }),
  });
}

export async function getFriends(): Promise<{
  success: boolean;
  friends: Friend[];
  incomingRequests?: IncomingFriendRequest[];
  outgoingRequests?: OutgoingFriendRequest[];
}> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("로그인이 필요합니다.");

  // 1. Fetch all friendships related to me
  const { data: friendships, error: friendshipError } = await supabase
    .from("friendships")
    .select("*")
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (friendshipError) throw friendshipError;

  // 2. Collect all related user IDs
  const relatedUserIds = new Set<string>();
  const acceptedRows: any[] = [];
  const incomingRows: any[] = [];
  const outgoingRows: any[] = [];

  (friendships ?? []).forEach((f) => {
    const otherId = f.user_id === user.id ? f.friend_id : f.user_id;
    relatedUserIds.add(otherId);

    if (f.status === "accepted") {
      acceptedRows.push({ ...f, otherId });
    } else if (f.status === "pending") {
      if (f.requested_by === user.id) {
        outgoingRows.push({ ...f, otherId });
      } else {
        incomingRows.push({ ...f, otherId });
      }
    }
  });

  // 3. Fetch user details in bulk
  const userMap = new Map<string, any>();
  if (relatedUserIds.size > 0) {
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, email, name, username")
      .in("id", Array.from(relatedUserIds));
    
    if (userError) throw userError;
    (users ?? []).forEach((u) => userMap.set(u.id, u));
  }

  // 4. Map details to categories
  const friends: Friend[] = acceptedRows
    .map((r) => {
      const u = userMap.get(r.otherId);
      if (!u) return null;
      return {
        userId: u.id,
        email: u.email,
        name: u.name,
        username: u.username ?? undefined,
        addedAt: r.created_at,
      } as Friend;
    })
    .filter((x): x is Friend => x !== null);

  const incomingRequests: IncomingFriendRequest[] = incomingRows
    .map((r) => {
      const u = userMap.get(r.otherId); // requester is otherId
      if (!u) return null;
      return {
        requestId: r.id,
        fromUser: {
          id: u.id,
          email: u.email,
          name: u.name,
          username: u.username ?? undefined,
        },
        createdAt: r.created_at,
      } as IncomingFriendRequest;
    })
    .filter((x): x is IncomingFriendRequest => x !== null);

  const outgoingRequests: OutgoingFriendRequest[] = outgoingRows
    .map((r) => {
      const u = userMap.get(r.otherId); // target is otherId
      if (!u) return null;
      return {
        requestId: r.id,
        toUser: {
          id: u.id,
          email: u.email,
          name: u.name,
          username: u.username ?? undefined,
        },
        createdAt: r.created_at,
      } as OutgoingFriendRequest;
    })
    .filter((x): x is OutgoingFriendRequest => x !== null);

  return { success: true, friends, incomingRequests, outgoingRequests };
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

export async function getLeaderboard(): Promise<{
  success: boolean;
  leaderboard: {
    user: { id: string; email: string; name: string; username?: string };
    plan: { id: string; name: string; totalDays: number } | null;
    achievementRate: number;
    progressRate: number;
    completedDays: number;
    totalDays: number;
  }[];
}> {
  return fetchAPI("/leaderboard");
}
