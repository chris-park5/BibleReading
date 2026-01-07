import fs from "fs";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function readEnvLocal() {
  const p = "c:/ChungAngUniversity/3_winter/BibleReading/.env.local";
  const txt = fs.readFileSync(p, "utf8");
  const map = new Map();
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    map.set(key, value);
  }
  return map;
}

async function fetchJson(url, { method, headers, body }) {
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 10000);

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: ac.signal,
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ignore
  }

  return { status: res.status, text, json };
}

function base64UrlDecodeToString(input) {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token).split(".");
    if (parts.length < 2) return null;
    const json = base64UrlDecodeToString(parts[1]);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function decodeJwtHeader(token) {
  try {
    const parts = String(token).split(".");
    if (parts.length < 1) return null;
    const json = base64UrlDecodeToString(parts[0]);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function maskToken(token) {
  const t = String(token);
  if (t.length <= 16) return t;
  return `${t.slice(0, 8)}...${t.slice(-8)} (len=${t.length})`;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const env = readEnvLocal();
  const supabaseUrl = (env.get("VITE_SUPABASE_URL") ?? "").replace(/\/+$/g, "");
  const anon = env.get("VITE_SUPABASE_ANON_KEY") ?? "";
  const base = (env.get("VITE_SUPABASE_FUNCTIONS_BASE") ?? "").replace(/\/+$/g, "");

  assert(supabaseUrl, "Missing VITE_SUPABASE_URL in .env.local");
  assert(anon, "Missing VITE_SUPABASE_ANON_KEY in .env.local");
  assert(base, "Missing VITE_SUPABASE_FUNCTIONS_BASE in .env.local");

  const suffix = crypto.randomBytes(4).toString("hex");
  const username = `test_${suffix}`;
  const email = `test_${suffix}@example.com`;
  const password = `Pw!${suffix}aA9`;
  const name = `Test User ${suffix}`;

  const headersFor = (token) => ({
    apikey: anon,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  console.log("Testing success flow against:");
  console.log("- functions:", base);
  console.log("- supabase:", supabaseUrl);
  console.log("Test identity:");
  console.log("- email:", email);
  console.log("- username:", username);

  // 1) Signup (creates auth.users + trigger creates public.users)
  {
    const res = await fetchJson(`${base}/signup`, {
      method: "POST",
      headers: headersFor(anon),
      body: { email, password, name, username },
    });

    console.log("\n1) signup ->", res.status);
    assert(res.status === 200, `signup failed: ${res.text}`);
  }

  // 2) Username->Email lookup (verifies public.users row exists)
  {
    const res = await fetchJson(`${base}/get-username-email`, {
      method: "POST",
      headers: headersFor(anon),
      body: { username },
    });

    console.log("2) get-username-email ->", res.status);
    assert(res.status === 200, `get-username-email failed: ${res.text}`);
    assert(res.json?.email === email, `email mismatch: ${res.text}`);
  }

  // 3) Sign in via Supabase Auth to obtain JWT
  const supabase = createClient(supabaseUrl, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  assert(!signInError, `signIn failed: ${signInError?.message}`);
  const jwt = signInData?.session?.access_token;
  assert(jwt, "signIn returned no access_token");
  console.log("3) signIn -> 200 (got access token)");

  const jwtPayload = decodeJwtPayload(jwt);
  const jwtHeader = decodeJwtHeader(jwt);
  console.log("   access_token:", maskToken(jwt));
  if (jwtHeader) {
    console.log("   jwt header:", { alg: jwtHeader.alg, kid: jwtHeader.kid });
  }
  if (jwtPayload) {
    console.log("   jwt payload:", {
      aud: jwtPayload.aud,
      sub: jwtPayload.sub,
      iss: jwtPayload.iss,
      exp: jwtPayload.exp,
    });
  } else {
    console.log("   jwt payload: <failed to decode>");
  }

  // Sanity check: verify token directly against GoTrue
  {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${jwt}`,
      },
    });
    const text = await res.text();
    console.log("   gotrue /auth/v1/user ->", res.status);
    if (res.status !== 200) {
      console.log("   gotrue error:", text);
    }
  }

  // 4) Create a preset plan
  {
    const hdrs = headersFor(jwt);
    console.log("   /plans Authorization:", maskToken(hdrs.Authorization));
    const res = await fetchJson(`${base}/plans`, {
      method: "POST",
      headers: hdrs,
      body: {
        name: "My First Plan",
        startDate: new Date().toISOString().slice(0, 10),
        totalDays: 365,
        isCustom: false,
        presetId: "one-year",
      },
    });

    console.log("4) create plan ->", res.status);
    assert(res.status === 200, `create plan failed: ${res.text}`);
  }

  // 5) Get plans
  {
    const res = await fetchJson(`${base}/plans`, {
      method: "GET",
      headers: headersFor(jwt),
      body: null,
    });

    console.log("5) get plans ->", res.status);
    assert(res.status === 200, `get plans failed: ${res.text}`);
    const count = Array.isArray(res.json?.plans) ? res.json.plans.length : null;
    console.log("   plans count:", count);
  }

  // 6) Cleanup: delete account
  {
    const res = await fetchJson(`${base}/account`, {
      method: "DELETE",
      headers: headersFor(jwt),
      body: null,
    });

    console.log("6) delete account (cleanup) ->", res.status);
    if (res.status !== 200) {
      console.log("Cleanup failed (non-fatal):", res.text);
    }
  }

  console.log("\nSuccess flow OK.");
}

main().catch((e) => {
  console.error("Test failed:", e?.message ?? e);
  process.exit(1);
});
