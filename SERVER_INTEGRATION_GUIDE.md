# Server Integration Guide

How to integrate Sentry, Redis, and advanced monitoring into the existing server.

## Installation

### 1. Install Required Dependencies

```bash
# Redis client for production rate limiting
pnpm add redis

# Sentry for error tracking
pnpm add @sentry/node @sentry/tracing

# Optional: Redis client types
pnpm add --save-dev @types/redis
```

### 2. Update server/index.ts

Add the following imports at the top of `createServer()`:

```typescript
import {
  initializeSentry,
  captureException,
  addBreadcrumb,
} from "./lib/sentry-integration";
import {
  initializeRateLimiter,
  checkRateLimit,
  closeRateLimiter,
} from "./lib/rate-limiter";
import { MonitoringService } from "./lib/monitoring-service";
```

### 3. Initialize Systems in createServer()

After `initializeFirebaseAdmin()`, add:

```typescript
// Initialize Sentry
initializeSentry(app);

// Initialize rate limiter (Redis or in-memory)
await initializeRateLimiter();

// Start background monitoring
MonitoringService.startBackgroundMonitoring();

// Add graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  await closeRateLimiter();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  await closeRateLimiter();
  process.exit(0);
});
```

### 4. Replace Rate Limiting Middleware

In server/index.ts, replace:

```typescript
app.use(serverRateLimit(60000, 100));
```

With:

```typescript
// Use production-ready rate limiter
app.use(async (req, res, next) => {
  try {
    const identifier = (req as any).decodedUid
      ? `uid:${(req as any).decodedUid}`
      : `ip:${req.ip || req.socket.remoteAddress}`;

    const result = await checkRateLimit(identifier, 100, 60000);

    if (!result.allowed) {
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfter: result.retryAfter,
      });
    }

    (req as any).rateLimitRemaining = result.remaining;
    next();
  } catch (error) {
    // Fail open - allow request if rate limiter fails
    console.error("Rate limiting error:", error);
    next();
  }
});
```

### 5. Add Admin-Specific Rate Limiting

```typescript
// Stricter rate limiting for admin operations
const adminRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = (req as any).decodedUid;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await checkRateLimit(
      `admin:${adminId}`,
      10, // 10 requests
      60000, // per minute
    );

    if (!result.allowed) {
      return res.status(429).json({
        error: "Admin rate limit exceeded. Please try again later.",
        retryAfter: result.retryAfter,
      });
    }

    next();
  } catch (error) {
    console.error("Admin rate limit error:", error);
    next();
  }
};

// Apply to all admin routes
apiRouter.get("/admin/users", adminRateLimit, handleGetAllUsers);
apiRouter.post("/admin/promote-user", adminRateLimit, handlePromoteUser);
// ... other admin routes
```

### 6. Enhance Error Handler

Update the error handler middleware:

```typescript
app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Unhandled error:", err);

    // Capture to Sentry
    const errorMessage = err instanceof Error ? err.message : String(err);
    captureException(err, {
      url: req.url,
      method: req.method,
      userId: (req as any).decodedUid,
    });

    // Add breadcrumb
    addBreadcrumb(`Error on ${req.method} ${req.url}`, "error", "error", {
      statusCode: 500,
      message: errorMessage,
    });

    res.status(500).json({
      error: "Internal server error",
      errorId: Date.now().toString(), // For tracking
    });
  },
);
```

## Features Integration

### Sentry Integration

#### Capture Custom Events

```typescript
import {
  captureMessage,
  setTags,
  addBreadcrumb,
} from "./lib/sentry-integration";

// In admin action handlers:
captureMessage("Admin action performed", "info", {
  adminId: userId,
  action: "PROMOTE_USER",
  targetUser: targetId,
});

setTags({
  environment: process.env.NODE_ENV || "production",
  adminAction: "promote_user",
});

addBreadcrumb("User promoted", "admin", "info", {
  adminId: userId,
  targetId: targetId,
});
```

#### Report Suspicious Activity

```typescript
import {
  reportSuspiciousActivity,
  reportRateLimitAbuse,
} from "./lib/sentry-integration";

// In rate limit exceeded handler:
reportRateLimitAbuse(userId, req.path, requestCount);

// In suspicious admin action:
reportSuspiciousActivity("rapid_promotions", adminId, {
  count: 15,
  timeWindow: "5 minutes",
});
```

### Monitoring Service Usage

```typescript
import { MonitoringService } from "./lib/monitoring-service";

// Generate daily report
app.get("/api/admin/monitoring-report", async (req, res) => {
  const report = await MonitoringService.generateDailyReport();
  res.json(report);
});

// Check collection size (can be called manually)
app.get("/api/admin/check-collections", async (req, res) => {
  const [logs, users, licenses] = await Promise.all([
    MonitoringService.checkAdminLogsSize(),
    MonitoringService.checkUsersSize(),
    MonitoringService.checkLicensesSize(),
  ]);

  res.json({
    admin_logs: logs,
    users: users,
    licenses: licenses,
  });
});

// Detect suspicious activity
app.get("/api/admin/detect-anomalies", async (req, res) => {
  const [activities, admins] = await Promise.all([
    MonitoringService.detectSuspiciousActivity(),
    MonitoringService.detectAnomalousAdmins(),
  ]);

  res.json({
    suspiciousActivities: activities,
    anomalousAdmins: admins,
  });
});
```

