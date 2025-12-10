/**
 * Settings Repository
 * Manages application-wide settings and configuration
 */

import { getDB, Timestamp } from "../firebase-db";

export interface AppSettings {
  key: string;
  value: any;
  updatedAt: number;
  updatedBy?: string;
}

export interface AIConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface MaintenanceStatus {
  global: boolean;
  services: string[];
  message: string;
  startedAt?: number;
  enabledBy?: string;
}

export class SettingsRepository {
  static async getAIConfig(): Promise<AIConfig> {
    const doc = await getDB().collection("settings").doc("ai_config").get();

    if (!doc.exists) {
      return {
        model: "openai/gpt-oss-120b:free",
        temperature: 0.7,
        maxTokens: 2048,
        systemPrompt:
          "You are a helpful assistant. Always respond in the user's language.",
      };
    }

    return doc.data() as AIConfig;
  }

  static async updateAIConfig(
    config: Partial<AIConfig>,
    updatedBy: string,
  ): Promise<AIConfig> {
    const current = await this.getAIConfig();
    const updated = { ...current, ...config };

    await getDB()
      .collection("settings")
      .doc("ai_config")
      .set({
        ...updated,
        updatedAt: Timestamp.now(),
        updatedBy,
      });

    return updated;
  }

  static async getMaintenanceStatus(): Promise<MaintenanceStatus> {
    const doc = await getDB().collection("settings").doc("maintenance").get();

    if (!doc.exists) {
      return {
        global: false,
        services: [],
        message: "",
      };
    }

    const data = doc.data() as any;
    return {
      global: data.global || false,
      services: data.services || [],
      message: data.message || "",
      startedAt: data.startedAt?.toMillis?.() || undefined,
      enabledBy: data.enabledBy,
    };
  }

  static async setMaintenanceStatus(
    status: MaintenanceStatus,
    updatedBy: string,
  ): Promise<void> {
    await getDB()
      .collection("settings")
      .doc("maintenance")
      .set({
        ...status,
        startedAt: Timestamp.now(),
        updatedBy,
      });
  }

  static async disableMaintenance(): Promise<void> {
    await getDB().collection("settings").doc("maintenance").set({
      global: false,
      services: [],
      message: "",
    });
  }

  static async getSetting(key: string): Promise<any | null> {
    const doc = await getDB().collection("settings").doc(key).get();
    if (!doc.exists) return null;
    return doc.data()?.value;
  }

  static async setSetting(
    key: string,
    value: any,
    updatedBy?: string,
  ): Promise<void> {
    await getDB().collection("settings").doc(key).set({
      key,
      value,
      updatedAt: Timestamp.now(),
      updatedBy,
    });
  }
}
