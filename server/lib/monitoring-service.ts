import { getAdminDb } from "./firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { reportCollectionSize } from "./sentry-integration";

/**
 * Service for monitoring admin logs, collection sizes, and generating alerts
 */
export class MonitoringService {
  private static logRetentionDays =
    parseInt(process.env.LOG_RETENTION_DAYS || "90");
  private static collectionCheckInterval = 3600000; // 1 hour
  private static lastCheck: Record<string, number> = {};

  /**
   * Check and enforce log retention policy
   * Automatically deletes logs older than LOG_RETENTION_DAYS
   */
  static async enforceLogRetention(): Promise<number> {
    const db = getAdminDb();
    if (!db) throw new Error("Database not initialized");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.logRetentionDays);

    const snapshot = await db
      .collection("admin_logs")
      .where("timestamp", "<", Timestamp.fromDate(cutoffDate))
      .get();

    let deletedCount = 0;
    const batch = db.batch();

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      deletedCount++;
    }

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`Deleted ${deletedCount} old admin logs`);
    }

    return deletedCount;
  }

  /**
   * Get admin logs collection size and monitor for growth
   */
  static async checkAdminLogsSize(): Promise<number> {
    const db = getAdminDb();
    if (!db) throw new Error("Database not initialized");

    const snapshot = await db.collection("admin_logs").count().get();
    const size = snapshot.data().count;

    // Alert if collection exceeds 100,000 documents
    reportCollectionSize("admin_logs", size, 100000);

    return size;
  }

  /**
   * Get users collection size and monitor
   */
  static async checkUsersSize(): Promise<number> {
    const db = getAdminDb();
    if (!db) throw new Error("Database not initialized");

    const snapshot = await db.collection("users").count().get();
    const size = snapshot.data().count;

    reportCollectionSize("users", size);

    return size;
  }

  /**
   * Get licenses collection size and monitor
   */
  static async checkLicensesSize(): Promise<number> {
    const db = getAdminDb();
    if (!db) throw new Error("Database not initialized");

    const snapshot = await db.collection("licenses").count().get();
    const size = snapshot.data().count;

    reportCollectionSize("licenses", size);

    return size;
  }

  /**
   * Detect suspicious patterns in admin logs
   * Flags unusual activity like rapid admin changes, mass deletions, etc.
   */
  static async detectSuspiciousActivity(): Promise<
    Array<{ type: string; details: any }>
  > {
    const db = getAdminDb();
    if (!db) throw new Error("Database not initialized");

    const suspiciousActivities: Array<{ type: string; details: any }> = [];
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    // Check for rapid promotion/demotion
    const promotionSnapshot = await db
      .collection("admin_logs")
      .where("action", "==", "PROMOTE_USER")
      .where("timestamp", ">=", Timestamp.fromDate(fiveMinutesAgo))
      .get();

    if (promotionSnapshot.size > 10) {
      suspiciousActivities.push({
        type: "rapid_promotions",
        details: {
          count: promotionSnapshot.size,
          timeWindow: "5 minutes",
          severity: "high",
        },
      });
    }

    // Check for mass user deletions
    const deletionSnapshot = await db
      .collection("admin_logs")
      .where("action", "==", "DELETE_USER")
      .where("timestamp", ">=", Timestamp.fromDate(fiveMinutesAgo))
      .get();

    if (deletionSnapshot.size > 5) {
      suspiciousActivities.push({
        type: "mass_deletion",
        details: {
          count: deletionSnapshot.size,
          timeWindow: "5 minutes",
          severity: "critical",
        },
      });
    }

    // Check for rapid ban operations
    const banSnapshot = await db
      .collection("admin_logs")
      .where("action", "==", "BAN_USER")
      .where("timestamp", ">=", Timestamp.fromDate(fiveMinutesAgo))
      .get();

    if (banSnapshot.size > 20) {
      suspiciousActivities.push({
        type: "mass_banning",
        details: {
          count: banSnapshot.size,
          timeWindow: "5 minutes",
          severity: "high",
        },
      });
    }

    // Check for configuration tampering
    const configSnapshot = await db
      .collection("admin_logs")
      .where("action", "==", "UPDATE_AI_CONFIG")
      .where("timestamp", ">=", Timestamp.fromDate(fiveMinutesAgo))
      .get();

    if (configSnapshot.size > 5) {
      suspiciousActivities.push({
        type: "repeated_config_changes",
        details: {
          count: configSnapshot.size,
          timeWindow: "5 minutes",
          severity: "medium",
        },
      });
    }

    return suspiciousActivities;
  }

  /**
   * Detect admin users with unusual access patterns
   */
  static async detectAnomalousAdmins(): Promise<
    Array<{ adminId: string; anomalies: string[] }>
  > {
    const db = getAdminDb();
    if (!db) throw new Error("Database not initialized");

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const logsSnapshot = await db
      .collection("admin_logs")
      .where("timestamp", ">=", Timestamp.fromDate(oneHourAgo))
      .get();

    const adminActions: Record<string, Array<string>> = {};

    logsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (!adminActions[data.adminUid]) {
        adminActions[data.adminUid] = [];
      }
      adminActions[data.adminUid].push(data.action);
    });

    const anomalous: Array<{ adminId: string; anomalies: string[] }> = [];

    Object.entries(adminActions).forEach(([adminId, actions]) => {
      const anomalies: string[] = [];

      // Flag if same admin performed >50 actions in 1 hour
      if (actions.length > 50) {
        anomalies.push(`unusual_activity_volume (${actions.length} actions)`);
      }

      // Flag if admin performed both promotions and deletions
      const hasPromotions = actions.some((a) => a === "PROMOTE_USER");
      const hasDeletions = actions.some((a) => a === "DELETE_USER");
      if (hasPromotions && hasDeletions) {
        anomalies.push("mixed_critical_operations");
      }

      // Flag if admin changed configuration multiple times
      const configChanges = actions.filter(
        (a) => a === "UPDATE_AI_CONFIG",
      ).length;
      if (configChanges > 5) {
        anomalies.push(`repeated_config_changes (${configChanges} times)`);
      }

      if (anomalies.length > 0) {
        anomalous.push({ adminId, anomalies });
      }
    });

    return anomalous;
  }

  /**
   * Generate daily monitoring report
   */
  static async generateDailyReport(): Promise<{
    timestamp: Date;
    adminLogsSize: number;
    usersSize: number;
    licensesSize: number;
    suspiciousActivities: Array<{ type: string; details: any }>;
    anomalousAdmins: Array<{ adminId: string; anomalies: string[] }>;
  }> {
    const [adminLogsSize, usersSize, licensesSize, suspiciousActivities, anomalousAdmins] =
      await Promise.all([
        this.checkAdminLogsSize(),
        this.checkUsersSize(),
        this.checkLicensesSize(),
        this.detectSuspiciousActivity(),
        this.detectAnomalousAdmins(),
      ]);

    return {
      timestamp: new Date(),
      adminLogsSize,
      usersSize,
      licensesSize,
      suspiciousActivities,
      anomalousAdmins,
    };
  }

  /**
   * Initialize background monitoring tasks
   * Call this on server startup
   */
  static startBackgroundMonitoring() {
    // Run log retention check every 6 hours
    setInterval(async () => {
      try {
        await this.enforceLogRetention();
      } catch (error) {
        console.error("Log retention check failed:", error);
      }
    }, 6 * 60 * 60 * 1000);

    // Run suspicious activity detection every 10 minutes
    setInterval(async () => {
      try {
        const activities = await this.detectSuspiciousActivity();
        if (activities.length > 0) {
          console.warn("Suspicious activities detected:", activities);
        }
      } catch (error) {
        console.error("Suspicious activity detection failed:", error);
      }
    }, 10 * 60 * 1000);

    // Run anomalous admin detection every hour
    setInterval(async () => {
      try {
        const anomalous = await this.detectAnomalousAdmins();
        if (anomalous.length > 0) {
          console.warn("Anomalous admin activities detected:", anomalous);
        }
      } catch (error) {
        console.error("Anomalous admin detection failed:", error);
      }
    }, 60 * 60 * 1000);

    console.log("Background monitoring tasks started");
  }
}
