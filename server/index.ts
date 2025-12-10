import "dotenv/config";
import express from "express";
import cors from "cors";
import { initializeFirebase } from "./lib/firebase-db";
import { ENV } from "./env";
import { IPDetectionService } from "./lib/ip-detection-service";

// Import route handlers
import * as authRoutes from "./routes/v1/auth";
import * as chatRoutes from "./routes/v1/chat";
import * as adminRoutes from "./routes/v1/admin";
import * as licenseRoutes from "./routes/v1/license";
import * as ipApiRoutes from "./routes/ip-api";
import * as adminLegacyRoutes from "./routes/admin";

export function createServer() {
  console.log("🚀 Starting server initialization...");

  // Initialize Firebase
  try {
    initializeFirebase();
  } catch (error) {
    console.error("❌ Failed to initialize Firebase:", error);
    process.exit(1);
  }

  const app = express();

  // Trust proxy
  app.set("trust proxy", 1);

  // CORS middleware
  app.use(
    cors({
      origin: ENV.app.corsOrigins.length > 0 ? ENV.app.corsOrigins : true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // Security headers
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
    next();
  });

  // Body parser
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // IP Detection Middleware - Attach real IP to all requests
  app.use((req, res, next) => {
    const clientIP = IPDetectionService.getClientIP(req);
    (req as any).clientIP = clientIP;
    res.setHeader("X-Client-IP", clientIP);
    next();
  });

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Routes
  const apiRouter = express.Router();

  // Authentication routes
  apiRouter.post("/auth/register", authRoutes.handleRegister);
  apiRouter.post("/auth/verify", authRoutes.handleVerifyToken);
  apiRouter.get("/auth/me", authRoutes.handleGetCurrentUser);

  // Chat routes
  apiRouter.post("/chat/send", chatRoutes.handleSendMessage);
  apiRouter.post("/chat/conversations", chatRoutes.handleGetConversations);
  apiRouter.post("/chat/create", chatRoutes.handleCreateConversation);
  apiRouter.post("/chat/messages", chatRoutes.handleGetMessages);
  apiRouter.post("/chat/delete", chatRoutes.handleDeleteConversation);

  // License routes
  apiRouter.post("/license/activate", licenseRoutes.handleActivateLicense);
  apiRouter.post("/license/list", licenseRoutes.handleGetAllLicenses);
  apiRouter.post("/license/create", licenseRoutes.handleCreateLicense);
  apiRouter.post("/license/invalidate", licenseRoutes.handleInvalidateLicense);
  apiRouter.post("/license/delete", licenseRoutes.handleDeleteLicense);
  apiRouter.post("/license/purge", licenseRoutes.handlePurgeInvalidLicenses);

  // Admin routes
  apiRouter.post("/admin/users", adminRoutes.handleGetAllUsers);
  apiRouter.get("/admin/users", adminRoutes.handleGetAllUsers);
  apiRouter.post("/admin/ban", adminRoutes.handleBanUser);
  apiRouter.post("/admin/unban", adminRoutes.handleUnbanUser);
  apiRouter.post("/admin/promote", adminRoutes.handlePromoteToAdmin);
  apiRouter.post("/admin/demote", adminRoutes.handleDemoteFromAdmin);
  apiRouter.post("/admin/reset-messages", adminRoutes.handleResetMessages);
  apiRouter.post("/admin/update-plan", adminRoutes.handleUpdateUserPlan);
  apiRouter.post("/admin/ai-config", adminRoutes.handleGetAIConfig);
  apiRouter.get("/admin/ai-config", adminRoutes.handleGetAIConfig);
  apiRouter.put("/admin/ai-config", adminRoutes.handleUpdateAIConfig);
  apiRouter.post("/admin/maintenance", adminRoutes.handleGetMaintenanceStatus);
  apiRouter.get("/admin/maintenance", adminRoutes.handleGetMaintenanceStatus);
  apiRouter.post(
    "/admin/maintenance/enable",
    adminRoutes.handleEnableMaintenance,
  );
  apiRouter.post(
    "/admin/maintenance/disable",
    adminRoutes.handleDisableMaintenance,
  );
  apiRouter.post("/admin/logs", adminRoutes.handleGetAdminLogs);
  apiRouter.post("/admin/logs/clear", adminRoutes.handleClearOldLogs);
  apiRouter.post("/admin/stats", adminRoutes.handleGetStats);
  apiRouter.get("/admin/stats", adminRoutes.handleGetStats);

  // IP Detection API Routes (new robust system)
  apiRouter.get("/ip", ipApiRoutes.handleGetClientIP);
  apiRouter.get("/ip/info", ipApiRoutes.handleGetIPInfo);
  apiRouter.get("/ip/fingerprint", ipApiRoutes.handleGetClientFingerprint);
  apiRouter.get("/ip/health", ipApiRoutes.handleIPDetectionHealth);

  // Legacy IP detection routes (for backward compatibility)
  apiRouter.get("/get-ip", ipApiRoutes.handleGetClientIP);
  apiRouter.post(
    "/check-vpn",
    (req, res) => {
      // VPN detection not implemented in new system
      res.json({ isVPN: false, provider: undefined });
    },
  );

  // Legacy admin license routes
  apiRouter.get("/admin/licenses", adminLegacyRoutes.handleGetLicenses);
  apiRouter.post(
    "/admin/create-license",
    adminLegacyRoutes.handleCreateLicense,
  );
  apiRouter.post(
    "/admin/delete-license",
    adminLegacyRoutes.handleDeleteLicense,
  );
  apiRouter.post(
    "/admin/clear-logs",
    adminLegacyRoutes.handleClearOldLogs,
  );
  apiRouter.post(
    "/admin/purge-licenses",
    adminLegacyRoutes.handlePurgeLicenses,
  );

  // BACKWARD COMPATIBILITY ROUTES (map old paths to new ones)
  // These keep the frontend working without modifications
  apiRouter.post("/ai/chat", chatRoutes.handleSendMessage);
  apiRouter.get("/ai/config", adminRoutes.handleGetAIConfig);
  apiRouter.put("/ai/config", adminRoutes.handleUpdateAIConfig);
  apiRouter.post("/activate-license", licenseRoutes.handleActivateLicense);
  apiRouter.post("/daily-reset", (req, res) => {
    // Daily reset is now automatic - just return success
    res.json({
      success: true,
      message: "Daily reset check completed",
    });
  });
  apiRouter.post("/admin/system-stats", adminRoutes.handleGetStats);
  apiRouter.get("/admin/system-stats", adminRoutes.handleGetStats);

  // Mount API router
  app.use("/api", apiRouter);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: "Not found",
    });
  });

  // Error handler
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error("Unhandled error:", err);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    },
  );

  return app;
}
