'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type EnvVar = { key: string; value: string; id: string };

const STORAGE_KEY = (sandboxId: string) => `sandbox_env_vars_${sandboxId}`;

function loadEnvVars(sandboxId: string): EnvVar[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(sandboxId));
    if (!raw) return [];
    return JSON.parse(raw) as EnvVar[];
  } catch {
    return [];
  }
}

function saveEnvVars(sandboxId: string, vars: EnvVar[]) {
  localStorage.setItem(STORAGE_KEY(sandboxId), JSON.stringify(vars));
}

export default function SandboxModifyPage() {
  const params = useParams();
  const sandboxId = typeof params.sandboxId === 'string' ? params.sandboxId : Array.isArray(params.sandboxId) ? params.sandboxId[0] : '';

  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (sandboxId) {
      setEnvVars(loadEnvVars(sandboxId));
    }
  }, [sandboxId]);

  function addRow() {
    setEnvVars(prev => [...prev, { key: '', value: '', id: crypto.randomUUID() }]);
    setSaved(false);
  }

  function updateRow(id: string, field: 'key' | 'value', val: string) {
    setEnvVars(prev => prev.map(v => v.id === id ? { ...v, [field]: val } : v));
    setSaved(false);
  }

  function removeRow(id: string) {
    setEnvVars(prev => prev.filter(v => v.id !== id));
    setSaved(false);
  }

  function handleSave() {
    const filtered = envVars.filter(v => v.key.trim());
    saveEnvVars(sandboxId, filtered);
    setEnvVars(filtered);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: 'var(--bg, #f9fafb)' }}
    >
      <header
        className="flex h-14 shrink-0 items-center justify-between border-b border-black/8 dark:border-white/8 px-6"
        style={{ backgroundColor: 'var(--bg-header, #fff)', backdropFilter: 'blur(14px)' }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-gray-100"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to app
          </Link>
          <span className="text-gray-300 dark:text-gray-700">/</span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Sandbox environment</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100">Modify sandbox VM</h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            Set environment variables that will be available to the AI agent inside this sandbox.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 text-gray-400">
              <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 5.5l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate">Sandbox ID: {sandboxId}</span>
          </div>
        </div>

        <div
          className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          style={{ backgroundColor: 'var(--bg-card, #fff)' }}
        >
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-3.5">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Environment variables</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">{envVars.filter(v => v.key.trim()).length} var{envVars.filter(v => v.key.trim()).length !== 1 ? 's' : ''}</span>
          </div>

          {envVars.length === 0
            ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <div className="flex size-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-gray-400 dark:text-gray-500">
                      <rect x="2" y="5" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M6 5V4a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      <circle cx="9" cy="9.5" r="1" fill="currentColor" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">No environment variables yet</p>
                  <button
                    onClick={addRow}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 px-3.5 py-2 text-sm text-gray-600 dark:text-gray-400 transition-colors hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    Add first variable
                  </button>
                </div>
              )
            : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {envVars.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 px-4 py-2.5">
                      <input
                        type="text"
                        placeholder="KEY"
                        value={v.key}
                        onChange={e => updateRow(v.id, 'key', e.target.value)}
                        className="w-36 shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2.5 py-1.5 font-mono text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-indigo-400 dark:focus:border-indigo-600 transition-colors"
                      />
                      <span className="shrink-0 text-xs text-gray-400 dark:text-gray-600">=</span>
                      <input
                        type="text"
                        placeholder="value"
                        value={v.value}
                        onChange={e => updateRow(v.id, 'value', e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2.5 py-1.5 font-mono text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-indigo-400 dark:focus:border-indigo-600 transition-colors"
                      />
                      <button
                        onClick={() => removeRow(v.id)}
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-gray-400 dark:text-gray-600 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
                        aria-label="Remove"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

          <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3">
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-gray-100"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Add variable
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Variables are stored locally and injected into the sandbox when the AI runs commands.
          </p>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80 active:opacity-70"
          >
            {saved
              ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Saved
                  </>
                )
              : 'Save'}
          </button>
        </div>
      </main>
    </div>
  );
}
