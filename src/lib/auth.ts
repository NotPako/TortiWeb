import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import {
  User,
  normalizeEmail,
  normalizeUsername,
} from '@/models/User';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) return null;
        await connectToDatabase();
        const usernameKey = normalizeUsername(credentials.username);
        const user = await User.findOne({ usernameKey }).exec();
        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!ok) return null;
        return {
          id: (user._id as Types.ObjectId).toString(),
          name: user.username,
          email: user.email,
          image: user.image,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;
      if (!user.email) return false;
      await connectToDatabase();
      const emailKey = normalizeEmail(user.email);
      const existing = await User.findOne({ emailKey }).exec();
      if (existing) {
        // Asegura googleId vinculado a la cuenta existente.
        if (!existing.googleId && account.providerAccountId) {
          existing.googleId = account.providerAccountId;
          if (!existing.image && user.image) existing.image = user.image;
          await existing.save();
        }
        return true;
      }
      // Crea cuenta pendiente de username. Usamos un placeholder único
      // basado en googleId; el usuario lo cambiará en /auth/setup-username.
      const placeholder = `g_${account.providerAccountId}`;
      await User.create({
        username: placeholder,
        usernameKey: placeholder.toLowerCase(),
        email: user.email,
        emailKey,
        googleId: account.providerAccountId,
        image: user.image ?? profile?.image,
      });
      return true;
    },
    async jwt({ token, user, trigger }) {
      // En el primer login o cuando se actualiza la sesión, recargamos de DB.
      if (user || trigger === 'update' || !token.usernameKey) {
        await connectToDatabase();
        const email = (user?.email ?? token.email) as string | undefined;
        if (email) {
          const doc = await User.findOne({
            emailKey: normalizeEmail(email),
          }).exec();
          if (doc) {
            token.userId = (doc._id as Types.ObjectId).toString();
            token.username = doc.username;
            token.usernameKey = doc.usernameKey;
            token.email = doc.email;
            token.needsUsername = doc.usernameKey.startsWith('g_');
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.userId as string;
        session.user.username = token.username as string;
        session.user.usernameKey = token.usernameKey as string;
        session.user.needsUsername = Boolean(token.needsUsername);
        session.user.email = token.email as string;
      }
      return session;
    },
  },
};
