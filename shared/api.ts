/**
 * Shared types between client and server
 * Used for type safety across API boundaries
 */

// Generic response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  details?: any;
  data?: T;
}

// Auth types
export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  plan: "Free" | "Classic" | "Pro";
  messagesUsed: number;
  messagesLimit: number;
  isAdmin: boolean;
  isBanned: boolean;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

// License types
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

// AI Config
export interface AIConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

// Admin types
export interface AdminLog {
  id: string;
  adminUid: string;
  action: string;
  data: Record<string, any>;
  timestamp: number;
  ipAddress?: string;
}

export interface AdminStats {
  totalUsers: number;
  adminUsers: number;
  bannedUsers: number;
  totalMessages: number;
  totalLicenses: number;
  validLicenses: number;
  usedLicenses: number;
  logsCount: number;
}

export interface MaintenanceStatus {
  global: boolean;
  services: string[];
  message: string;
  startedAt?: number;
  enabledBy?: string;
}

// Demo response (for backward compatibility)
export interface DemoResponse {
  message: string;
}
