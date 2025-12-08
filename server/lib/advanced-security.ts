import { getAdminDb } from "./firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";

/**
 * Advanced security features for admin operations
 * - IP-based access restrictions
 * - Abnormal access detection
 * - Rate limiting per admin
 * - Action verification requirements
 */
export class AdvancedSecurityService {
  /**
   * Register admin access IP
   * Track which IPs are used by each admin
   */
  static async registerAdminIP(
    adminId: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<void> {
    const db = getAdminDb();
    if (!db) throw new Error("Database not initialized");

    const docRef = db.collection("admin_ip_whitelist").doc(adminId);
    const doc = await docRef.get();

    const ipData = {
      ip: ipAddress,
      userAgent: userAgent || "unknown",
      timestamp: Timestamp.now(),
      lastSeen: Timestamp.now(),
    };

    if (doc.exists) {
      const data = doc.data();
      const trustedIPs = data.trustedIPs || [];

      // Check if IP already in whitelist
      const existingIP = trustedIPs.find(
        (entry: any) => entry.ip === ipAddress,
      );

      if (existingIP) {
        // Update last seen
        const updatedIPs = trustedIPs.map((entry: any) =>
          entry.ip === ipAddress
            ? { ...entry, lastSeen: Timestamp.now() }
            : entry,
        );
        await docRef.update({ trustedIPs: updatedIPs });
      } else {
        // Add new IP if less than 5 trusted IPs
        if (trustedIPs.length < 5) {
          await docRef.update({
            trustedIPs: [...trustedIPs, ipData],
          });
        }
      }
    } else {
      // Create new document
      await docRef.set({
        adminId,
        trustedIPs: [ipData],
        createdAt: Timestamp.now(),
        enableIPRestriction: false,
      });
    }
  }

  /**
   * Check if IP is trusted for admin
   */
  static async isIPTrusted(
    adminId: string,
    ipAddress: string,
  ): Promise<boolean> {
    const db = getAdminDb();
    if (!db) throw new Error("Database not initialized");

    const doc = await db.collection("admin_ip_whitelist").doc(adminId).get();

    if (!doc.exists) {
      // First time admin accessing - auto-whitelist
      return true;
    }

    const data = doc.data();

    // If IP restriction not enabled, allow
    if (!data.enableIPRestriction) {
      return true;
    }

    // Check if IP in whitelist
    const trustedIPs = data.trustedIPs || [];
    return trustedIPs.some((entry: any) => entry.ip === ipAddress);
  }

  /**
   * Enable IP restrictions for admin
   */
  static async enableIPRestriction(adminId: string): Promise<void> {
    const db = getAdminDb();
    if (!db) throw new Error("Database not initialized");

    await db.collection("admin_ip_whitelist").doc(adminId).update({
      enableIPRestriction: true,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Disable IP restrictions for admin
   */
  static async disableIPRestriction(adminId: string): Promise<void> {
    const db = getAdminDb();
    if (!db) throw new Error("Database not initialized");

    await db.collection("admin_ip_whitelist").doc(adminId).update({
      enableIPRestriction: false,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Generate 2FA code for critical operations
   * Code is time-based and valid for 5 minutes
   */
  static generateTwoFactorCode(): {
    code: string;
    expiresAt: number;
  } {
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    return { code, expiresAt };
  }

  /**
   * Store 2FA code for verification
   */
  static async store2FACode(
    adminId: string,
    code: string,
    expiresAt: number,
    actionType: string,
  ): Promise<void> {
    const db = getAdminDb();
    if (!db) throw new Error("Database not initialized");

    await db.collection("admin_2fa_codes").add({
      adminId,
      code,
      expiresAt: Timestamp.fromDate(new Date(expiresAt)),
      actionType,
      verified: false,
      createdAt: Timestamp.now(),
    });
  }

  /**
   * Verify 2FA code
   */
  static async verify2FACode(
    adminId: string,
    code: string,
    actionType?: string,
  ): Promise<boolean> {
    const db = getAdminDb();
    if (!db) throw new Error("Database not initialized");

    const query = db
      .collection("admin_2fa_codes")
      .where("adminId", "==", adminId)
      .where("code", "==", code)
      .where("verified", "==", false);

    const snapshot = await query.get();

    if (snapshot.empty) {
      return false;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Check if code expired
    const expiresAt = data.expiresAt.toDate().getTime();
    if (Date.now() > expiresAt) {
      // Delete expired code
      await doc.ref.delete();
      return false;
    }

    // Check action type if specified
    if (actionType && data.actionType !== actionType) {
      return false;
    }

    // Mark code as verified
    await doc.ref.update({ verified: true });

    // Clean up old codes (older than 1 hour)
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const oldCodesSnapshot = await db
      .collection("admin_2fa_codes")
      .where("createdAt", "<", Timestamp.fromDate(oneHourAgo))
      .get();

    for (const oldDoc of oldCodesSnapshot.docs) {
      await oldDoc.ref.delete();
    }

    return true;
  }

  /**
   * Log critical admin action with IP and timestamp
   */
  static async logCriticalAction(
    adminId: string,
    actionType: string,
    ipAddress: string,
    details: Record<string, any>,
  ): Promise<void> {
    const db = getAdminDb();
    if (!db) throw new Error("Database not initialized");

    await db.collection("admin_critical_actions").add({
      adminId,
      actionType,
      ipAddress,
      details,
      timestamp: Timestamp.now(),
      userAgent: details.userAgent || "unknown",
    });
  }

  /**
   * Check for suspicious admin behavior patterns
   */
  static async checkAdminBehavior(
    adminId: string,
  ): Promise<{ isSuspicious: boolean; reasons: string[] }> {
    const db = getAdminDb();
    if (!db) throw new Error("Database not initialized");

    const reasons: string[] = [];
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    // Check for multiple failed 2FA attempts
    const failedCodesSnapshot = await db
      .collection("admin_2fa_codes")
      .where("adminId", "==", adminId)
      .where("verified", "==", false)
      .where("createdAt", ">=", Timestamp.fromDate(oneHourAgo))
      .get();

    if (failedCodesSnapshot.size > 5) {
      reasons.push("multiple_failed_2fa_attempts");
    }

    // Check for access from new/unusual IPs
    const criticalActionsSnapshot = await db
      .collection("admin_critical_actions")
      .where("adminId", "==", adminId)
      .where("timestamp", ">=", Timestamp.fromDate(oneHourAgo))
      .get();

    const ipsUsed = new Set<string>();
    criticalActionsSnapshot.forEach((doc) => {
      ipsUsed.add(doc.data().ipAddress);
    });

    if (ipsUsed.size > 3) {
      reasons.push("access_from_multiple_ips");
    }

    // Check for excessive action frequency
    if (criticalActionsSnapshot.size > 20) {
      reasons.push("excessive_action_frequency");
    }

    return {
      isSuspicious: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Get admin security profile
   */
  static async getAdminSecurityProfile(adminId: string): Promise<{
    adminId: string;
    ipRestrictionEnabled: boolean;
    trustedIPs: any[];
    suspiciousBehavior: { isSuspicious: boolean; reasons: string[] };
    lastActivity: Date | null;
  }> {
    const db = getAdminDb();
    if (!db) throw new Error("Database not initialized");

    const ipWhitelistDoc = await db
      .collection("admin_ip_whitelist")
      .doc(adminId)
      .get();

    const behavior = await this.checkAdminBehavior(adminId);

    let lastActivity: Date | null = null;
    const lastActionSnapshot = await db
      .collection("admin_critical_actions")
      .where("adminId", "==", adminId)
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();

    if (!lastActionSnapshot.empty) {
      lastActivity = lastActionSnapshot.docs[0].data().timestamp.toDate();
    }

    return {
      adminId,
      ipRestrictionEnabled: ipWhitelistDoc.exists
        ? ipWhitelistDoc.data().enableIPRestriction || false
        : false,
      trustedIPs: ipWhitelistDoc.exists
        ? ipWhitelistDoc.data().trustedIPs || []
        : [],
      suspiciousBehavior: behavior,
      lastActivity,
    };
  }
}
