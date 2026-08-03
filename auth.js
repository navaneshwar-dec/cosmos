import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import sql, { initDb } from './lib/db';
import { verifyPassword } from './lib/password';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Derive the callback host from the incoming request (Host / X-Forwarded-Host) instead
  // of a hardcoded NEXTAUTH_URL — so the same server works over localhost AND the Tailscale
  // HTTPS hostname (tailscale serve sets X-Forwarded-Host/Proto). Each host you use must
  // still be added as an authorized redirect URI in the Google OAuth client.
  trustHost: true,
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          // drive.file = access only to files cosmos creates (never the rest of your Drive).
          scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
          access_type: 'offline',      // ask Google for a refresh token
          prompt: 'consent',           // force it to return the refresh token
          include_granted_scopes: 'true',
        },
      },
    }),
    // Email + password for existing users who set a password in their account settings.
    // (No Google Drive access on this path — Drive needs the Google OAuth token.)
    Credentials({
      name: 'Email',
      credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Password', type: 'password' } },
      authorize: async (creds) => {
        const email = String(creds?.email || '').trim().toLowerCase();
        const password = String(creds?.password || '');
        if (!email || !password) return null;
        try {
          await initDb();
          const [u] = await sql`SELECT id, email, name, picture, password_hash FROM users WHERE lower(email) = ${email} LIMIT 1`;
          if (!u || !u.password_hash || !verifyPassword(password, u.password_hash)) return null;
          return { id: String(u.id), email: u.email, name: u.name, image: u.picture };
        } catch (err) {
          console.error('[auth] credentials authorize error:', err?.message ?? err);
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: '/', error: '/' },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'credentials') return true;   // already verified in authorize
      if (account?.provider !== 'google') return false;
      try {
        await initDb();
        const isAdmin = user.email === (process.env.ADMIN_EMAIL ?? '');
        await sql`
          INSERT INTO users (google_id, email, name, picture, is_admin)
          VALUES (
            ${account.providerAccountId},
            ${user.email},
            ${user.name  ?? ''},
            ${user.image ?? ''},
            ${isAdmin}
          )
          ON CONFLICT (google_id) DO UPDATE SET
            name    = EXCLUDED.name,
            picture = EXCLUDED.picture
        `;
      } catch (err) {
        console.error('[auth] signIn DB error (non-fatal):', err?.message ?? err);
        // Don't block sign-in for transient DB errors — jwt callback will retry
      }
      return true;
    },

    async jwt({ token, user, account, profile }) {
      // Email+password sign-in: the user is already verified in authorize().
      if (account?.provider === 'credentials' && user) {
        try {
          await initDb();
          const rows = await sql`SELECT prayer_enabled, is_admin FROM users WHERE id = ${Number(user.id)}`;
          token.userId       = Number(user.id);
          token.prayerEnabled = rows[0]?.prayer_enabled ?? false;
          token.isAdmin       = rows[0]?.is_admin       ?? false;
        } catch (err) {
          console.error('[auth] jwt (credentials) DB error:', err?.message ?? err);
          token.dbError = err?.message ?? String(err);
        }
        return token;
      }
      if (account) {
        try {
          await initDb();
          // Try to upsert in case signIn callback had a DB error
          const isAdmin = profile?.email === (process.env.ADMIN_EMAIL ?? '');
          await sql`
            INSERT INTO users (google_id, email, name, picture, is_admin)
            VALUES (
              ${account.providerAccountId},
              ${profile?.email ?? ''},
              ${profile?.name  ?? ''},
              ${profile?.picture ?? ''},
              ${isAdmin}
            )
            ON CONFLICT (google_id) DO UPDATE SET
              name    = EXCLUDED.name,
              picture = EXCLUDED.picture
          `;
          // Persist Google Drive OAuth tokens (only overwrite refresh_token when Google sends one)
          if (account.access_token) {
            await sql`
              UPDATE users SET
                google_access_token = ${account.access_token},
                google_token_expiry = ${account.expires_at ? new Date(account.expires_at * 1000) : null},
                google_refresh_token = COALESCE(${account.refresh_token ?? null}, google_refresh_token)
              WHERE google_id = ${account.providerAccountId}
            `;
          }
          const rows = await sql`
            SELECT id, prayer_enabled, is_admin
            FROM users
            WHERE google_id = ${account.providerAccountId}
          `;
          const u = rows[0];
          token.userId        = u?.id;
          token.prayerEnabled = u?.prayer_enabled ?? false;
          token.isAdmin       = u?.is_admin       ?? false;
        } catch (err) {
          console.error('[auth] jwt DB error:', err?.message ?? err);
          token.dbError = err?.message ?? String(err);
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id             = token.userId;
      session.user.prayerEnabled  = token.prayerEnabled  ?? false;
      session.user.isAdmin        = token.isAdmin         ?? false;
      session.user.dbError        = token.dbError;
      return session;
    },
  },
});
