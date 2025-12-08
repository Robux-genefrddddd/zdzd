# Admin Panel System Architecture

Complete architecture documentation for the admin panel system.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React SPA)                        │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Admin Pages  │  │  Components  │  │  Auth Context        │  │
│  │              │  │              │  │  (Firebase Auth)     │  │
│  │ - Users      │  │ - Tables     │  │                      │  │
│  │ - Licenses   │  │ - Forms      │  │  - User Session      │  │
│  │ - AI Config  │  │ - Modals     │  │  - Admin Status      │  │
│  │ - System     │  │ - Cards      │  │  - ID Token          │  │
│  │ - Maintenance│  │ - Charts     │  │  - Refresh Token     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                            ↓ API Calls                            │
└─────────────────────────────────────────────────────────────────┘
                            HTTPS/Bearer Token
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER (Express + Node.js)                    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   MIDDLEWARE STACK                        │  │
│  │                                                            │  │
│  │ 1. CORS Validation      → Verify origin                  │  │
│  │ 2. Security Headers     → X-Frame-Options, CSP, etc      │  │
│  │ 3. Request Size Check   → 10MB limit                     │  │
│  │ 4. JSON Parser          → Parse request body             │  │
│  │ 5. Content-Type Check   → Must be application/json       │  │
│  │ 6. Input Validation     → Null bytes, injection check    │  │
│  │ 7. Auth Middleware      → Extract & decode Bearer token  │  │
│  │ 8. Rate Limiting        → Global & per-user limits       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               ADMIN ROUTE HANDLERS                        │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐  │  │
│  │ │ User Management                                     │  │  │
│  │ │ - GET /api/admin/users              → List users   │  │  │
│  │ │ - POST /api/admin/promote-user      → Add admin    │  │  │
│  │ │ - POST /api/admin/demote-user       → Remove admin │  │  │
│  │ │ - POST /api/admin/ban-user          → Ban user     │  │  │
│  │ │ - POST /api/admin/unban-user        → Unban user   │  │  │
│  │ │ - POST /api/admin/reset-messages    → Reset quota  │  │  │
│  │ │ - POST /api/admin/delete-user       → Delete user  │  │  │
│  │ │ - POST /api/admin/update-user-plan  → Change plan  │  │  │
│  │ │ - GET /api/admin/banned-users       → List bans    │  │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐  │  │
│  │ │ License Management                                  │  │  │
│  │ │ - GET /api/admin/licenses           → List all     │  │  │
│  │ │ - POST /api/admin/create-license    → Generate     │  │  │
│  │ │ - POST /api/admin/invalidate-license → Invalidate  │  │  │
│  │ │ - POST /api/admin/delete-license    → Delete       │  │  │
│  │ │ - POST /api/admin/purge-licenses    → Clean up     │  │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐  │  │
│  │ │ AI Configuration                                    │  │  │
│  │ │ - GET /api/admin/ai-config          → Get config   │  │  │
│  │ │ - PUT /api/admin/ai-config          → Update       │  │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐  │  │
│  │ │ System & Monitoring                                 │  │  │
│  │ │ - GET /api/admin/system-stats       → Stats        │  │  │
│  │ │ - GET /api/admin/logs               → Audit logs   │  │  │
│  │ │ - POST /api/admin/clear-logs        → Delete old   │  │  │
│  │ │ - POST /api/admin/verify            → Auth check   │  │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐  │  │
│  │ │ Maintenance Management                              │  │  │
│  │ │ - GET /api/admin/maintenance-status → Current      │  │  │
│  │ │ - POST /api/admin/enable-global-maintenance        │  │  │
│  │ │ - POST /api/admin/disable-global-maintenance       │  │  │
│  │ │ - POST /api/admin/enable-partial-maintenance       │  │  │
│  │ │ - POST /api/admin/disable-partial-maintenance      │  │  │
│  │ │ - POST /api/admin/enable-ia-maintenance            │  │  │
│  │ │ - POST /api/admin/disable-ia-maintenance           │  │  │
│  │ │ - POST /api/admin/enable-license-maintenance       │  │  │
│  │ │ - POST /api/admin/disable-license-maintenance      │  │  │
│  │ │ - POST /api/admin/enable-planned-maintenance       │  │  │
│  │ │ - POST /api/admin/disable-planned-maintenance      │  │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     SECURITY LAYER                        │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐  │  │
│  │ │ Authentication                                      │  │  │
│  │ │ - Firebase Admin SDK verifyIdToken()              │  │  │
│  │ │ - Admin status check from Firestore              │  │  │
│  │ │ - Ban status validation                           │  │  │
│  │ │ - Token expiration verification                  │  │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐  │  │
│  │ │ Authorization                                       │  │  │
│  │ │ - Zod schema validation for all inputs            │  │  │
│  │ │ - User ID regex validation (28 chars)            │  │  │
│  │ │ - Enum validation for plans/actions              │  │  │
│  │ │ - String length constraints                      │  │  │
│  │ │ - Type coercion prevention                       │  │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐  │  │
│  │ │ Rate Limiting                                       │  │  │
│  │ │ - In-memory store (dev) OR Redis (production)     │  │  │
│  │ │ - 10 requests/minute per admin                    │  │  │
│  │ │ - Per-endpoint configuration                      │  │  │
│  │ │ - User UID priority over IP address              │  │  │
│  │ │ - Retry-After header in 429 responses            │  │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐  │  │
│  │ │ Advanced Security (Optional)                        │  │  │
│  │ │ - IP whitelisting per admin                       │  │  │
│  │ │ - 2FA code generation & verification             │  │  │
│  │ │ - Critical action logging                         │  │  │
│  │ │ - Anomalous behavior detection                    │  │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  FIREBASE ADMIN SDK                       │  │
│  │                                                            │  │
│  │  Secure initialization with service account              │  │
│  │  - No REST API calls                                     │  │
│  │  - Server-side only operations                           │  │
│  │  - Service account credentials protected                │  │
│  │  - Connection pooling & caching                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      FIREBASE BACKEND                            │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               CLOUD FIRESTORE (NoSQL Database)           │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐  │  │
│  │ │ Collections:                                        │  │  │
│  │ │ - users/             → User profiles & admin info  │  │  │
│  │ │ - licenses/          → License keys & validity     │  │  │
│  │ │ - admin_logs/        → Audit trail for all ops    │  │  │
│  │ │ - settings/          → AI config & maintenance    │  │  │
│  │ │ - conversations/     → User chat sessions         │  │  │
│  │ │ - messages/          → Chat message history       │  │  │
│  │ │ - admin_ip_whitelist/ → IP restrictions (opt)    │  │  │
│  │ │ - admin_2fa_codes/   → 2FA verification (opt)    │  │  │
│  │ │ - admin_critical_actions/ → Critical ops log    │  │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐  │  │
│  │ │ Firestore Security Rules:                          │  │  │
│  │ │ - Admin operations protected with isAdmin check   │  │  │
│  │ │ - User can only modify own profile                │  │  │
│  │ │ - IP ban/user ban managed server-side only       │  │  │
│  │ │ - Maintenance notices publicly readable           │  │  │
│  │ │ - Settings editable by admins only               │  │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐  │  │
│  │ │ Composite Indexes:                                  │  │  │
│  │ │ - admin_logs: timestamp (DESC)                     │  │  │
│  │ │ - admin_logs: adminUid + timestamp                 │  │  │
│  │ │ - users: isBanned, isAdmin, plan                  │  │  │
│  │ │ - licenses: valid status tracking                 │  │  │
│  │ │ - conversations: userId + createdAt               │  │  │
│  │ │ - messages: conversationId + createdAt            │  │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            FIREBASE AUTHENTICATION                        │  │
│  │                                                            │  │
│  │ - Email/Password authentication                          │  │
│  │ - Custom claims for admin status                         │  │
│  │ - ID token generation (1 hour validity)                 │  │
│  │ - Refresh token management                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              EXTERNAL INTEGRATIONS                        │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐  │  │
│  │ │ Redis (Production Rate Limiting)                   │  │  │
│  │ │ - Distributed rate limiting                       │  │  │
│  │ │ - Sliding window algorithm                        │  │  │
│  │ │ - 60 second persistence per key                   │  │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐  │  │
│  │ │ Sentry (Error Tracking & Monitoring)               │  │  │
│  │ │ - Exception capture                                │  │  │
│  │ │ - Performance monitoring                           │  │  │
│  │ │ - Breadcrumb tracking                             │  │  │
│  │ │ - Alert rules configuration                        │  │  │
│  │ │ - Custom tags and context                         │  │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### User Promotion Flow

