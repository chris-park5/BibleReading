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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchJson(url, { method, headers, body }) {
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 15000);

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

function loadPresetSchedule() {
  const p = "c:/ChungAngUniversity/3_winter/BibleReading/src/app/plans/one-year_newtwo_oldone.json";
  const txt = fs.readFileSync(p, "utf8");
  const preset = JSON.parse(txt);

  assert(preset?.id === "one-year-psalm-ot-nt", `Unexpected preset id: ${preset?.id}`);
  assert(Array.isArray(preset?.schedule) && preset.schedule.length > 0, "Preset schedule missing");

  // API expects: [{ day: number, readings: [{book, chapters}] }]
  const schedule = preset.schedule.map((d) => ({
    day: d.day,
    readings: (d.readings ?? []).map((r) => ({ book: r.book, chapters: r.chapters })),
  }));

  return { presetId: preset.id, totalDays: preset.totalDays ?? 365, schedule };
}

async function main() {
  const env = readEnvLocal();
  const supabaseUrl = (env.get("VITE_SUPABASE_URL") ?? "").replace(/\/+$/g, "");
  const anon = env.get("VITE_SUPABASE_ANON_KEY") ?? "";
  const base = (env.get("VITE_SUPABASE_FUNCTIONS_BASE") ?? "").replace(/\/+$/g, "");

  assert(supabaseUrl, "Missing VITE_SUPABASE_URL in .env.local");
  assert(anon, "Missing VITE_SUPABASE_ANON_KEY in .env.local");
  assert(base, "Missing VITE_SUPABASE_FUNCTIONS_BASE in .env.local");

  const { presetId, totalDays, schedule } = loadPresetSchedule();

  const suffix = crypto.randomBytes(4).toString("hex");
  const username = `test_multi_${suffix}`;
  const email = `test_multi_${suffix}@example.com`;
  const password = `Pw!${suffix}aA9`;
  const name = `Test Multi ${suffix}`;

  const headersFor = (token) => ({
    apikey: anon,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  console.log("Testing multi-reading progress semantics against:");
  console.log("- functions:", base);
  console.log("- presetId:", presetId);

  // 1) Signup
  {
    const res = await fetchJson(`${base}/signup`, {
      method: "POST",
      headers: headersFor(anon),
      body: { email, password, name, username },
    });

    console.log("\n1) signup ->", res.status);
    assert(res.status === 200, `signup failed: ${res.text}`);
  }

  // 2) Sign in
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
  console.log("2) signIn -> 200 (got access token)");

  // 3) Create preset plan (and pass schedule so server can seed if needed)
  let planId = null;
  {
    const res = await fetchJson(`${base}/plans`, {
      method: "POST",
      headers: headersFor(jwt),
      body: {
        name: `Multi Reading Plan ${suffix}`,
        startDate: new Date().toISOString().slice(0, 10),
        totalDays,
        isCustom: false,
        presetId,
        schedule,
      },
    });

    console.log("3) create plan ->", res.status);
    assert(res.status === 200, `create plan failed: ${res.text}`);
    planId = res.json?.plan?.id;
    assert(planId, `missing planId in response: ${res.text}`);
  }

  // Pick a day that has multiple readings (should be day 1 for this preset)
  const dayEntry = schedule.find((d) => Array.isArray(d.readings) && d.readings.length > 1);
  assert(dayEntry, "No multi-reading day found in schedule");
  const day = dayEntry.day;
  const requiredCount = dayEntry.readings.length;
  assert(requiredCount >= 2, "Expected >=2 readings for chosen day");

  // 4) Initially, day should not be in completedDays
  {
    const res = await fetchJson(`${base}/progress?planId=${encodeURIComponent(planId)}`, {
      method: "GET",
      headers: headersFor(jwt),
      body: null,
    });

    console.log("4) get progress (initial) ->", res.status);
    assert(res.status === 200, `get progress failed: ${res.text}`);
    const completedDays = res.json?.progress?.completedDays ?? [];
    assert(!completedDays.includes(day), `day ${day} should not be completed initially`);
  }

  // 5) Mark only ONE reading as completed
  {
    const res = await fetchJson(`${base}/progress`, {
      method: "POST",
      headers: headersFor(jwt),
      body: { planId, day, readingIndex: 0, completed: true },
    });

    console.log(`5) complete one reading (day=${day}, idx=0) ->`, res.status);
    assert(res.status === 200, `update progress failed: ${res.text}`);

    const completedDays = res.json?.progress?.completedDays ?? [];
    assert(
      !completedDays.includes(day),
      `BUG: day ${day} became completed after only 1/${requiredCount} readings`
    );
  }

  // 6) Mark remaining readings as completed
  for (let i = 1; i < requiredCount; i++) {
    const res = await fetchJson(`${base}/progress`, {
      method: "POST",
      headers: headersFor(jwt),
      body: { planId, day, readingIndex: i, completed: true },
    });

    console.log(`6) complete reading (day=${day}, idx=${i}) ->`, res.status);
    assert(res.status === 200, `update progress failed: ${res.text}`);
  }

  // 7) Now day MUST be in completedDays
  {
    const res = await fetchJson(`${base}/progress?planId=${encodeURIComponent(planId)}`, {
      method: "GET",
      headers: headersFor(jwt),
      body: null,
    });

    console.log("7) get progress (after completing all) ->", res.status);
    assert(res.status === 200, `get progress failed: ${res.text}`);

    const completedDays = res.json?.progress?.completedDays ?? [];
    assert(
      completedDays.includes(day),
      `day ${day} should be completed after ${requiredCount}/${requiredCount} readings`
    );
  }

  // 8) Cleanup
  {
    const res = await fetchJson(`${base}/account`, {
      method: "DELETE",
      headers: headersFor(jwt),
      body: null,
    });

    console.log("8) delete account (cleanup) ->", res.status);
    if (res.status !== 200) {
      console.log("Cleanup failed (non-fatal):", res.text);
    }
  }

  console.log("\nMulti-reading progress semantics OK.");
}

main().catch((e) => {
  console.error("Test failed:", e?.message ?? e);
  process.exit(1);
});
