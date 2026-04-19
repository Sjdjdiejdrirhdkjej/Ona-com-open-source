'use client';

import { useEffect, useState } from 'react';

export type SessionUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
};

export function useAuth() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/user')
      .then(res => (res.ok ? res.json() : null))
      .then((data: SessionUser | null) => {
        setUser(data);
      })
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
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
