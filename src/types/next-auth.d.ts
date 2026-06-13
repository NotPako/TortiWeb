import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string;
      usernameKey: string;
      email: string;
      needsUsername: boolean;
      role: 'user' | 'admin';
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    username?: string;
    usernameKey?: string;
    needsUsername?: boolean;
    role?: 'user' | 'admin';
  }
}
