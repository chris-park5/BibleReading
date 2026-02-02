/**
 * Friend + Share Plan Routes
 */

import { Context } from "npm:hono";
import {
  getSupabaseClient,
  getAuthClient,
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

type Ymd = { y: number; m: number; d: number };

function parseYyyyMmDd(value: string): Ymd | null {
  const [y, m, d] = String(value || "").split("-").map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function getYyyyMmDdInTimeZone(date: Date, timeZone: string): Ymd {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);

  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    const iso = date.toISOString().slice(0, 10);
    const parsed = parseYyyyMmDd(iso);
    return parsed ?? { y: 1970, m: 1, d: 1 };
  }

  return { y, m, d };
}

function dayNumberUtc(ymd: Ymd): number {
  return Math.floor(Date.UTC(ymd.y, ymd.m - 1, ymd.d) / (24 * 60 * 60 * 1000));
}

function diffDaysYyyyMmDd(start: Ymd, end: Ymd): number {
  return dayNumberUtc(end) - dayNumberUtc(start);
}

const supabase = getSupabaseClient();

// ============================================
// Friend Routes
// ============================================

export async function addFriend(c: Context) {
  try {
    const userId = c.get("userId");
    const authHeader = c.req.header("Authorization");
    if (!authHeader) return c.json({ error: "Missing Authorization header" }, 401);

    const authClient = getAuthClient(authHeader);
    const { friendIdentifier } = (await c.req.json()) as AddFriendRequest;

    if (!friendIdentifier) {
      return c.json({ error: "Friend identifier is required" }, 400);
    }

    // Email 또는 Username 조회 (Admin client 사용 - Users RLS 제한 우회 필요)
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

    // 기존 관계 확인 (Auth client 사용 - RLS 적용)
    // RLS: "Users can view own friendships"
    const { data: existing, error: existingError } = await authClient
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
    // RLS: "Users can send requests"
    const { error } = await authClient.from("friendships").insert({
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
    const authHeader = c.req.header("Authorization");
    if (!authHeader) return c.json({ error: "Missing Authorization header" }, 401);
    
    const authClient = getAuthClient(authHeader);
    const { requestId } = (await c.req.json()) as CancelFriendRequest;

    if (!requestId) {
      return c.json({ error: "requestId is required" }, 400);
    }

    // RLS 덕분에 본인이 참여하지 않은 관계는 조회/삭제되지 않음
    const { data: row, error: rowError } = await authClient
      .from("friendships")
      .select("id, user_id, friend_id, requested_by, status")
      .eq("id", requestId)
      .maybeSingle();

    if (rowError) throw rowError;
    if (!row) return c.json({ error: "Request not found" }, 404); // RLS에 의해 숨겨진 경우도 포함

    // 추가 검증: 요청자만 취소 가능 (RLS는 user_id/friend_id만 체크하므로 로직 필요)
    if (row.requested_by !== userId) return c.json({ error: "Only requester can cancel" }, 403);
    if (row.status !== "pending") return c.json({ error: "Request is not pending" }, 400);

    const { error: deleteError } = await authClient.from("friendships").delete().eq("id", requestId);

    if (deleteError) throw deleteError;
    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to cancel friend request"), 500);
  }
}

export async function respondFriendRequest(c: Context) {
  try {
    const userId = c.get("userId");
    const authHeader = c.req.header("Authorization");
    if (!authHeader) return c.json({ error: "Missing Authorization header" }, 401);

    const authClient = getAuthClient(authHeader);
    const { requestId, action } = (await c.req.json()) as RespondFriendRequest;

    if (!requestId || (action !== "accept" && action !== "decline")) {
      return c.json({ error: "requestId and valid action are required" }, 400);
    }

    // RLS: 본인 관련 데이터만 조회 가능
    const { data: row, error: rowError } = await authClient
      .from("friendships")
      .select("id, user_id, friend_id, requested_by, status")
      .eq("id", requestId)
      .maybeSingle();

    if (rowError) throw rowError;
    if (!row) return c.json({ error: "Request not found" }, 404);

    if (row.requested_by === userId) return c.json({ error: "Cannot respond to own request" }, 400);
    if (row.status !== "pending") return c.json({ error: "Request is not pending" }, 400);

    if (action === "accept") {
      // RLS: "Users can respond to requests" 정책이 업데이트 허용
      const { error: updateError } = await authClient
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", requestId);

      if (updateError) throw updateError;
      return c.json({ success: true });
    }

    // decline: delete request row
    // RLS: "Users can delete friendships" 정책이 삭제 허용
    const { error: deleteError } = await authClient.from("friendships").delete().eq("id", requestId);

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
      .select("id, name, username, shared_plan_id, current_streak, last_active_at")
      .eq("id", friendUserId)
      .maybeSingle();

    if (friendUserError) throw friendUserError;
    if (!friendUser) return c.json({ error: "User not found" }, 404);

    // Calculate effective streak based on last_active_at
    // If not active today or yesterday, streak is effectively broken (0)
    let effectiveStreak = friendUser.current_streak ?? 0;
    if (friendUser.last_active_at) {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (friendUser.last_active_at !== todayStr && friendUser.last_active_at !== yesterdayStr) {
        effectiveStreak = 0;
      }
    } else {
      // If last_active_at is null but streak > 0, it's stale data from before migration or error
      effectiveStreak = 0;
    }

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
          currentStreak: effectiveStreak,
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
          currentStreak: effectiveStreak,
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
        currentStreak: effectiveStreak,
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
    const authHeader = c.req.header("Authorization");
    if (!authHeader) return c.json({ error: "Missing Authorization header" }, 401);

    const authClient = getAuthClient(authHeader);
    const friendUserId = c.req.param("friendUserId");

    if (!friendUserId) {
      return c.json({ error: "friendUserId is required" }, 400);
    }

    if (friendUserId === userId) {
      return c.json({ error: "Cannot delete yourself" }, 400);
    }

    // RLS: 본인 관련 데이터만 조회 가능
    const { data: friendship, error: friendshipError } = await authClient
      .from("friendships")
      .select("id")
      .eq("status", "accepted")
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_id.eq.${userId})`
      )
      .maybeSingle();

    if (friendshipError) throw friendshipError;
    if (!friendship) return c.json({ error: "Not friends" }, 403);

    // RLS: 본인 관련 데이터만 삭제 가능
    const { error: deleteError } = await authClient.from("friendships").delete().eq("id", friendship.id);

    if (deleteError) throw deleteError;
    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to delete friend"), 500);
  }
}

export async function getLeaderboard(c: Context) {
  try {
    const userId = c.get("userId");

    const toNum = (value: unknown, fallback = 0) => {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n : fallback;
    };

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

    // Include current user
    const allUserIds = Array.from(new Set([...friendIds, userId]));

    if (allUserIds.length === 0) {
      return c.json({ success: true, leaderboard: [] });
    }

    // 2. Fetch Stats + Users + Plans
    const { data: statsData, error: statsError } = await supabase
      .from("user_plan_stats")
      .select(`
        completed_chapters,
        user_id,
        plan_id,
        users!inner (id, name, username, shared_plan_id),
        plans!inner (id, name, total_days, total_chapters, start_date, is_custom, preset_id)
      `)
      .in("user_id", allUserIds);

    if (statsError) throw statsError;

    // Filter to Active Plan
    const activeStats = (statsData || []).filter((row: any) => 
      row.users.shared_plan_id === row.plan_id
    );

    // 3. Bulk Fetch Schedules
    const distinctPlanIds = new Set<string>();
    const distinctPresetIds = new Set<string>();
    const planMap = new Map<string, any>();

    activeStats.forEach((row: any) => {
      planMap.set(row.plan_id, row.plans);
      if (row.plans.is_custom) {
        distinctPlanIds.add(row.plan_id);
      } else if (row.plans.preset_id) {
        distinctPresetIds.add(row.plans.preset_id);
      }
    });

    // Schedule Cache: Key = PlanID or PresetID -> Schedule Array
    const scheduleCache = new Map<string, any[]>();

    // Fetch Custom Schedules
    if (distinctPlanIds.size > 0) {
      const { data: customSchedules, error: customError } = await supabase
        .from("plan_schedules")
        .select("plan_id, day, book, chapters, chapter_count")
        .in("plan_id", Array.from(distinctPlanIds));
      
      if (customError) throw customError;

      (customSchedules || []).forEach((s: any) => {
        if (!scheduleCache.has(s.plan_id)) {
          scheduleCache.set(s.plan_id, []);
        }
        scheduleCache.get(s.plan_id)!.push(s);
      });
    }

    // Fetch Preset Schedules
    if (distinctPresetIds.size > 0) {
      const { data: presetSchedules, error: presetError } = await supabase
        .from("preset_schedules")
        .select("preset_id, day, book, chapters, chapter_count")
        .in("preset_id", Array.from(distinctPresetIds));
        
      if (presetError) throw presetError;

      (presetSchedules || []).forEach((s: any) => {
        if (!scheduleCache.has(s.preset_id)) {
          scheduleCache.set(s.preset_id, []);
        }
        scheduleCache.get(s.preset_id)!.push(s);
      });
    }

    // Helper to group flat rows into the structure needed by computeChaptersTotals
    const groupSchedule = (rows: any[]) => {
      const map = new Map<number, any>();
      rows.forEach(row => {
        const d = Number(row.day);
        if (!map.has(d)) map.set(d, { day: d, readings: [] });
        map.get(d).readings.push({ book: row.book, chapters: row.chapters });
      });
      return Array.from(map.values());
    };

    // 4. Construct Leaderboard
    // Use timezone-safe KST calendar-day math (avoid UTC runtime day-boundary drift)
    const todayKST = getYyyyMmDdInTimeZone(new Date(), "Asia/Seoul");

    // Map stats by user_id for easy lookup
    const statsByUser = new Map<string, any>();
    activeStats.forEach((row: any) => statsByUser.set(row.user_id, row));

    // We need to iterate over *allUserIds* to handle users with no stats
    // But we need user details for them.
    // Optimization: Just use the users found in activeStats + separate fetch if needed?
    // Let's stick to activeStats for the "Leaderboard". 
    // If a friend has no active plan or no stats, they might not appear.
    // But requirement usually implies showing them with 0.
    // Let's fetch all users details to be safe.
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, name, username, shared_plan_id")
      .in("id", allUserIds);

    const leaderboard = await Promise.all((allUsers || []).map(async (u: any) => {
        if (!u.shared_plan_id) {
             return {
                user: { id: u.id, name: u.name, username: u.username },
                plan: null,
                achievementRate: 0,
                progressRate: 0,
                completedDays: 0,
                totalDays: 0,
             };
        }

        const statRow = statsByUser.get(u.id);
        
        // If we have stats, use them. If not, we might need to fetch plan details separately 
        // if we really want to show "0%".
        // For now, if no stats, return 0.
        if (!statRow) {
             return {
                user: { id: u.id, name: u.name, username: u.username },
                plan: null,
                achievementRate: 0,
                progressRate: 0,
                completedDays: 0,
                totalDays: 0,
             };
        }

        const plan = statRow.plans;
        const completed = toNum(statRow.completed_chapters, 0);

        // Achievement Rate (Actual)
        let achievementRate = 0;
        
        const startDateStr = typeof plan.start_date === "string" ? plan.start_date : "";
        const startYmd = parseYyyyMmDd(startDateStr);
        const diffDays = startYmd ? diffDaysYyyyMmDd(startYmd, todayKST) : 0;
        const elapsedDays = Math.max(0, Math.min(plan.total_days, diffDays + 1));
        
        // Retrieve Schedule
        const scheduleKey = plan.is_custom ? plan.id : plan.preset_id;
        const flatSchedule = scheduleCache.get(scheduleKey) || [];

        // Compute totalChapters (full plan) from DB field if present, else from schedule.
        let totalChapters = toNum(plan.total_chapters, 0);
        if (totalChapters <= 0 && flatSchedule.length > 0) {
          totalChapters = 0;
          flatSchedule.forEach((s: any) => {
            totalChapters += toNum(s.chapter_count, 0);
          });
        }
        if (totalChapters <= 0 && flatSchedule.length > 0) {
          const groupedSchedule = groupSchedule(flatSchedule);
          const { totalChapters: computedTotal } = computeChaptersTotals({
            schedule: groupedSchedule,
            progress: {},
          });
          totalChapters = toNum(computedTotal, 0);
        }

        // Progress Rate (overall completion). Do NOT clamp here; UI can clamp the bar width.
        const progressRate = totalChapters > 0 ? (completed / totalChapters) * 100 : 0;
        
        // OPTIMIZED: Calculate Expected via Sum (Avoids Parsing)
        let expected = 0;
        flatSchedule.forEach((s: any) => {
           if (Number(s.day) <= elapsedDays) {
             expected += toNum(s.chapter_count, 0);
           }
        });
        
        // Fallback for expected if chapter_count is missing (0) but schedule exists
        if (expected === 0 && flatSchedule.length > 0 && elapsedDays > 0) {
             const groupedSchedule = groupSchedule(flatSchedule);
             const { totalChapters: computedExpected } = computeChaptersTotals({
                schedule: groupedSchedule,
                progress: {}, 
                upToDay: elapsedDays
             });
             expected = computedExpected;
        }

        if (expected > 0) {
            achievementRate = Math.round((completed / expected) * 100);
        } else if (completed > 0) {
             // Started early?
            achievementRate = 100;
        }

        return {
          user: { id: u.id, name: u.name, username: u.username },
          plan: { 
            id: plan.id, 
            name: plan.name, 
            totalDays: plan.total_days,
            totalChapters: totalChapters
          },
          achievementRate,
          progressRate,
          // Legacy field name used by the current UI (actually chapters, not days)
          completedDays: completed,
          // New explicit field name (safe to ignore on older clients)
          completedChapters: completed,
          totalDays: plan.total_days,
        };
    }));

    // Sort by achievement rate desc
    leaderboard.sort((a, b) => b.achievementRate - a.achievementRate);

    return c.json({ success: true, leaderboard });
  } catch (error) {
    return c.json(handleError(error, "Failed to get leaderboard"), 500);
  }
}

