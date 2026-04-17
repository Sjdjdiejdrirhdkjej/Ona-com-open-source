'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type GitHubUser = {
  login: string;
  name?: string | null;
  avatar_url?: string;
};

type Status =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'pending'; deviceCode: string; userCode: string; verificationUri: string; interval: number }
  | { type: 'connected'; user: GitHubUser }
  | { type: 'error'; message: string };

export function GitHubConnect() {
  const [status, setStatus] = useState<Status>({ type: 'loading' });
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);

  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/github/status');
      if (!res.ok) { setStatus({ type: 'idle' }); return; }
      const data = await res.json() as { configured: boolean; connected: boolean; user?: GitHubUser };
      if (!data.configured) { setStatus({ type: 'idle' }); return; }
      if (data.connected && data.user) {
        setStatus({ type: 'connected', user: data.user });
      } else {
        setStatus({ type: 'idle' });
      }
    } catch {
      setStatus({ type: 'idle' });
    }
  }, []);

  useEffect(() => {
    checkConnection();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [checkConnection]);

  function stopPolling() {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
  }

  async function startDeviceFlow() {
    setStatus({ type: 'loading' });
    try {
      const res = await fetch('/api/github/device/start', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start');
      const data = await res.json() as {
        device_code: string;
        user_code: string;
        verification_uri: string;
        interval: number;
      };
      setStatus({
        type: 'pending',
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        interval: data.interval,
      });
      schedulePoll(data.device_code, data.interval);
    } catch {
      setStatus({ type: 'error', message: 'Could not reach GitHub. Try again.' });
    }
  }

  function schedulePoll(deviceCode: string, interval: number) {
    pollRef.current = setTimeout(() => doPoll(deviceCode, interval), interval * 1000);
  }

  async function doPoll(deviceCode: string, interval: number) {
    try {
      const res = await fetch('/api/github/device/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_code: deviceCode }),
      });
      const data = await res.json() as { status: string; error?: string };
      if (data.status === 'authorized') {
        stopPolling();
        await checkConnection();
      } else if (data.status === 'slow_down') {
        schedulePoll(deviceCode, interval + 5);
      } else if (data.status === 'authorization_pending') {
        schedulePoll(deviceCode, interval);
      } else {
        stopPolling();
        setStatus({ type: 'error', message: data.error ?? 'Authorization failed.' });
      }
    } catch {
      schedulePoll(deviceCode, interval);
    }
  }

  async function disconnect() {
    stopPolling();
    await fetch('/api/github/device/disconnect', { method: 'POST' });
    setStatus({ type: 'idle' });
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (status.type === 'loading') {
    return (
      <div className="flex items-center gap-2 px-1 py-1">
        <div className="size-3.5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
        <span className="text-xs text-gray-400">Checking GitHub…</span>
      </div>
    );
  }

  if (status.type === 'connected') {
    return (
      <div className="flex items-center gap-2">
        {status.user.avatar_url
          ? <img src={status.user.avatar_url} alt="" className="size-5 rounded-full" />
          : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600 dark:text-gray-400">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
            )}
        <span className="flex-1 truncate text-xs text-gray-700 dark:text-gray-300">
          {status.user.name ?? status.user.login}
        </span>
        <button
          onClick={disconnect}
          className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          title="Disconnect GitHub"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (status.type === 'pending') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Waiting for GitHub…</span>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2">
          <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Enter this code at GitHub:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono font-bold tracking-widest text-gray-900 dark:text-gray-100">
              {status.userCode}
            </code>
            <button
              onClick={() => copyCode(status.userCode)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
        <a
          href={status.verificationUri}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Open GitHub
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 8L8 2M8 2H4M8 2v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <button
          onClick={() => { stopPolling(); setStatus({ type: 'idle' }); }}
          className="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (status.type === 'error') {
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-red-500">{status.message}</p>
        <button
          onClick={startDeviceFlow}
          className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startDeviceFlow}
      className="flex w-full items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 transition-colors hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
      style={{ backgroundColor: 'var(--bg-card)' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
      Connect GitHub
    </button>
  );
}
