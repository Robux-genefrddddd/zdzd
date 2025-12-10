import { Request } from "express";

/**
 * Robust IP Detection Service
 * Reliably extracts the real client IP address from Express requests
 */
export class IPDetectionService {
  /**
   * Extract the real client IP address from a request
   * Checks multiple headers in order of reliability
   */
  static getClientIP(req: Request): string {
    let ipAddress: string | undefined;

    // Check headers in order of reliability (most to least trusted)
    // X-Client-IP (CloudFlare)
    ipAddress = (req.headers["x-client-ip"] as string)?.split(",")[0]?.trim();
    if (ipAddress && this.isValidIP(ipAddress)) return ipAddress;

    // X-Forwarded-For (common proxy header)
    ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim();
    if (ipAddress && this.isValidIP(ipAddress)) return ipAddress;

    // CF-Connecting-IP (CloudFlare)
    ipAddress = (req.headers["cf-connecting-ip"] as string)?.trim();
    if (ipAddress && this.isValidIP(ipAddress)) return ipAddress;

    // X-Forwarded (generic)
    ipAddress = (req.headers["x-forwarded"] as string)?.split(",")[0]?.trim();
    if (ipAddress && this.isValidIP(ipAddress)) return ipAddress;

    // X-Original-Forwarded-For
    ipAddress = (req.headers["x-original-forwarded-for"] as string)
      ?.split(",")[0]
      ?.trim();
    if (ipAddress && this.isValidIP(ipAddress)) return ipAddress;

    // X-Real-IP (nginx proxy)
    ipAddress = (req.headers["x-real-ip"] as string)?.trim();
    if (ipAddress && this.isValidIP(ipAddress)) return ipAddress;

    // X-Originating-IP
    ipAddress = (req.headers["x-originating-ip"] as string)
      ?.replace(/[\[\]]/g, "")
      .trim();
    if (ipAddress && this.isValidIP(ipAddress)) return ipAddress;

    // Fall back to socket address
    ipAddress =
      req.socket?.remoteAddress ||
      req.connection?.remoteAddress ||
      req.ip ||
      "";

    // Remove IPv6 prefix if present
    if (ipAddress?.startsWith("::ffff:")) {
      ipAddress = ipAddress.substring(7);
    }

    return this.isValidIP(ipAddress) ? ipAddress : "0.0.0.0";
  }

  /**
   * Validate if a string is a valid IPv4 or IPv6 address
   */
  static isValidIP(ip: string): boolean {
    if (!ip || typeof ip !== "string") return false;

    ip = ip.trim();

    // IPv4 validation
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (ipv4Regex.test(ip)) return true;

    // IPv6 validation (simplified)
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|::)$/;
    if (ipv6Regex.test(ip)) return true;

    // Allow localhost variations
    if (ip === "localhost" || ip === "127.0.0.1" || ip === "::1")
      return true;

    return false;
  }

  /**
   * Check if an IP is private/local
   */
  static isPrivateIP(ip: string): boolean {
    const privateIPRanges = [
      /^127\./, // Loopback
      /^10\./, // Private
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private
      /^192\.168\./, // Private
      /^169\.254\./, // Link-local
      /^fc00:/i, // IPv6 private
      /^fe80:/i, // IPv6 link-local
      /^::1$/, // IPv6 loopback
      /^::$/,  // IPv6 unspecified
    ];

    return privateIPRanges.some((range) => range.test(ip));
  }

  /**
   * Get IP information (country, ISP, etc.) - uses a free API if available
   */
  static async getIPInfo(
    ip: string,
  ): Promise<{
    ip: string;
    country?: string;
    city?: string;
    isp?: string;
    isPrivate: boolean;
  }> {
    const result = {
      ip,
      isPrivate: this.isPrivateIP(ip),
    };

    // Don't make external calls for private IPs
    if (result.isPrivate) {
      return result;
    }

    // Try to get additional info from a free API (optional)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(`https://ipapi.co/${ip}/json/`, {
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const data = (await response.json()) as {
            country_name?: string;
            city?: string;
            org?: string;
          };
          return {
            ip,
            country: data.country_name,
            city: data.city,
            isp: data.org,
            isPrivate: false,
          };
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      // Silently fail - return basic info
      console.debug("IP info lookup failed (non-critical):", error);
    }

    return result;
  }

  /**
   * Generate a unique client fingerprint from IP and user agent
   */
  static generateClientFingerprint(
    ip: string,
    userAgent?: string,
  ): string {
    const data = `${ip}:${userAgent || "unknown"}`;
    // Simple hash using native crypto
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
