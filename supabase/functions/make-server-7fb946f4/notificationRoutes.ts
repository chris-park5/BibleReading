/**
 * Notification + Web Push Routes
 */

import { Context } from "npm:hono";
import webpush from "npm:web-push@3";
import { getSupabaseClient, handleError } from "./utils.ts";
import type { NotificationRequest } from "./types.ts";

const supabase = getSupabaseClient();

function timeHHMM(value: string) {
  // Accept 'HH:MM' or 'HH:MM:SS'
  const parts = String(value || "").split(":");
  if (parts.length < 2) return null;
  // Handle case where time might be like "9:5" -> "09:05"
  const hh = parts[0].padStart(2, "0");
  const mm = parts[1].padStart(2, "0");
  return `${hh}:${mm}`;
}

function isTimeWithinWindow(target: string, now: string, windowMinutes = 2) {
  // target, now: "HH:MM"
  const [th, tm] = target.split(":").map(Number);
  const [nh, nm] = now.split(":").map(Number);
  const targetMinutes = th * 60 + tm;
  const nowMinutes = nh * 60 + nm;
  return Math.abs(targetMinutes - nowMinutes) <= windowMinutes;
}

function nowInSeoul() {
  // Supabase Edge runs in UTC. We normalize to Asia/Seoul for scheduling.
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const yyyy = get("year") ?? "";
  const mm = get("month") ?? "";
  const dd = get("day") ?? "";
  const hour = get("hour") ?? "00";
  const minute = get("minute") ?? "00";
  return {
    date: `${yyyy}-${mm}-${dd}`,
    hhmm: `${hour}:${minute}`,
  };
}

function requireCronSecret(c: Context) {
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) return { ok: false as const, reason: "Missing CRON_SECRET env" };
  const got = c.req.header("x-cron-secret");
  if (!got || got !== expected) return { ok: false as const, reason: "Invalid cron secret" };
  return { ok: true as const };
}

function initWebPush() {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

async function sendPushToUser(userId: string, payloadJson: unknown) {
  const payload = JSON.stringify(payloadJson);

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth,expiration_time")
    .eq("user_id", userId);

  if (subsError) throw subsError;
  if (!subs?.length) return { delivered: 0, removed: 0 };

  let delivered = 0;
  let removed = 0;

  for (const s of subs) {
    const subscription = {
      endpoint: s.endpoint,
      expirationTime: s.expiration_time ?? null,
      keys: {
        p256dh: s.p256dh,
        auth: s.auth,
      },
    };

    try {
      await webpush.sendNotification(subscription as any, payload, { headers: { "Urgency": "high" }, TTL: 3600 });
      delivered++;
    } catch (e: any) {
      const statusCode = e?.statusCode ?? e?.status;
      if (statusCode === 404 || statusCode === 410) {
        const { error: delErr } = await supabase.from("push_subscriptions").delete().eq("id", s.id);
        if (!delErr) removed++;
      }
    }
  }

  return { delivered, removed };
}

// ============================================
// Notification Routes
// ============================================

export async function saveNotification(c: Context) {
  try {
    const userId = c.get("userId");
    const { planId, time, enabled } = (await c.req.json()) as NotificationRequest;

    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!planId || typeof planId !== "string") {
      return c.json({ error: "planId is required" }, 400);
    }

    if (!time || typeof time !== "string") {
      return c.json({ error: "time is required" }, 400);
    }

    if (typeof enabled !== "boolean") {
      return c.json({ error: "enabled must be boolean" }, 400);
    }

    // Ensure the plan belongs to the user.
    // Ensure the plan belongs to the user or it's a valid preset ID.
    // If it's a UUID, it should be in the 'plans' table for this user.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId);
    
    if (isUuid) {
      const { data: planRow, error: planError } = await supabase
        .from("plans")
        .select("id")
        .eq("id", planId)
        .eq("user_id", userId)
        .maybeSingle();

      if (planError) throw planError;
      if (!planRow) {
        return c.json({ error: "Plan not found" }, 404);
      }
    } else {
      // For preset IDs, we just need to make sure the user is authenticated (already checked).
      // The notification_settings table will handle the mapping.
      const { data: presetRow, error: presetError } = await supabase
        .from("preset_plans")
        .select("id")
        .eq("id", planId)
        .maybeSingle();
      
      if (presetError) throw presetError;
      if (!presetRow) {
        return c.json({ error: "Preset plan not found" }, 404);
      }
    }

    const { data, error } = await supabase
      .from("notification_settings")
      .upsert(
        {
          user_id: userId,
          plan_id: planId,
          time: timeHHMM(time) || time,
          enabled,
        },
        { onConflict: "user_id,plan_id" }
      )
      .select("plan_id,time,enabled")
      .maybeSingle();

    if (error) throw error;

    return c.json({
      success: true,
      notification: {
        planId: data?.plan_id ?? planId,
        time: timeHHMM(data?.time) ?? time,
        enabled: typeof data?.enabled === "boolean" ? data.enabled : enabled,
      },
    });
  } catch (error) {
    return c.json(handleError(error, "Failed to save notification"), 500);
  }
}

