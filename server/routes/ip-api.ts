import { RequestHandler } from "express";
import { IPDetectionService } from "../lib/ip-detection-service";

/**
 * Get client's real IP address
 * Fast, no database calls, immediate response
 */
export const handleGetClientIP: RequestHandler = async (req, res) => {
  const ip = IPDetectionService.getClientIP(req);

  res.json({
    ip,
    isPrivate: IPDetectionService.isPrivateIP(ip),
    userAgent: req.headers["user-agent"],
  });
};

/**
 * Get detailed IP information
 * Includes country, city, ISP if available
 */
export const handleGetIPInfo: RequestHandler = async (req, res) => {
  const ip = IPDetectionService.getClientIP(req);

  try {
    const info = await IPDetectionService.getIPInfo(ip);
    res.json(info);
  } catch (error) {
    console.error("Error getting IP info:", error);
    res.json({
      ip,
      isPrivate: IPDetectionService.isPrivateIP(ip),
    });
  }
};

/**
 * Get client fingerprint for device identification
 * Uses IP + User Agent
 */
export const handleGetClientFingerprint: RequestHandler = (req, res) => {
  const ip = IPDetectionService.getClientIP(req);
  const userAgent = req.headers["user-agent"];
  const fingerprint = IPDetectionService.generateClientFingerprint(
    ip,
    userAgent,
  );

  res.json({
    fingerprint,
    ip,
  });
};

/**
 * Health check for IP detection service
 */
export const handleIPDetectionHealth: RequestHandler = (req, res) => {
  const ip = IPDetectionService.getClientIP(req);
  const isValid = IPDetectionService.isValidIP(ip);

  res.json({
    status: isValid ? "operational" : "degraded",
    detectedIP: ip,
    timestamp: new Date().toISOString(),
  });
};
