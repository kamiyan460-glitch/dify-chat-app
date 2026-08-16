export type ChatMessage = {
  id: string;
  role: 'user' | 'bot';
  content: string;
};

export type Conversation = {
  id: string;
  title: string;
  conversationId: string;
  messages: ChatMessage[];
  updatedAt: number;
};

const STORAGE_KEY = 'chat-history-v1';

function readAll(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

function writeAll(conversations: Conversation[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

export function getConversations(): Conversation[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(id: string): Conversation | undefined {
  return readAll().find((c) => c.id === id);
}

export function saveConversation(conversation: Conversation) {
  const all = readAll();
  const index = all.findIndex((c) => c.id === conversation.id);
  if (index >= 0) {
    all[index] = conversation;
  } else {
    all.push(conversation);
  }
  writeAll(all);
}

export function deleteConversation(id: string) {
  writeAll(readAll().filter((c) => c.id !== id));
}

export function makeTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim();
  return trimmed.length > 30 ? `${trimmed.slice(0, 30)}…` : trimmed || '新しいチャット';
}
