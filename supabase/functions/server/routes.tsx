import { Context } from "npm:hono";
import * as kv from "./kv_store.tsx";
import * as auth from "./auth.tsx";

// 회원가입
export async function signup(c: Context) {
  try {
    const { email, password, name } = await c.req.json();

    if (!email || !password || !name) {
      return c.json({ error: "Email, password, and name are required" }, 400);
    }

    const result = await auth.signUp(email, password, name);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    // KV store에 사용자 정보 저장
    await kv.set(`user:${result.user.id}`, {
      id: result.user.id,
      email: result.user.email,
      name: result.user.user_metadata?.name || name,
      created_at: new Date().toISOString(),
    });

    return c.json({ success: true, user: result.user });
  } catch (error) {
    console.error("Signup route error:", error);
    return c.json({ error: "Failed to sign up" }, 500);
  }
}

// 인증 미들웨어
export async function requireAuth(c: Context, next: () => Promise<void>) {
  const authHeader = c.req.header("Authorization");
  const accessToken = authHeader?.split(" ")[1];

  if (!accessToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await auth.verifyToken(accessToken);

  if (!result.success || !result.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("userId", result.user.id);
  c.set("userEmail", result.user.email);
  await next();
}

// 읽기 계획 생성
export async function createPlan(c: Context) {
  try {
    const userId = c.get("userId");
    const { name, startDate, endDate, totalDays, schedule, isCustom } =
      await c.req.json();

    if (!name || !startDate || !totalDays || !schedule) {
      return c.json(
        { error: "Name, start date, total days, and schedule are required" },
        400
      );
    }

    const planId = crypto.randomUUID();
    const plan = {
      id: planId,
      userId,
      name,
      startDate,
      endDate,
      totalDays,
      schedule,
      isCustom: isCustom || false,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`plan:${planId}`, plan);

    // 사용자의 계획 목록에 추가
    const userPlansKey = `user_plans:${userId}`;
    const userPlans = (await kv.get(userPlansKey)) || [];
    userPlans.push(planId);
    await kv.set(userPlansKey, userPlans);

    // 진도 초기화
    await kv.set(`progress:${userId}:${planId}`, {
      userId,
      planId,
      completedDays: [],
      lastUpdated: new Date().toISOString(),
    });

    return c.json({ success: true, plan });
  } catch (error) {
    console.error("Create plan error:", error);
    return c.json({ error: "Failed to create plan" }, 500);
  }
}

// 사용자의 모든 계획 조회
export async function getPlans(c: Context) {
  try {
    const userId = c.get("userId");
    const userPlansKey = `user_plans:${userId}`;
    const planIds = (await kv.get(userPlansKey)) || [];

    const plans = await Promise.all(
      planIds.map(async (planId: string) => {
        const plan = await kv.get(`plan:${planId}`);
        return plan;
      })
    );

    return c.json({ success: true, plans: plans.filter((p) => p !== null) });
  } catch (error) {
    console.error("Get plans error:", error);
    return c.json({ error: "Failed to get plans" }, 500);
  }
}

// 계획 삭제
export async function deletePlan(c: Context) {
  try {
    const userId = c.get("userId");
    const planId = c.req.param("planId");

    if (!planId) {
      return c.json({ error: "Plan ID is required" }, 400);
    }

    const planKey = `plan:${planId}`;
    const plan = await kv.get(planKey);

    if (!plan) {
      return c.json({ error: "Plan not found" }, 404);
    }

    if (plan.userId !== userId) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // user_plans 목록에서 제거
    const userPlansKey = `user_plans:${userId}`;
    const planIds = (await kv.get(userPlansKey)) || [];
    const nextPlanIds = (planIds as string[]).filter((id) => id !== planId);
    await kv.set(userPlansKey, nextPlanIds);

    // plan/progress 삭제
    await kv.mdel([planKey, `progress:${userId}:${planId}`]);

    return c.json({ success: true });
  } catch (error) {
    console.error("Delete plan error:", error);
    return c.json({ error: "Failed to delete plan" }, 500);
  }
}

// 진도 업데이트
export async function updateProgress(c: Context) {
  try {
    const userId = c.get("userId");
    const { planId, day, completed, readingIndex, readingCount } =
      await c.req.json();

    if (!planId || day === undefined || completed === undefined) {
      return c.json(
        { error: "Plan ID, day, and completed status are required" },
        400
      );
    }

    const progressKey = `progress:${userId}:${planId}`;
    const progress = (await kv.get(progressKey)) || {
      userId,
      planId,
      completedDays: [],
      completedReadingsByDay: {},
      lastUpdated: new Date().toISOString(),
    };

    // 읽기 항목 단위 업데이트
    if (readingIndex !== undefined && readingIndex !== null) {
      const key = String(day);
      progress.completedReadingsByDay = progress.completedReadingsByDay || {};
      const list = Array.isArray(progress.completedReadingsByDay[key])
        ? progress.completedReadingsByDay[key]
        : [];
      const set = new Set(list);
      if (completed) set.add(readingIndex);
      else set.delete(readingIndex);
      progress.completedReadingsByDay[key] = Array.from(set).sort(
        (a: number, b: number) => a - b
      );

      // readingCount가 있으면 day 완료 여부도 함께 갱신
      if (typeof readingCount === "number" && readingCount > 0) {
        const isDayCompleted = progress.completedReadingsByDay[key].length >= readingCount;
        if (isDayCompleted) {
          if (!progress.completedDays.includes(day)) progress.completedDays.push(day);
        } else {
          progress.completedDays = progress.completedDays.filter((d: number) => d !== day);
        }
      }
    } else {
      // 기존(day 단위) 업데이트
      if (completed) {
        if (!progress.completedDays.includes(day)) {
          progress.completedDays.push(day);
        }
      } else {
        progress.completedDays = progress.completedDays.filter(
          (d: number) => d !== day
        );
      }
    }

    progress.lastUpdated = new Date().toISOString();
    await kv.set(progressKey, progress);

    return c.json({ success: true, progress });
  } catch (error) {
    console.error("Update progress error:", error);
    return c.json({ error: "Failed to update progress" }, 500);
  }
}

// 진도 조회
export async function getProgress(c: Context) {
  try {
    const userId = c.get("userId");
    const planId = c.req.query("planId");

    if (!planId) {
      return c.json({ error: "Plan ID is required" }, 400);
    }

    const progressKey = `progress:${userId}:${planId}`;
    const progress = await kv.get(progressKey);

    if (!progress) {
      return c.json({
        success: true,
        progress: {
          userId,
          planId,
          completedDays: [],
          completedReadingsByDay: {},
          lastUpdated: new Date().toISOString(),
        },
      });
    }

    if (!progress.completedReadingsByDay) {
      progress.completedReadingsByDay = {};
    }

    return c.json({ success: true, progress });
  } catch (error) {
    console.error("Get progress error:", error);
    return c.json({ error: "Failed to get progress" }, 500);
  }
}

// 친구 추가
export async function addFriend(c: Context) {
  try {
    const userId = c.get("userId");
    const { friendEmail } = await c.req.json();

    if (!friendEmail) {
      return c.json({ error: "Friend email is required" }, 400);
    }

    // 이메일로 친구 찾기
    const allUsersKeys = await kv.getByPrefix("user:");
    const friendUser = allUsersKeys.find(
      (u: any) => u.email === friendEmail
    );

    if (!friendUser) {
      return c.json({ error: "User not found" }, 404);
    }

    if (friendUser.id === userId) {
      return c.json({ error: "Cannot add yourself as friend" }, 400);
    }

    // 친구 목록에 추가
    const friendsKey = `friends:${userId}`;
    const friends = (await kv.get(friendsKey)) || [];

    if (friends.some((f: any) => f.userId === friendUser.id)) {
      return c.json({ error: "Already friends" }, 400);
    }

    friends.push({
      userId: friendUser.id,
      email: friendUser.email,
      name: friendUser.name,
      addedAt: new Date().toISOString(),
    });

    await kv.set(friendsKey, friends);

    return c.json({ success: true, friend: friends[friends.length - 1] });
  } catch (error) {
    console.error("Add friend error:", error);
    return c.json({ error: "Failed to add friend" }, 500);
  }
}

// 친구 목록 조회
export async function getFriends(c: Context) {
  try {
    const userId = c.get("userId");
    const friendsKey = `friends:${userId}`;
    const friends = (await kv.get(friendsKey)) || [];

    return c.json({ success: true, friends });
  } catch (error) {
    console.error("Get friends error:", error);
    return c.json({ error: "Failed to get friends" }, 500);
  }
}

// 친구의 진도 조회
export async function getFriendProgress(c: Context) {
  try {
    const friendUserId = c.req.query("friendUserId");
    const planId = c.req.query("planId");

    if (!friendUserId || !planId) {
      return c.json({ error: "Friend user ID and plan ID are required" }, 400);
    }

    const progressKey = `progress:${friendUserId}:${planId}`;
    const progress = await kv.get(progressKey);

    const friendKey = `user:${friendUserId}`;
    const friendUser = await kv.get(friendKey);

    const planKey = `plan:${planId}`;
    const plan = await kv.get(planKey);

    if (!progress || !friendUser || !plan) {
      return c.json({ error: "Data not found" }, 404);
    }

    return c.json({
      success: true,
      friendProgress: {
        user: friendUser,
        plan,
        progress,
      },
    });
  } catch (error) {
    console.error("Get friend progress error:", error);
    return c.json({ error: "Failed to get friend progress" }, 500);
  }
}

// 알림 설정 저장
export async function saveNotification(c: Context) {
  try {
    const userId = c.get("userId");
    const { planId, time, enabled } = await c.req.json();

    if (!planId || !time) {
      return c.json({ error: "Plan ID and time are required" }, 400);
    }

    const notificationKey = `notification:${userId}:${planId}`;
    const notification = {
      userId,
      planId,
      time,
      enabled: enabled !== false,
      createdAt: new Date().toISOString(),
    };

    await kv.set(notificationKey, notification);

    return c.json({ success: true, notification });
  } catch (error) {
    console.error("Save notification error:", error);
    return c.json({ error: "Failed to save notification" }, 500);
  }
}

// 알림 설정 조회
export async function getNotifications(c: Context) {
  try {
    const userId = c.get("userId");
    const notifications = await kv.getByPrefix(`notification:${userId}:`);

    return c.json({ success: true, notifications: notifications || [] });
  } catch (error) {
    console.error("Get notifications error:", error);
    return c.json({ error: "Failed to get notifications" }, 500);
  }
}
