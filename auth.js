import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import sql, { initDb } from './lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: '/', error: '/' },
  callbacks: {
    async signIn({ user, account }) {
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

    async jwt({ token, account, profile }) {
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
