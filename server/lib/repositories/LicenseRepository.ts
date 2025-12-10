/**
 * License Repository
 * Manages license keys and activation
 */

import { getDB, Timestamp } from "../firebase-db";

export interface License {
  key: string;
  plan: "Free" | "Classic" | "Pro";
  valid: boolean;
  usedBy?: string;
  usedAt?: number;
  createdAt: number;
  createdBy: string;
  validityDays: number;
}

export class LicenseRepository {
  static async createLicense(
    plan: "Free" | "Classic" | "Pro",
    validityDays: number,
    createdBy: string,
  ): Promise<License> {
    const key = `LIC-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 11)
      .toUpperCase()}`;

    const license: License = {
      key,
      plan,
      valid: true,
      createdBy,
      createdAt: Date.now(),
      validityDays,
    };

    await getDB().collection("licenses").doc(key).set(license);
    return license;
  }

  static async getLicense(key: string): Promise<License | null> {
    const doc = await getDB().collection("licenses").doc(key).get();
    if (!doc.exists) return null;
    return doc.data() as License;
  }

  static async activateLicense(key: string, userId: string): Promise<License> {
    const license = await this.getLicense(key);

    if (!license) {
      throw new Error("License not found");
    }

    if (!license.valid) {
      throw new Error("License is not valid");
    }

    if (license.usedBy && license.usedBy !== userId) {
      throw new Error("License already used by another account");
    }

    await getDB().collection("licenses").doc(key).update({
      usedBy: userId,
      usedAt: Timestamp.now(),
    });

    return { ...license, usedBy: userId, usedAt: Date.now() };
  }

  static async getAllLicenses(limit = 100): Promise<License[]> {
    const snapshot = await getDB().collection("licenses").limit(limit).get();

    return snapshot.docs.map((doc) => doc.data() as License);
  }

  static async invalidateLicense(key: string): Promise<void> {
    await getDB().collection("licenses").doc(key).update({
      valid: false,
      invalidatedAt: Timestamp.now(),
    });
  }

  static async deleteLicense(key: string): Promise<void> {
    await getDB().collection("licenses").doc(key).delete();
  }

  static async purgeInvalidLicenses(): Promise<number> {
    const snapshot = await getDB()
      .collection("licenses")
      .where("valid", "==", false)
      .get();

    const batch = getDB().batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size;
  }
}