### Advanced Security Features

```typescript
import { AdvancedSecurityService } from "./lib/advanced-security";

// In admin authentication middleware:
const isIPTrusted = await AdvancedSecurityService.isIPTrusted(adminId, req.ip!);

if (!isIPTrusted) {
  // Require 2FA
  const { code, expiresAt } = AdvancedSecurityService.generateTwoFactorCode();

  await AdvancedSecurityService.store2FACode(
    adminId,
    code,
    expiresAt,
    "critical_action",
  );

  // Send code to admin (email/SMS)
  // Require code in next request
}

// Log critical action
await AdvancedSecurityService.logCriticalAction(
  adminId,
  "DELETE_USER",
  req.ip!,
  {
    targetUser: targetId,
    userAgent: req.get("user-agent"),
  },
);

// Check admin behavior
const behavior = await AdvancedSecurityService.checkAdminBehavior(adminId);
if (behavior.isSuspicious) {
  // Alert admin or restrict access
  console.warn(
    `Suspicious behavior detected for admin ${adminId}:`,
    behavior.reasons,
  );
}
```

## Environment Variables

Add to .env or .env.production:

```env
# Sentry
SENTRY_DSN=https://key@sentry.io/projectid
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# Redis
REDIS_URL=redis://username:password@localhost:6379
REDIS_PASSWORD=your-password
REDIS_DB=0

# Monitoring
LOG_RETENTION_DAYS=90
DEBUG=false
```

## Testing Integration

### Test Sentry

```bash
# Send a test error
curl -X POST http://localhost:8080/api/test-error \
  -H "Content-Type: application/json"
```

Add test endpoint in server:

```typescript
apiRouter.post("/test-error", (_req, res) => {
  try {
    throw new Error("Test error for Sentry");
  } catch (error) {
    captureException(error);
    res.json({ message: "Error captured" });
  }
});
```

### Test Redis Rate Limiting

```bash
# Make rapid requests (should hit rate limit)
for i in {1..15}; do
  curl -s http://localhost:8080/api/ping | jq .
done

# After 10 requests, should get 429 response
```

### Test Monitoring

```bash
curl -s http://localhost:8080/api/admin/detect-anomalies \
  -H "Authorization: Bearer [admin-token]" | jq .

# Should return suspicious activities if any
```

## Deployment Considerations

### Production Checklist

- [ ] Redis is running and accessible
- [ ] REDIS_URL environment variable set
- [ ] Sentry DSN configured
- [ ] SENTRY_ENVIRONMENT set to "production"
- [ ] LOG_RETENTION_DAYS set to appropriate value
- [ ] All environment variables validated
- [ ] Rate limiting tested under load
- [ ] Error capture verified in Sentry dashboard
- [ ] Monitoring background tasks verified
- [ ] Graceful shutdown tested

### Performance Impact

- **Sentry**: ~10-20ms per request (for sampled traces)
- **Redis Rate Limiting**: ~5ms per request (vs 1ms in-memory)
- **Monitoring Tasks**: Runs in background, no impact on requests
- **Log Retention**: Runs hourly, minimal impact

### Scaling Considerations

1. **Redis**: Use cluster mode for horizontal scaling
2. **Sentry**: Adjust sample rate (lower for high-volume)
3. **Monitoring**: Run on dedicated worker if needed
4. **Load Balancing**: Rate limits are per-node in-memory; use sticky sessions with load balancer

## Troubleshooting

### Redis Connection Failed

```bash
# Test Redis connectivity
redis-cli ping
# Should return: PONG

# Check Redis URL format
echo $REDIS_URL
# Should be: redis://user:pass@host:port

# Restart rate limiter with in-memory fallback
# Set REDIS_URL="" to use in-memory store
```

### Sentry Not Capturing Events

```bash
# Verify DSN is correct
echo $SENTRY_DSN

# Check Sentry project exists and accepts events
# Verify SENTRY_ENVIRONMENT is not set to "ignore"

# Test send:
curl -X POST https://key@sentry.io/projectid/api/1/store/ \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

### High Memory Usage

```bash
# Check in-memory rate limiter size
# If using in-memory, switch to Redis:
REDIS_URL=redis://localhost:6379

# Clear old rate limit entries
redis-cli DEL "ratelimit:*"

# Monitor Redis memory
redis-cli INFO memory
```

## Next Steps

1. Install dependencies
2. Update server/index.ts with integrations
3. Configure environment variables
4. Test each component
5. Deploy to staging
6. Monitor for 24 hours
7. Deploy to production
8. Monitor production metrics
