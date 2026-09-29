import 'server-only';
import { randomUUID } from 'node:crypto';
import { dbPool } from '@/lib/server/db/pool';
import { ApiError } from '@/lib/server/errors';

export type GoogleIdentity = { subject: string; email: string; name: string; picture: string | null };

export async function resolveGoogleAccount(identity: GoogleIdentity, linkUserId?: string): Promise<{
  userId: string; email: string; role: 'user' | 'admin' | 'analyst'; status: string;
}> {
  return dbPool.withTransaction(async client => {
    const linked = await client.query<{ user_id: string }>(
      'SELECT user_id FROM oauth_identities WHERE provider = $1 AND subject = $2', ['google', identity.subject]);
    if (linked.rows[0] && linkUserId && linked.rows[0].user_id !== linkUserId) {
      throw new ApiError('This Google account is linked to a different Sentinel account.', 409, 'GOOGLE_ALREADY_LINKED');
    }
    let userId = linked.rows[0]?.user_id;
    if (!userId && linkUserId) {
      const owner = await client.query<{ id: string; email: string | null }>(
        'SELECT id, email FROM users WHERE id = $1 FOR UPDATE', [linkUserId]);
      if (!owner.rows[0]) throw new ApiError('Account not found.', 404, 'ACCOUNT_NOT_FOUND');
      const emailOwner = await client.query<{ id: string }>(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [identity.email]);
      if (emailOwner.rows[0] && emailOwner.rows[0].id !== linkUserId) {
        throw new ApiError('That Google email belongs to another account.', 409, 'GOOGLE_EMAIL_CONFLICT');
      }
      await client.query(
        'INSERT INTO oauth_identities (provider, subject, user_id, email_at_link) VALUES ($1, $2, $3, $4)',
        ['google', identity.subject, linkUserId, identity.email]);
      userId = linkUserId;
    }
    if (!userId) {
      // Do not silently merge by email: only an authenticated owner may link
      // a pre-existing password or wallet account.
      const emailOwner = await client.query<{ id: string }>(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [identity.email]);
      if (emailOwner.rows[0]) {
        throw new ApiError('An account already uses this email. Sign in with its existing method, then link Google in Security settings.', 409, 'GOOGLE_LINK_REQUIRED');
      }
      userId = `usr_${randomUUID()}`;
      await client.query(
        `INSERT INTO users (id, email, display_name, avatar_url, email_verified_at, status, role)
         VALUES ($1, $2, $3, $4, NOW(), 'active', 'user')`,
        [userId, identity.email, identity.name, identity.picture]);
      await client.query(
        'INSERT INTO oauth_identities (provider, subject, user_id, email_at_link) VALUES ($1, $2, $3, $4)',
        ['google', identity.subject, userId, identity.email]);
    }
    const account = await client.query<{ id: string; email: string; role: 'user' | 'admin' | 'analyst'; status: string }>(
      'SELECT id, email, role, status FROM users WHERE id = $1', [userId]);
    if (!account.rows[0] || account.rows[0].status !== 'active') {
      throw new ApiError('This account is unavailable.', 403, 'ACCOUNT_UNAVAILABLE');
    }
    return { userId: account.rows[0].id, email: account.rows[0].email, role: account.rows[0].role, status: account.rows[0].status };
  });
}
