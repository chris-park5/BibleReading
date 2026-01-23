/**
 * Friend + Share Plan Routes
 */

import { Context } from "npm:hono";
import {
  getSupabaseClient,
  fetchUserProgress,
  handleError,
  computeChaptersTotals,
  calculateAchievementRate,
  calculateProgressRate,
  fetchGroupedSchedule,
} from "./utils.ts";
import type {
  AddFriendRequest,
  CancelFriendRequest,
  RespondFriendRequest,
  SetSharePlanRequest,
} from "./types.ts";

const supabase = getSupabaseClient();

// ============================================
// Friend Routes
// ============================================

export async function addFriend(c: Context) {
  try {
    const userId = c.get("userId");
    const { friendIdentifier } = (await c.req.json()) as AddFriendRequest;

    if (!friendIdentifier) {
      return c.json({ error: "Friend identifier is required" }, 400);
    }

    // Email 또는 Username 조회
    const isEmail = friendIdentifier.includes("@");
    const { data: friend, error: findError } = await supabase
      .from("users")
      .select("id, email, name, username")
      .eq(isEmail ? "email" : "username", friendIdentifier)
      .maybeSingle();

    if (findError || !friend) {
      return c.json({ error: "User not found" }, 404);
    }

    // 자기 자신 추가 방지
    if (friend.id === userId) {
      return c.json({ error: "Cannot add yourself" }, 400);
    }

    // 기존 관계(정규화 때문에 양방향 모두 확인)
    const { data: existing, error: existingError } = await supabase
      .from("friendships")
      .select("id, status, requested_by, user_id, friend_id")
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friend.id}),and(user_id.eq.${friend.id},friend_id.eq.${userId})`
      )
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      if (existing.status === "accepted") {
        return c.json({ error: "Already friends" }, 409);
      }

      if (existing.requested_by === userId) {
        return c.json({ error: "Friend request already sent" }, 409);
      }

      return c.json({ error: "Friend request already received" }, 409);
    }

    // 친구 요청 생성 (pending)
    // friendships 테이블은 requested_by NOT NULL이며, 정규화 트리거가 쌍을 정리하므로 requested_by를 명시해야 함
    const { error } = await supabase.from("friendships").insert({
      user_id: userId,
      friend_id: friend.id,
      requested_by: userId,
      status: "pending",
    });

    if (error) throw error;

    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to add friend"), 500);
  }
}

export async function getFriends(c: Context) {
  try {
    const userId = c.get("userId");

    // 1) 수락된 친구 목록
    const { data: acceptedRows, error: acceptedError } = await supabase
      .from("friendships")
      .select(`id, user_id, friend_id, created_at, status`)
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (acceptedError) throw acceptedError;

    const acceptedFriendIds = (acceptedRows ?? []).map((r: any) =>
      r.user_id === userId ? r.friend_id : r.user_id
    );

    const { data: acceptedUsers, error: acceptedUsersError } = await supabase
      .from("users")
      .select("id, name, username")
      .in("id", acceptedFriendIds.length ? acceptedFriendIds : ["00000000-0000-0000-0000-000000000000"]);

    if (acceptedUsersError) throw acceptedUsersError;

    const acceptedUserMap = new Map<string, any>();
    (acceptedUsers ?? []).forEach((u: any) => acceptedUserMap.set(u.id, u));

    const friends = (acceptedRows ?? [])
      .map((r: any) => {
        const friendId = r.user_id === userId ? r.friend_id : r.user_id;
        const u = acceptedUserMap.get(friendId);
        if (!u) return null;
        return {
          userId: u.id,
          name: u.name,
          username: u.username,
          addedAt: r.created_at,
        };
      })
      .filter(Boolean);

    // 2) 받은 친구 요청(내가 requested_by가 아닌 pending)
    const { data: incomingRows, error: incomingError } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, requested_by, created_at, status")
      .eq("status", "pending")
      .neq("requested_by", userId)
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (incomingError) throw incomingError;

    const incomingRequesterIds = (incomingRows ?? []).map((r: any) => r.requested_by);
    const { data: requesterUsers, error: requesterError } = await supabase
      .from("users")
      .select("id, name, username")
      .in(
        "id",
        incomingRequesterIds.length ? incomingRequesterIds : ["00000000-0000-0000-0000-000000000000"]
      );

    if (requesterError) throw requesterError;

    const requesterMap = new Map<string, any>();
    (requesterUsers ?? []).forEach((u: any) => requesterMap.set(u.id, u));

    const incomingRequests = (incomingRows ?? [])
      .map((r: any) => {
        const requester = requesterMap.get(r.requested_by);
        if (!requester) return null;
        return {
          requestId: r.id,
          fromUser: {
            id: requester.id,
            name: requester.name,
            username: requester.username,
          },
          createdAt: r.created_at,
        };
      })
      .filter(Boolean);

    // 3) 내가 보낸 친구 요청(대기중)
    const { data: outgoingRows, error: outgoingError } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, requested_by, created_at, status")
      .eq("status", "pending")
      .eq("requested_by", userId)
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (outgoingError) throw outgoingError;

    const outgoingTargetIds = (outgoingRows ?? []).map((r: any) =>
      r.user_id === userId ? r.friend_id : r.user_id
    );

    const { data: outgoingTargets, error: outgoingTargetsError } = await supabase
      .from("users")
      .select("id, name, username")
      .in(
        "id",
        outgoingTargetIds.length ? outgoingTargetIds : ["00000000-0000-0000-0000-000000000000"]
      );

    if (outgoingTargetsError) throw outgoingTargetsError;

    const outgoingTargetMap = new Map<string, any>();
    (outgoingTargets ?? []).forEach((u: any) => outgoingTargetMap.set(u.id, u));

    const outgoingRequests = (outgoingRows ?? [])
      .map((r: any) => {
        const toUserId = r.user_id === userId ? r.friend_id : r.user_id;
        const toUser = outgoingTargetMap.get(toUserId);
        if (!toUser) return null;
        return {
          requestId: r.id,
          toUser: {
            id: toUser.id,
            name: toUser.name,
            username: toUser.username,
          },
          createdAt: r.created_at,
        };
      })
      .filter(Boolean);

    return c.json({ success: true, friends, incomingRequests, outgoingRequests });
  } catch (error) {
    return c.json(handleError(error, "Failed to get friends"), 500);
  }
}

export async function cancelFriendRequest(c: Context) {
  try {
    const userId = c.get("userId");
    const { requestId } = (await c.req.json()) as CancelFriendRequest;

    if (!requestId) {
      return c.json({ error: "requestId is required" }, 400);
    }

    const { data: row, error: rowError } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, requested_by, status")
      .eq("id", requestId)
      .maybeSingle();

    if (rowError) throw rowError;
    if (!row) return c.json({ error: "Request not found" }, 404);

    const isParticipant = row.user_id === userId || row.friend_id === userId;
    if (!isParticipant) return c.json({ error: "Forbidden" }, 403);
    if (row.requested_by !== userId) return c.json({ error: "Only requester can cancel" }, 403);
    if (row.status !== "pending") return c.json({ error: "Request is not pending" }, 400);

    const { error: deleteError } = await supabase.from("friendships").delete().eq("id", requestId);

    if (deleteError) throw deleteError;
    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to cancel friend request"), 500);
  }
}

export async function respondFriendRequest(c: Context) {
  try {
    const userId = c.get("userId");
    const { requestId, action } = (await c.req.json()) as RespondFriendRequest;

    if (!requestId || (action !== "accept" && action !== "decline")) {
      return c.json({ error: "requestId and valid action are required" }, 400);
    }

    // 대상 요청 확인 (내가 참여자이고, 내가 요청자가 아닌 pending만 처리 가능)
    const { data: row, error: rowError } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, requested_by, status")
      .eq("id", requestId)
      .maybeSingle();

    if (rowError) throw rowError;
    if (!row) return c.json({ error: "Request not found" }, 404);

    const isParticipant = row.user_id === userId || row.friend_id === userId;
    if (!isParticipant) return c.json({ error: "Forbidden" }, 403);
    if (row.requested_by === userId) return c.json({ error: "Cannot respond to own request" }, 400);
    if (row.status !== "pending") return c.json({ error: "Request is not pending" }, 400);

    if (action === "accept") {
      const { error: updateError } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", requestId);

      if (updateError) throw updateError;
      return c.json({ success: true });
    }

    // decline: delete request row
    const { error: deleteError } = await supabase.from("friendships").delete().eq("id", requestId);

    if (deleteError) throw deleteError;
    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to respond to friend request"), 500);
  }
}

// ============================================
// Share plan + friend progress routes
// ============================================

export async function getSharePlan(c: Context) {
  try {
    const userId = c.get("userId");

    const { data: userRow, error } = await supabase
      .from("users")
      .select("shared_plan_id")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return c.json({ success: true, sharedPlanId: userRow?.shared_plan_id ?? null });
  } catch (error) {
    return c.json(handleError(error, "Failed to get shared plan"), 500);
  }
}

export async function setSharePlan(c: Context) {
  try {
    const userId = c.get("userId");
    const { planId } = (await c.req.json()) as SetSharePlanRequest;

    if (planId) {
      const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("id")
        .eq("id", planId)
        .eq("user_id", userId)
        .maybeSingle();

      if (planError) throw planError;
      if (!plan) return c.json({ error: "Plan not found" }, 404);
    }

    const { error } = await supabase.from("users").update({ shared_plan_id: planId ?? null }).eq("id", userId);

    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to set shared plan"), 500);
  }
}

export async function getFriendStatus(c: Context) {
  try {
    const userId = c.get("userId");
    const friendUserId = c.req.query("friendUserId");

    if (!friendUserId) {
      return c.json({ error: "friendUserId is required" }, 400);
    }

    // 수락된 친구 관계 확인 (나 자신인 경우 패스)
    if (friendUserId !== userId) {
      const { data: friendship, error: friendshipError } = await supabase
        .from("friendships")
        .select("id")
        .eq("status", "accepted")
        .or(
          `and(user_id.eq.${userId},friend_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_id.eq.${userId})`
        )
        .maybeSingle();

      if (friendshipError) throw friendshipError;
      if (!friendship) return c.json({ error: "Not friends" }, 403);
    }

    const { data: friendUser, error: friendUserError } = await supabase
      .from("users")
      .select("id, name, username, shared_plan_id, current_streak")
      .eq("id", friendUserId)
      .maybeSingle();

    if (friendUserError) throw friendUserError;
    if (!friendUser) return c.json({ error: "User not found" }, 404);

    // 공유할 계획은 친구가 '선택한' 계획만 보여줌
    const selectedPlanId = friendUser.shared_plan_id ?? null;

    if (!selectedPlanId) {
      return c.json({
        success: true,
        friendStatus: {
          user: friendUser,
          plan: null,
          achievementRate: 0,
          completedDays: 0,
          totalDays: 0,
          currentStreak: friendUser.current_streak ?? 0,
        },
      });
    }

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, name, total_days, start_date, is_custom, preset_id")
      .eq("id", selectedPlanId)
      .maybeSingle();

    if (planError) throw planError;

    if (!plan) {
      return c.json({
        success: true,
        friendStatus: {
          user: friendUser,
          plan: null,
          achievementRate: 0,
          completedDays: 0,
          totalDays: 0,
          currentStreak: friendUser.current_streak ?? 0,
        },
      });
    }

    const progress = await fetchUserProgress(friendUserId, plan.id);
    const groupedSchedule = await fetchGroupedSchedule(supabase, plan);
    
    const achievementRate = await calculateAchievementRate(supabase, friendUserId, plan, progress, groupedSchedule);
    const progressRate = await calculateProgressRate(supabase, friendUserId, plan, progress, groupedSchedule);

    const { completedChapters } = computeChaptersTotals({ 
      schedule: groupedSchedule, 
      progress 
    });

    return c.json({
      success: true,
      friendStatus: {
        user: friendUser,
        plan: {
          id: plan.id,
          name: plan.name,
          totalDays: plan.total_days,
          startDate: plan.start_date,
        },
        achievementRate,
        progressRate,
        completedDays: completedChapters, // Using chapters count here as requested by UI
        totalDays: plan.total_days,
        currentStreak: friendUser.current_streak ?? 0,
      },
    });
  } catch (error) {
    return c.json(handleError(error, "Failed to get friend status"), 500);
  }
}

export async function getFriendProgress(c: Context) {
  try {
    const userId = c.get("userId");
    const friendUserId = c.req.query("friendUserId");
    const planId = c.req.query("planId");

    if (!friendUserId || !planId) {
      return c.json({ error: "Friend user ID and plan ID required" }, 400);
    }

    // 친구 관계 확인
    const { data: friendship, error: friendshipError } = await supabase
      .from("friendships")
      .select("id")
      .eq("status", "accepted")
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_id.eq.${userId})`
      )
      .maybeSingle();

    if (friendshipError) throw friendshipError;

    if (!friendship) {
      return c.json({ error: "Not friends" }, 403);
    }

    // 친구의 진도 조회
    const progress = await fetchUserProgress(friendUserId, planId);

    // Fetch plan details for achievement rate
    const { data: plan } = await supabase
      .from("plans")
      .select("id, start_date, total_days, is_custom, preset_id")
      .eq("id", planId)
      .maybeSingle();

    let achievementRate = 0;
    let progressRate = 0;
    if (plan) {
      const groupedSchedule = await fetchGroupedSchedule(supabase, plan);
      achievementRate = await calculateAchievementRate(supabase, friendUserId, plan, progress, groupedSchedule);
      progressRate = await calculateProgressRate(supabase, friendUserId, plan, progress, groupedSchedule);
    }

    return c.json({ success: true, friendProgress: progress, achievementRate, progressRate });
  } catch (error) {
    return c.json(handleError(error, "Failed to get friend progress"), 500);
  }
}

