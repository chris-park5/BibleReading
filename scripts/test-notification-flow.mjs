import fs from "fs";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// ============================================ 
// Test Utilities
// ============================================ 

function readEnvLocal() {
  // We need this because this script runs outside Vite's env loading.
  const p = "c:/ChungAngUniversity/3_winter/BibleReading/.env.local";
  try {
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
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error(`Error: .env.local file not found at ${p}`);
      console.error("Please create it based on .env.example and fill in the required variables.");
      process.exit(1);
    }
    throw e;
  }
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function nowInSeoul() {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const hour = get("hour") ?? "00";
  const minute = get("minute") ?? "00";
  return `${hour}:${minute}`;
}

// ============================================ 
// Main Test Logic
// ============================================ 

async function main() {
  const env = readEnvLocal();
  const supabaseUrl = (env.get("VITE_SUPABASE_URL") ?? "").replace(/\/+$/g, "");
  const anon = env.get("VITE_SUPABASE_ANON_KEY") ?? "";
  const base = (env.get("VITE_SUPABASE_FUNCTIONS_BASE") ?? "").replace(/\/+$/g, "");
  const cronSecret = env.get("CRON_SECRET") ?? "";

  assert(supabaseUrl, "Missing VITE_SUPABASE_URL in .env.local");
  assert(anon, "Missing VITE_SUPABASE_ANON_KEY in .env.local");
  assert(base, "Missing VITE_SUPABASE_FUNCTIONS_BASE in .env.local");
  assert(cronSecret, "Missing CRON_SECRET in .env.local");
  
  const suffix = crypto.randomBytes(4).toString("hex");
  const email = `test_notif_${suffix}@example.com`;
  const password = `Pw!${suffix}bB1`;
  const name = `Test Notif ${suffix}`;
  
  const headersFor = (token) => ({
    apikey: anon,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });
  
  const cronHeaders = {
    "x-cron-secret": cronSecret,
  };

  console.log("Testing Notification Flow against:");
  console.log("- functions:", base);
  console.log("Test identity:");
  console.log("- email:", email);
  
  // 1) Signup
  const supabase = createClient(supabaseUrl, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  {
    const res = await fetchJson(`${base}/signup`, {
      method: "POST",
      headers: headersFor(anon),
      body: { email, password, name, username: name.replace(/\s/g, '') },
    });
    console.log("1) signup ->", res.status);
    assert(res.status === 200, `1) signup failed: ${res.text}`);
  }

  // 2) Sign in to get JWT
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  assert(!signInError, `2) signIn failed: ${signInError?.message}`);
  const jwt = signInData?.session?.access_token;
  assert(jwt, "2) signIn returned no access_token");
  console.log("2) signIn -> 200 (got access token)");

  // 3) Create a plan from a preset
  let userPlanId = '';
  const PRESET_ID = 'one-year_newtwo_oldone';
  {
      const res = await fetchJson(`${base}/plans`, {
          method: 'POST',
          headers: headersFor(jwt),
          body: {
              name: 'My Test Plan',
              presetId: PRESET_ID,
              startDate: new Date().toISOString().split('T')[0],
              totalDays: 365,
              isCustom: false,
          },
      });
      console.log(`3) create-plan from preset ${PRESET_ID} ->`, res.status);
      assert(res.status === 200, `create-plan failed: ${res.text}`);
      userPlanId = res.json?.plan?.id;
      assert(userPlanId, 'create-plan did not return a plan ID');
  }


  // 4) Save a push subscription (required for sending notifications)
  {
    const res = await fetchJson(`${base}/push/subscribe`, {
      method: "POST",
      headers: headersFor(jwt),
      body: {
        // This is a dummy subscription object. The server doesn't validate it
        // during this test, but it needs a row in the DB to attempt a push.
        endpoint: `https://example.com/push/${suffix}`,
        keys: {
          p256dh: "dummy_p256dh_key",
          auth: "dummy_auth_key",
        },
      },
    });
    console.log("4) save-push-subscription ->", res.status);
    assert(res.status === 200, `save-push-subscription failed: ${res.text}`);
  }

  // 5) Set a notification for 1 minute from now
  const notificationTime = new Date(Date.now() + 60 * 1000); // 1 min in the future
  const hours = notificationTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Seoul', hour12: false, hour: '2-digit' });
  const minutes = notificationTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Seoul', minute: '2-digit' });
  const scheduledTime = `${hours}:${minutes}`;

  {
    const res = await fetchJson(`${base}/notifications`, {
        method: "POST",
        headers: headersFor(jwt),
        body: {
            planId: userPlanId,
            time: scheduledTime,
            enabled: true,
        },
    });
    console.log(`5) save-notification for ${scheduledTime} ->`, res.status);
    assert(res.status === 200, `save-notification failed: ${res.text}`);
  }

  console.log("\nWaiting for 65 seconds to ensure the scheduled time passes...");
  await new Promise(resolve => setTimeout(resolve, 65000));

  // 6) Trigger the cron job manually
  console.log(`\n6) Triggering cron/send-notifications at ${nowInSeoul()}`);
  {
    const res = await fetchJson(`${base}/cron/send-notifications`, {
        method: "POST",
        headers: cronHeaders,
        body: {},
    });

    console.log("   cron/send-notifications ->", res.status);
    assert(res.status === 200, `cron/send-notifications failed: ${res.text}`);
    console.log("   Response:", res.json);

    assert(res.json?.due === 1, `Expected 1 due notification, but got ${res.json?.due}.`);
    console.log("\n✅ Test Passed: Notification was successfully processed by the server.");
  }


  // 7) Cleanup
  {
    const res = await fetchJson(`${base}/account`, {
      method: "DELETE",
      headers: headersFor(jwt),
      body: null,
    });
    console.log("7) cleanup ->", res.status);
    assert(res.status === 200, `7) cleanup failed: ${res.text}`);
  }
}

main().catch((e) => {
  console.error("\n❌ Test failed:", e?.message ?? e);
  process.exit(1);
});
