import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

const googleConfigured =
  Boolean(process.env.AUTH_GOOGLE_ID) && Boolean(process.env.AUTH_GOOGLE_SECRET);

const isProd = process.env.NODE_ENV === "production";
/** During `next build`, NODE_ENV is production but we still need a provider so the auth route can be compiled. */
const isNextProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
const useDevCredentials =
  !googleConfigured && (!isProd || isNextProductionBuild);

const devCredentials = useDevCredentials
    ? [
        Credentials({
          id: "dev-email",
          name: "Dev sign-in (local only)",
          credentials: {
            email: { label: "Email", type: "text" },
          },
          authorize(creds) {
            if (isProd && !isNextProductionBuild) {
              return null;
            }
            const email = typeof creds?.email === "string" ? creds.email.trim() : "";
            if (!email || !email.includes("@")) return null;
            return {
              id: `dev:${email}`,
              email,
              name: "Local dev user",
            };
          },
        }),
      ]
    : [];

/** Auth.js requires a secret for cookies/JWT (`MissingSecret` → “server configuration” error on /api/auth/signin). */
function authSecret(): string {
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv) return fromEnv;
  if (!isProd) {
    return "local-dev-auth-secret-min-32-characters-long!";
  }
  if (isNextProductionBuild) {
    return "build-time-auth-secret-not-used-at-runtime";
  }
  throw new Error(
    "AUTH_SECRET is required in production. Generate one: npx auth secret  (or openssl rand -base64 32)",
  );
}

const providers = [
  ...(googleConfigured
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID!,
          clientSecret: process.env.AUTH_GOOGLE_SECRET!,
        }),
      ]
    : []),
  ...devCredentials,
];

if (providers.length === 0) {
  throw new Error(
    "No auth providers configured. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or run in development for Dev email sign-in.",
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  secret: authSecret(),
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account, user }) {
      if (account?.providerAccountId) {
        token.sub = account.providerAccountId;
      } else if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string) ?? "";
      }
      return session;
    },
  },
});
