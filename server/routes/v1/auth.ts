/**
 * Authentication Routes
 * Handles user registration, login, and token verification
 */

import { RequestHandler } from "express";
import { z } from "zod";
import { getAuth_ } from "../../lib/firebase-db";
import { UserRepository } from "../../lib/repositories/UserRepository";
import { AdminLogsRepository } from "../../lib/repositories/AdminLogsRepository";

// Schemas
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const VerifyTokenSchema = z.object({
  idToken: z.string().min(10),
});

// Register user
export const handleRegister: RequestHandler = async (req, res) => {
  try {
    const { email, password } = RegisterSchema.parse(req.body);

    const auth = getAuth_();

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
    });

    // Create user document in Firestore
    await UserRepository.createUser(userRecord.uid, email);

    // Log action
    await AdminLogsRepository.logAction(
      "system",
      "USER_REGISTERED",
      { userId: userRecord.uid, email },
      req.ip || "unknown",
    );

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: error.errors,
      });
    }

    if (error instanceof Error) {
      if (error.message.includes("already exists")) {
        return res.status(409).json({
          success: false,
          error: "Email already registered",
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to register user",
    });
  }
};

// Verify token and get user
export const handleVerifyToken: RequestHandler = async (req, res) => {
  try {
    const { idToken } = VerifyTokenSchema.parse(req.body);

    const auth = getAuth_();

    // Verify token
    const decodedToken = await auth.verifyIdToken(idToken);

    // Get user document
    const user = await UserRepository.getUser(decodedToken.uid);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Record login
    await UserRepository.recordLogin(user.uid);

    return res.json({
      success: true,
      data: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        plan: user.plan,
        messagesUsed: user.messagesUsed,
        messagesLimit: user.messagesLimit,
        isAdmin: user.isAdmin,
        isBanned: user.isBanned,
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
      if (
        error.message.includes("invalid") ||
        error.message.includes("expired")
      ) {
        return res.status(401).json({
          success: false,
          error: "Invalid or expired token",
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to verify token",
    });
  }
};

// Get current user (via token in header)
export const handleGetCurrentUser: RequestHandler = async (req, res) => {
  try {
    const idToken =
      req.body?.idToken ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null);

    if (!idToken) {
      return res.status(401).json({
        success: false,
        error: "No token provided",
      });
    }

    const auth = getAuth_();
    const decodedToken = await auth.verifyIdToken(idToken);
    const user = await UserRepository.getUser(decodedToken.uid);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("invalid") || error.message.includes("expired"))
    ) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to get current user",
    });
  }
};
