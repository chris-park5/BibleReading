/**
 * Bible Reading API
 * 
 * Main entry point for the Edge Function
 */

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";

// Dynamic imports are used for all routes to improve cold start time.
// We avoid top-level imports of route modules (like authRoutes.ts) because they often
// instantiate heavy dependencies (like Supabase client) which slows down the boot time.

const app = new Hono();
const api = new Hono();

// Logger middleware
api.use("*", logger());

// CORS middleware
// Note: We also handle OPTIONS manually in Deno.serve for maximum speed,
// but we keep this here for correctness within the Hono app structure.
api.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: false,
  })
);

// Middleware Wrapper for Dynamic Import
// This ensures 'authRoutes.ts' (and thus supabase-js) is only loaded when needed.
const requireAuth = async (c: any, next: any) => {
  const mod = await import("./authRoutes.ts");
  return mod.requireAuth(c, next);
};

// Health check
api.get("/", (c) => c.json({ status: "ok", message: "Bible Reading API" }));
api.get("/health", (c) => c.json({ status: "ok" }));

// Public routes
api.post("/signup", async (c) => (await import("./authRoutes.ts")).signup(c));
api.post("/get-username-email", async (c) => (await import("./authRoutes.ts")).getUsernameEmail(c));

// Protected routes
api.post("/preset-schedules/seed", requireAuth, async (c) => (await import("./planRoutes.ts")).seedPresetSchedules(c));
api.post("/plans", requireAuth, async (c) => (await import("./planRoutes.ts")).createPlan(c));
api.get("/plans", requireAuth, async (c) => (await import("./planRoutes.ts")).getPlans(c));
api.delete("/plans/:planId", requireAuth, async (c) => (await import("./planRoutes.ts")).deletePlan(c));
api.post("/plans/:planId/complete", requireAuth, async (c) => (await import("./planRoutes.ts")).completePlan(c));
api.patch("/plans/order", requireAuth, async (c) => (await import("./planRoutes.ts")).updatePlanOrder(c));

api.post("/progress", requireAuth, async (c) => (await import("./progressRoutes.ts")).updateProgress(c));
api.get("/progress", requireAuth, async (c) => (await import("./progressRoutes.ts")).getProgress(c));
api.get("/daily-stats", requireAuth, async (c) => (await import("./progressRoutes.ts")).getDailyStats(c));

api.post("/friends", requireAuth, async (c) => (await import("./friendRoutes.ts")).addFriend(c));
api.get("/friends", requireAuth, async (c) => (await import("./friendRoutes.ts")).getFriends(c));
api.delete("/friends/:friendUserId", requireAuth, async (c) => (await import("./friendRoutes.ts")).deleteFriend(c));
api.get("/friend-progress", requireAuth, async (c) => (await import("./friendRoutes.ts")).getFriendProgress(c));
api.post("/friend-requests/respond", requireAuth, async (c) => (await import("./friendRoutes.ts")).respondFriendRequest(c));
api.post("/friend-requests/cancel", requireAuth, async (c) => (await import("./friendRoutes.ts")).cancelFriendRequest(c));
api.get("/friend-status", requireAuth, async (c) => (await import("./friendRoutes.ts")).getFriendStatus(c));
api.get("/leaderboard", requireAuth, async (c) => (await import("./friendRoutes.ts")).getLeaderboard(c));
api.get("/share-plan", requireAuth, async (c) => (await import("./friendRoutes.ts")).getSharePlan(c));
api.post("/share-plan", requireAuth, async (c) => (await import("./friendRoutes.ts")).setSharePlan(c));

api.post("/notifications", requireAuth, async (c) => (await import("./notificationRoutes.ts")).saveNotification(c));
api.get("/notifications", requireAuth, async (c) => (await import("./notificationRoutes.ts")).getNotifications(c));

api.post("/push/subscribe", requireAuth, async (c) => (await import("./notificationRoutes.ts")).savePushSubscription(c));
api.post("/push/test", requireAuth, async (c) => (await import("./notificationRoutes.ts")).sendTestPush(c));
api.get("/push/public-key", async (c) => (await import("./notificationRoutes.ts")).getVapidPublicKey(c));

// Scheduled/cron trigger
api.post("/cron/send-notifications", async (c) => (await import("./notificationRoutes.ts")).sendScheduledNotifications(c));

api.delete("/account", requireAuth, async (c) => (await import("./authRoutes.ts")).deleteAccount(c));

// Mount routes for both cases:
// - runtime passes path as '/health'
// - runtime passes path as '/make-server-7fb946f4/health'
app.route("/", api);
app.route("/make-server-7fb946f4", api);

// Serve with OPTIONS optimization
// This bypasses the Hono app instantiation and middleware chain for OPTIONS requests,
// ensuring a fast response for CORS preflight checks.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  return app.fetch(req);
});