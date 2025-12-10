# Backend Complete Rebuild - Documentation

## ✅ What's New

This is a **complete rewrite** of the backend from scratch using **Firebase (Firestore) as the only database**. Everything is clean, stable, and production-ready.

### Architecture

```
server/
├── env.ts                           # Environment validation
├── lib/
│   ├── firebase-db.ts              # Firebase initialization
│   └── repositories/               # Data access layer
│       ├── UserRepository.ts
│       ├── ConversationRepository.ts
│       ├── LicenseRepository.ts
│       ├── AdminLogsRepository.ts
│       └── SettingsRepository.ts
├── routes/v1/
│   ├── auth.ts                     # Auth routes
│   ├── chat.ts                     # Chat routes
│   ├── admin.ts                    # Admin panel
│   └── license.ts                  # License management
└── index.ts                        # Express app setup
```

## 🔑 Environment Variables Required

Set these in your deployment (Vercel, etc.):

```
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}  # The JSON you provided
OPENROUTER_API_KEY=your-api-key                             # For AI chat
JWT_SECRET=your-secret-key                                   # For tokens (change in prod!)
ADMIN_PANEL_SECRET=your-admin-secret                         # For admin access
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com  # Comma-separated
PORT=3001                                                     # Optional, defaults to 3001
```

## 🚀 API Routes

All routes use standardized response format:

```json
{
  "success": true,
  "data": {...},
  "message": "..."
}
```

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/verify` - Verify Firebase token & get user
- `GET /api/auth/me` - Get current user (requires `idToken` in body)

### Chat

- `POST /api/chat/send` - Send message to AI (creates conversation if needed)
- `POST /api/chat/conversations` - Get all conversations
- `POST /api/chat/create` - Create new conversation
- `POST /api/chat/messages` - Get messages from conversation
- `POST /api/chat/delete` - Delete conversation

### License

- `POST /api/license/activate` - Activate license key
- `POST /api/license/list` - List all licenses (admin)
- `POST /api/license/create` - Create license (admin)
- `POST /api/license/invalidate` - Invalidate license (admin)
- `POST /api/license/delete` - Delete license (admin)
- `POST /api/license/purge` - Delete all invalid licenses (admin)

### Admin Panel

- `POST /api/admin/users` - List all users
- `POST /api/admin/ban` - Ban user
- `POST /api/admin/unban` - Unban user
- `POST /api/admin/promote` - Make user admin
- `POST /api/admin/demote` - Remove admin privileges
- `POST /api/admin/reset-messages` - Reset user message count
- `POST /api/admin/update-plan` - Change user's plan
- `POST /api/admin/ai-config` - Get AI configuration
- `PUT /api/admin/ai-config` - Update AI configuration
- `POST /api/admin/maintenance` - Get maintenance status
- `POST /api/admin/maintenance/enable` - Enable maintenance mode
- `POST /api/admin/maintenance/disable` - Disable maintenance mode
- `POST /api/admin/logs` - Get admin action logs
- `POST /api/admin/logs/clear` - Delete old logs
- `POST /api/admin/stats` - Get system statistics

## 📝 Frontend Migration Guide

### ✅ What Works Without Changes

Most of your frontend code works **without modification** because the API contracts are compatible!

The frontend already expects:

- Firebase authentication
- POST requests to `/api/` endpoints
- `idToken` in request body for auth

### ⚠️ What Changed (Minimal Updates Needed)

#### 1. Chat Endpoint Response

**Before:**

```javascript
response.data = {
  content: "...",
  messagesUsed: 10,
  messagesLimit: 100,
};
```

**Now (same, but in `data` object):**

```javascript
response.data = {
  conversationId: "...",
  message: "...",
  messagesUsed: 10,
  messagesLimit: 100,
};
```

**Update in `client/lib/ai.ts`:**

```typescript
// Replace this:
const content = data.content || "No response";

// With this:
const content = data.data?.message || data.content || "No response";
const conversationId = data.data?.conversationId;
```

#### 2. Conversation Routes (NEW)

The backend now stores conversations! Update `client/lib/messages.ts`:

```typescript
export class MessagesService {
  static async getConversations(userId: string) {
    const idToken = await auth.currentUser?.getIdToken();
    const response = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const data = await response.json();
    return data.data || [];
  }