```
Admin clicks "Promote User"
    ↓
Modal appears with confirmation
    ↓
Admin submits form with user ID
    ↓
POST /api/admin/promote-user
    ↓
Server receives request
    ↓
1. Extract Bearer token from header
2. Verify token signature (Firebase)
3. Get admin UID from token
4. Check admin exists & has isAdmin=true
5. Validate user ID format (Zod)
6. Get target user from Firestore
7. Check target user exists
8. Check target is not already admin
9. Update user.isAdmin = true
10. Set Firebase custom claims
11. Log action to admin_logs
12. Return success response
    ↓
Client receives response
    ↓
Optimistically update UI
    ↓
Refetch user list
    ↓
Show success toast
```

### License Creation & Usage Flow

```
Admin creates license "Pro, 365 days"
    ↓
Validate & generate license key
    ↓
Store in Firestore: licenses/{key}
    ↓
Return key to admin (to copy/share)
    ↓
User activates license
    ↓
POST /api/activate-license with key
    ↓
Server:
1. Verify token
2. Validate license key format
3. Look up license in Firestore
4. Check license valid=true
5. Check not already used
6. Check validity period not expired
7. Update license.usedBy = userId
8. Update license.usedAt = now
9. Update user.plan = license.plan
10. Update user.messagesLimit based on plan
    ↓
License can only be used once
Non-transferable to other users
```

### Monitoring & Alert Flow

