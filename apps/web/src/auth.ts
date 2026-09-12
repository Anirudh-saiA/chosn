import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import { authDb } from './lib/auth/db';
import { hashPassword, verifyPassword } from './lib/auth/password';
import { accounts, sessions, users, verificationTokens } from './lib/auth/schema';
import { isTotpEnabled, verifyTotpForLogin } from './lib/auth/totp';
import { signApiToken } from './lib/auth/api-token';
import { reconcileLegacyRecords } from './lib/auth/reconcile';
import { clientIp, slidingWindowRateLimit } from './lib/auth/rate-limit';
import { isRevoked } from './lib/auth/session-revocation';

/** Thrown from `authorize()` when a password is correct but the account has TOTP enabled and no valid code was supplied — the login page checks for this specific code to show a second step, not a generic "wrong password." */
class TotpRequiredError extends CredentialsSignin {
  code = 'totp_required';
}

/** Thrown before any password check even runs — task 4, per-IP and per-account, both checked here since `authorize()`'s second argument gives access to the original request (Auth.js v5's own `authorize(credentials, request)` contract). */
class RateLimitedError extends CredentialsSignin {
  code = 'rate_limited';
}

const LOGIN_IP_LIMIT = { limit: 20, windowSeconds: 5 * 60 }; // 20 attempts/5min per IP — covers a person mistyping several times, not a bot spraying credentials
const LOGIN_ACCOUNT_LIMIT = { limit: 8, windowSeconds: 15 * 60 }; // tighter per-account — this is what actually stops credential stuffing against one target email regardless of how many IPs it comes from

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Day 27 real bug found setting up staging: Auth.js v5 refuses to
  // operate on a host it doesn't already know (a deliberate guard
  // against host-header spoofing) unless explicitly told to trust the
  // incoming request's Host header — confirmed by actually hitting
  // /api/auth/session on a real deployment and getting back
  // "There was a problem with the server configuration" until this was
  // added, not assumed from the docs. Production got away without it
  // because AUTH_URL/its own fixed domain happened to satisfy the
  // check; a Vercel Preview deployment's URL changes per-branch
  // (chosn-web-git-<branch>-*.vercel.app) and has no single fixed value
  // to hardcode. Safe here specifically because both Vercel's
  // production and preview domains are Vercel-controlled and verified
  // via its own deployment system — this isn't trusting an arbitrary
  // client-supplied header the way it would be on a self-hosted origin
  // with no platform-level domain verification in front of it.
  trustHost: true,
  adapter: DrizzleAdapter(authDb, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // JWT, not "database" — not a free choice: Auth.js's Credentials
  // provider requires it (`session.strategy: 'database'` throws
  // `UnsupportedStrategy` at request time, hit for real while testing
  // this, not found by reading the docs first — the `sessions` table
  // this schema still creates exists for the Drizzle adapter's OAuth
  // flows, not for storing these sessions). The httpOnly/secure/
  // sameSite cookie itself still holds only an *encrypted, signed*
  // token, never a plain user id — Auth.js's own default JWE encoding
  // — and updateAge below rolls it forward on activity, the same
  // "stays alive while used, expires if abandoned" shape a refresh
  // token gives you. What JWT strategy genuinely doesn't give you for
  // free is server-side revocation (no row to delete) — `isRevoked`
  // below is what restores that, backed by Redis instead of Postgres.
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  providers: [
    // Conditional, not unconditionally listed — same no-op-until-
    // configured convention as RESEND_API_KEY/retailer credentials
    // elsewhere in this project: AUTH_GOOGLE_ID/SECRET (auto-inferred
    // by provider name) require a real Google Cloud Console OAuth app,
    // which needs the user's own account to create — see this repo's
    // README/.env.example. Without them, Google sign-in simply doesn't
    // appear as an option rather than crashing every request; email/
    // password keeps working regardless.
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google] : []),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totpCode: { label: 'Authenticator code', type: 'text' },
      },
      async authorize(raw, request) {
        const email = String(raw?.email ?? '').toLowerCase().trim();
        const password = String(raw?.password ?? '');
        const totpCode = raw?.totpCode ? String(raw.totpCode) : undefined;
        if (!email || !password) return null;

        const ip = clientIp(request.headers);
        const [ipCheck, accountCheck] = await Promise.all([
          slidingWindowRateLimit(`login:ip:${ip}`, LOGIN_IP_LIMIT.limit, LOGIN_IP_LIMIT.windowSeconds),
          slidingWindowRateLimit(`login:account:${email}`, LOGIN_ACCOUNT_LIMIT.limit, LOGIN_ACCOUNT_LIMIT.windowSeconds),
        ]);
        if (!ipCheck.allowed || !accountCheck.allowed) throw new RateLimitedError();

        const [user] = await authDb.select().from(users).where(eq(users.email, email)).limit(1);
        // Same response shape whether the email doesn't exist or the
        // password is wrong — a differing error here is a user-
        // enumeration oracle, exactly the kind of thing task 9's audit
        // looks for, so it's closed from the start rather than found
        // and patched later.
        if (!user || !user.passwordHash) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;

        if (await isTotpEnabled(user.id)) {
          if (!totpCode) throw new TotpRequiredError();
          const valid = await verifyTotpForLogin(user.id, user.email, totpCode);
          if (!valid) throw new TotpRequiredError(); // wrong code reads the same as "not entered yet" — no oracle for "right password, wrong 2FA" either
        }

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  callbacks: {
    // Runs on every request that touches the session. `user` is only
    // populated on the initial sign-in (Auth.js's own JWT-strategy
    // contract) — everything this app needs later has to be copied
    // onto `token` here, since that's what persists request to
    // request; `session()` below only ever sees `token`, never `user`,
    // after the first call.
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id; // sub is already the user id by default, kept explicit since revocation checks it below

        // Day 17 — fetched once here, at sign-in, not on every request:
        // this token is only re-minted every `updateAge` (24h) under
        // JWT strategy, so a role change takes up to that long to
        // reach the *session* (UI-only convenience — the Admin nav
        // link, redirecting a non-admin away from /admin/moderation).
        // The actual security boundary is apps/api's AdminGuard, which
        // re-checks role from Postgres on every single admin request —
        // see that guard's own comment for why the two deliberately
        // don't share a staleness window.
        const [row] = await authDb
          .select({ role: users.role, displayName: users.displayName, avatarSeed: users.avatarSeed })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        if (row) {
          token.role = row.role;
          token.displayName = row.displayName;
          token.avatarSeed = row.avatarSeed;
        }
      }

      if (token.sub) {
        // Checked on every request, not just sign-in — this is the
        // actual enforcement point for revokeAllSessions(). A token
        // issued before the user's last "sign out everywhere"/
        // password change is rejected here regardless of its own
        // `exp`; returning `null` invalidates the session immediately.
        const revoked = token.iat ? await isRevoked(token.sub, token.iat) : false;
        if (revoked) return null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as typeof session.user & { id: string }).id = token.sub;
        (session.user as typeof session.user & { role?: string }).role = token.role as string | undefined;
        (session.user as typeof session.user & { displayName?: string | null }).displayName = token.displayName as
          | string
          | null
          | undefined;
        (session.user as typeof session.user & { avatarSeed?: string }).avatarSeed = token.avatarSeed as
          | string
          | undefined;
      }
      // Minted fresh every call — see the session-strategy comment
      // above. 15 minutes: long enough to cover a normal burst of API
      // calls a page load makes, short enough that a leaked token
      // (XSS, a logged request) is only ever useful for a few minutes,
      // not indefinitely.
      if (token.sub && session.user?.email) {
        (session as typeof session & { apiToken: string }).apiToken = signApiToken(token.sub, session.user.email);
      }
      return session;
    },
  },
  events: {
    // Runs on every successful sign-in, credentials or OAuth alike —
    // idempotent (the WHERE clauses only ever touch not-yet-linked
    // rows), so there's no separate one-time migration job to run and
    // no risk of double-linking. Day 16 task 3, done the way the brief
    // itself frames it: "link... on first real login."
    async signIn({ user }) {
      if (user.id && user.email) await reconcileLegacyRecords(user.id, user.email);
    },
  },
  pages: {
    signIn: '/login',
  },
});

export async function createAccount(email: string, password: string, name?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.toLowerCase().trim();
  const [existing] = await authDb.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
  if (existing) return { ok: false, error: 'An account with that email already exists.' };

  const passwordHash = await hashPassword(password);
  await authDb.insert(users).values({ email: normalized, name, passwordHash });
  return { ok: true };
}
