/**
 * Admin Routes
 * Handles admin panel operations: users, bans, configuration, maintenance
 */

import { RequestHandler } from "express";
import { z } from "zod";
import { getAuth_ } from "../../lib/firebase-db";
import { UserRepository } from "../../lib/repositories/UserRepository";
import { AdminLogsRepository } from "../../lib/repositories/AdminLogsRepository";
import { SettingsRepository } from "../../lib/repositories/SettingsRepository";
import { LicenseRepository } from "../../lib/repositories/LicenseRepository";

// Helper to verify admin
async function verifyAdminToken(idToken: string): Promise<string> {
  const auth = getAuth_();
  const decodedToken = await auth.verifyIdToken(idToken);
  const user = await UserRepository.getUser(decodedToken.uid);

  if (!user?.isAdmin) {
    throw new Error("Unauthorized: Admin access required");
  }

  return decodedToken.uid;
}

// Get all users
export const handleGetAllUsers: RequestHandler = async (req, res) => {
  try {
    const { idToken } = z.object({ idToken: z.string() }).parse(req.body);
    const adminUid = await verifyAdminToken(idToken);

    const users = await UserRepository.getAllUsers();

    await AdminLogsRepository.logAction(
      adminUid,
      "GET_ALL_USERS",
      { userCount: users.length },
      req.ip,
    );

    return res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
};

// Ban user
export const handleBanUser: RequestHandler = async (req, res) => {
  try {
    const { idToken, userId, reason } = z
      .object({
        idToken: z.string(),
        userId: z.string(),
        reason: z.string().min(5),
      })
      .parse(req.body);

    const adminUid = await verifyAdminToken(idToken);

    await UserRepository.banUser(userId, reason, adminUid);

    await AdminLogsRepository.logAction(
      adminUid,
      "BAN_USER",
      { targetUser: userId, reason },
      req.ip,
    );

    return res.json({
      success: true,
      message: "User banned successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to ban user" });
  }
};

// Unban user
export const handleUnbanUser: RequestHandler = async (req, res) => {
  try {
    const { idToken, userId } = z
      .object({ idToken: z.string(), userId: z.string() })
      .parse(req.body);

    const adminUid = await verifyAdminToken(idToken);

    await UserRepository.unbanUser(userId);

    await AdminLogsRepository.logAction(
      adminUid,
      "UNBAN_USER",
      { targetUser: userId },
      req.ip,
    );

    return res.json({
      success: true,
      message: "User unbanned successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to unban user" });
  }
};

// Promote to admin
export const handlePromoteToAdmin: RequestHandler = async (req, res) => {
  try {
    const { idToken, userId } = z
      .object({ idToken: z.string(), userId: z.string() })
      .parse(req.body);

    const adminUid = await verifyAdminToken(idToken);

    await UserRepository.promoteToAdmin(userId);

    await AdminLogsRepository.logAction(
      adminUid,
      "PROMOTE_TO_ADMIN",
      { targetUser: userId },
      req.ip,
    );

    return res.json({
      success: true,
      message: "User promoted to admin",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to promote user" });
  }
};

// Demote from admin
export const handleDemoteFromAdmin: RequestHandler = async (req, res) => {
  try {
    const { idToken, userId } = z
      .object({ idToken: z.string(), userId: z.string() })
      .parse(req.body);

    const adminUid = await verifyAdminToken(idToken);

    await UserRepository.demoteFromAdmin(userId);

    await AdminLogsRepository.logAction(
      adminUid,
      "DEMOTE_FROM_ADMIN",
      { targetUser: userId },
      req.ip,
    );

    return res.json({
      success: true,
      message: "Admin privileges removed",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to demote user" });
  }
};

// Reset user messages
export const handleResetMessages: RequestHandler = async (req, res) => {
  try {
    const { idToken, userId } = z
      .object({ idToken: z.string(), userId: z.string() })
      .parse(req.body);

    const adminUid = await verifyAdminToken(idToken);

    await UserRepository.resetUserMessages(userId);

    await AdminLogsRepository.logAction(
      adminUid,
      "RESET_USER_MESSAGES",
      { targetUser: userId },
      req.ip,
    );

    return res.json({
      success: true,
      message: "User messages reset",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to reset messages" });
  }
};

// Update user plan
export const handleUpdateUserPlan: RequestHandler = async (req, res) => {
  try {
    const { idToken, userId, plan } = z
      .object({
        idToken: z.string(),
        userId: z.string(),
        plan: z.enum(["Free", "Classic", "Pro"]),
      })
      .parse(req.body);

    const adminUid = await verifyAdminToken(idToken);

    await UserRepository.updateUserPlan(userId, plan);

    await AdminLogsRepository.logAction(
      adminUid,
      "UPDATE_USER_PLAN",
      { targetUser: userId, plan },
      req.ip,
    );

    return res.json({
      success: true,
      message: `User plan updated to ${plan}`,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to update user plan" });
  }
};

// Get AI config
export const handleGetAIConfig: RequestHandler = async (req, res) => {
  try {
    const { idToken } = z.object({ idToken: z.string() }).parse(req.body);
    await verifyAdminToken(idToken);

    const config = await SettingsRepository.getAIConfig();

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to fetch AI config" });
  }
};

// Update AI config
export const handleUpdateAIConfig: RequestHandler = async (req, res) => {
  try {
    const { idToken, model, temperature, maxTokens, systemPrompt } = z
      .object({
        idToken: z.string(),
        model: z.string().optional(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
        systemPrompt: z.string().optional(),
      })
      .parse(req.body);

    const adminUid = await verifyAdminToken(idToken);

    const updated = await SettingsRepository.updateAIConfig(
      { model, temperature, maxTokens, systemPrompt },
      adminUid,
    );

    await AdminLogsRepository.logAction(
      adminUid,
      "UPDATE_AI_CONFIG",
      { model, temperature, maxTokens },
      req.ip,
    );

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to update AI config" });
  }
};

// Get maintenance status
export const handleGetMaintenanceStatus: RequestHandler = async (req, res) => {
  try {
    const status = await SettingsRepository.getMaintenanceStatus();
    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Failed to fetch maintenance status",
    });
  }
};

// Enable maintenance
export const handleEnableMaintenance: RequestHandler = async (req, res) => {
  try {
    const { idToken, message } = z
      .object({ idToken: z.string(), message: z.string().optional() })
      .parse(req.body);

    const adminUid = await verifyAdminToken(idToken);

    await SettingsRepository.setMaintenanceStatus(
      {
        global: true,
        services: [],
        message: message || "Server is under maintenance",
      },
      adminUid,
    );

    await AdminLogsRepository.logAction(
      adminUid,
      "ENABLE_MAINTENANCE",
      { message },
      req.ip,
    );

    return res.json({
      success: true,
      message: "Maintenance mode enabled",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to enable maintenance" });
  }
};

// Disable maintenance
export const handleDisableMaintenance: RequestHandler = async (req, res) => {
  try {
    const { idToken } = z.object({ idToken: z.string() }).parse(req.body);

    const adminUid = await verifyAdminToken(idToken);

    await SettingsRepository.disableMaintenance();

    await AdminLogsRepository.logAction(
      adminUid,
      "DISABLE_MAINTENANCE",
      {},
      req.ip,
    );

    return res.json({
      success: true,
      message: "Maintenance mode disabled",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to disable maintenance" });
  }
};

// Get admin logs
export const handleGetAdminLogs: RequestHandler = async (req, res) => {
  try {
    const { idToken } = z.object({ idToken: z.string() }).parse(req.body);
    await verifyAdminToken(idToken);

    const logs = await AdminLogsRepository.getLogs(100);

    return res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to fetch logs" });
  }
};

// Clear old logs
export const handleClearOldLogs: RequestHandler = async (req, res) => {
  try {
    const { idToken, daysOld } = z
      .object({ idToken: z.string(), daysOld: z.number().optional() })
      .parse(req.body);

    const adminUid = await verifyAdminToken(idToken);

    const deleted = await AdminLogsRepository.clearOldLogs(daysOld);

    await AdminLogsRepository.logAction(
      adminUid,
      "CLEAR_OLD_LOGS",
      { deletedCount: deleted },
      req.ip,
    );

    return res.json({
      success: true,
      message: `Deleted ${deleted} old logs`,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to clear logs" });
  }
};

// Get statistics
export const handleGetStats: RequestHandler = async (req, res) => {
  try {
    const { idToken } = z.object({ idToken: z.string() }).parse(req.body);
    await verifyAdminToken(idToken);

    const users = await UserRepository.getAllUsers();
    const licenses = await LicenseRepository.getAllLicenses();
    const logs = await AdminLogsRepository.getLogs(1000);

    const stats = {
      totalUsers: users.length,
      adminUsers: users.filter((u) => u.isAdmin).length,
      bannedUsers: users.filter((u) => u.isBanned).length,
      totalMessages: users.reduce((sum, u) => sum + u.messagesUsed, 0),
      totalLicenses: licenses.length,
      validLicenses: licenses.filter((l) => l.valid).length,
      usedLicenses: licenses.filter((l) => l.usedBy).length,
      logsCount: logs.length,
    };

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to fetch statistics" });
  }
};
