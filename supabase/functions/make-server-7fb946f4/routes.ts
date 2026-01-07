/**
 * API Routes
 * 
 * 간결하고 명확한 라우트 핸들러
 */

import { Context } from "npm:hono";
import { getSupabaseClient, verifyAccessToken, fetchUserProgress, handleError } from "./utils.ts";
import * as auth from "./auth.ts";
import type {
  CreatePlanRequest,
  UpdatePlanOrderRequest,
  UpdateProgressRequest,
  AddFriendRequest,
  CancelFriendRequest,
  RespondFriendRequest,
  SetSharePlanRequest,
  NotificationRequest,
} from "./types.ts";

const supabase = getSupabaseClient();

// ============================================
// Middleware
// ============================================

export async function requireAuth(c: Context, next: () => Promise<void>) {
  const authHeader = c.req.header("Authorization");
  
  if (!authHeader) {
    return c.json({ error: "Missing authorization header" }, 401);
  }

  const token = authHeader.split(" ")[1];
  
  if (!token) {
    return c.json({ error: "Invalid authorization header" }, 401);
  }

  const origin = new URL(c.req.url).origin;
  const result = await verifyAccessToken(token, origin);

  if (!result.success || !result.user) {
    const msg = (result as any).error ?? "Unauthorized";
    return c.json({ error: msg }, 401);
  }

  c.set("userId", result.user.id);
  c.set("userEmail", result.user.email);
  await next();
}

// ============================================
// Auth Routes
// ============================================

export async function signup(c: Context) {
  try {
    const { email, password, name, username } = await c.req.json();

    if (!email || !password || !name || !username) {
      return c.json({ error: "All fields are required" }, 400);
    }

    // Username 중복 확인
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return c.json({ error: "Username already exists" }, 409);
    }

    // 사용자 생성
    const result = await auth.createUser(email, password, name, username);

    if (!result.success || !result.user) {
      return c.json({ error: result.error }, 400);
    }

    // auth.users -> public.users 동기화는 DB 트리거(handle_new_auth_user)가 담당
    // (트리거가 적용되지 않았으면 이후 기능이 꼬이므로 여기서 빠르게 감지)
    const { data: profile, error: profileSelectError } = await supabase
      .from("users")
      .select("id")
      .eq("id", result.user.id)
      .maybeSingle();

    if (profileSelectError) {
      console.error("User profile check failed:", profileSelectError);
      return c.json({ error: "Failed to verify user profile" }, 500);
    }

    if (!profile) {
      return c.json(
        {
          error:
            "User profile was not created. Ensure DB migration (trigger on auth.users) is applied.",
        },
        500
      );
    }

    return c.json({ success: true, user: result.user });
  } catch (error) {
    return c.json(handleError(error, "Signup failed"), 500);
  }
}

export async function getUsernameEmail(c: Context) {
  try {
    const { username } = await c.req.json();

    if (!username) {
      return c.json({ error: "Username is required" }, 400);
    }

    const result = await auth.findUserByUsername(username);

    if (!result.success && (result as any).error) {
      return c.json({ error: (result as any).error }, 500);
    }

    if (!result.success || !result.user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ success: true, email: result.user.email });
  } catch (error) {
    return c.json(handleError(error, "Failed to find user"), 500);
  }
}

// ============================================
// Preset Schedule Seed Route
// ============================================

