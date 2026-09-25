import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { supabaseAdmin } from './supabase';
import type { Role } from '@/types';

const ALLOWED_DOMAIN   = process.env.ALLOWED_EMAIL_DOMAIN || 'iiitbh.ac.in';
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL    || 'balajimmishra@gmail.com';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      const email = user.email || '';

      // Superadmin: allow any Gmail
      if (email === SUPERADMIN_EMAIL) return true;

      // Everyone else must be on college domain
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return '/auth/error?error=unauthorized_domain';
      }

      // Check whitelist / auto-register first-time users
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, is_active, profile_completed, verification_status')
        .eq('email', email)
        .single();

      if (error && error.code === 'PGRST116') {
        // New user — create pending record
        await supabaseAdmin.from('users').insert({
          email,
          name: user.name || email.split('@')[0],
          role: 'student', // default, they pick during profile setup
          is_active: true,
          profile_completed: false,
          is_verified: false,
          verification_status: 'pending',
        });
        return true;
      }

      if (error) return '/auth/error?error=server_error';
      if (!data?.is_active) return '/auth/error?error=account_disabled';

      return true;
    },

    async jwt({ token, user, trigger }) {
      if (user?.email || trigger === 'update') {
        const email = user?.email || token.email;
        if (!email) return token;

        if (email === SUPERADMIN_EMAIL) {
          // Ensure admin exists in DB
          const { data } = await supabaseAdmin.from('users')
            .select('id').eq('email', email).single();
          if (!data) {
            const { data: created } = await supabaseAdmin.from('users').insert({
              email, name: 'Administrator', role: 'superadmin',
              is_active: true, profile_completed: true,
              is_verified: true, verification_status: 'approved',
            }).select().single();
            token.userId = created?.id;
          } else {
            token.userId = data.id;
          }
          token.role = 'superadmin' as Role;
          token.profileCompleted = true;
          
          token.profileCompleted = true;
          token.verificationStatus = 'approved';
          token.isActive = true;
          return token;
        }

        const { data } = await supabaseAdmin.from('users')
          .select('id, role, name, profile_completed, verification_status, profile_photo_url, is_active')
          .eq('email', email).single();

        if (data) {
          token.role = data.role as Role;
          token.userId = data.id;
          token.name = data.name;
          token.profileCompleted = data.profile_completed;
          token.verificationStatus = data.verification_status;
          
          token.profilePhotoUrl = data.profile_photo_url;
          token.isActive = data.is_active;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.role               = token.role as Role;
        session.user.userId             = token.userId as string;
        session.user.profileCompleted   = token.profileCompleted as boolean;
        session.user.verificationStatus = token.verificationStatus as string;
        
        session.user.profilePhotoUrl    = token.profilePhotoUrl as string;
        session.user.isActive           = token.isActive as boolean;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      return url.startsWith(baseUrl) ? url : baseUrl;
    },
  },

  pages: {
    signIn: '/auth/login',
    error:  '/auth/error',
  },

  session: { 
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || 'fallback_secret_if_not_provided_in_env_though_it_should_be',
};

export default NextAuth(authOptions);
