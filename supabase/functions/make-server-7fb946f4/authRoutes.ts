/**
 * Auth + Middleware Routes
 */

import { Context } from "npm:hono";
import { verifyAccessToken, getSupabaseClient, handleError } from "./utils.ts";
import * as auth from "./auth.ts";

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