export async function deleteFriend(c: Context) {
  try {
    const userId = c.get("userId");
    const friendUserId = c.req.param("friendUserId");

    if (!friendUserId) {
      return c.json({ error: "friendUserId is required" }, 400);
    }

    if (friendUserId === userId) {
      return c.json({ error: "Cannot delete yourself" }, 400);
    }

    const { data: friendship, error: friendshipError } = await supabase
      .from("friendships")
      .select("id")
      .eq("status", "accepted")
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_id.eq.${userId})`
      )
      .maybeSingle();

    if (friendshipError) throw friendshipError;
    if (!friendship) return c.json({ error: "Not friends" }, 403);

    const { error: deleteError } = await supabase.from("friendships").delete().eq("id", friendship.id);

    if (deleteError) throw deleteError;
    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to delete friend"), 500);
  }
}

export async function getLeaderboard(c: Context) {
  try {
    const userId = c.get("userId");

    // 1. Get all friends (accepted)
    const { data: friendships, error: fsError } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (fsError) throw fsError;

    const friendIds = (friendships || []).map((f: any) =>
      f.user_id === userId ? f.friend_id : f.user_id
    );

    // Include current user in the set
    const allUserIds = Array.from(new Set([...friendIds, userId]));

    if (allUserIds.length === 0) {
      return c.json({ success: true, leaderboard: [] });
    }

    // 2. Get Users + Shared Plan ID
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name, username, shared_plan_id")
      .in("id", allUserIds);

    if (usersError) throw usersError;

    // 3. Calculate stats for each user
    // To match Progress Tab's "Achievement Rate (달성률)", we need:
    // (Completed Chapters / Chapters scheduled until today) * 100
    
    // Calculate Today in KST
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    const today = new Date(kstDate.getUTCFullYear(), kstDate.getUTCMonth(), kstDate.getUTCDate());

    const leaderboard = await Promise.all(
      (users || []).map(async (u: any) => {
        if (!u.shared_plan_id) {
          return {
            user: { id: u.id, name: u.name, username: u.username },
            plan: null,
            achievementRate: 0,
            completedDays: 0,
            totalDays: 0,
          };
        }

        // Fetch Plan with details
        const { data: plan, error: planError } = await supabase
          .from("plans")
          .select("id, name, total_days, start_date, is_custom, preset_id")
          .eq("id", u.shared_plan_id)
          .maybeSingle();

        if (planError || !plan) {
          return {
            user: { id: u.id, name: u.name, username: u.username },
            plan: null,
            achievementRate: 0,
            completedDays: 0,
            totalDays: 0,
          };
        }

        // Fetch Progress
        const progress = await fetchUserProgress(u.id, plan.id);
        const groupedSchedule = await fetchGroupedSchedule(supabase, plan);

        // Compute Totals
        const { completedChapters: totalCompleted } = computeChaptersTotals({ 
          schedule: groupedSchedule, 
          progress 
        });

        const achievementRate = await calculateAchievementRate(supabase, u.id, plan, progress, groupedSchedule);
        const progressRate = await calculateProgressRate(supabase, u.id, plan, progress, groupedSchedule);

        return {
          user: { id: u.id, name: u.name, username: u.username },
          plan: { id: plan.id, name: plan.name, totalDays: plan.total_days },
          achievementRate,
          progressRate,
          completedDays: totalCompleted, // Using total chapters count for "count" metric
          totalDays: plan.total_days,
        };
      })
    );

    // Sort by achievement rate desc
    leaderboard.sort((a, b) => b.achievementRate - a.achievementRate);

    return c.json({ success: true, leaderboard });
  } catch (error) {
    return c.json(handleError(error, "Failed to get leaderboard"), 500);
  }
}

