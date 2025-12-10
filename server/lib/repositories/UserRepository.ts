/**
 * User Repository
 * Manages user data in Firestore
 */

import { getDB, Timestamp } from "../firebase-db";

export interface User {
  uid: string;
  email: string;
  displayName: string;
  plan: "Free" | "Classic" | "Pro";
  messagesUsed: number;
  messagesLimit: number;
  isAdmin: boolean;
  isBanned: boolean;
  bannedReason?: string;
  bannedAt?: number;
  bannedBy?: string;
  createdAt: number;
  lastLoginAt?: number;
}

export class UserRepository {
  static async createUser(uid: string, email: string): Promise<User> {
    const now = Date.now();
    const user: User = {
      uid,
      email,
      displayName: email.split("@")[0],
      plan: "Free",
      messagesUsed: 0,
      messagesLimit: 10,
      isAdmin: false,
      isBanned: false,
      createdAt: now,
    };

    await getDB().collection("users").doc(uid).set(user);

    return user;
  }

  static async getUser(uid: string): Promise<User | null> {
    const doc = await getDB().collection("users").doc(uid).get();
    if (!doc.exists) return null;
    return doc.data() as User;
  }

  static async updateUser(uid: string, data: Partial<User>): Promise<void> {
    await getDB().collection("users").doc(uid).update(data);
  }

  static async getAllUsers(limit = 100): Promise<User[]> {
    const snapshot = await getDB().collection("users").limit(limit).get();

    return snapshot.docs.map((doc) => doc.data() as User);
  }

  static async updateUserMessages(
    uid: string,
    messagesUsed: number,
  ): Promise<void> {
    await getDB().collection("users").doc(uid).update({
      messagesUsed,
      lastMessageAt: Timestamp.now(),
    });
  }

  static async resetUserMessages(uid: string): Promise<void> {
    await getDB().collection("users").doc(uid).update({
      messagesUsed: 0,
      lastMessageReset: Timestamp.now(),
    });
  }

  static async banUser(
    uid: string,
    reason: string,
    bannedBy: string,
  ): Promise<void> {
    await getDB().collection("users").doc(uid).update({
      isBanned: true,
      bannedReason: reason,
      bannedAt: Timestamp.now(),
      bannedBy,
    });
  }

  static async unbanUser(uid: string): Promise<void> {
    await getDB().collection("users").doc(uid).update({
      isBanned: false,
      bannedReason: null,
      bannedAt: null,
      bannedBy: null,
    });
  }

  static async updateUserPlan(
    uid: string,
    plan: "Free" | "Classic" | "Pro",
  ): Promise<void> {
    const limits: Record<string, number> = {
      Free: 10,
      Classic: 100,
      Pro: 1000,
    };

    await getDB().collection("users").doc(uid).update({
      plan,
      messagesLimit: limits[plan],
    });
  }

  static async promoteToAdmin(uid: string): Promise<void> {
    await getDB().collection("users").doc(uid).update({
      isAdmin: true,
    });
  }

  static async demoteFromAdmin(uid: string): Promise<void> {
    await getDB().collection("users").doc(uid).update({
      isAdmin: false,
    });
  }

  static async deleteUser(uid: string): Promise<void> {
    await getDB().collection("users").doc(uid).delete();
  }

  static async getBannedUsers(): Promise<User[]> {
    const snapshot = await getDB()
      .collection("users")
      .where("isBanned", "==", true)
      .get();

    return snapshot.docs.map((doc) => doc.data() as User);
  }

  static async recordLogin(uid: string): Promise<void> {
    await getDB().collection("users").doc(uid).update({
      lastLoginAt: Timestamp.now(),
    });
  }
}
