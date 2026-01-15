/**
 * Bible Reading API
 * 
 * Main entry point for the Edge Function
 */

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as authRoutes from "./authRoutes.ts";
// The other route modules are now dynamically imported to improve cold start time.

const app = new Hono();
const api = new Hono();

// Logger middleware
api.use("*", logger());

// CORS middleware
api.use(
  "/*",
  cors({
    // This API is token-based (Authorization header) and does not rely on cookies.
    // Avoid the invalid CORS combination: credentials=true with Access-Control-Allow-Origin='*'.
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: false,
  })
);

// Health check
api.get("/", (c) => c.json({ status: "ok", message: "Bible Reading API" }));
api.get("/health", (c) => c.json({ status: "ok" }));

// Public routes
api.post("/signup", authRoutes.signup);
api.post("/get-username-email", authRoutes.getUsernameEmail);

// Protected routes
api.post("/preset-schedules/seed", authRoutes.requireAuth, async (c) => (await import("./planRoutes.ts")).seedPresetSchedules(c));
api.post("/plans", authRoutes.requireAuth, async (c) => (await import("./planRoutes.ts")).createPlan(c));
api.get("/plans", authRoutes.requireAuth, async (c) => (await import("./planRoutes.ts")).getPlans(c));
api.delete("/plans/:planId", authRoutes.requireAuth, async (c) => (await import("./planRoutes.ts")).deletePlan(c));
api.patch("/plans/order", authRoutes.requireAuth, async (c) => (await import("./planRoutes.ts")).updatePlanOrder(c));

api.post("/progress", authRoutes.requireAuth, async (c) => (await import("./progressRoutes.ts")).updateProgress(c));
api.get("/progress", authRoutes.requireAuth, async (c) => (await import("./progressRoutes.ts")).getProgress(c));

api.post("/friends", authRoutes.requireAuth, async (c) => (await import("./friendRoutes.ts")).addFriend(c));
api.get("/friends", authRoutes.requireAuth, async (c) => (await import("./friendRoutes.ts")).getFriends(c));
api.delete("/friends/:friendUserId", authRoutes.requireAuth, async (c) => (await import("./friendRoutes.ts")).deleteFriend(c));
api.get("/friend-progress", authRoutes.requireAuth, async (c) => (await import("./friendRoutes.ts")).getFriendProgress(c));
api.post("/friend-requests/respond", authRoutes.requireAuth, async (c) => (await import("./friendRoutes.ts")).respondFriendRequest(c));
api.post("/friend-requests/cancel", authRoutes.requireAuth, async (c) => (await import("./friendRoutes.ts")).cancelFriendRequest(c));
api.get("/friend-status", authRoutes.requireAuth, async (c) => (await import("./friendRoutes.ts")).getFriendStatus(c));
api.get("/share-plan", authRoutes.requireAuth, async (c) => (await import("./friendRoutes.ts")).getSharePlan(c));
api.post("/share-plan", authRoutes.requireAuth, async (c) => (await import("./friendRoutes.ts")).setSharePlan(c));

api.post("/notifications", authRoutes.requireAuth, async (c) => (await import("./notificationRoutes.ts")).saveNotification(c));
api.get("/notifications", authRoutes.requireAuth, async (c) => (await import("./notificationRoutes.ts")).getNotifications(c));

api.post("/push/subscribe", authRoutes.requireAuth, async (c) => (await import("./notificationRoutes.ts")).savePushSubscription(c));
api.post("/push/test", authRoutes.requireAuth, async (c) => (await import("./notificationRoutes.ts")).sendTestPush(c));
api.get("/push/public-key", async (c) => (await import("./notificationRoutes.ts")).getVapidPublicKey(c));

// Scheduled/cron trigger (protect with a shared secret header).
api.post("/cron/send-notifications", async (c) => (await import("./notificationRoutes.ts")).sendScheduledNotifications(c));

api.delete("/account", authRoutes.requireAuth, authRoutes.deleteAccount);

// Mount routes for both cases:
// - runtime passes path as '/health'
// - runtime passes path as '/make-server-7fb946f4/health'
app.route("/", api);
app.route("/make-server-7fb946f4", api);

Deno.serve(app.fetch);
