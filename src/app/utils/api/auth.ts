import { fetchAPI, SESSION_TIMEOUT_MS, setAccessToken, supabase, withTimeout } from "./_internal";

// ============================================================================
// Auth APIs
// ============================================================================

export async function signUp(email: string, password: string, name: string, username: string) {
  return fetchAPI(
    "/signup",
    {
      method: "POST",
      body: JSON.stringify({ email, password, name, username }),
    },
    false
  );
}

export async function getUsernameEmail(username: string) {
  return fetchAPI(
    "/get-username-email",
    {
      method: "POST",
      body: JSON.stringify({ username }),
    },
    false
  );
}

export async function signIn(username: string, password: string) {
  // username으로 이메일 조회
  const { success, email } = await getUsernameEmail(username);

  if (!success || !email) {
    throw new Error("사용자를 찾을 수 없습니다");
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  if (session?.access_token) {
    setAccessToken(session.access_token);
  }

  return { session };
}

/**
 * Google OAuth Sign In
 */
export async function signInWithGoogle() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Use origin only to minimize Supabase Redirect URL mismatches across routes.
  const redirectTo = origin;

  // Supabase OAuth requires an absolute http(s) redirect URL.
  // If the app is opened via file:// (origin === "null"), Supabase returns a vague "request path" error.
  if (!redirectTo.startsWith("http://") && !redirectTo.startsWith("https://")) {
    throw new Error("구글 로그인을 사용하려면 http(s)로 실행해야 합니다. (예: npm run dev로 실행 후 접속)");
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Use origin+pathname (no query/hash) so it works even when hosted under a sub-path.
      // Note: Redirect URL must be allow-listed in Supabase Auth settings.
      redirectTo,
    },
  });

  if (error) {
    const msg = (error as any)?.message ? String((error as any).message) : "";
    const normalized = msg.toLowerCase();
    if (normalized.includes("request path") && normalized.includes("invalid")) {
      throw new Error(
        `구글 로그인 설정 오류: Supabase Dashboard → Authentication → URL Configuration의 Redirect URLs에 현재 도메인을 추가해야 합니다. (현재: ${redirectTo})`
      );
    }
    throw error;
  }

  return { data };
}

export async function signOut() {
  await supabase.auth.signOut();
  setAccessToken(null);
}

export async function getSession() {
  // If we are returning from an OAuth provider, the URL may contain an auth code.
  // Supabase can usually detect/exchange automatically, but explicit handling makes it more reliable.
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const oauthError = params.get("error");
      const oauthErrorDescription = params.get("error_description");

      if (oauthError) {
        throw new Error(oauthErrorDescription || oauthError);
      }

      if (code) {
        await withTimeout(supabase.auth.exchangeCodeForSession(code), 20_000, "OAuth 세션 교환 시간이 초과되었습니다");

        // Remove query params to prevent re-processing the auth code on refresh.
        // Keep the hash route if present.
        window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("OAuth callback handling failed:", e);
    }
  }

  const {
    data: { session },
    error,
  } = await withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS, "세션 확인 시간이 초과되었습니다");

  if (session?.access_token) {
    setAccessToken(session.access_token);
  }

  return { session, error };
}

export async function getMyProfile(): Promise<{
  success: true;
  profile: { id: string; email: string; name: string; username: string };
}> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("로그인이 필요합니다");

  const { data: profileRow, error: profileError } = await supabase
    .from("users")
    .select("id, email, name, username")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profileRow) throw new Error("프로필 정보를 찾을 수 없습니다");

  return {
    success: true,
    profile: {
      id: profileRow.id,
      email: profileRow.email ?? user.email ?? "",
      name: profileRow.name ?? "",
      username: profileRow.username ?? "",
    },
  };
}

export async function updateUsername(newUsername: string): Promise<{ success: true }> {
  const username = String(newUsername ?? "").trim();
  if (username.length < 3 || username.length > 20) {
    throw new Error("아이디는 3-20자여야 합니다");
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error("아이디는 영문자/숫자/밑줄(_)만 사용할 수 있습니다");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("로그인이 필요합니다");

  const { error } = await supabase.from("users").update({ username }).eq("id", user.id);

  if (error) {
    if ((error as any).code === "23505") {
      throw new Error("이미 사용 중인 아이디입니다");
    }
    throw error;
  }

  return { success: true };
}

export async function updatePassword(currentPassword: string, newPassword: string): Promise<{ success: true }> {
  const current = String(currentPassword ?? "");
  const next = String(newPassword ?? "");

  if (!current) throw new Error("현재 비밀번호를 입력해주세요");
  if (next.length < 6) throw new Error("새 비밀번호는 6자 이상이어야 합니다");

  const {
    data: { session },
    error: sessionError,
  } = await withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS, "세션 확인 시간이 초과되었습니다");

  if (sessionError) throw sessionError;
  const email = session?.user?.email;
  if (!email) {
    throw new Error("이 계정의 이메일 정보를 찾을 수 없습니다");
  }

  // 기존 비밀번호 확인(재로그인)
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: current,
  });

  if (verifyError) {
    throw new Error("현재 비밀번호가 올바르지 않습니다");
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: next,
  });

  if (updateError) throw updateError;

  // accessToken을 최신 세션으로 동기화
  const { data } = await withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS, "세션 확인 시간이 초과되었습니다");
  if (data.session?.access_token) {
    setAccessToken(data.session.access_token);
  }

  return { success: true };
}
