# 04. Authorization and Middleware

## 1. Authentication vs Authorization

The platform maintains a strict separation between identity verification and permission checks:

| Layer | Responsibility | Primary Mechanism |
|---|---|---|
| **Authentication** | Confirms identity: *Who are you?* | Bearer Token / Session Cookie |
| **Authorization** | Confirms permissions: *Are you allowed to perform this action?* | Role-Based Access Control (RBAC), Scope validation, Resource ownership |

---

## 2. Server Middleware Decorators

### A. `requireAuth(request)`
- Resolves the bearer token or session cookie.
- Validates that the associated session ID is active, unrevoked, and unexpired.
- Checks that the user account status is `ACTIVE` (rejects `SUSPENDED` accounts with `403 Forbidden`).
- Attaches the authenticated context:
  ```ts
  export interface AuthContext {
    user: AuthUser;
    session: ServerSession;
    requestId: string;
  }
  ```

### B. `optionalAuth(request)`
- Attempts credential resolution without rejecting unauthenticated requests.
- Returns `AuthContext | null`, allowing public endpoints (e.g. market discovery, token explorer) to personalize content if logged in.

---

## 3. Resource-Level Authorization Service

`AuthorizationService` performs deterministic ownership assertions:

- `canAccessWallet(userId, walletId)`: Validates that the target wallet belongs to `userId` and is not revoked.
- `canAccessOrder(userId, orderId)`: Validates that the order was placed by `userId`.
- `canManageSession(userId, sessionId)`: Ensures users can only view and revoke their own sessions.

---

## 4. Step-Up Re-Authentication (`requireRecentAuthentication`)

For sensitive security operations (e.g., password change, email change, removing 2FA/MFA, or critical fund management):

```ts
function requireRecentAuthentication(session: ServerSession, maxAgeSeconds = 300): void {
  const sessionAge = (Date.now() - new Date(session.createdAt).getTime()) / 1000;
  if (sessionAge > maxAgeSeconds) {
    throw new ApiError('Sensitive operation requires recent re-authentication.', 401, 'REAUTHENTICATION_REQUIRED');
  }
}
```

If the session was not authenticated within the last 5 minutes (300 seconds), the user must re-enter their credentials.
