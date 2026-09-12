import type { NextAuthOptions } from 'next-auth'
export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: 'authentik',
      name: 'Authentik',
      type: 'oauth',
      wellKnown: `${process.env.AUTHENTIK_ISSUER}.well-known/openid-configuration`,
      authorization: { params: { scope: 'openid email profile' } },
      idToken: true,
      checks: ['pkce', 'state'],
      clientId: process.env.AUTHENTIK_CLIENT_ID,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET,
      profile(profile) {
        return { id: profile.sub, name: profile.name ?? profile.preferred_username, email: profile.email, image: profile.picture ?? null }
      },
    },
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, account }) { if (account) token.accessToken = account.access_token; return token },
    async session({ session }) { return session },
  },
  pages: { signIn: '/login' },
}
