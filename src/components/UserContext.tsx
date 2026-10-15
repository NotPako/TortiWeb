'use client';

import { signOut as nextSignOut, useSession } from 'next-auth/react';

type UseUserResult = {
  userName: string | null;
  userImage: string | null;
  isReady: boolean;
  needsUsername: boolean;
  signOut: () => void;
};

export function useUser(): UseUserResult {
  const { data, status } = useSession();
  const isReady = status !== 'loading';
  const user = data?.user;
  const needsUsername = Boolean(user?.needsUsername);
  return {
    userName: user && !needsUsername ? user.username : null,
    userImage: user && !needsUsername ? user.image ?? null : null,
    isReady,
    needsUsername,
    signOut: () => nextSignOut({ callbackUrl: '/login' }),
  };
}
