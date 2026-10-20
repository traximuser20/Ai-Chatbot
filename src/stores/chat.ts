import { defineStore } from 'pinia';
import { ApplicationSettings } from '@nativescript/core';
import type { ChatMessagePayload } from '../services/omni-ai';

export type MessageSender = 'user' | 'ai';

export interface Message {
  text: string;
  sender: MessageSender;
  timestamp: string;
  /** Set when the message carries an error rather than a model reply. */
  isError?: boolean;
  /** Model that produced the reply - lets the UI attribute each answer. */
  model?: string;
}

/** A saved conversation shown in the drawer. */
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Model the conversation was last talking to. */
  model: string;
  messages: Message[];
}

const STORAGE_KEY = 'omniai.conversations.v1';

/**
 * The key the app used before it was renamed. It is read once, so renaming
 * the app never throws away the conversations that are already on the device.
 */
const LEGACY_STORAGE_KEY = 'omniroute.conversations.v1';

/** How many conversations are kept on the device. */
const MAX_CONVERSATIONS = 40;

/**
 * Formats a date as a 12-hour clock time, e.g. "5:19 PM".
 *
 * `Date.prototype.toLocaleTimeString` is NOT used on purpose: the V8 build
 * bundled with Android ignores the `options` argument and the empty-locale
 * array, so it returned the full default string
 * ("17:16:32 GMT+0000 (UTC)") instead of the requested
 * "{ hour: '2-digit', minute: '2-digit' }" format.
 */
export function formatClockTime(date: Date = new Date()): string {
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${suffix}`;
}

/** Formats a timestamp as a short relative label ("now", "12m", "3h", "2d"). */
export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) {
    return 'now';
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h`;
  }
  if (seconds < 604800) {
    return `${Math.floor(seconds / 86400)}d`;
  }
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** Builds a conversation title from the first thing the user said. */
function deriveTitle(text: string): string {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return 'New conversation';
  }
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
}

function makeId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalises a message that came back from storage.
 *
 * The stored JSON is written by an older version of the app (or by a
 * half-finished write), so a message can be missing its text. Everything
 * downstream assumes a string - a single `undefined` would otherwise take the
 * whole UI down when the Markdown parser reads it.
 */
function sanitizeMessage(raw: any): Message {
  return {
    text: typeof raw?.text === 'string' ? raw.text : '',
    sender: raw?.sender === 'user' ? 'user' : 'ai',
    timestamp: typeof raw?.timestamp === 'string' ? raw.timestamp : '',
    isError: !!raw?.isError,
    model: typeof raw?.model === 'string' ? raw.model : undefined,
  };
}

/** Normalises a conversation that came back from storage. */
function sanitizeConversation(raw: any): Conversation {
  const messages = Array.isArray(raw?.messages) ? raw.messages.map(sanitizeMessage) : [];
  return {
    id: typeof raw?.id === 'string' ? raw.id : makeId(),
    title: typeof raw?.title === 'string' && raw.title ? raw.title : 'New conversation',
    createdAt: typeof raw?.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw?.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    model: typeof raw?.model === 'string' ? raw.model : 'auto/best-fast',
    messages,
  };
}

function readStored(): { conversations: Conversation[]; activeId: string | null } {
  try {
    const raw =
      ApplicationSettings.getString(STORAGE_KEY, '') ||
      ApplicationSettings.getString(LEGACY_STORAGE_KEY, '');
    if (!raw) {
      return { conversations: [], activeId: null };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.conversations)) {
      return { conversations: [], activeId: null };
    }
    return {
      conversations: parsed.conversations.map(sanitizeConversation),
      activeId: (parsed.activeId as string) ?? null,
    };
  } catch (err) {
    console.error('Could not read conversations:', err);
    return { conversations: [], activeId: null };
  }
}

const stored = readStored();

