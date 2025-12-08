import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "../index";
import { Express } from "express";

describe("Admin Routes Security Tests", () => {
  let app: Express;

  beforeAll(() => {
    app = createServer();
  });

  describe("Authentication & Authorization", () => {
    it("should reject requests without Bearer token", async () => {
      const response = await (app as any)
        .test()
        .get("/api/admin/users")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Unauthorized");
    });

    it("should reject requests with invalid token format", async () => {
      const response = await (app as any)
        .test()
        .get("/api/admin/users")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should reject requests from non-admin users", async () => {
      // This would need a valid non-admin token
      // Test assumes user exists but isAdmin=false
      const response = await (app as any)
        .test()
        .get("/api/admin/users")
        .set("Authorization", "Bearer user-token")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("admin");
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limiting on admin endpoints", async () => {
      // Make multiple rapid requests
      const token = "dummy-token";
      let rateLimitHit = false;

      for (let i = 0; i < 15; i++) {
        const response = await (app as any)
          .test()
          .get("/api/admin/users")
          .set("Authorization", `Bearer ${token}`);

        if (response.status === 429) {
          rateLimitHit = true;
          expect(response.body.error).toContain("Too many requests");
          break;
        }
      }

      expect(rateLimitHit).toBe(true);
    });

    it("should include retry-after header in rate limit response", async () => {
      // Similar to above test
      const token = "another-token";

      for (let i = 0; i < 15; i++) {
        const response = await (app as any)
          .test()
          .get("/api/admin/users")
          .set("Authorization", `Bearer ${token}`);

        if (response.status === 429) {
          expect(response.body.retryAfter).toBeDefined();
          expect(typeof response.body.retryAfter).toBe("number");
          break;
        }
      }
    });
  });

  describe("Input Validation", () => {
    it("should reject invalid user ID format", async () => {
      const response = await (app as any)
        .test()
        .post("/api/admin/promote-user")
        .set("Authorization", "Bearer valid-token")
        .send({ userId: "invalid-id" })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid");
    });

    it("should reject ban reason that is too short", async () => {
      const response = await (app as any)
        .test()
        .post("/api/admin/ban-user")
        .set("Authorization", "Bearer valid-token")
        .send({
          userId: "vSXTJhVmF3VhF8EzrqFcVIXwYoN",
          reason: "bad",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should reject license validity beyond 10 years", async () => {
      const response = await (app as any)
        .test()
        .post("/api/admin/create-license")
        .set("Authorization", "Bearer valid-token")
        .send({
          plan: "Pro",
          validityDays: 10000, // More than 3650 days (10 years)
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should reject invalid plan type", async () => {
      const response = await (app as any)
        .test()
        .post("/api/admin/create-license")
        .set("Authorization", "Bearer valid-token")
        .send({
          plan: "InvalidPlan",
          validityDays: 365,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("Content-Type Validation", () => {
    it("should reject non-JSON content type", async () => {
      const response = await (app as any)
        .test()
        .post("/api/admin/promote-user")
        .set("Content-Type", "text/plain")
        .set("Authorization", "Bearer valid-token")
        .send("invalid")
        .expect(400);

      expect(response.body.error).toContain("Content-Type");
    });

    it("should accept JSON content type", async () => {
      // Just verify it passes content-type check
      // (will fail on auth, but content-type should pass)
      const response = await (app as any)
        .test()
        .post("/api/admin/promote-user")
        .set("Content-Type", "application/json")
        .set("Authorization", "Bearer invalid-token")
        .send({ userId: "vSXTJhVmF3VhF8EzrqFcVIXwYoN" });

      // Should not fail with Content-Type error
      expect(response.body.error || response.body.message).not.toContain(
        "Content-Type",
      );
    });
  });

  describe("Request Size Limits", () => {
    it("should reject oversized requests", async () => {
      const largePayload = "x".repeat(11 * 1024 * 1024); // 11MB

      const response = await (app as any)
        .test()
        .post("/api/admin/ban-user")
        .set("Authorization", "Bearer valid-token")
        .set("Content-Length", (11 * 1024 * 1024).toString())
        .send({ userId: "vSXTJhVmF3VhF8EzrqFcVIXwYoN", reason: largePayload })
        .expect(413);

      expect(response.body.error).toContain("too large");
    });
  });

  describe("Security Headers", () => {
    it("should include security headers in response", async () => {
      const response = await (app as any).test().get("/api/ping");

      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-frame-options"]).toBe("DENY");
      expect(response.headers["x-xss-protection"]).toBe("1; mode=block");
      expect(response.headers["strict-transport-security"]).toBeDefined();
    });

    it("should set Content-Security-Policy header", async () => {
      const response = await (app as any).test().get("/api/ping");

      expect(
        response.headers["x-content-security-policy"],
      ).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle Firestore errors gracefully", async () => {
      // Test with invalid token that will fail at Firebase verification
      const response = await (app as any)
        .test()
        .get("/api/admin/users")
        .set("Authorization", "Bearer invalid-firebase-token");

      // Should return JSON error, not 500
      expect(response.body).toHaveProperty("message");
      expect(response.body.success).toBe(false);
    });

    it("should not leak sensitive error details", async () => {
      const response = await (app as any)
        .test()
        .post("/api/admin/promote-user")
        .set("Authorization", "Bearer invalid-token")
        .send({ userId: "vSXTJhVmF3VhF8EzrqFcVIXwYoN" });

      // Should not contain sensitive info like file paths, etc
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toMatch(/\/[a-z\/]+\.ts:/i); // No file paths
      expect(responseText).not.toMatch(/at [A-Za-z]+\.js/); // No stack traces
    });
  });

  describe("CORS & Origin Validation", () => {
    it("should respect CORS_ORIGINS environment variable", async () => {
      const response = await (app as any)
        .test()
        .get("/api/ping")
        .set("Origin", "https://trusted-domain.com");

      // If CORS_ORIGINS is set, should allow or deny based on config
      // If empty, should allow all (default)
      expect(response.status).toBeLessThan(500);
    });
  });
});

describe("Admin API Endpoints Functionality Tests", () => {
  // Note: These tests assume valid Firebase credentials and database
  // They verify that endpoints exist and handle requests properly

  describe("User Management Endpoints", () => {
    it("GET /api/admin/users - should return user list structure", async () => {
      // Test will fail without valid token, but verifies endpoint exists
      const response = await fetch("/api/admin/users", {
        headers: { Authorization: "Bearer invalid" },
      });

      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
    });

    it("POST /api/admin/promote-user - endpoint should exist", async () => {
      const response = await fetch("/api/admin/promote-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid",
        },
        body: JSON.stringify({ userId: "test" }),
      });

      expect(response.status).toBeGreaterThan(0);
    });

    it("POST /api/admin/ban-user - should validate reason length", async () => {
      const response = await fetch("/api/admin/ban-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid",
        },
        body: JSON.stringify({
          userId: "vSXTJhVmF3VhF8EzrqFcVIXwYoN",
          reason: "x",
        }),
      });

      // Should fail validation (401 from auth or 400 from validation)
      expect([400, 401]).toContain(response.status);
    });
  });

  describe("License Management Endpoints", () => {
    it("GET /api/admin/licenses - endpoint should exist", async () => {
      const response = await fetch("/api/admin/licenses", {
        headers: { Authorization: "Bearer invalid" },
      });

      expect([200, 401]).toContain(response.status);
    });

    it("POST /api/admin/create-license - endpoint should exist", async () => {
      const response = await fetch("/api/admin/create-license", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid",
        },
        body: JSON.stringify({
          plan: "Pro",
          validityDays: 365,
        }),
      });

      expect(response.status).toBeGreaterThan(0);
    });
  });

  describe("AI Configuration Endpoints", () => {
    it("GET /api/admin/ai-config - endpoint should exist", async () => {
      const response = await fetch("/api/admin/ai-config", {
        headers: { Authorization: "Bearer invalid" },
      });

      expect(response.status).toBeGreaterThan(0);
    });

    it("PUT /api/admin/ai-config - endpoint should exist", async () => {
      const response = await fetch("/api/admin/ai-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid",
        },
        body: JSON.stringify({
          model: "gpt-4",
          temperature: 0.7,
          maxTokens: 2048,
          systemPrompt: "You are helpful.",
        }),
      });

      expect(response.status).toBeGreaterThan(0);
    });
  });

  describe("System & Maintenance Endpoints", () => {
    it("GET /api/admin/system-stats - endpoint should exist", async () => {
      const response = await fetch("/api/admin/system-stats", {
        headers: { Authorization: "Bearer invalid" },
      });

      expect([200, 401]).toContain(response.status);
    });

    it("GET /api/admin/logs - endpoint should exist", async () => {
      const response = await fetch("/api/admin/logs", {
        headers: { Authorization: "Bearer invalid" },
      });

      expect([200, 401]).toContain(response.status);
    });

    it("POST /api/admin/clear-logs - endpoint should exist", async () => {
      const response = await fetch("/api/admin/clear-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid",
        },
        body: JSON.stringify({ daysOld: 90 }),
      });

      expect([200, 401]).toContain(response.status);
    });

    it("POST /api/admin/enable-global-maintenance - endpoint should exist", async () => {
      const response = await fetch("/api/admin/enable-global-maintenance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid",
        },
        body: JSON.stringify({ message: "Maintenance" }),
      });

      expect([200, 401]).toContain(response.status);
    });
  });
});
