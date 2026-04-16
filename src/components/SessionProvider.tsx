'use client';

import { createContext, useContext } from 'react';

type SessionUser = {
  id: string;
  name?: string | null;
  email: string;
  image?: string | null;
};

type SessionData = {
  user: SessionUser;
  session: {
    id: string;
    expiresAt: Date | string;
    userId: string;
  };
} | null;

const SessionContext = createContext<SessionData>(null);

export function SessionProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: SessionData;
}) {
  return (
    <SessionContext.Provider value={initialSession}>
      {children}
    </SessionContext.Provider>
  );
}

export function useServerSession(): SessionData {
  return useContext(SessionContext);
}