export async function seedPresetSchedules(c: Context) {
  try {
    const { presetId, schedule } = await c.req.json() as {
      presetId?: string;
      schedule?: Array<{ day: number; readings: Array<{ book: string; chapters: string }> }>;
    };

    if (!presetId) {
      return c.json({ error: "presetId is required" }, 400);
    }

    const { count } = await supabase
      .from("preset_schedules")
      .select("id", { count: "exact", head: true })
      .eq("preset_id", presetId);

    if ((count ?? 0) > 0) {
      return c.json({ success: true, seeded: false });
    }

    if (!Array.isArray(schedule) || schedule.length === 0) {
      return c.json({ error: "schedule is required to seed" }, 400);
    }

    const rows = schedule.flatMap((d) =>
      (d.readings || []).map((r) => ({
        preset_id: presetId,
        day: d.day,
        book: r.book,
        chapters: r.chapters,
      }))
    );

    if (rows.length > 10000) {
      return c.json({ error: "schedule too large" }, 400);
    }

    const { error } = await supabase
      .from("preset_schedules")
      .upsert(rows, {
        onConflict: "preset_id,day,book,chapters",
        ignoreDuplicates: true,
      });

    if (error) throw error;

    return c.json({ success: true, seeded: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to seed preset schedules"), 500);
  }
}

export async function deleteAccount(c: Context) {
  try {
    const userId = c.get("userId");
    const result = await auth.deleteUser(userId);

    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to delete account"), 500);
  }
}

// ============================================
// Plan Routes
// ============================================

export async function createPlan(c: Context) {
  try {
    const userId = c.get("userId");
    const body = await c.req.json() as CreatePlanRequest;
    
    const { name, startDate, endDate, totalDays, schedule, isCustom, presetId } = body;

    // Validation
    if (!name || !startDate || !totalDays) {
      return c.json({ error: "Name, start date, and total days are required" }, 400);
    }

    if (isCustom && !schedule) {
      return c.json({ error: "Schedule required for custom plans" }, 400);
    }

    if (!isCustom && !presetId) {
      return c.json({ error: "Preset ID required for preset plans" }, 400);
    }

    // Preset plan은 preset_plans(id)를 참조하므로, 새 DB/커스텀 프리셋에서 preset이 없으면 먼저 생성
    if (!isCustom && presetId) {
      const { data: existingPreset, error: presetLookupError } = await supabase
        .from("preset_plans")
        .select("id")
        .eq("id", presetId)
        .maybeSingle();

      if (presetLookupError) throw presetLookupError;

      if (!existingPreset) {
        const { error: presetInsertError } = await supabase
          .from("preset_plans")
          .insert({
            id: presetId,
            name,
            description: null,
            total_days: totalDays,
          });

        if (presetInsertError) throw presetInsertError;
      }
    }

    // 중복 확인
    const { data: existing } = await supabase
      .from("plans")
      .select("id")
      .eq("user_id", userId)
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      return c.json({ error: `Plan "${name}" already exists` }, 409);
    }

    // Display order 계산
    const { data: maxOrder } = await supabase
      .from("plans")
      .select("display_order")
      .eq("user_id", userId)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (maxOrder?.display_order ?? 0) + 1;

    // Plan 생성
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .insert({
        user_id: userId,
        preset_id: isCustom ? null : presetId,
        name,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        is_custom: isCustom,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (planError || !plan) {
      throw planError;
    }

    // Schedule 생성
    // - Custom plan: plan_schedules에 저장
    // - Preset plan: preset_schedules가 비어있으면(새 DB) 클라이언트가 보낸 schedule로 1회 시드
    if (!isCustom && presetId && schedule && schedule.length > 0) {
      const { count } = await supabase
        .from("preset_schedules")
        .select("id", { count: "exact", head: true })
        .eq("preset_id", presetId);

      if ((count ?? 0) === 0) {
        const presetRows = schedule.flatMap((day) =>
          day.readings.map((reading) => ({
            preset_id: presetId,
            day: day.day,
            book: reading.book,
            chapters: reading.chapters,
          }))
        );

        if (presetRows.length > 0) {
          const { error: presetSeedError } = await supabase
            .from("preset_schedules")
            .insert(presetRows);

          if (presetSeedError) {
            console.error("Failed to seed preset_schedules:", presetSeedError);
          }
        }
      }
    }

    // Custom plan: plan_schedules
    if (isCustom && schedule && schedule.length > 0) {
      const scheduleRows = schedule.flatMap((day) =>
        day.readings.map((reading) => ({
          plan_id: plan.id,
          day: day.day,
          book: reading.book,
          chapters: reading.chapters,
        }))
      );

      const { error: scheduleError } = await supabase
        .from("plan_schedules")
        .insert(scheduleRows);

      if (scheduleError) {
        // Rollback
        await supabase.from("plans").delete().eq("id", plan.id);
        throw scheduleError;
      }
    }

    return c.json({
      success: true,
      plan: {
        id: plan.id,
        name: plan.name,
        startDate: plan.start_date,
        endDate: plan.end_date,
        totalDays: plan.total_days,
        isCustom: plan.is_custom,
        schedule: schedule || [],
      },
    });
  } catch (error) {
    return c.json(handleError(error, "Failed to create plan"), 500);
  }
}

export async function getPlans(c: Context) {
  try {
    const userId = c.get("userId");

    const { data: plansData, error } = await supabase
      .from("plans")
      .select("*")
      .eq("user_id", userId)
      .order("display_order", { ascending: true });

    if (error) throw error;

    // 각 Plan의 Schedule 조회
    const plans = await Promise.all(
      plansData.map(async (p) => {
        let scheduleData;

        if (p.is_custom) {
          // Custom: plan_schedules
          const { data } = await supabase
            .from("plan_schedules")
            .select("day, book, chapters")
            .eq("plan_id", p.id);
          scheduleData = data || [];
        } else {
          // Preset: preset_schedules
          const { data } = await supabase
            .from("preset_schedules")
            .select("day, book, chapters")
            .eq("preset_id", p.preset_id);
          scheduleData = data || [];
        }

        // Schedule 재구성
        const scheduleMap = new Map<number, Array<{ book: string; chapters: string }>>();
        
        scheduleData.forEach((s: any) => {
          if (!scheduleMap.has(s.day)) {
            scheduleMap.set(s.day, []);
          }
          scheduleMap.get(s.day)!.push({ book: s.book, chapters: s.chapters });
        });

        const schedule = Array.from(scheduleMap.entries())
          .map(([day, readings]) => ({ day, readings }))
          .sort((a, b) => a.day - b.day);

        return {
          id: p.id,
          userId: p.user_id,
          presetId: p.preset_id,
          name: p.name,
          startDate: p.start_date,
          endDate: p.end_date,
          totalDays: p.total_days,
          isCustom: p.is_custom,
          displayOrder: p.display_order,
          createdAt: p.created_at,
          schedule,
        };
      })
    );

    return c.json({ success: true, plans });
  } catch (error) {
    return c.json(handleError(error, "Failed to get plans"), 500);
  }
}

export async function deletePlan(c: Context) {
  try {
    const userId = c.get("userId");
    const planId = c.req.param("planId");

    if (!planId) {
      return c.json({ error: "Plan ID is required" }, 400);
    }

    const { error } = await supabase
      .from("plans")
      .delete()
      .eq("id", planId)
      .eq("user_id", userId);

    if (error) throw error;

    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to delete plan"), 500);
  }
}

export async function updatePlanOrder(c: Context) {
  try {
    const userId = c.get("userId");
    const { planId, newOrder } = await c.req.json() as UpdatePlanOrderRequest;

    if (!planId || newOrder === undefined) {
      return c.json({ error: "Plan ID and new order are required" }, 400);
    }

    // Plan 확인
    const { data: plan } = await supabase
      .from("plans")
      .select("display_order")
      .eq("id", planId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!plan) {
      return c.json({ error: "Plan not found" }, 404);
    }

    const oldOrder = plan.display_order;

    // Order 변경
    if (oldOrder !== newOrder) {
      if (newOrder < oldOrder) {
        // 위로 이동: newOrder ~ oldOrder-1 사이 증가
        await supabase.rpc("increment_display_order", {
          p_user_id: userId,
          p_min_order: newOrder,
          p_max_order: oldOrder - 1,
        });
      } else {
        // 아래로 이동: oldOrder+1 ~ newOrder 사이 감소
        await supabase.rpc("decrement_display_order", {
          p_user_id: userId,
          p_min_order: oldOrder + 1,
          p_max_order: newOrder,
        });
      }

      // 대상 Plan 업데이트
      const { error } = await supabase
        .from("plans")
        .update({ display_order: newOrder })
        .eq("id", planId)
        .eq("user_id", userId);

      if (error) throw error;
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to update plan order"), 500);
  }
}

// ============================================
// Progress Routes
// ============================================

export async function updateProgress(c: Context) {
  try {
    const userId = c.get("userId");
    const { planId, day, completed, readingIndex } = await c.req.json() as UpdateProgressRequest;

    if (!planId || day === undefined || readingIndex === undefined) {
      return c.json({ error: "Plan ID, day, and reading index required" }, 400);
    }

    if (completed) {
      // 완료 표시
      const { error } = await supabase
        .from("reading_progress")
        .upsert(
          {
            user_id: userId,
            plan_id: planId,
            day,
            reading_index: readingIndex,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "user_id, plan_id, day, reading_index" }
        );

      if (error) throw error;
    } else {
      // 완료 취소
      const { error } = await supabase
        .from("reading_progress")
        .delete()
        .eq("user_id", userId)
        .eq("plan_id", planId)
        .eq("day", day)
        .eq("reading_index", readingIndex);

      if (error) throw error;
    }

    // 업데이트된 진도 반환
    const progress = await fetchUserProgress(userId, planId);
    return c.json({ success: true, progress });
  } catch (error) {
    return c.json(handleError(error, "Failed to update progress"), 500);
  }
}

export async function getProgress(c: Context) {
  try {
    const userId = c.get("userId");
    const planId = c.req.query("planId");

    if (!planId) {
      return c.json({ error: "Plan ID is required" }, 400);
    }

    const progress = await fetchUserProgress(userId, planId);
    return c.json({ success: true, progress });
  } catch (error) {
    return c.json(handleError(error, "Failed to get progress"), 500);
  }
}

// ============================================
// Friend Routes
// ============================================

export async function addFriend(c: Context) {
  try {
    const userId = c.get("userId");
    const { friendIdentifier } = await c.req.json() as AddFriendRequest;

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
    const { error } = await supabase
      .from("friendships")
      .insert({
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
      .select("id, email, name, username")
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
          email: u.email,
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
      .select("id, email, name, username")
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
            email: requester.email,
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
      .select("id, email, name, username")
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
            email: toUser.email,
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
    const { requestId } = await c.req.json() as CancelFriendRequest;

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

    const { error: deleteError } = await supabase
      .from("friendships")
      .delete()
      .eq("id", requestId);

    if (deleteError) throw deleteError;
    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to cancel friend request"), 500);
  }
}

// ============================================
// Share Plan Routes
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
    const { planId } = await c.req.json() as SetSharePlanRequest;

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

    const { error } = await supabase
      .from("users")
      .update({ shared_plan_id: planId ?? null })
      .eq("id", userId);

    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to set shared plan"), 500);
  }
}

export async function respondFriendRequest(c: Context) {
  try {
    const userId = c.get("userId");
    const { requestId, action } = await c.req.json() as RespondFriendRequest;

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
    const { error: deleteError } = await supabase
      .from("friendships")
      .delete()
      .eq("id", requestId);

    if (deleteError) throw deleteError;
    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to respond to friend request"), 500);
  }
}

export async function getFriendStatus(c: Context) {
  try {
    const userId = c.get("userId");
    const friendUserId = c.req.query("friendUserId");

    if (!friendUserId) {
      return c.json({ error: "friendUserId is required" }, 400);
    }

    // 수락된 친구 관계 확인
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

    const { data: friendUser, error: friendUserError } = await supabase
      .from("users")
      .select("id, email, name, username, shared_plan_id")
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
        },
      });
    }

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, name, total_days, start_date")
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
        },
      });
    }

    const progress = await fetchUserProgress(friendUserId, plan.id);
    const completedDays = progress.completedDays.length;
    const totalDays = Number(plan.total_days) || 0;
    const achievementRate = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

    return c.json({
      success: true,
      friendStatus: {
        user: friendUser,
        plan: {
          id: plan.id,
          name: plan.name,
          totalDays,
          startDate: plan.start_date,
        },
        achievementRate,
        completedDays,
        totalDays,
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
    return c.json({ success: true, friendProgress: progress });
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

    const { error: deleteError } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendship.id);

    if (deleteError) throw deleteError;
    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to delete friend"), 500);
  }
}

// ============================================
// Notification Routes (Stub)
// ============================================

export async function saveNotification(c: Context) {
  // TODO: 알림 기능 구현
  return c.json({ success: true });
}

export async function getNotifications(c: Context) {
  // TODO: 알림 기능 구현
  return c.json({ success: true, notifications: [] });
}
