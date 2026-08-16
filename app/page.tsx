'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Menu,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  type ChatMessage,
  type Conversation,
  deleteConversation,
  getConversation,
  getConversations,
  makeTitle,
  saveConversation,
} from '@/lib/chat-history';

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'bot',
  content: 'こんにちは!何でも聞いてください。',
};

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState('');
  const [activeConversationId, setActiveConversationId] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeConversationIdRef = useRef(activeConversationId);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    setActiveConversationId(crypto.randomUUID());
    setConversations(getConversations());
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const persistConversation = (msgs: ChatMessage[], convId: string) => {
    const firstUser = msgs.find((m) => m.role === 'user');
    if (!firstUser) return;
    const conversation: Conversation = {
      id: activeConversationIdRef.current,
      title: makeTitle(firstUser.content),
      conversationId: convId,
      messages: msgs,
      updatedAt: Date.now(),
    };
    saveConversation(conversation);
    setConversations(getConversations());
  };

  const streamBotResponse = async (query: string) => {
    setIsSending(true);
    const botMessageId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: botMessageId, role: 'bot', content: '' }]);

    let botContent = '';
    let finalConversationId = conversationId;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, conversationId }),
      });

      if (!res.ok || !res.body) {
        throw new Error('チャットの応答取得に失敗しました');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'));
          if (!dataLine) continue;
          const jsonStr = dataLine.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const payload = JSON.parse(jsonStr);
            if (payload.event === 'message' && typeof payload.answer === 'string') {
              botContent += payload.answer;
              const snapshot = botContent;
              setMessages((prev) =>
                prev.map((m) => (m.id === botMessageId ? { ...m, content: snapshot } : m))
              );
            } else if (payload.event === 'message_end' && payload.conversation_id) {
              finalConversationId = payload.conversation_id;
            }
          } catch {
            // 不完全なチャンクは無視
          }
        }
      }

      if (!botContent) {
        throw new Error('チャットの応答取得に失敗しました');
      }

      setConversationId(finalConversationId);
      setMessages((prev) => {
        persistConversation(prev, finalConversationId);
        return prev;
      });
    } catch {
      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === botMessageId
            ? { ...m, content: 'エラーが発生しました。もう一度お試しください。' }
            : m
        );
        persistConversation(next, finalConversationId);
        return next;
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setInput('');
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    await streamBotResponse(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setActiveConversationId(crypto.randomUUID());
    setConversationId('');
    setMessages([WELCOME_MESSAGE]);
    setEditingId(null);
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    const conv = getConversation(id);
    if (!conv) return;
    setActiveConversationId(conv.id);
    setConversationId(conv.conversationId);
    setMessages(conv.messages);
    setEditingId(null);
    setSidebarOpen(false);
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    deleteConversation(pendingDeleteId);
    setConversations(getConversations());
    if (pendingDeleteId === activeConversationId) {
      handleNewChat();
    }
    setPendingDeleteId(null);
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('コピーしました');
    } catch {
      toast.error('コピーに失敗しました');
    }
  };

  const startEdit = (message: ChatMessage) => {
    setEditingId(message.id);
    setEditValue(message.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const confirmEdit = async () => {
    const trimmed = editValue.trim();
    if (!trimmed || !editingId || isSending) return;

    const index = messages.findIndex((m) => m.id === editingId);
    if (index === -1) return;

    const truncated = messages.slice(0, index);
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    setMessages([...truncated, userMessage]);
    setEditingId(null);
    setEditValue('');
    await streamBotResponse(trimmed);
  };

  const handleRegenerate = async (botMessageId: string) => {
    if (isSending) return;
    const index = messages.findIndex((m) => m.id === botMessageId);
    if (index <= 0) return;
    const userMessage = messages[index - 1];
    if (userMessage.role !== 'user') return;

    setMessages(messages.slice(0, index));
    await streamBotResponse(userMessage.content);
  };

  return (
    <div className="flex h-dvh flex-col bg-neutral-50">
      <header className="flex items-center gap-2 border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          aria-label="会話履歴を開く"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold text-neutral-900 sm:text-lg">
          チャット
        </h1>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-1"
          onClick={handleNewChat}
        >
          <Plus className="h-4 w-4" />
          新規チャット
        </Button>
      </header>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="flex w-3/4 flex-col sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>会話履歴</SheetTitle>
          </SheetHeader>
          <ScrollArea className="mt-4 flex-1">
            <div className="flex flex-col gap-1 pr-2">
              {conversations.length === 0 && (
                <p className="px-2 py-4 text-sm text-neutral-400">
                  まだ会話履歴がありません。
                </p>
              )}
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    'group flex items-center gap-1 rounded-lg px-2 py-2 text-left hover:bg-neutral-100',
                    conv.id === activeConversationId && 'bg-neutral-100'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectConversation(conv.id)}
                    className="flex-1 truncate text-sm text-neutral-800"
                  >
                    {conv.title}
                  </button>
                  <button
                    type="button"
                    aria-label="削除"
                    onClick={() => setPendingDeleteId(conv.id)}
                    className="rounded p-1 text-neutral-400 opacity-0 hover:bg-neutral-200 hover:text-neutral-700 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この会話を削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。会話履歴が完全に削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.map((message) => {
            const isUser = message.role === 'user';
            const isEditing = editingId === message.id;

            return (
              <div key={message.id} className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
                {isEditing ? (
                  <div className="flex w-full max-w-[80%] flex-col gap-2">
                    <Textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="text-sm sm:text-base"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={cancelEdit}>
                        <X className="mr-1 h-4 w-4" />
                        キャンセル
                      </Button>
                      <Button size="sm" onClick={confirmEdit} disabled={!editValue.trim() || isSending}>
                        <Check className="mr-1 h-4 w-4" />
                        送信
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className={cn(
                        'max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm leading-relaxed sm:text-base',
                        isUser
                          ? 'bg-neutral-900 text-white'
                          : 'border border-neutral-200 bg-white text-neutral-900'
                      )}
                    >
                      {message.content}
                    </div>
                    <div className="mt-1 flex gap-1">
                      <button
                        type="button"
                        aria-label="コピー"
                        onClick={() => handleCopy(message.content)}
                        className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {isUser && (
                        <button
                          type="button"
                          aria-label="編集"
                          onClick={() => startEdit(message)}
                          disabled={isSending}
                          className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-40"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {!isUser && message.id !== 'welcome' && (
                        <button
                          type="button"
                          aria-label="再生成"
                          onClick={() => handleRegenerate(message.id)}
                          disabled={isSending}
                          className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-40"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}

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