  static async getMessages(userId: string, conversationId: string) {
    const idToken = await auth.currentUser?.getIdToken();
    const response = await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, conversationId }),
    });
    const data = await response.json();
    return data.data || [];
  }
}
```

#### 3. Auth Routes (Already Compatible)

Your `client/contexts/AuthContext.tsx` should work as-is because:

- Firebase Auth client handles login/registration
- Token verification via `/api/auth/verify` works perfectly
- User data is synced to Firestore automatically

#### 4. Admin Routes (Already Compatible)

The admin panel routes are 100% compatible with existing code. Just ensure:

- All requests include `idToken` in body
- User has `isAdmin: true` flag
- Response format is `{ success, data, error }`

### 🔄 Optional: Use New Conversation Storage

If you want to **store and load conversations from backend** (recommended):

In `client/lib/messages.ts`, sync with `/api/chat/` endpoints:

```typescript
// Send message and store in backend
const response = await fetch("/api/chat/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    idToken,
    conversationId: activeConversationId,
    userMessage,
    conversationHistory,
  }),
});

// Get all user conversations from backend
const conversations = await fetch("/api/chat/conversations", {
  method: "POST",
  body: JSON.stringify({ idToken }),
})
  .then((r) => r.json())
  .then((d) => d.data);
```

## 🌐 Vercel Deployment (Exact Steps)

### 1. Set Environment Variables

Go to your Vercel project **Settings → Environment Variables** and add:

```
FIREBASE_SERVICE_ACCOUNT_KEY = {"type":"service_account",...}
OPENROUTER_API_KEY = sk-or-v1-xxxx
JWT_SECRET = your-secret-string
ADMIN_PANEL_SECRET = admin-secret-string
CORS_ORIGINS = https://yoursite.vercel.app
NODE_ENV = production
```

### 2. Build Configuration

Your `package.json` already has the right build scripts:

```json
{
  "scripts": {
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build",
    "build:server": "vite build --config vite.config.server.ts",
    "start": "node dist/server/node-build.js"
  }
}
```

Vercel will:

1. Run `npm run build`
2. Detect Node.js app
3. Run `npm start`

### 3. Verify Deployment

After deploy, test:

```bash
curl https://your-vercel-domain.vercel.app/health
# Should return: {"status":"ok","timestamp":"..."}

curl https://your-vercel-domain.vercel.app/api/auth/verify \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"idToken":"your-firebase-token"}'
# Should return: {"success":true,"data":{...}}
```

## 🧪 Testing Locally

1. Set env vars:

```bash
export FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
export OPENROUTER_API_KEY='your-key'
export JWT_SECRET='secret'
export ADMIN_PANEL_SECRET='admin'
```

2. Start dev server:

```bash
pnpm dev
```

3. Test chat:

```bash
curl http://localhost:3001/api/chat/send \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "firebase-token",
    "userMessage": "Hello!",
    "model": "openai/gpt-oss-120b:free"
  }'
```

## 📊 Firestore Collections

Backend automatically creates these collections in Firestore:

- **users/** - User documents with plan, message limits, ban status
- **users/{uid}/conversations/** - User's conversations (subcollection)
- **users/{uid}/conversations/{convId}/messages/** - Chat messages (subcollection)
- **licenses/** - License keys and activation status
- **admin_logs/** - Audit trail of admin actions
- **settings/** - AI config and maintenance status

## 🔐 Security Notes

- All endpoints verify Firebase token authenticity
- Admin endpoints require `isAdmin: true` flag
- Rate limiting is built-in via global middleware
- Messages are stored encrypted in Firestore
- All admin actions are logged for audit

## 🐛 Troubleshooting

### "Firebase Admin SDK not initialized"

→ Check `FIREBASE_SERVICE_ACCOUNT_KEY` is set and valid JSON

### "Invalid or expired token"

→ Token must be a valid Firebase ID token from your auth domain

### "AI service error"

→ Check `OPENROUTER_API_KEY` is set and has credits

### Conversations not saving

→ Make sure `conversationId` is passed to subsequent messages to keep them in same conversation

## 🎯 Next Steps

1. ✅ Deploy to Vercel with environment variables
2. ✅ Test `/api/health` endpoint works
3. ✅ Test login and chat functionality
4. ✅ Monitor admin logs for any errors
5. ✅ Optional: Update frontend to use new conversation API

---

**Questions?** Check Firebase console at https://console.firebase.google.com for your project `keysystem-d0b86-8df89`
