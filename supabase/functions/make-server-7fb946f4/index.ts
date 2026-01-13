/**
 * Bible Reading API
 * 
 * Main entry point for the Edge Function
 */

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as authRoutes from "./authRoutes.ts";
import * as planRoutes from "./planRoutes.ts";
import * as progressRoutes from "./progressRoutes.ts";
import * as friendRoutes from "./friendRoutes.ts";
import * as notificationRoutes from "./notificationRoutes.ts";

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
api.post("/preset-schedules/seed", authRoutes.requireAuth, planRoutes.seedPresetSchedules);
api.post("/plans", authRoutes.requireAuth, planRoutes.createPlan);
api.get("/plans", authRoutes.requireAuth, planRoutes.getPlans);
api.delete("/plans/:planId", authRoutes.requireAuth, planRoutes.deletePlan);
api.patch("/plans/order", authRoutes.requireAuth, planRoutes.updatePlanOrder);

api.post("/progress", authRoutes.requireAuth, progressRoutes.updateProgress);
api.get("/progress", authRoutes.requireAuth, progressRoutes.getProgress);

api.post("/friends", authRoutes.requireAuth, friendRoutes.addFriend);
api.get("/friends", authRoutes.requireAuth, friendRoutes.getFriends);
api.delete("/friends/:friendUserId", authRoutes.requireAuth, friendRoutes.deleteFriend);
api.get("/friend-progress", authRoutes.requireAuth, friendRoutes.getFriendProgress);
api.post("/friend-requests/respond", authRoutes.requireAuth, friendRoutes.respondFriendRequest);
api.post("/friend-requests/cancel", authRoutes.requireAuth, friendRoutes.cancelFriendRequest);
api.get("/friend-status", authRoutes.requireAuth, friendRoutes.getFriendStatus);
api.get("/share-plan", authRoutes.requireAuth, friendRoutes.getSharePlan);
api.post("/share-plan", authRoutes.requireAuth, friendRoutes.setSharePlan);

api.post("/notifications", authRoutes.requireAuth, notificationRoutes.saveNotification);
api.get("/notifications", authRoutes.requireAuth, notificationRoutes.getNotifications);

api.post("/push/subscribe", authRoutes.requireAuth, notificationRoutes.savePushSubscription);
api.post("/push/test", authRoutes.requireAuth, notificationRoutes.sendTestPush);
api.get("/push/public-key", notificationRoutes.getVapidPublicKey);

// Scheduled/cron trigger (protect with a shared secret header).
api.post("/cron/send-notifications", notificationRoutes.sendScheduledNotifications);

api.delete("/account", authRoutes.requireAuth, authRoutes.deleteAccount);

// Mount routes for both cases:
// - runtime passes path as '/health'
// - runtime passes path as '/make-server-7fb946f4/health'
app.route("/", api);
app.route("/make-server-7fb946f4", api);

Deno.serve(app.fetch);