export async function getNotifications(c: Context) {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { data, error } = await supabase
      .from("notification_settings")
      .select("plan_id,time,enabled")
      .eq("user_id", userId);

    if (error) throw error;

    const notifications = (data ?? []).map((row: any) => ({
      planId: row.plan_id,
      time: timeHHMM(row.time) ?? row.time,
      enabled: Boolean(row.enabled),
    }));

    return c.json({ success: true, notifications });
  } catch (error) {
    return c.json(handleError(error, "Failed to get notifications"), 500);
  }
}

// ============================================
// Web Push
// ============================================

export async function savePushSubscription(c: Context) {
  try {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const authKey = body?.keys?.auth;
    const expirationTime = body?.expirationTime ?? null;
    const userAgent = body?.userAgent ?? null;

    if (!endpoint || !p256dh || !authKey) {
      return c.json({ error: "Invalid subscription" }, 400);
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth: authKey,
        expiration_time: typeof expirationTime === "number" ? expirationTime : null,
        user_agent: typeof userAgent === "string" ? userAgent : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) throw error;

    return c.json({ success: true });
  } catch (error) {
    return c.json(handleError(error, "Failed to save push subscription"), 500);
  }
}

// CRON/스케줄러는 반드시 "매 분" 실행되어야 신뢰성 보장됨. (서버 슬립/중단 시 누락 가능)
export async function sendScheduledNotifications(c: Context) {
  try {
    const authz = requireCronSecret(c);
    if (!authz.ok) return c.json({ error: authz.reason }, 401);

    initWebPush();

    const { date, hhmm } = nowInSeoul();
    console.log(`[cron] sendScheduledNotifications: Running at ${hhmm} (${date})`);

    const { data: due, error: dueError } = await supabase
      .from("notification_settings")
      .select("id,user_id,plan_id,time,enabled,last_sent_at")
      .eq("enabled", true);

    if (dueError) throw dueError;

    const WINDOW_MINUTES = 15; // ±15분 허용
    const nowMinutes = (() => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    })();

    const dueFiltered = (due ?? []).filter((row: any) => {
      const t = timeHHMM(row.time);
      if (!t || !isTimeWithinWindow(t, hhmm, WINDOW_MINUTES)) return false;

      // last_sent_at 중복 방지: 같은 날짜+시각에 이미 발송된 경우 스킵
      const last = row.last_sent_at ? new Date(row.last_sent_at) : null;
      if (!last) return true;

      const lastDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(last);

      // last_sent_at이 오늘이고, last_sent_at의 시각이 현재 시각 윈도우 내에 있으면 중복 발송 방지
      const lastH = last.getHours();
      const lastM = last.getMinutes();
      const lastMinutes = lastH * 60 + lastM;
      if (lastDate === date && Math.abs(lastMinutes - nowMinutes) <= WINDOW_MINUTES) return false;

      return true;
    });

    let sent = 0;
    let removed = 0;

    for (const row of dueFiltered) {
      const userId = row.user_id;

      const payload = {
        title: "성경 읽기 알림",
        body: "오늘 말씀을 읽을 시간이에요. 앱을 열어 오늘의 읽기를 확인하세요.",
        url: "/",
      };

      const result = await sendPushToUser(userId, payload);
      removed += result.removed;

      // 실제로 발송된 경우에만 last_sent_at 갱신
      if (result.delivered > 0) {
        sent++;
        await supabase
          .from("notification_settings")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("id", row.id);
      }
    }

    return c.json({ success: true, hhmm, date, due: dueFiltered.length, sent, removed });
  } catch (error) {
    return c.json(handleError(error, "Failed to send scheduled notifications"), 500);
  }
}

export async function sendTestPush(c: Context) {
  try {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    initWebPush();

    const payload = {
      title: "테스트 알림",
      body: "오늘 말씀을 읽을 시간이에요. 알림이 정상적으로 작동합니다!",
      url: "/",
    };

    const result = await sendPushToUser(userId, payload);
    return c.json({ success: true, delivered: result.delivered, removed: result.removed });
  } catch (error) {
    return c.json(handleError(error, "Failed to send test push"), 500);
  }
}

export async function getVapidPublicKey(c: Context) {
  try {
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    if (!publicKey) {
      return c.json({ error: "Missing VAPID_PUBLIC_KEY env" }, 500);
    }
    return c.json({ success: true, publicKey });
  } catch (error) {
    return c.json(handleError(error, "Failed to get VAPID public key"), 500);
  }
}
