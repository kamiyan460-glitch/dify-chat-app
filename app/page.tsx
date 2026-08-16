'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Message = {
  id: string;
  role: 'user' | 'bot';
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'bot',
      content: 'こんにちは!何でも聞いてください。',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed, conversationId }),
      });

      if (!res.ok) {
        throw new Error('チャットの応答取得に失敗しました');
      }

      const data: { answer: string; conversationId: string } = await res.json();

      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'bot', content: data.answer },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'bot',
          content: 'エラーが発生しました。もう一度お試しください。',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
        <h1 className="text-base font-semibold text-neutral-900 sm:text-lg">
          チャット
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm leading-relaxed sm:text-base ${
                  message.role === 'user'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-900 border border-neutral-200'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-400 sm:text-base">
                入力中...
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      <div className="border-t border-neutral-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力..."
            disabled={isSending}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={isSending || !input.trim()}
            size="icon"
            aria-label="送信"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