export const useChatStore = defineStore('chat', {
  state: () => ({
    /** All saved conversations, newest first. */
    conversations: stored.conversations,
    /** Id of the conversation currently on screen. */
    activeConversationId: stored.activeId,
    isConnected: false,
    isTyping: false,
    /** Model id sent with each request. */
    model: 'auto/best-fast',
  }),
  getters: {
    /** The conversation currently on screen (may be undefined). */
    activeConversation: (state) =>
      state.conversations.find((conversation) => conversation.id === state.activeConversationId),
    /** Messages of the conversation currently on screen. */
    messages(): Message[] {
      return this.activeConversation?.messages ?? [];
    },
    hasMessages(): boolean {
      return this.messages.length > 0;
    },
    /** Total number of messages across every conversation. */
    totalMessages: (state) =>
      state.conversations.reduce((sum, conversation) => sum + conversation.messages.length, 0),
  },
  actions: {
    persist() {
      try {
        ApplicationSettings.setString(
          STORAGE_KEY,
          JSON.stringify({
            conversations: this.conversations.slice(0, MAX_CONVERSATIONS),
            activeId: this.activeConversationId,
          }),
        );
      } catch (err) {
        console.error('Could not save conversations:', err);
      }
    },

    /** Makes sure a conversation exists and is active. */
    ensureActiveConversation(): Conversation {
      let conversation = this.activeConversation;
      if (!conversation) {
        conversation = {
          id: makeId(),
          title: 'New conversation',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: this.model,
          messages: [],
        };
        this.conversations.unshift(conversation);
        this.activeConversationId = conversation.id;
        this.persist();
      }
      return conversation;
    },

    /** Starts a fresh conversation and makes it active. */
    newChat() {
      const conversation: Conversation = {
        id: makeId(),
        title: 'New conversation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: this.model,
        messages: [],
      };
      this.conversations.unshift(conversation);
      this.activeConversationId = conversation.id;
      this.trim();
      this.persist();
    },

    /** Opens a stored conversation. */
    openConversation(id: string) {
      const conversation = this.conversations.find((item) => item.id === id);
      if (!conversation) {
        return;
      }
      this.activeConversationId = id;
      this.model = conversation.model || this.model;
      this.persist();
    },

    /** Deletes a conversation. */
    deleteConversation(id: string) {
      this.conversations = this.conversations.filter((conversation) => conversation.id !== id);
      if (this.activeConversationId === id) {
        this.activeConversationId = this.conversations[0]?.id ?? null;
      }
      this.persist();
    },

    /** Removes every conversation. */
    clearHistory() {
      this.conversations = [];
      this.activeConversationId = null;
      this.persist();
    },

    /** Keeps the list bounded. */
    trim() {
      if (this.conversations.length > MAX_CONVERSATIONS) {
        this.conversations = this.conversations.slice(0, MAX_CONVERSATIONS);
      }
    },

    addMessage(text: string, sender: MessageSender, isError = false) {
      const conversation = this.ensureActiveConversation();
      conversation.messages.push({
        text,
        sender,
        timestamp: formatClockTime(),
        isError,
        model: sender === 'ai' && !isError ? this.model : undefined,
      });
      conversation.updatedAt = Date.now();

      // The title of a conversation is the first thing the user asked.
      if (sender === 'user' && (conversation.title === 'New conversation' || !conversation.title)) {
        conversation.title = deriveTitle(text);
      }

      this.persist();
    },

    setConnectionStatus(status: boolean) {
      this.isConnected = status;
    },
    setTypingStatus(status: boolean) {
      this.isTyping = status;
    },
    setModel(model: string) {
      this.model = model;
      const conversation = this.activeConversation;
      if (conversation) {
        conversation.model = model;
        this.persist();
      }
    },
    clearMessages() {
      const conversation = this.activeConversation;
      if (!conversation) {
        return;
      }
      conversation.messages = [];
      conversation.title = 'New conversation';
      this.persist();
    },
    /**
     * Builds the request payload for the gateway from the visible conversation.
     * The trailing assistant message is dropped because it is the answer the
     * model is about to produce.
     */
    buildHistory(systemPrompt?: string): ChatMessagePayload[] {
      const history: ChatMessagePayload[] = this.messages
        .filter((message) => !message.isError)
        .map((message) => ({
          role: message.sender === 'user' ? ('user' as const) : ('assistant' as const),
          content: message.text,
        }));

      // Drop a trailing assistant reply - it would be duplicated by the
      // answer we are about to request.
      if (history.length && history[history.length - 1].role === 'assistant') {
        history.pop();
      }

      if (systemPrompt) {
        history.unshift({ role: 'system', content: systemPrompt });
      }

      return history;
    },
  },
});
