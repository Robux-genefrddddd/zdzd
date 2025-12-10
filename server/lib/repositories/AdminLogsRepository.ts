/**
 * Admin Logs Repository
 * Tracks all admin actions for audit purposes
 */

import { getDB, Timestamp } from "../firebase-db";

export interface AdminLog {
  id: string;
  adminUid: string;
  action: string;
  data: Record<string, any>;
  timestamp: number;
  ipAddress?: string;
}

export class AdminLogsRepository {
  static async logAction(
    adminUid: string,
    action: string,
    data: Record<string, any> = {},
    ipAddress?: string,
  ): Promise<AdminLog> {
    const docRef = await getDB()
      .collection("admin_logs")
      .add({
        adminUid,
        action,
        data,
        ipAddress: ipAddress || "unknown",
        timestamp: Timestamp.now(),
      });

    return {
      id: docRef.id,
      adminUid,
      action,
      data,
      timestamp: Date.now(),
      ipAddress,
    };
  }

  static async getLogs(limit = 100): Promise<AdminLog[]> {
    const snapshot = await getDB()
      .collection("admin_logs")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        adminUid: data.adminUid,
        action: data.action,
        data: data.data || {},
        timestamp: data.timestamp?.toMillis?.() || Date.now(),
        ipAddress: data.ipAddress,
      };
    });
  }

  static async clearOldLogs(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const snapshot = await getDB()
      .collection("admin_logs")
      .where("timestamp", "<", Timestamp.fromDate(cutoffDate))
      .get();

    const batch = getDB().batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size;
  }

  static async deleteLog(logId: string): Promise<void> {
    await getDB().collection("admin_logs").doc(logId).delete();
  }
}
