'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SERIF = 'Georgia, "Times New Roman", serif';

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string | ContentPart[];
  imagePreview?: string;
};

const SUGGESTIONS = [
  'Weekly digest of changed files',
  'Review open pull requests',
  'Find and fix CVEs in my repos',
  'Migrate a COBOL service to Java',
];

function OnaAvatar() {
  return (
    <div
      className="mr-2.5 mt-1 flex size-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ background: 'linear-gradient(135deg,#7b68ee,#9370db)', flexShrink: 0 }}
    >
      O
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const text = typeof msg.content === 'string'
    ? msg.content
    : msg.content.find(p => p.type === 'text') && (msg.content.find(p => p.type === 'text') as { type: 'text'; text: string }).text || '';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <OnaAvatar />}
      <div className="max-w-[80%] space-y-2">
        {msg.imagePreview && (
          <img
            src={msg.imagePreview}
            alt="Uploaded"
            className="max-h-48 rounded-xl border border-gray-200 object-cover"
          />
        )}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'rounded-tr-sm bg-gray-900 text-white'
              : 'rounded-tl-sm border border-gray-200 text-gray-800'
          }`}
          style={!isUser ? { backgroundColor: '#eceae4' } : {}}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <OnaAvatar />
      <div
        className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-gray-200 px-4 py-3"
        style={{ backgroundColor: '#eceae4' }}
      >
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-gray-400"
            style={{ animation: `pulse 1s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AppPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async (text: string, imageDataUrl?: string) => {
    const trimmed = text.trim();
    if ((!trimmed && !imageDataUrl) || loading) return;

    const userContent: ContentPart[] = [];
    if (trimmed) userContent.push({ type: 'text', text: trimmed });
    if (imageDataUrl) {
      userContent.push({ type: 'image_url', image_url: { url: imageDataUrl } });
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent.length === 1 && userContent[0]!.type === 'text'
        ? trimmed
        : userContent,
      imagePreview: imageDataUrl,
    };

    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setPendingImage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setLoading(true);

    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const { delta } = JSON.parse(data) as { delta: string };
            if (delta) {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: (typeof m.content === 'string' ? m.content : '') + delta }
                    : m,
                ),
              );
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `Something went wrong: ${(err as Error).message}` }
            : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input, pendingImage ?? undefined);
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPendingImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPendingImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  const isEmpty = messages.length === 0;
  const canSend = (input.trim() || pendingImage) && !loading;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages / empty state */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {isEmpty
          ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <h1
                  className="mb-3 text-3xl text-gray-900 sm:text-4xl"
                  style={{ fontFamily: SERIF, fontWeight: 400 }}
                >
                  What should Ona do?
                </h1>
                <p className="mb-8 max-w-sm text-sm text-gray-500">
                  Describe a task and a background agent will execute it end-to-end, then open a pull request.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:border-gray-500 hover:text-gray-950"
                      style={{ backgroundColor: '#f7f6f2' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )
          : (
              <div className="mx-auto max-w-2xl space-y-5">
                {messages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
                {loading && messages.at(-1)?.role !== 'assistant' && <TypingIndicator />}
                <div ref={bottomRef} />
              </div>
            )}
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-gray-200 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-2xl">
          {pendingImage && (
            <div className="mb-2 flex items-center gap-2">
              <img src={pendingImage} alt="Pending upload" className="h-16 rounded-lg border border-gray-200 object-cover" />
              <button
                onClick={() => setPendingImage(null)}
                className="rounded-full p-1 text-gray-400 hover:text-gray-700"
                aria-label="Remove image"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}

          <div
            className="flex items-end gap-2 rounded-2xl border border-gray-300 px-3 py-3 transition-shadow focus-within:border-gray-400 focus-within:shadow-sm"
            style={{ backgroundColor: '#fff' }}
          >
            {/* Image upload button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mb-0.5 flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Attach image"
              title="Attach image"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <circle cx="5.5" cy="6" r="1.25" stroke="currentColor" strokeWidth="1.3" />
                <path d="M1.5 11l3.5-3 2.5 2.5 2-2 4.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={autoResize}
              onKeyDown={handleKey}
              onPaste={handlePaste}
              placeholder="Describe a task for your agent… (paste images too)"
              className="flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
              style={{ maxHeight: '180px' }}
            />

            <button
              onClick={() => send(input, pendingImage ?? undefined)}
              disabled={!canSend}
              aria-label="Send"
              className="mb-0.5 flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-950 text-white transition-opacity hover:opacity-80 disabled:opacity-25"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 12V2M7 2L3 6M7 2L11 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">
            Powered by Llama 4 Maverick on Fireworks AI · Enter to send · paste or
            {' '}
            <button onClick={() => fileInputRef.current?.click()} className="underline hover:text-gray-600">
              upload
            </button>
            {' '}
            images
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.3); opacity: 1; }
        }
      `}
      </style>
    </div>
  );
}
