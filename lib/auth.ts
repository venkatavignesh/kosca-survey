import type { NextAuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './db';
import { verifyPassword } from './password';
import { Role } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      mustChangePassword: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    mustChangePassword: boolean;
    pwChangedAt?: number;
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  // next-auth v4 already trusts the incoming Host header when NEXTAUTH_URL is
  // unset, so the same deployment serves both http://<lan-ip>:3002 and
  // https://survey.zycadus.com without an explicit `trustHost` flag (that
  // option only exists in Auth.js v5).
  // We serve over plain HTTP on the LAN (192.168.2.222:3002) AND over HTTPS
  // through the Cloudflare tunnel. Browsers refuse `Secure` cookies on HTTP,
  // so forcing useSecureCookies=true would silently break LAN login. Disable
  // it so the same cookie format works on both. HttpOnly + SameSite=Lax
  // remain in place; the only thing we give up is the Secure flag.
  useSecureCookies: false,
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          pwChangedAt: user.passwordChangedAt?.getTime(),
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.mustChangePassword = (user as any).mustChangePassword;
        token.pwChangedAt = (user as any).pwChangedAt;
      }
      // refresh from DB on update or every request to keep mustChangePassword fresh
      if (trigger === 'update' || token.id) {
        const fresh = await prisma.user.findUnique({ where: { id: token.id as string } });
        if (fresh) {
          token.role = fresh.role;
          token.mustChangePassword = fresh.mustChangePassword;
          token.pwChangedAt = fresh.passwordChangedAt?.getTime();
          token.name = fresh.name;
          token.email = fresh.email;
        } else {
          // user deleted
          return {} as JWT;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.mustChangePassword = !!token.mustChangePassword;
      }
      return session;
    },
  },
};

export async function getSession(): Promise<Session | null> {
  const { getServerSession } = await import('next-auth');
  return getServerSession(authOptions);
}
