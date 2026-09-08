'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

/** Thin wrapper so layout.tsx (a Server Component) doesn't need its own 'use client' — next-auth/react's hooks (useSession, signIn, signOut) all need this ancestor somewhere in the tree. */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
