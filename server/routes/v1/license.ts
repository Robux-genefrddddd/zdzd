/**
 * License Routes
 * Handles license activation and management
 */

import { RequestHandler } from "express";
import { z } from "zod";
import { getAuth_ } from "../../lib/firebase-db";
import { UserRepository } from "../../lib/repositories/UserRepository";
import { LicenseRepository } from "../../lib/repositories/LicenseRepository";
import { AdminLogsRepository } from "../../lib/repositories/AdminLogsRepository";

// Activate license
export const handleActivateLicense: RequestHandler = async (req, res) => {
  try {
    const { idToken, licenseKey } = z
      .object({
        idToken: z.string().min(10),
        licenseKey: z.string().min(10),
      })
      .parse(req.body);

    const auth = getAuth_();
    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    const userId = decodedToken.uid;
    const user = await UserRepository.getUser(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Activate license
    const license = await LicenseRepository.activateLicense(licenseKey, userId);

    // Update user plan
    await UserRepository.updateUserPlan(userId, license.plan);

    await AdminLogsRepository.logAction(
      "system",
      "LICENSE_ACTIVATED",
      { userId, licenseKey, plan: license.plan },
      req.ip,
    );

    return res.json({
      success: true,
      message: "License activated successfully",
      data: {
        plan: license.plan,
        messagesLimit:
          license.plan === "Pro" ? 1000 : license.plan === "Classic" ? 100 : 10,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
    }

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return res.status(404).json({
          success: false,
          error: "License not found",
        });
      }
      if (error.message.includes("not valid")) {
        return res.status(400).json({
          success: false,
          error: "License is not valid",
        });
      }
      if (error.message.includes("already used")) {
        return res.status(400).json({
          success: false,
          error: "License already used by another account",
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to activate license",
    });
  }
};

// Get all licenses (admin only)
export const handleGetAllLicenses: RequestHandler = async (req, res) => {
  try {
    const { idToken } = z.object({ idToken: z.string() }).parse(req.body);

    const auth = getAuth_();
    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    const user = await UserRepository.getUser(decodedToken.uid);

    if (!user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    const licenses = await LicenseRepository.getAllLicenses();

    return res.json({
      success: true,
      data: licenses,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to fetch licenses",
    });
  }
};

// Create license (admin only)
export const handleCreateLicense: RequestHandler = async (req, res) => {
  try {
    const { idToken, plan, validityDays } = z
      .object({
        idToken: z.string(),
        plan: z.enum(["Free", "Classic", "Pro"]),
        validityDays: z.number().int().min(1),
      })
      .parse(req.body);

    const auth = getAuth_();
    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    const user = await UserRepository.getUser(decodedToken.uid);

    if (!user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    const license = await LicenseRepository.createLicense(
      plan,
      validityDays,
      decodedToken.uid,
    );

    await AdminLogsRepository.logAction(
      decodedToken.uid,
      "CREATE_LICENSE",
      { licenseKey: license.key, plan, validityDays },
      req.ip,
    );

    return res.status(201).json({
      success: true,
      data: license,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to create license",
    });
  }
};

// Invalidate license (admin only)
export const handleInvalidateLicense: RequestHandler = async (req, res) => {
  try {
    const { idToken, licenseKey } = z
      .object({
        idToken: z.string(),
        licenseKey: z.string(),
      })
      .parse(req.body);

    const auth = getAuth_();
    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    const user = await UserRepository.getUser(decodedToken.uid);

    if (!user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    await LicenseRepository.invalidateLicense(licenseKey);

    await AdminLogsRepository.logAction(
      decodedToken.uid,
      "INVALIDATE_LICENSE",
      { licenseKey },
      req.ip,
    );

    return res.json({
      success: true,
      message: "License invalidated",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to invalidate license",
    });
  }
};

// Delete license (admin only)
export const handleDeleteLicense: RequestHandler = async (req, res) => {
  try {
    const { idToken, licenseKey } = z
      .object({
        idToken: z.string(),
        licenseKey: z.string(),
      })
      .parse(req.body);

    const auth = getAuth_();
    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    const user = await UserRepository.getUser(decodedToken.uid);

    if (!user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    await LicenseRepository.deleteLicense(licenseKey);

    await AdminLogsRepository.logAction(
      decodedToken.uid,
      "DELETE_LICENSE",
      { licenseKey },
      req.ip,
    );

    return res.json({
      success: true,
      message: "License deleted",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to delete license",
    });
  }
};

// Purge invalid licenses (admin only)
export const handlePurgeInvalidLicenses: RequestHandler = async (req, res) => {
  try {
    const { idToken } = z.object({ idToken: z.string() }).parse(req.body);

    const auth = getAuth_();
    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    const user = await UserRepository.getUser(decodedToken.uid);

    if (!user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    const deletedCount = await LicenseRepository.purgeInvalidLicenses();

    await AdminLogsRepository.logAction(
      decodedToken.uid,
      "PURGE_INVALID_LICENSES",
      { deletedCount },
      req.ip,
    );

    return res.json({
      success: true,
      message: `Purged ${deletedCount} invalid licenses`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to purge licenses",
    });
  }
};
