export interface UserIP {
  id: string;
  userId: string;
  email?: string;
  ipAddress: string;
  lastLogin?: number;
  createdAt?: number;
  isVPN?: boolean;
  vpnProvider?: string;
}

export interface IPBan {
  id?: string;
  ipAddress: string;
  reason: string;
  bannedAt?: any;
  expiresAt?: any;
  isPermanent?: boolean;
}

export class IPService {
  /**
   * Get the user's real IP address using the new robust detection system
   */
  static async getUserIP(): Promise<string> {
    try {
      const response = await fetch("/api/ip", {
        method: "GET",
      });

      if (!response.ok) {
        console.error("Failed to get IP:", response.status);
        return "unknown";
      }

      const data = (await response.json()) as { ip?: string };
      return data.ip || "unknown";
    } catch (error) {
      console.error("Error getting IP:", error);
      return "unknown";
    }
  }

  /**
   * Get detailed IP information (country, city, ISP)
   */
  static async getIPInfo(): Promise<{
    ip: string;
    country?: string;
    city?: string;
    isp?: string;
    isPrivate: boolean;
  }> {
    try {
      const response = await fetch("/api/ip/info", {
        method: "GET",
      });

      if (!response.ok) {
        const ip = await this.getUserIP();
        return {
          ip,
          isPrivate: false,
        };
      }

      return (await response.json()) as {
        ip: string;
        country?: string;
        city?: string;
        isp?: string;
        isPrivate: boolean;
      };
    } catch (error) {
      console.error("Error getting IP info:", error);
      const ip = await this.getUserIP();
      return {
        ip,
        isPrivate: false,
      };
    }
  }

  /**
   * Get a unique client fingerprint based on IP and user agent
   */
  static async getClientFingerprint(): Promise<string> {
    try {
      const response = await fetch("/api/ip/fingerprint", {
        method: "GET",
      });

      if (!response.ok) {
        return "unknown";
      }

      const data = (await response.json()) as { fingerprint?: string };
      return data.fingerprint || "unknown";
    } catch (error) {
      console.error("Error getting client fingerprint:", error);
      return "unknown";
    }
  }

  /**
   * Check VPN status (simplified - always returns false)
   * Full VPN detection requires external APIs
   */
  static async checkVPN(ipAddress: string): Promise<{
    isVPN: boolean;
    provider?: string;
  }> {
    try {
      const response = await fetch("/api/check-vpn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipAddress }),
      });

      if (!response.ok) {
        return { isVPN: false };
      }

      return (await response.json()) as {
        isVPN: boolean;
        provider?: string;
      };
    } catch (error) {
      console.error("Error checking VPN:", error);
      return { isVPN: false };
    }
  }

  /**
   * Record user IP (no longer persisted to database)
   */
  static async recordUserIP(
    userId: string,
    email: string,
    ipAddress: string,
  ): Promise<void> {
    // IP recording is now handled server-side via middleware
    return;
  }

  /**
   * Update user IP login (no longer persisted to database)
   */
  static async updateUserIPLogin(
    userId: string,
    ipAddress: string,
  ): Promise<void> {
    // IP tracking is now handled server-side via middleware
    return;
  }

  /**
   * Check IP limit (always returns false - no longer enforced)
   */
  static async checkIPLimit(
    ipAddress: string,
    maxAccountsPerIP: number = 1,
  ): Promise<{
    isLimitExceeded: boolean;
    accountCount: number;
    maxAccounts: number;
  }> {
    return {
      isLimitExceeded: false,
      accountCount: 0,
      maxAccounts: maxAccountsPerIP,
    };
  }

  /**
   * Check IP ban (always returns null - no longer enforced)
   */
  static async checkIPBan(ipAddress: string): Promise<IPBan | null> {
    return null;
  }
}
