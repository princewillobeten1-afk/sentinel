# 02. Session Management and Security

## 1. Server-Managed Session Architecture

The platform operates server-managed stateful sessions combined with signed JWT transport cookies:

```text
Browser Client                     API Gateway / Middleware                  PostgreSQL / SessionStore
      │                                       │                                         │
      │── 1. POST /api/v1/auth/login ────────►│                                         │
      │   (email, password)                   │── 2. Verify Credentials & Create ──────►│
      │                                       │      Session Record (sid, ip, ua)       │
      │◄── 3. Set-Cookie: sentinel_session ───│                                         │
      │       (HttpOnly; Secure; SameSite)    │                                         │
      │                                       │                                         │
      │── 4. GET /api/v1/portfolio ──────────►│                                         │
      │   (Cookie Header)                     │── 5. Validate `sid` not revoked ───────►│
      │                                       │      and not expired                    │
      │◄── 6. 200 OK + Portfolio Data ────────│                                         │
```

- **Stateless Tokens vs Stateful Control**: While the cookie carries a cryptographic payload, every request resolves against the authoritative server-side session registry (`user_sessions` / `sessionStore`).
- **No `localStorage` Tokens**: Long-lived session secrets are never stored in browser `localStorage` or `sessionStorage` to mitigate Cross-Site Scripting (XSS) token exfiltration.

---

## 2. Cookie Security Attributes

The session cookie (`sentinel_session`) is strictly formatted:

```text
Set-Cookie: sentinel_session=<JWT>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Priority=High
```

- `HttpOnly`: Inaccessible to client JavaScript execution.
- `Secure`: Transmitted exclusively over TLS/HTTPS (enforced in production environments).
- `SameSite=Lax`: Defends against Cross-Site Request Forgery (CSRF) on top-level navigations.
- `Max-Age`: Configured for a standard 7-day duration, expiring server-side if revoked or inactive.

---

## 3. Session Expiration & Activity Tracking

Each session record maintains:

- `createdAt`: Timestamp of initial creation.
- `expiresAt`: Fixed upper bound (e.g. 7 days).
- `lastActivityAt`: Updated on user activity (`touchSession`). Inactivity beyond policy (e.g. 24 hours of total inactivity) prompts re-authentication.
- `revokedAt` & `revokedReason`: Populated when a session is invalidated manually or automatically.

---

## 4. Session Rotation on Security Events

To prevent session fixation and unauthorized escalation, the active session is rotated (old session revoked, new session issued) during sensitive operations:

1. Initial Login
2. Password Change
3. Email Address Modification
4. Multi-Factor Authentication (MFA) Verification
5. Primary / Default Wallet Changes

---

## 5. Session Revocation APIs

- `POST /api/v1/auth/logout`: Revokes the current session and instructs browser to clear cookie (`Max-Age=0`).
- `POST /api/v1/auth/logout-all`: Revokes all active sessions for the user (with optional flag to spare current session).
- `GET /api/v1/auth/sessions`: Lists all active devices, IP addresses, user agents, and creation times for the authenticated user.
- `DELETE /api/v1/auth/sessions/:id`: Revokes a specific remote device session.
