import * as Sentry from "@sentry/node";
import { Express } from "express";

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
export function initializeSentry(app?: Express) {
  if (!process.env.SENTRY_DSN) {
    console.log(
      "Sentry DSN not configured, error tracking disabled. Set SENTRY_DSN to enable.",
    );
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment:
      process.env.NODE_ENV || process.env.SENTRY_ENVIRONMENT || "production",
    tracesSampleRate: parseFloat(
      process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1",
    ),
    maxBreadcrumbs: 50,
    attachStacktrace: true,
    denyUrls: [
      // Ignore browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /moz-extension:\/\//i,
    ],
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],
  });

  // Add Sentry middleware to Express app if provided
  if (app) {
    // Request handler must be the first middleware that touches req/res
    app.use(Sentry.Handlers.requestHandler());

    // Tracing middleware
    app.use(Sentry.Handlers.tracingHandler());

    // Error handler - should be the last middleware
    app.use(Sentry.Handlers.errorHandler());
  }

  console.log("Sentry error tracking initialized");
}

/**
 * Capture exception and send to Sentry
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, any>,
) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a custom message/event
 */
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "info",
  context?: Record<string, any>,
) {
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  level?: "fatal" | "error" | "warning" | "info" | "debug",
  data?: Record<string, any>,
) {
  Sentry.addBreadcrumb({
    message,
    category: category || "app",
    level: level || "info",
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, userData?: Record<string, any>) {
  Sentry.setUser({
    id: userId,
    ...userData,
  });
}

/**
 * Clear user context
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Set custom tags for filtering errors
 */
export function setTags(tags: Record<string, string>) {
  Object.entries(tags).forEach(([key, value]) => {
    Sentry.setTag(key, value);
  });
}

/**
 * Report suspicious activity pattern
 */
export function reportSuspiciousActivity(
  activityType: string,
  userId: string,
  details: Record<string, any>,
) {
  captureMessage(`Suspicious Activity: ${activityType}`, "warning", {
    userId,
    ...details,
  });
}

/**
 * Monitor collection size (for Firestore collections)
 */
export function reportCollectionSize(
  collectionName: string,
  size: number,
  threshold?: number,
) {
  if (threshold && size > threshold) {
    captureMessage(
      `Collection '${collectionName}' exceeds threshold: ${size} documents`,
      "warning",
      {
        collection: collectionName,
        size,
        threshold,
      },
    );
  } else {
    addBreadcrumb(
      `Collection size check: ${collectionName}`,
      "database",
      "info",
      {
        collection: collectionName,
        size,
      },
    );
  }
}

/**
 * Report rate limit abuse
 */
export function reportRateLimitAbuse(
  identifier: string,
  endpoint: string,
  requestCount: number,
) {
  reportSuspiciousActivity("rate_limit_exceeded", identifier, {
    endpoint,
    requestCount,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Report failed authentication attempts
 */
export function reportFailedAuth(
  identifier: string,
  reason: string,
  details?: Record<string, any>,
) {
  reportSuspiciousActivity("failed_authentication", identifier, {
    reason,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

/**
 * Report admin action anomaly
 */
export function reportAdminActionAnomaly(
  adminId: string,
  action: string,
  details?: Record<string, any>,
) {
  reportSuspiciousActivity("admin_action_anomaly", adminId, {
    action,
    timestamp: new Date().toISOString(),
    ...details,
  });
}
