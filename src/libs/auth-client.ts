'use client';

import { useEffect, useState } from 'react';

import type { SessionUser } from './session';

export type { SessionUser };

export function useAuth() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadUser = async () => {
      try {
        const res = await fetch('/api/auth/user', { cache: 'no-store' });
        const data = res.ok ? await res.json() : null;
        if (!active) return;
        setUser(data);
        setIsLoading(false);
      } catch {
        if (!active) return;
        setUser(null);
        setIsLoading(false);
      }
    };

    loadUser();

    const interval = window.setInterval(loadUser, 10000);

    const handleFocus = () => {
      loadUser();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}

export function signIn() {
  window.location.href = '/api/login';
}

export function signOut() {
  window.location.href = '/api/logout';
}