```
Background monitoring running every 10 minutes
    ↓
1. Check admin_logs size
2. Count rapid promotions (last 5 min)
3. Count user deletions (last 5 min)
4. Count ban operations (last 5 min)
5. Detect config changes frequency
    ↓
If thresholds exceeded:
    ↓
Report to Sentry as warning/critical
    ↓
Sentry triggers alert rules:
    ↓
1. Admin receives email alert
2. Slack notification sent
3. Logged to central dashboard
4. Available for investigation
```

## Security Boundaries

### Client Side (Trusted User)

- Can only access own profile (read)
- Cannot modify isAdmin or isBanned fields
- Cannot access admin panel (unauthorized redirect)
- Cannot call admin endpoints

### Server Side (Trusted Service)

- Has full access to Firestore Admin SDK
- Can read/write all collections
- Can bypass Firestore rules
- Protected by HTTPS + Bearer token validation

### Database (Rules Enforced)

- Admins can read all users
- Admins can read/write admin_logs
- Admins can manage licenses
- Regular users cannot access admin operations
- IP bans enforced at server level

## Firestore Rules Hierarchy

```
admin_logs/
  ├── read/write: isAdmin only
  └── Audit trail for accountability

users/{userId}/
  ├── read: Self OR isAdmin
  ├── create: Self during registration
  ├── update: Self (limited fields) OR isAdmin
  ├── delete: Self OR isAdmin
  └── Protected fields: isAdmin, isBanned, plan (server-side only)

licenses/{licenseKey}/
  ├── read: isAdmin only
  ├── write/delete: isAdmin only
  └── Usage tracked server-side

settings/{configKey}/
  ├── read: Authenticated users
  ├── write: isAdmin only
  └── AI config & maintenance status

conversations/{conversationId}/
  ├── read: Owner only
  ├── create: Authenticated users
  ├── update: Owner only
  └── delete: Owner only

messages/{messageId}/
  ├── read: Via conversation owner check
  ├── create: In own conversations
  ├── delete: Owner only
  └── No updates allowed
```

## Error Handling & Recovery

### Network Errors

- Automatic retry with exponential backoff
- User notification after 3 failed attempts
- Offline mode support for read operations

### Authentication Errors

- 401: Invalid/expired token → Force re-login
- 403: Not authorized → Show access denied
- Server handles token refresh automatically

### Validation Errors

- 400: Malformed request → Show field-specific errors
- Client-side validation before submission
- Server-side validation always enforced

### Rate Limiting

- 429: Too many requests
- Includes Retry-After header
- Client should back off and retry

### Server Errors

- 500: Unhandled exception
- Logged to Sentry with context
- Generic error message to client
- Unique error ID for support reference

## Performance Considerations

### Pagination

- User list: 100 users per page
- License list: 100 items per page
- Logs: 100 entries per page
- Firestore startAfter() for cursor pagination

### Caching

- AI config cached in-memory (5 min TTL)
- System stats cached (1 min TTL)
- Admin IP whitelist cached (10 min TTL)

### Rate Limiting

- Per-user tracking in Redis
- Sliding window algorithm (more accurate than fixed window)
- Fail-open if Redis unavailable
- Memory cleanup every 1 hour

### Database Indexes

- Composite indexes for complex queries
- Timestamp descending for recent-first queries
- Status fields (isBanned, isAdmin) for filtering

## Backup & Disaster Recovery

### Firestore Backups

- Automated daily backups via Cloud Tasks
- Export to Cloud Storage
- 30-day retention
- Restore capability in < 1 hour

### Redis Backups

- AOF (Append-Only File) persistence
- RDB snapshots hourly
- Replication to standby instance
- Recovery < 5 minutes

### Logs Archival

- Old logs (>90 days) auto-deleted
- Before deletion, archived to Cloud Storage
- Long-term retention for compliance

## Scalability

### Firestore

- Auto-scales to millions of reads/writes
- Optimized with proper indexes
- Document limits: 100 subcollections per doc
- Query complexity monitoring

### Rate Limiting

- Redis cluster mode for horizontal scaling
- Sharded by user UID or IP
- Consistent hashing for distribution

### Admin Operations

- Batch operations via transactions
- Async background tasks for heavy operations
- Progress tracking for long-running tasks

## Deployment Architecture

```
┌─────────────────────────────────┐
│    Production Environment       │
│                                 │
│  ┌──────────────────────────┐  │
│  │    Load Balancer        │  │
│  │   (SSL Termination)     │  │
│  └──────────────────────────┘  │
│            ↓                    │
│  ┌──────────────────────────┐  │
│  │  Node.js Instance 1     │  │
│  │  Node.js Instance 2     │  │
│  │  Node.js Instance 3     │  │
│  │  (Horizontal scaling)   │  │
│  └──────────────────────────┘  │
│            ↓                    │
│  ┌──────────────────────────┐  │
│  │  Redis Cluster          │  │
│  │  (Rate Limiting)        │  │
│  └──────────────────────────┘  │
│            ↓                    │
│  ┌──────────────────────────┐  │
│  │  Firebase/Firestore     │  │
│  │  (GCP Managed)          │  │
│  └──────────────────────────┘  │
│            ↓                    │
│  ┌──────────────────────────┐  │
│  │  Sentry Cloud           │  │
│  │  (Error Tracking)       │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```
