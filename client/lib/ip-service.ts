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
  static async getUserIP(): Promise<string> {
    // IP detection service has been removed
    return "unknown";
  }

  static async checkVPN(ipAddress: string): Promise<{
    isVPN: boolean;
    provider?: string;
  }> {
    // VPN checking service has been removed
    return { isVPN: false };
  }

  static async recordUserIP(
    userId: string,
    email: string,
    ipAddress: string,
  ): Promise<void> {
    // IP recording service has been removed
    return;
  }

  static async updateUserIPLogin(
    userId: string,
    ipAddress: string,
  ): Promise<void> {
    // IP login update service has been removed
    return;
  }

  static async checkIPLimit(
    ipAddress: string,
    maxAccountsPerIP: number = 1,
  ): Promise<{
    isLimitExceeded: boolean;
    accountCount: number;
    maxAccounts: number;
  }> {
    // IP limit checking service has been removed
    return {
      isLimitExceeded: false,
      accountCount: 0,
      maxAccounts: maxAccountsPerIP,
    };
  }

  static async checkIPBan(ipAddress: string): Promise<IPBan | null> {
    // IP ban checking service has been removed
    return null;
  }
}
