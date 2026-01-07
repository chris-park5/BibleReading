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

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

  console.log("Testing share-plan flow against:");
  console.log("- functions:", base);

  // 1) signup
  {
    const res = await fetchJson(`${base}/signup`, {
      method: "POST",
      headers: headersFor(anon),
      body: { email, password, name, username },
    });

    console.log("1) signup ->", res.status);
    assert(res.status === 200, `signup failed: ${res.text}`);
  }

  // 2) sign in
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
  console.log("2) signIn -> 200");

  // 3) create plan (capture id)
  let planId = null;
  {
    const res = await fetchJson(`${base}/plans`, {
      method: "POST",
      headers: headersFor(jwt),
      body: {
        name: "My Shared Plan",
        startDate: new Date().toISOString().slice(0, 10),
        totalDays: 365,
        isCustom: false,
        presetId: "one-year",
      },
    });

    console.log("3) create plan ->", res.status);
    assert(res.status === 200, `create plan failed: ${res.text}`);
    planId = res.json?.plan?.id ?? null;
    assert(planId, `create plan returned no plan.id: ${res.text}`);
  }

  // 4) GET share-plan (expect null initially)
  {
    const res = await fetchJson(`${base}/share-plan`, {
      method: "GET",
      headers: headersFor(jwt),
      body: null,
    });

    console.log("4) get share-plan ->", res.status);
    assert(res.status === 200, `get share-plan failed: ${res.text}`);
    assert(
      res.json?.sharedPlanId === null,
      `expected sharedPlanId null initially: ${res.text}`
    );
  }

  // 5) POST share-plan (set)
  {
    const res = await fetchJson(`${base}/share-plan`, {
      method: "POST",
      headers: headersFor(jwt),
      body: { planId },
    });

    console.log("5) set share-plan ->", res.status);
    assert(res.status === 200, `set share-plan failed: ${res.text}`);
  }

  // 6) GET share-plan (expect planId)
  {
    const res = await fetchJson(`${base}/share-plan`, {
      method: "GET",
      headers: headersFor(jwt),
      body: null,
    });

    console.log("6) get share-plan (after set) ->", res.status);
    assert(res.status === 200, `get share-plan failed: ${res.text}`);
    assert(res.json?.sharedPlanId === planId, `sharedPlanId mismatch: ${res.text}`);
  }

  // 7) POST share-plan (unset)
  {
    const res = await fetchJson(`${base}/share-plan`, {
      method: "POST",
      headers: headersFor(jwt),
      body: { planId: null },
    });

    console.log("7) unset share-plan ->", res.status);
    assert(res.status === 200, `unset share-plan failed: ${res.text}`);
  }

  // 8) GET share-plan (expect null)
  {
    const res = await fetchJson(`${base}/share-plan`, {
      method: "GET",
      headers: headersFor(jwt),
      body: null,
    });

    console.log("8) get share-plan (after unset) ->", res.status);
    assert(res.status === 200, `get share-plan failed: ${res.text}`);
    assert(res.json?.sharedPlanId === null, `expected sharedPlanId null: ${res.text}`);
  }

  // 9) cleanup
  {
    const res = await fetchJson(`${base}/account`, {
      method: "DELETE",
      headers: headersFor(jwt),
      body: null,
    });

    console.log("9) delete account (cleanup) ->", res.status);
    if (res.status !== 200) {
      console.log("Cleanup failed (non-fatal):", res.text);
    }
  }

  console.log("\nShare-plan flow OK.");
}

main().catch((e) => {
  console.error("Test failed:", e?.message ?? e);
  process.exit(1);
});
