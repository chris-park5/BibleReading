/**
 * Authentication Service
 * 
 * 사용자 인증 및 계정 관리
 */

import { getSupabaseClient } from "./utils.ts";

/**
 * 회원가입
 */
export async function createUser(
  email: string,
  password: string,
  name: string,
  username: string
) {
  const supabase = getSupabaseClient();

  try {
    // 사용자 생성 (이메일 자동 확인)
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, username },
      email_confirm: true,
    });

    if (error) {
      console.error("User creation failed:", error);
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user };
  } catch (error) {
    console.error("User creation exception:", error);
    return { success: false, error: "Failed to create user" };
  }
}

/**
 * Username으로 사용자 조회
 */
export async function findUserByUsername(username: string) {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      console.error("User lookup failed:", error);
      return { success: false, user: null, error: error.message };
    }

    if (!data) {
      return { success: false, user: null };
    }

    return { success: true, user: data };
  } catch (error) {
    console.error("User lookup failed:", error);
    return { success: false, user: null, error: "User lookup failed" };
  }
}

/**
 * 사용자 삭제 (회원 탈퇴)
 */
export async function deleteUser(userId: string) {
  const supabase = getSupabaseClient();

  try {
    // 1. public.users 삭제 (CASCADE로 관련 데이터 자동 삭제)
    const { error: dbError } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (dbError) {
      console.error("Database user deletion failed:", dbError);
      return { success: false, error: dbError.message };
    }

    // 2. auth.users 삭제
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error("Auth user deletion failed:", authError);
      return { success: false, error: authError.message };
    }

    return { success: true };
  } catch (error) {
    console.error("User deletion exception:", error);
    return { success: false, error: "Failed to delete user" };
  }
}
