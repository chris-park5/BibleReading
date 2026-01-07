/**
 * Bible Reading API
 * 
 * Main entry point for the Edge Function
 */

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as routes from "./routes.ts";

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
api.post("/signup", routes.signup);
api.post("/get-username-email", routes.getUsernameEmail);

// Protected routes
api.post("/preset-schedules/seed", routes.requireAuth, routes.seedPresetSchedules);
api.post("/plans", routes.requireAuth, routes.createPlan);
api.get("/plans", routes.requireAuth, routes.getPlans);
api.delete("/plans/:planId", routes.requireAuth, routes.deletePlan);
api.patch("/plans/order", routes.requireAuth, routes.updatePlanOrder);

api.post("/progress", routes.requireAuth, routes.updateProgress);
api.get("/progress", routes.requireAuth, routes.getProgress);

api.post("/friends", routes.requireAuth, routes.addFriend);
api.get("/friends", routes.requireAuth, routes.getFriends);
api.delete("/friends/:friendUserId", routes.requireAuth, routes.deleteFriend);
api.get("/friend-progress", routes.requireAuth, routes.getFriendProgress);
api.post("/friend-requests/respond", routes.requireAuth, routes.respondFriendRequest);
api.post("/friend-requests/cancel", routes.requireAuth, routes.cancelFriendRequest);
api.get("/friend-status", routes.requireAuth, routes.getFriendStatus);
api.get("/share-plan", routes.requireAuth, routes.getSharePlan);
api.post("/share-plan", routes.requireAuth, routes.setSharePlan);

api.post("/notifications", routes.requireAuth, routes.saveNotification);
api.get("/notifications", routes.requireAuth, routes.getNotifications);

api.post("/push/subscribe", routes.requireAuth, routes.savePushSubscription);
api.post("/push/test", routes.requireAuth, routes.sendTestPush);

// Scheduled/cron trigger (protect with a shared secret header).
api.post("/cron/send-notifications", routes.sendScheduledNotifications);

api.delete("/account", routes.requireAuth, routes.deleteAccount);

// Mount routes for both cases:
// - runtime passes path as '/health'
// - runtime passes path as '/make-server-7fb946f4/health'
app.route("/", api);
app.route("/make-server-7fb946f4", api);

Deno.serve(app.fetch);