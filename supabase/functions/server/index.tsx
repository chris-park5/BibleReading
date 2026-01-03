import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import * as routes from "./routes.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-7fb946f4/health", (c) => {
  return c.json({ status: "ok" });
});

// Public routes
app.post("/make-server-7fb946f4/signup", routes.signup);

// Protected routes
app.post("/make-server-7fb946f4/plans", routes.requireAuth, routes.createPlan);
app.get("/make-server-7fb946f4/plans", routes.requireAuth, routes.getPlans);
app.delete("/make-server-7fb946f4/plans/:planId", routes.requireAuth, routes.deletePlan);
app.post("/make-server-7fb946f4/progress", routes.requireAuth, routes.updateProgress);
app.get("/make-server-7fb946f4/progress", routes.requireAuth, routes.getProgress);
app.post("/make-server-7fb946f4/friends", routes.requireAuth, routes.addFriend);
app.get("/make-server-7fb946f4/friends", routes.requireAuth, routes.getFriends);
app.get("/make-server-7fb946f4/friend-progress", routes.requireAuth, routes.getFriendProgress);
app.post("/make-server-7fb946f4/notifications", routes.requireAuth, routes.saveNotification);
app.get("/make-server-7fb946f4/notifications", routes.requireAuth, routes.getNotifications);

Deno.serve(app.fetch);