# Google sign-in setup

Copilot uses the ordinary Sentinel account session. Its “Sign in with Google” button uses Google OpenID Connect, not `GEMINI_API_KEY`.

1. In Google Cloud Console, create an OAuth client of type **Web application**. Configure the consent screen for the users who will sign in.
2. Register the exact authorized redirect URI `http://localhost:3000/api/v1/auth/google/callback` for local development. Register the corresponding HTTPS URI for each deployment.
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in the server environment, along with `AUTH_JWT_SECRET` and `DATABASE_URL`. Do not use `NEXT_PUBLIC_` for the secret. Restart the server.
4. Apply migration `037_google_oauth_identity.sql` with `npm run db:migrate`.

Google sign-in verifies a short-lived signed state, PKCE verifier, and ID-token audience/issuer/signature/nonce. A verified Google `sub` maps to exactly one Sentinel user. An existing email account is **not** merged automatically: sign in with its existing method and use **Security settings → Link Google account**. Suspended accounts and accounts requiring a separate MFA challenge are not admitted through this flow. The OAuth cookie is short-lived; the Sentinel session cookie is HttpOnly, SameSite=Lax, and Secure in production.

After setup, start at `/ai`, choose **Sign in with Google**, complete Google consent, and confirm `/api/v1/auth/me` returns the signed-in user before using Copilot. The Gemini pilot has separate activation and quota settings.
