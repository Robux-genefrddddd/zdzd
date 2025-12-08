# Production Deployment Guide - Admin Panel System

Complete guide to deploy the admin panel system to production with full security, monitoring, and reliability.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Firebase Configuration](#firebase-configuration)
3. [Environment Setup](#environment-setup)
4. [Server Configuration](#server-configuration)
5. [Security Hardening](#security-hardening)
6. [Monitoring & Logging](#monitoring--logging)
7. [Deployment Steps](#deployment-steps)
8. [Post-Deployment Verification](#post-deployment-verification)
9. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Infrastructure
- [ ] Production Firebase project created
- [ ] Cloud Firestore database enabled
- [ ] Firebase Authentication enabled
- [ ] Service account credentials generated
- [ ] Redis instance configured (for rate limiting)
- [ ] Sentry project created (for error tracking)
- [ ] SSL/TLS certificate configured
- [ ] Domain name configured with DNS

### Code & Configuration
- [ ] All tests passing (`npm run test`)
- [ ] TypeScript type checking passes (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] All environment variables defined
- [ ] Firestore indexes created (see FIREBASE_INDEXES.json)
- [ ] Security rules deployed
- [ ] .env file not committed to repository

### Security
- [ ] CORS origins configured
- [ ] Rate limiting configured
- [ ] Security headers validated
- [ ] 2FA setup complete
- [ ] IP whitelisting configured (optional)
- [ ] Admin users verified

---

## Firebase Configuration

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Blaze plan (required for Cloud Functions if needed)

### Step 2: Set Up Firestore

1. Create a Cloud Firestore database
2. Choose "Start in production mode"
3. Select appropriate region (closest to your users)
4. Deploy Firestore rules from `firestore.rules`

```bash
firebase deploy --only firestore:rules
```

### Step 3: Create Firestore Indexes

Upload indexes from `FIREBASE_INDEXES.json`:

```bash
firebase deploy --only firestore:indexes
```

Or manually create indexes in Firebase Console:
- Go to Cloud Firestore → Indexes
- Create composite indexes for:
  - `admin_logs`: timestamp (DESC)
  - `admin_logs`: adminUid (ASC), timestamp (DESC)
  - `users`: isBanned (ASC)
  - `users`: isAdmin (ASC)
  - `users`: plan (ASC)
  - `licenses`: valid (ASC)
  - `conversations`: userId (ASC), createdAt (DESC)
  - `messages`: conversationId (ASC), createdAt (ASC)

### Step 4: Create Service Account

1. Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file securely
4. Convert to base64 or individual environment variables

**For base64:**
```bash
cat service-account.json | base64 | tr -d '\n'
```

---

## Environment Setup

### Step 1: Copy Environment Template

```bash
cp .env.example .env.production
```

### Step 2: Configure Firebase Credentials

**Option A: Base64 JSON (Recommended)**
```env
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```

**Option B: Individual Variables**
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=xxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789
```

### Step 3: Configure Security Settings

```env
# CORS Origins (comma-separated)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Application URL
APP_URL=https://yourdomain.com

# Node Environment
NODE_ENV=production
```

### Step 4: Configure Redis (Production Rate Limiting)

```env
REDIS_URL=redis://username:password@hostname:port
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# Rate Limiting
RATE_LIMIT_GLOBAL=100
RATE_LIMIT_ADMIN=10
RATE_LIMIT_AI_CHAT=10
```

**To set up Redis:**
- Use AWS ElastiCache, Azure Cache for Redis, or self-hosted
- Ensure Redis supports persistence (RDB/AOF)
- Configure backup strategy
- Enable SSL/TLS for connections

### Step 5: Configure Monitoring (Sentry)

```env
SENTRY_DSN=https://key@sentry.io/projectid
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

**To set up Sentry:**
1. Create account at [sentry.io](https://sentry.io)
2. Create a new project (Node.js)
3. Copy DSN value
4. Set log retention, alert rules, etc.

### Step 6: Configure Logging

```env
LOG_RETENTION_DAYS=90
DEBUG=false
```

---

## Server Configuration

### Node.js & Dependencies

```bash
# Ensure Node.js 18+ is installed
node --version  # Should be v18.0.0 or higher

# Install dependencies with pnpm
pnpm install

# Install Redis client
pnpm add redis
```

### Build Application

```bash
# Production build
npm run build

# Verify build
ls -la dist/
```

### Environment Validation

Create `validate-env.ts`:

```typescript
const requiredVars = [
  'FIREBASE_PROJECT_ID',
  'CORS_ORIGINS',
  'APP_URL',
  'NODE_ENV',
];

const missingVars = requiredVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error('Missing environment variables:', missingVars);
  process.exit(1);
}

if (process.env.NODE_ENV !== 'production') {
  console.warn('NODE_ENV is not "production"');
}

console.log('✓ Environment validation passed');
```

Run validation before starting:
```bash
node validate-env.ts && npm run start
```

---

## Security Hardening

### 1. HTTPS/TLS

**Nginx Configuration:**
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Strong security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 2. Firewall Rules

```bash
# Allow HTTPS only
ufw default deny incoming
ufw default allow outgoing
ufw allow 443/tcp
ufw allow 80/tcp  # For Let's Encrypt renewal
ufw allow 22/tcp  # SSH
ufw enable
```

### 3. Admin Access Control

**IP Whitelisting (optional):**
```nginx
# Restrict admin panel to specific IPs
location /api/admin/ {
    allow 203.0.113.0;     # Office IP
    allow 198.51.100.0/24;  # VPN subnet
    deny all;
}
```

### 4. Backup Strategy

```bash
# Daily Firestore backup
0 2 * * * /usr/local/bin/backup-firestore.sh

# Redis backup
0 3 * * * /usr/local/bin/backup-redis.sh
```

---

## Monitoring & Logging

### 1. Server-Side Monitoring

The system includes built-in monitoring:

```typescript
// Start monitoring on server startup
import { MonitoringService } from './lib/monitoring-service';
import { initializeSentry } from './lib/sentry-integration';

initializeSentry(app);
MonitoringService.startBackgroundMonitoring();
```

This automatically:
- Enforces log retention (90 days by default)
- Detects suspicious activities
- Identifies anomalous admin behavior
- Generates hourly reports

### 2. Application Logs

Configure log aggregation:

**Using ELK Stack:**
```bash
# Filebeat config
filebeat install service
filebeat modules enable system
filebeat modules enable docker  # If containerized
```

**Using Cloud Logging (GCP):**
```bash
gcloud logging write admin-panel "Application started" --severity=INFO
```

### 3. Sentry Monitoring

Automatically monitors:
- Unhandled exceptions
- Failed API requests
- Performance degradation
- Rate limit abuse
- Authentication failures

### 4. Database Monitoring

Set up Firestore alerts:
1. Console → Alerts
2. Create alert for:
   - `admin_logs` collection size > 100,000 docs
   - Failed authentication attempts > 10/minute
   - Admin operations > 20/minute

---

## Deployment Steps

### Option 1: Manual Deployment

```bash
# 1. SSH into server
ssh user@your-server.com

# 2. Clone repository
git clone https://github.com/your-org/your-repo.git
cd your-repo

# 3. Set environment variables
cp .env.example .env.production
nano .env.production  # Edit with real values

# 4. Install dependencies
pnpm install

# 5. Build application
npm run build

# 6. Start application with PM2
npm install -g pm2
pm2 start "npm run start" --name "admin-panel" --env production
pm2 save
pm2 startup

# 7. Monitor
pm2 monit
```

### Option 2: Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

EXPOSE 8080

CMD ["npm", "run", "start"]
```

```bash
docker build -t admin-panel:latest .
docker run -d \
  -e FIREBASE_SERVICE_ACCOUNT_KEY='...' \
  -e CORS_ORIGINS=https://yourdomain.com \
  -e REDIS_URL=redis://redis:6379 \
  -p 8080:8080 \
  --name admin-panel \
  admin-panel:latest
```

### Option 3: Netlify Deployment

```bash
# 1. Connect repository to Netlify
# 2. Set build command: npm run build
# 3. Set publish directory: dist/spa
# 4. Set environment variables in Netlify dashboard
# 5. Deploy
```

### Option 4: Vercel Deployment

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Link project
vercel link

# 3. Add environment variables
vercel env add FIREBASE_SERVICE_ACCOUNT_KEY
vercel env add CORS_ORIGINS
# ... other vars

# 4. Deploy
vercel --prod
```

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check server is running
curl -s https://yourdomain.com/api/ping | jq .

# Should return: {"message":"pong"}
```

### 2. Security Validation

```bash
# Check HTTPS
curl -I https://yourdomain.com

# Should show 200 OK with security headers

# Check HSTS
curl -I https://yourdomain.com | grep -i hsts

# Should show: Strict-Transport-Security: max-age=31536000
```

### 3. Firebase Connectivity

```bash
# Check Firestore can be accessed
curl -X POST https://yourdomain.com/api/admin/verify \
  -H "Authorization: Bearer [valid-token]"
```

### 4. Rate Limiting

```bash
# Test rate limiting
for i in {1..15}; do
  curl -s https://yourdomain.com/api/ping | grep -q 'pong' && echo "Request $i: OK" || echo "Request $i: BLOCKED"
done

# Should start rejecting after 10 requests
```

### 5. Error Tracking

1. Check Sentry dashboard
2. Verify at least one event is tracked
3. Confirm alerts are configured

### 6. Admin Panel Test

1. Login as admin
2. Test user management section
3. Test license management
4. Test AI configuration
5. Check system stats load correctly
6. Verify maintenance mode works

---

## Troubleshooting

### Firebase Connection Issues

**Problem:** "Firebase Admin SDK not initialized"

**Solution:**
```bash
# Verify credentials
echo $FIREBASE_SERVICE_ACCOUNT_KEY | base64 -d | jq .

# Check Firestore permissions
firebase deploy --only firestore:rules
```

### Rate Limiting Issues

**Problem:** "All requests blocked (429)"

**Solution:**
```bash
# Check Redis connection
redis-cli ping

# Should return: PONG

# Reset rate limit
redis-cli DEL ratelimit:*

# Check Redis memory
redis-cli INFO memory
```

### Admin Authorization Failures

**Problem:** "Unauthorized: Not an admin"

**Solution:**
1. Verify user exists in Firestore with `isAdmin: true`
2. Check custom claims in Firebase Auth: `setCustomUserClaims(uid, {admin: true})`
3. Verify token is not expired

### High Memory Usage

**Problem:** In-memory rate limiter consuming too much memory

**Solution:**
1. Configure Redis: `REDIS_URL=redis://...`
2. Restart server: `pm2 restart admin-panel`
3. Monitor: `pm2 monit`

### Slow Admin Operations

**Problem:** Admin endpoints responding slowly

**Solution:**
1. Check Firestore indexes are created
2. Monitor query complexity in Firestore console
3. Check Sentry for slow operations
4. Scale Firestore capacity if needed

### Disk Space Issues

**Problem:** Logs filling up disk

**Solution:**
```bash
# Configure log rotation
apt-get install logrotate

# Create /etc/logrotate.d/admin-panel
/var/log/admin-panel.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
}
```

---

## Maintenance Schedule

### Daily
- Monitor Sentry for new errors
- Check admin_logs collection size
- Review suspicious activity alerts

### Weekly
- Review admin access logs
- Check rate limiting effectiveness
- Verify backups are working

### Monthly
- Security audit of admin operations
- Review and update IP whitelists
- Performance optimization review
- Update dependencies

### Quarterly
- Full security assessment
- Disaster recovery drill
- Capacity planning review

---

## Support & Documentation

- [Firebase Documentation](https://firebase.google.com/docs)
- [Sentry Documentation](https://docs.sentry.io/)
- [Redis Documentation](https://redis.io/documentation)
- [This Admin Panel Documentation](./ADMIN_PANEL_IMPLEMENTATION.md)
